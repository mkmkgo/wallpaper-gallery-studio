/**
 * Cloudflare Worker - AI 接口 CORS 代理
 *
 * [LOCAL] 自建文件，与上游无同名文件，同步上游时不会冲突，可安全保留。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────
 * 浏览器直连智谱 open.bigmodel.cn 会被 CORS 拦截：
 *   Access to fetch ... from origin 'https://wall.pj365.qzz.io' has been
 *   blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
 * 但服务端 curl 同一个域名能拿到 ACAO —— 说明是浏览器侧链路的问题，
 * 靠改前端无法根治。本 Worker 把链路改成：
 *   浏览器 → 你的 Worker（自带 CORS 头）→ 厂商接口
 * 第二段是服务端到服务端，不存在跨域，因此彻底绕开 CORS。
 *
 * ── 部署 ──────────────────────────────────────────────────────
 *   npx wrangler deploy worker/ai-cors-proxy.js \
 *     --name wallpaper-ai-proxy --compatibility-date 2026-10-21
 *
 * ── 部署后在 Cloudflare Pages 增加环境变量（改成你的 Worker 地址）──
 *   VITE_ZHIPU_BASE_URL=https://wallpaper-ai-proxy.<sub>.workers.dev/zhipu
 *   VITE_GROQ_BASE_URL=https://wallpaper-ai-proxy.<sub>.workers.dev/groq
 *   VITE_MODELSCOPE_BASE_URL=https://wallpaper-ai-proxy.<sub>.workers.dev/modelscope
 * 改完环境变量必须「重新部署」Pages（VITE_ 变量是构建时注入的）。
 *
 * ── 安全 ──────────────────────────────────────────────────────
 * Worker 不存储任何密钥，Authorization 由前端透传，行为与原直连一致。
 */

// 厂商前缀 → 上游地址（与各 provider 的 baseUrl 保持一致）
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  })
}

export default {
  async fetch(request) {
    // 1) CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    // 2) 按首段路径识别厂商：/zhipu/chat/completions → zhipu + /chat/completions
    const url = new URL(request.url)
    const seg = url.pathname.split('/').filter(Boolean)
    const provider = seg[0]
    const upstream = UPSTREAMS[provider]

    if (!upstream) {
      return jsonResponse(
        { error: '未知的 provider', path: url.pathname, supported: Object.keys(UPSTREAMS) },
        400
      )
    }

    const rest = seg.length > 1 ? `/${seg.slice(1).join('/')}` : '/chat/completions'

    // 3) 透传 Authorization（密钥仍在前端，Worker 不留存）
    const auth = request.headers.get('authorization')
    if (!auth) {
      return jsonResponse({ error: '缺少 Authorization 请求头' }, 401)
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
      return jsonResponse({ error: '代理转发失败', message: error.message }, 502)
    }
  }
}
