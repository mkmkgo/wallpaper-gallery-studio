// SPA 页面壳（构建期会被真实 dist/index.html 覆盖）
//
// 为什么需要它：catch-all 函数（[[default]].js）接管了前端路由
// （/callback、/login 等），必须返回真正的 index.html 页面壳，
// 否则 Vue Router 拿不到页面、登录回调会丢失 code 参数。
//
// 早期实现是「函数内 fetch 自己域名的 /index.html」，实测在平台上
// self-fetch 会失败并退到最小兜底页（meta refresh 跳 /），导致
// /callback?code=xxx 被跳回首页、登录失败。
//
// 改为构建期内联：scripts/vite-plugin-makers-functions.js 在 closeBundle
// 阶段读取 dist/index.html，用它的内容覆盖本文件（真实产物）。
// 本文件只是源码占位，保证本地 lint / 语法检查不缺文件。

export const SPA_SHELL_HTML =
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">' +
  '<title>Wallpaper Gallery · Studio</title></head><body>' +
  '<p>页面加载中，若长时间无响应请刷新。</p></body></html>'
