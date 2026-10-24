// Cloud Function（EdgeOne Makers Node.js 运行时）—— catch-all 兜底入口
// 文件：cloud-functions/[[default]].js（仓库根级，必须提交进仓库）
//
// 定位：与 cloud-functions/api/* 的精确路由并存，互为双保险。
// 精确路由（优先级更高）能命中时不会走到这里；这里负责：
//   POST /api/github-oauth  用 code 换 access_token
//   GET  /api/ping-github   出网探针
//   其它路径 + Accept: text/html → 返回 SPA 入口页（保 /callback 等前端路由）
//   其它路径                  → JSON 404
//
// 排错背景（勿删，防止再踩）：
// 登录报 Unexpected token '<' 的根因是 /api/* 请求被当成前端路由、
// 返回了 index.html（纯静态兜底），前端 fetch().json() 解析 HTML 失败。
// 触发条件是项目被判为「纯静态站」（函数没被平台发现）。
// 官方 CLI 文档要点：手动构建时，函数目录需进入输出目录（本项目即 dist），
// 这一步由 scripts/vite-plugin-makers-functions.js 在构建期完成。
//
// 环境变量（控制台 项目设置→环境变量，函数内经 context.env / process.env 读取）：
//   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET

import { json, handleOAuth, handlePing, handleSpaShell } from './_lib/github.js'

async function onRequest(context) {
  const request = context.request
  const pathname = new URL(request.url).pathname
  const method = (request.method || 'GET').toUpperCase()
  const accept = request.headers.get('accept') || ''

  if (pathname === '/api/github-oauth') {
    if (method === 'POST') {
      return handleOAuth(context)
    }
    return json({ error: '该接口只接受 POST { code }' }, 405)
  }

  if (pathname === '/api/ping-github') {
    return handlePing()
  }

  if (accept.includes('text/html')) {
    return handleSpaShell(context)
  }

  return json({ error: 'Not Found', path: pathname }, 404)
}

// 同时提供 default 与命名导出，兼容平台两种入口识别方式
export default onRequest
export { onRequest }
