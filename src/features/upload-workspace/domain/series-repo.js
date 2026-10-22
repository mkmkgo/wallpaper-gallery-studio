/**
 * 分仓路由（2026-10-22 图床分仓 / 2026-10-23 改造为仓库注册表驱动）
 *
 * desktop 系列已迁至独立公开仓 nuanXinProPic-desktop（tag v2.0.0 起独立编号），
 * mobile / avatar 仍写主仓。每条图片数据自带 repo + cdnTag 字段（前端已按此路由），
 * Studio 侧通过本模块把上传/读取/工作流触发按 series 解析到对应仓库。
 *
 * 本模块保留旧签名作为兼容层，实际分配逻辑全部委托给 `repo-registry.js`：
 * - 一个 series 可落在 N 个仓库（desktop / desktop-2 …）
 * - workflow 事件从注册表条目读取，不再按 series 名硬编码
 *
 * 纯函数，无副作用，可单测。
 */

import {
  DEFAULT_REPOSITORY_REGISTRY,
  DEFAULT_WORKFLOW_EVENT,
  allocateRepo,
  createRegistryFromLegacyConfig
} from './repo-registry.js'

// 新接口从本模块透出，调用方无需关心它实际定义在 repo-registry
export { resolveRepoWorkflowEvent } from './repo-registry.js'

/**
 * 按 series 解析目标仓库
 *
 * 内部先把配置（新版 `repositories` 或旧版 `seriesRepos`）归一成注册表，再走 `allocateRepo`。
 * 返回形状保持 `{ owner, repo }` 两个字段，避免破坏既有调用方。
 *
 * @param {{ owner?: string, repo?: string, branch?: string, repositories?: Array<object>, seriesRepos?: Record<string, { owner?: string, repo?: string }> }} config
 * @param {string} series - 'desktop' | 'mobile' | 'avatar' | ''
 * @param {{ repoId?: string, sizeMap?: Record<string, number> }} [options] - 手动指定仓库 / 容量数据
 * @returns {{ owner: string, repo: string }} 分仓缺省回退主仓配置
 */
export function resolveSeriesRepo(config = {}, series = '', options = {}) {
  const safeConfig = config || {}
  const registry = createRegistryFromLegacyConfig(safeConfig)
  const context = allocateRepo(registry, series, {
    ...options,
    defaultRepoId: safeConfig.defaultRepoId || 'main'
  })

  return {
    owner: context?.owner ?? '',
    repo: context?.repo ?? ''
  }
}

/**
 * @deprecated 请使用 `resolveRepoWorkflowEvent(registry, repoId)`
 *
 * 保留签名是为了不破坏既有调用方（如 WorkflowPanel）。实现已改为走注册表：
 * 先按 series 分配仓库，再从仓库条目上取 `workflowEvent`。
 *
 * @param {string} series
 * @param {Array<object>} [registry] - 默认用环境变量生成的默认注册表
 * @returns {string}
 */
export function resolveSeriesWorkflowEvent(series = '', registry = DEFAULT_REPOSITORY_REGISTRY) {
  const context = allocateRepo(registry, series)
  return context?.workflowEvent || DEFAULT_WORKFLOW_EVENT
}
