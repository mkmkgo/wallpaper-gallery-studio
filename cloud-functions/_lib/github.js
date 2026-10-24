// Cloud Functions 辅助模块（不导出 handler，因此不会被注册成独立路由，
// 只会被复制到构建产物中供入口文件引用 —— 官方文档「入口文件识别」一节）。
//
// 这里放 GitHub OAuth 换 token 的共享逻辑，被以下入口复用：
//   cloud-functions/api/github-oauth/index.js  （精确路由 /api/github-oauth）
//   cloud-functions/api/ping-github/index.js   （精确路由 /api/ping-github）
//   cloud-functions/[[default]].js             （catch-all 兜底/双保险）

import { SPA_SHELL_HTML } from './spa-shell.js'

export const TOKEN_URL = 'https://github.com/login/oauth/access_token'
export const UPSTREAM_TIMEOUT_MS = 15000

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  })
}

// Makers 运行时把项目环境变量挂在 context.env 上；Node 运行时另注入 process.env，一并兜住
export function readEnv(context, key) {
  const fromContext = context && context.env ? context.env[key] : ''
  if (fromContext) return fromContext
  if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
    return process.env[key]
  }
  return ''
}

// ---- POST /api/github-oauth：code 换 token ----
export async function handleOAuth(context) {
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
export async function handlePing() {
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

// ---- SPA 入口兜底：浏览器导航请求返回 index.html 页面壳 ----
// catch-all 会接管前端路由（/callback、/login 等），必须返回真正的
// index.html 页面壳，否则 Vue Router 拿不到页面、登录回调丢失 code。
//
// 早期实现用「函数内 fetch 自己的 /index.html」（self-fetch），实测在
// EdgeOne 上 self-fetch 失败，会退到最小兜底页（meta refresh 跳 /），
// 导致 /callback?code=xxx 被跳回首页、登录必失败。
// 改为构建期内联：dist/index.html 的内容在构建时被写进
// _lib/spa-shell.js（由 vite 插件覆盖），这里直接返回，零运行时依赖。
export function handleSpaShell() {
  return new Response(SPA_SHELL_HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  })
}
