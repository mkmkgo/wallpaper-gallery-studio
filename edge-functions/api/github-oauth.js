// Edge Function（EdgeOne Pages/Makers edge-functions，V8 运行时）—— 路由: /api/github-oauth
//
// 作用：用 GitHub OAuth 的 code 换 access_token。
// 为什么必须有服务端：换 token 需要 client_secret，secret 一旦进前端包
// 等于把 GitHub 仓库写权限公开。以前这一步跑在 Cloudflare Worker 上
// （wallpaper-oauth.1109008002.workers.dev），国内网络连不上，登录必失败；
// 现在迁到 EdgeOne 的 Edge Function，与后台同域名、国内可达。
//
// 目录/路由约定（官方文档，文件系统路由、函数优先于静态资源）：
//   edge-functions/api/github-oauth.js  →  https://域名/api/github-oauth
// 入口识别：导出 onRequest / onRequestGet / onRequestPost 等 Handler 才会注册成路由。
//
// 环境变量（EdgeOne 控制台「项目设置 → 环境变量」，函数里经 context.env 读取；
// 不加 VITE_ 前缀，只存在于服务端、不会打进前端产物）：
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET
//
// 前端对应：VITE_OAUTH_WORKER_URL = /api/github-oauth
//
// 历史教训（排错花了三轮，记录在此防再踩）：
//   1) cloud-functions/ 是 EdgeOne Makers「Node.js 函数」的目录，但该功能是 Beta，
//      本项目未开通时目录被整体忽略；node-functions/ 则根本不是 Makers 的约定。
//      两者都会让 /api/* 请求落到 SPA 静态回退、返回 index.html，
//      前端 fetch().json() 解析 HTML 即报 Unexpected token '<'。
//   2) Edge Functions（edge-functions/）是 GA 功能、文档明示无需额外配置，故改用本目录。
//   3) edgeone.json 保持 {}：不写自定义 rewrites，避免 /* → /index.html 把 /api/* 一起吞掉。

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

// EdgeOne 把项目环境变量挂在 context.env 上；个别运行时（Node 函数）另注入 process.env，一并兜住
function readEnv(context, key) {
  const fromContext = context && context.env ? context.env[key] : ''
  if (fromContext) return fromContext
  if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
    return process.env[key]
  }
  return ''
}

// 正常流程：前端 POST { code }，服务端持 client_secret 换 access_token
export async function onRequestPost(context) {
  const request = context && context.request

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
        'User-Agent': 'edgeone-oauth'
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

// 浏览器直接打开 /api/github-oauth 时给个明确 JSON 提示（正常流程不会走这里）
// 注意：返回 JSON 而非 HTML，正是判断「函数有没有真部署」的探针。
export function onRequestGet() {
  return json({ error: '该接口只接受 POST { code }' }, 405)
}
