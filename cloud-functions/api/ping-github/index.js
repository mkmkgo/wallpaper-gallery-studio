// Cloud Function（Node.js 运行时）—— 精确路由: /api/ping-github
//
// 一次性探针：验证 Node 函数运行时能否连到 GitHub 的换 token 接口。
// 部署后浏览器打开 https://你的域名/api/ping-github：
//   返回 JSON ok:true  → 函数已部署且出网正常，登录可以打通
//   返回 JSON ok:false → 该地域连不上 GitHub，需换地域/加速区域
//   返回 HTML          → 函数根本没部署（看构建日志是否仍是 pure project）

import { handlePing } from '../../_lib/github.js'

export async function onRequestGet() {
  return handlePing()
}

export async function onRequest() {
  return handlePing()
}
