// EdgeOne Makers 根级中间件（在所有请求——静态/函数——之前执行）
//
// 作用：把浏览器导航请求（Accept: text/html 且非 /api/ 路径）改写（rewrite）
// 到 /index.html，让 SPA 前端路由（/callback、/login、/settings 等）命中
// 静态资源，由 Vue Router 接管；/api/* 请求原样放行给 Cloud Functions。
//
// 为什么需要它：
//   之前用 catch-all 函数（cloud-functions/[[default]].js）兜底 SPA 路由，
//   但平台实际运行的是「仓库根目录」的函数源码，拿不到构建产物里的真实
//   index.html，只能返回占位内容 → /callback 显示「页面加载中」、登录卡住。
//   因此改为：不接管的策略（删掉 catch-all）+ 本中间件把导航请求交给静态层。
//
// 安全性：全部逻辑包在 try/catch 内，且只在使用前检查 context.rewrite /
// context.next 是否存在。即使平台不支持该 API 或改写失败，也会走
// context.next()（透传），不会让站点挂掉 —— 纯增益，无风险。

export function middleware(context) {
  try {
    const request = context && context.request
    if (!request) {
      return context.next ? context.next() : undefined
    }

    let pathname = ''
    try {
      pathname = new URL(request.url).pathname
    } catch {
      pathname = ''
    }

    const accept =
      typeof request.headers?.get === 'function' ? request.headers.get('accept') || '' : ''

    // API 请求放行给云函数；只处理浏览器导航请求
    if (!pathname.startsWith('/api/') && accept.includes('text/html')) {
      if (typeof context.rewrite === 'function') {
        return context.rewrite('/index.html')
      }
    }
  } catch {
    // 任何异常都走透传，不影响站点
  }

  return context && typeof context.next === 'function' ? context.next() : undefined
}
