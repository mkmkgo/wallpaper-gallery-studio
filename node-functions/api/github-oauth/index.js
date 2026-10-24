// Cloud Function (Node.js 20) —— 路由: /api/github-oauth
//
// 作用：用 GitHub OAuth 的 code 换 access_token。
// 为什么必须有服务端：换 token 需要 client_secret，secret 一旦进前端包
// 等于把 GitHub 仓库写权限公开。以前这一步跑在 Cloudflare Worker 上
// （wallpaper-oauth.1109008002.workers.dev），国内网络连不上，登录必失败；
// 现在迁到 EdgeOne Pages 的 Cloud Function，与后台同域名、国内可达。
//
// 环境变量（控制台「项目设置 → 环境管理 → 生产环境 → 环境变量」，
// 注意不要加 VITE_ 前缀，这样只存在于服务端、不会打进前端产物）：
//   GITHUB_CLIENT_ID
//   GITHUB_CLIENT_SECRET
//
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

// Cloud Functions 文档里 process.env 与 context.env 两种写法都出现过，都兜住
function readEnv(context, key) {
  const fromContext = context && context.env ? context.env[key] : ''
  return fromContext || process.env[key] || ''
}

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

// 浏览器直接打开 /api/github-oauth 时给个明确提示（正常流程不会走这里）
export function onRequest() {
  return json({ error: '该接口只接受 POST { code }' }, 405)
}
