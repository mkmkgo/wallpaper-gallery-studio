// GitHub OAuth 配置
const appOrigin = globalThis.location?.origin || 'http://localhost:5173'
const CONFIG_STORAGE_KEY = 'wallpaper_admin_config'

function getStoredConfig() {
  try {
    const raw = globalThis.localStorage?.getItem(CONFIG_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const oauthConfig = {
  get clientId() {
    const stored = getStoredConfig()
    return import.meta.env.VITE_GITHUB_CLIENT_ID || stored.clientId || ''
  },
  // Worker 地址
  get tokenEndpoint() {
    const stored = getStoredConfig()
    return import.meta.env.VITE_OAUTH_WORKER_URL || stored.oauthWorkerUrl || ''
  },
  // 授权地址
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  // 回调地址
  redirectUri: `${appOrigin}/callback`,
  // 请求的权限范围
  scope: 'repo'
}

// 生成授权 URL
export function getAuthUrl() {
  if (!oauthConfig.clientId) {
    throw new Error('未配置 GitHub Client ID，请在设置页或环境变量中填写')
  }

  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    scope: oauthConfig.scope,
    state: generateState()
  })
  return `${oauthConfig.authorizeUrl}?${params}`
}

// 生成随机 state 防止 CSRF
// 注意：globalThis.crypto.randomUUID 只在「安全上下文」下存在（https / localhost）。
// 用 http 打开、或老旧 WebView / 部分浏览器里它是 undefined，会直接抛
// "globalThis.crypto.randomUUID is not a function"。所以做三级降级兜底。
function generateState() {
  const state = randomToken()
  sessionStorage.setItem('oauth_state', state)
  return state
}

function randomToken() {
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  // 最差兜底：时间戳 + 双随机数，足够当一次性 CSRF state 用
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`
}

// 验证 state
export function verifyState(state) {
  const saved = sessionStorage.getItem('oauth_state')
  sessionStorage.removeItem('oauth_state')
  return saved === state
}

// 用 code 换 token
export async function exchangeToken(code) {
  if (!oauthConfig.tokenEndpoint) {
    throw new Error('未配置 OAuth Worker URL，请在设置页或环境变量中填写')
  }

  const response = await fetch(oauthConfig.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  })

  if (!response.ok) {
    let errorMessage = '获取 Token 失败'
    try {
      const error = await response.json()
      errorMessage = error.error || errorMessage
    } catch {
      // ignore non-json response body
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  return data.access_token
}
