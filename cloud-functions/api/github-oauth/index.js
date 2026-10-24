// Cloud Function（Node.js 运行时）—— 精确路由: /api/github-oauth
//
// 这是官方文档 Quick Start 的标准写法：cloud-functions/api/<路径>/index.js
// 会映射为 /api/<路径>。相比根级 catch-all（[[default]].js），精确路由
// 优先级更高、也更容易被平台的路由表识别，因此两者并存互为双保险。
//
// 作用：用 GitHub OAuth 的 code 换 access_token。
// 为什么必须有服务端：换 token 需要 client_secret，secret 一旦进前端包
// 等于把 GitHub 仓库写权限公开。
//
// 环境变量（控制台 项目设置→环境变量；不加 VITE_ 前缀，只存在服务端）：
//   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
// 前端对应：VITE_OAUTH_WORKER_URL = /api/github-oauth

import { json, handleOAuth } from '../../_lib/github.js'

// 正常流程：前端 POST { code }
export async function onRequestPost(context) {
  return handleOAuth(context)
}

// 浏览器直接打开时的 JSON 提示（返回 JSON 而非 HTML，
// 正是判断「函数有没有真部署」的探针）
export function onRequestGet() {
  return json({ error: '该接口只接受 POST { code }' }, 405)
}

// 兜底：其它方法
export function onRequest() {
  return json({ error: '该接口只接受 POST { code }' }, 405)
}
