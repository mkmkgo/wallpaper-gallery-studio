// Cloud Functions 辅助模块（不导出 handler，因此不会被注册成独立路由，
// 只会被复制到构建产物中供入口文件引用 —— 官方文档「入口文件识别」一节）。
//
// 这里放 GitHub OAuth 换 token 的共享逻辑，被以下入口复用：
//   cloud-functions/api/github-oauth/index.js  （精确路由 /api/github-oauth）
//   cloud-functions/api/ping-github/index.js   （精确路由 /api/ping-github）
//   cloud-functions/[[default]].js             （catch-all 兜底/双保险）

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
// 注意：值统一 trim —— 从 GitHub 页面复制 client_id / secret 时很容易带上
// 首尾空格或换行，GitHub 会直接判为凭证不正确（incorrect_client_credentials）。
export function readEnv(context, key) {
  const fromContext = context && context.env ? context.env[key] : ''
  if (fromContext) return String(fromContext).trim()
  if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
    return String(process.env[key]).trim()
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
export async function handlePing(context) {
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

    // 诊断信息：只暴露 client_id 的前缀与长度、secret 的长度，
    // 绝不返回密钥本体。用于核对服务端读到的环境变量是否正确。
    const clientId = readEnv(context, 'GITHUB_CLIENT_ID')
    const clientSecret = readEnv(context, 'GITHUB_CLIENT_SECRET')

    return json({
      ok: true,
      message: 'Node 函数已部署且出网到 GitHub 正常',
      upstreamStatus: res.status,
      elapsedMs: Date.now() - started,
      env: {
        clientIdConfigured: !!clientId,
        // client_id 前 8 位，用于核对是否为 Ov23li...(注意第 9 位是数字 0 不是字母 O)
        clientIdPrefix: clientId ? clientId.slice(0, 8) : '',
        clientIdLength: clientId ? clientId.length : 0,
        secretConfigured: !!clientSecret,
        // GitHub client_secret 为 40 位十六进制，长度不对说明复制有问题
        secretLength: clientSecret ? clientSecret.length : 0
      },
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

// 注：这里曾经有 handleSpaShell（catch-all 返回 SPA 页面壳），现已移除。
// 原因：平台实际使用「仓库根目录」的 cloud-functions 源码，不会用构建产物
// dist 里的内联 HTML，导致 catch-all 只能返回源码里的占位内容，
// /callback 显示「页面加载中」、登录卡住。
// 现在 SPA 路由交给静态层（平台原生 SPA 回退 + 根级 middleware.js 兜底），
// 函数只负责 /api/*（见 cloud-functions/api/ 下的精确路由）。
