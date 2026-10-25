// Cloud Function（Node.js 运行时）—— 精确路由: /api/ai-proxy/zhipu/chat/completions
//
// 目录嵌套即路由：cloud-functions/api/ai-proxy/zhipu/chat/completions/index.js
// 上线后 /api/ai-proxy/zhipu/chat/completions 可用（已实证的同款模式：
// cloud-functions/api/ping-github/index.js → /api/ping-github）。
//
// 作用：智谱 GLM 视觉模型（图片分析）的同源代理入口。
// 为什么必须同源函数而不是 Cloudflare Worker：workers.dev 域名在大陆被
// GFW 精准阻断，用户两台电脑一台 "Failed to fetch"；挂在 studio 自己域名下
// 后大陆稳定可达，且同源无 CORS。完整背景见 _lib/ai-proxy.js 顶部注释。
//
// 逻辑放在 _lib/ai-proxy.js（不导出 handler 的辅助模块），此处只做路由绑定。

// ⚠️ 坑（2026-10-25 实测）：EdgeOne handler 的第一个参数是 context，
// 真正的 Request 在 context.request 上（同 _lib/github.js:36 的写法）。
// 若把第一个参数直接当 request 用，request.method 是 undefined，
// POST 也会掉进 405 分支（线上实测：POST/OPTIONS 全返回 Method not allowed）。

import { handleAiProxy } from '../../../../../_lib/ai-proxy.js'

// 正常流程：前端 POST（Authorization 头透传智谱 API Key）
export async function onRequestPost(context) {
  return handleAiProxy(context.request, 'zhipu')
}

// 兜底：其它方法也交给 handleAiProxy 统一处理
// （OPTIONS 预检 / 405 / 401 / 未知 provider 等分支都在那里）
export async function onRequest(context) {
  return handleAiProxy(context.request, 'zhipu')
}
