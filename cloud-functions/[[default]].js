// Cloud Function（EdgeOne Makers Node.js 运行时）—— server-handler 入口
// 文件：cloud-functions/[[default]].js（仓库根级，必须提交进仓库）
//
// ⚠️ 这个文件是 Makers 启用 Node 函数的「server-handler」：平台检出仓库时扫描它
// 来决定是否启用 Node 函数，缺失会把项目降级为纯静态站——那时所有函数目录都被
// 忽略，/api/* 请求全部落到 SPA 静态回退返回 index.html，前端 fetch().json()
// 解析 HTML 即报 Unexpected token '<'。（本排错前三轮全部栽在这一条：
// cloud-functions 缺根级入口 / node-functions 目录名不存在 / edge-functions 未注册。）
//
// 路由（[[default]] 为通配 handler，优先级低于精确静态路由与精确函数路由）：
//   POST /api/github-oauth  用 code 换 access_token（服务端持 client_secret）
//   GET  /api/ping-github   出网探针（兼作「函数是否真的部署」探针）
//   其它路径 + Accept: text/html → 返回 SPA 入口页（前端路由兜底）
//   其它路径                  → JSON 404
// 精确静态路由（/ 、/assets/* 、/favicon.svg 等）优先级更高，仍由静态层直接服务。
//
// 环境变量（EdgeOne 控制台 项目设置→环境变量，函数内经 context.env / process.env
// 读取，不加 VITE_ 前缀，只存在服务端、不会打进前端产物）：
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET
// 前端对应：VITE_OAUTH_WORKER_URL = /api/github-oauth

const TOKEN_URL = 'https://github.com/login/oauth/access_token'
const UPSTREAM_TIMEOUT_MS = 15000

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

// Makers 运行时把项目环境变量挂在 context.env 上；Node 运行时另注入 process.env，一并兜住
function readEnv(context, key) {
  const fromContext = context && context.env ? context.env[key] : ''
  if (fromContext) return fromContext
  if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
    return process.env[key]
  }
  return ''
}

// ---- POST /api/github-oauth：code 换 token ----
async function handleOAuth(context) {
  const request = context.request

  const clientId = readEnv(context, 'GITHUB_CLIENT_ID')
  const clientSecret = readEnv(context, 'GITHUB_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    return json({ error: '服务端未配置 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET' }, 500)
  }

  let code = ''
  try {
    const body = await request.json()
    code = body && body.code
  } catch {
    return json({ error: '请求体不是合法 JSON' }, 400)
  }
  if (!code || typeof code !== 'string') {
    return json({ error: '缺少 code 参数' }, 400)
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'edgeone-makers-oauth'
      },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
      signal: ac.signal
    })

    const data = await upstream.json().catch(() => ({}))

    // 前端 exchangeToken() 读 JSON 的 error 字段作为提示文案
    if (!upstream.ok || !data.access_token) {
      return json(
        { error: data.error_description || data.error || 'GitHub 拒绝了本次授权' },
        upstream.ok ? 400 : upstream.status
      )
    }

    // 原样透传 { access_token, scope, token_type }，绝不带 client_secret 回去
    return json(data, 200)
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? '请求 GitHub 超时' : (e && e.message) || String(e)
    return json({ error: `请求 GitHub 失败：${msg}` }, 502)
  } finally {
    clearTimeout(timer)
  }
}

// ---- /api/ping-github：出网探针 ----
async function handlePing() {
  const started = Date.now()
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    // 故意用无效 code：能拿到任何 HTTP 响应就证明链路是通的
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'edgeone-makers-probe'
      },
      body: JSON.stringify({ client_id: 'probe', client_secret: 'probe', code: 'probe' }),
      signal: ac.signal
    })
    const text = await res.text()
    clearTimeout(timer)

    return json({
      ok: true,
      message: 'Node 函数已部署且出网到 GitHub 正常',
      upstreamStatus: res.status,
      elapsedMs: Date.now() - started,
      upstreamBody: text.slice(0, 200)
    })
  } catch (e) {
    clearTimeout(timer)
    const msg =
      e && e.name === 'AbortError'
        ? `超过 ${UPSTREAM_TIMEOUT_MS}ms 未响应`
        : (e && e.message) || String(e)
    return json(
      {
        ok: false,
        message: '函数连不上 GitHub，该地域出网受限',
        error: msg,
        elapsedMs: Date.now() - started
      },
      502
    )
  }
}

// ---- SPA 入口兜底：浏览器导航请求返回 index.html ----
// 通配函数可能拦下未命中精确静态路由的前端路由（如 /callback），
// 此时自取同域 /index.html（精确静态路径，不会形成回环）把页面壳交还给前端。
async function handleSpaShell(context) {
  try {
    const origin = new URL(context.request.url).origin
    const res = await fetch(`${origin}/index.html`, { headers: { Accept: 'text/html' } })
    if (res.ok) {
      const html = await res.text()
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      })
    }
  } catch {
    // 忽略，走下面最小兜底页
  }

  return new Response(
    '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<meta http-equiv="refresh" content="0;url=/">' +
      '<title>Wallpaper Gallery · Studio</title></head><body></body></html>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
    }
  )
}

async function onRequest(context) {
  const request = context.request
  const pathname = new URL(request.url).pathname
  const method = (request.method || 'GET').toUpperCase()
  const accept = request.headers.get('accept') || ''

  if (pathname === '/api/github-oauth') {
    if (method === 'POST') {
      return handleOAuth(context)
    }
    // 浏览器直接打开时给个明确 JSON 提示（正常流程不会走这里）；
    // 返回 JSON 而非 HTML，正是判断「函数有没有真部署」的探针。
    return json({ error: '该接口只接受 POST { code }' }, 405)
  }

  if (pathname === '/api/ping-github') {
    return handlePing()
  }

  if (accept.includes('text/html')) {
    return handleSpaShell(context)
  }

  return json({ error: 'Not Found', path: pathname }, 404)
}

// 同时提供 default 与命名导出，兼容平台两种入口识别方式
export default onRequest
export { onRequest }
