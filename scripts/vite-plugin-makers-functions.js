// Vite 插件：把 Makers 函数目录搬进构建产物 dist/
//
// 为什么必须要这一步（排错教训，勿删）：
//   EdgeOne Makers 在「部署产物目录」里发现函数，而不是在仓库根。
//   官方 CLI 文档原文：「若手动构建，则需将 Pages Functions 相关文件夹及
//   package.json 放入输出目录（如 dist），再执行 deploy」。
//   本项目 outputDirectory = dist（默认），而 vite build 只会从 index.html
//   出发打包静态资源，压根不会碰仓库根的 cloud-functions/。
//   于是构建日志出现：
//     [cli] No server-handler detected, generating routes.json for pure project
//   项目被判定为纯静态站 → /api/* 全部走静态兜底返回 index.html →
//   前端 fetch().json() 解析 HTML 报 Unexpected token '<'。
//
// 之前把目录名从 cloud-functions 改到 node-functions、edge-functions 全无效，
// 根因不在目录名，而在「没进 dist」。本插件修复这一点。
//
// 同时复制 middleware.js（若存在）：根级中间件负责 SPA 路由回退。

import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const FUNCTION_DIRS = ['cloud-functions', 'edge-functions']
const ROOT_FILES = ['middleware.js']

export default function makersFunctions() {
  let root = process.cwd()
  let outDir = 'dist'

  return {
    name: 'makers-copy-functions',
    apply: 'build',
    configResolved(config) {
      root = config.root || process.cwd()
      outDir = config.build.outDir || 'dist'
    },
    closeBundle() {
      const target = resolve(root, outDir)

      for (const dir of FUNCTION_DIRS) {
        const src = resolve(root, dir)
        if (!existsSync(src)) continue
        cpSync(src, resolve(target, dir), { recursive: true })
        this.info(`[makers] 已复制 ${dir}/ -> ${outDir}/${dir}/`)
      }

      for (const file of ROOT_FILES) {
        const src = resolve(root, file)
        if (!existsSync(src)) continue
        cpSync(src, resolve(target, file))
        this.info(`[makers] 已复制 ${file} -> ${outDir}/${file}`)
      }
    }
  }
}
