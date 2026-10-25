// Cloud Functions 辅助模块（不导出 handler，因此不会被注册成独立路由，
// 只会被入口文件 import —— 与 _lib/github.js 同一模式，官方文档「入口文件识别」）。
//
// ── 为什么从 Cloudflare Worker 迁到这里 ──────────────────────────────
// 原链路：浏览器 → wallpaper-ai-proxy.1109008002.workers.dev → 智谱
// workers.dev 是 Cloudflare 分配的公共边缘域名，其 IP 段在大陆被 GFW
// 精准阻断（移动网络必挂、电信联通看脸）：用户两台电脑，一台能连上、
// 一台报 "Failed to fetch"，用户侧完全不可控。
// 新链路：浏览器 → studio 自己的域名（同源 EdgeOne Pages 函数）→ 智谱
// 函数挂在站点自身域名下，大陆访问稳定；同源之后连 CORS 预检都不存在
// （CORS 头仍防御性保留：不排除有人从别的 origin 调用）。
//
// 逻辑原型：worker/ai-cors-proxy.js（Cloudflare Worker 版），两者逐条对应；
// 那个文件保留作备用通道——EdgeOne 地域抽风时，前端可用环境变量切回。
//
// 路由映射：cloud-functions/api/<路径>/index.js → /<路径>
// 本模块被 cloud-functions/api/ai-proxy/zhipu/chat/completions/index.js 引用，
// 对应路由 /api/ai-proxy/zhipu/chat/completions（zhipu 段即 provider 名）。

// 厂商前缀 → 上游地址（与各 provider 的 baseUrl 保持一致，同 worker 版）
const UPSTREAMS = {
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  groq: 'https://api.groq.com/openai/v1',
  modelscope: 'https://api-inference.modelscope.cn/v1'
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // 必须放行 authorization，否则浏览器预检依旧失败
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Max-Age': '86400'
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export async function handleAiProxy(request, provider) {
  // 防御：入口文件必须传 context.request（见路由文件顶部注释）；
  // 若误传 context，request.method 为 undefined，这里统一转大写后判断，
  // 避免「POST 也返回 405」这类静默错分支。
  const method = String(request?.method || '').toUpperCase()

  // 1) CORS 预检（同源其实不会来，防御性保留）
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // 2) provider 由路由段固定，查表拿上游
  const upstream = UPSTREAMS[provider]
  if (!upstream) {
    return json({ error: '未知的 provider', supported: Object.keys(UPSTREAMS) }, 400)
  }

  // 3) 切掉前缀 /api/ai-proxy/<provider>，剩下的就是上游路径；
  //    rest 为空（或只有 /）时默认 /chat/completions
  const pathname = new URL(request.url).pathname
  const prefix = `/api/ai-proxy/${provider}`
  let rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : ''
  if (!rest || rest === '/') {
    rest = '/chat/completions'
  }

  // 4) 透传 Authorization（密钥仍在前端，函数不留存，行为与原 Worker 一致）
  const auth = request.headers.get('authorization')
  if (!auth) {
    return json({ error: '缺少 Authorization 请求头' }, 401)
  }

  const upstreamUrl = upstream + rest

  try {
    const body = await request.text()

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body
    })

    const responseBody = await upstreamResponse.text()

    return new Response(responseBody, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
        ...CORS_HEADERS
      }
    })
  } catch (error) {
    return json({ error: '代理转发失败', message: error.message }, 502)
  }
}
