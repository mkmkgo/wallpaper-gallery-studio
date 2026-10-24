// Cloud Function（兜底 / SPA 回退）—— 路由: /* （除 /api/* 外的所有路径）
//
// 为什么需要它：EdgeOne 的 `rewrites: [{ source: '/*', destination: '/index.html' }]`
// 是「静态回退」，会连 /api/* 一起改写成 index.html，导致 API 函数永远拿不到请求
// （官方文档：静态资源路由优先于函数路由）。所以 SPA 回退不能靠静态 rewrite 做，
// 改用这个兜底函数：具体 API 函数（cloud-functions/api/**）优先级更高会先被命中，
// 只有那些「既不是静态文件、也不是 /api/* 函数」的路径（如 /callback、/settings）
// 才会落到这里，统一返回 index.html 交给前端路由。
//
// 安全护栏：万一 /api/* 没被具体函数接住，这里也绝不返回 HTML（否则前端 JSON.parse 会炸），
// 而是直接 404。

export async function onRequest(context) {
  const req = context.request
  const url = new URL(req.url)

  // 护栏：/api/* 不该走到这里；若真走到，返回 404 而不是 HTML
  if (url.pathname.startsWith('/api/')) {
    return new Response('Not Found', { status: 404 })
  }

  try {
    // /index.html 是真实静态文件，fetch 它会被静态处理器直接返回（不会回流到本函数）
    const res = await fetch(`${url.origin}/index.html`)
    const html = await res.text()
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
}
