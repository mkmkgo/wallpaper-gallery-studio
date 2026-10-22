import {
  DEFAULT_REPOSITORY_REGISTRY,
  allocateRepo,
  createRegistryFromLegacyConfig
} from '@/features/upload-workspace/domain/repo-registry'

const DEFAULT_REPO_ID = 'main'

/**
 * 由注册表派生旧版 `seriesRepos` 视图（只含非主仓条目），供向后兼容读取
 * @param {Array<object>} registry
 * @param {string} defaultRepoId
 * @returns {Record<string, { owner: string, repo: string, branch: string }>}
 */
function deriveLegacySeriesRepos(registry, defaultRepoId) {
  const result = {}

  for (const entry of registry) {
    if (entry.id === defaultRepoId) continue
    for (const series of entry.accepts) {
      if (series === '*') continue
      result[series] = { owner: entry.owner, repo: entry.repo, branch: entry.branch }
    }
  }

  return result
}

const DEFAULT_REPOSITORY_CONFIG = {
  provider: 'github',
  owner: '',
  repo: '',
  branch: 'main',
  wallpaperRoot: 'wallpaper',
  manifestPath: 'config/upload-workspace.manifest.json',
  // 仓库注册表（2026-10-23 v2）：取代 seriesRepos 的一对一映射，支持 N 仓 + 自动/手动分配
  // 详见 src/features/upload-workspace/domain/repo-registry.js
  version: 2,
  defaultRepoId: DEFAULT_REPO_ID,
  // 'auto' 按 priority + 容量自动推荐 | 'manual' 由用户显式指定 repoId
  assignment: 'auto',
  repositories: DEFAULT_REPOSITORY_REGISTRY,
  // 向后兼容视图：由 repositories 派生，旧代码 / 旧配置仍可读
  seriesRepos: deriveLegacySeriesRepos(DEFAULT_REPOSITORY_REGISTRY, DEFAULT_REPO_ID)
}

const DEFAULT_UPLOAD_CONFIG = {
  maxFileSizeMB: 25,
  batchWarningThreshold: 50,
  uploadDelayMs: 500,
  metadataPendingDir: 'metadata-pending',
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']
}

export const DEFAULT_APP_CONFIG = {
  repository: DEFAULT_REPOSITORY_CONFIG,
  upload: DEFAULT_UPLOAD_CONFIG
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function mergeConfig(base, overrides) {
  if (!isPlainObject(overrides)) {
    return Array.isArray(base) ? [...base] : base
  }

  const result = Array.isArray(base) ? [...base] : { ...base }

  for (const [key, value] of Object.entries(overrides)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = mergeConfig(result[key], value)
    } else {
      result[key] = value
    }
  }

  return result
}

export function resolveAppConfig(overrides = {}) {
  return mergeConfig(DEFAULT_APP_CONFIG, overrides)
}

/**
 * 取归一化后的仓库注册表（用户配置 + 默认配置融合）
 * 供仓库管理界面 / 自动选仓读取；拿到注册表后即可调用
 * `listCandidates` / `allocateRepo` / `resolveRepoContext`。
 *
 * @param {object} userConfig - configStore.config
 * @returns {Array<object>} 归一化条目：{ id, label, owner, repo, branch, enabled, accepts, priority, capacityKB, workflowEvent, cdnTagPrefix }
 */
export function resolveRepositoryRegistry(userConfig = {}) {
  const safeUserConfig = userConfig || {}
  const merged = resolveAppConfig({ repository: safeUserConfig }).repository

  return createRegistryFromLegacyConfig({
    owner: safeUserConfig.owner || merged.owner,
    repo: safeUserConfig.repo || merged.repo,
    branch: safeUserConfig.branch || merged.branch,
    repositories: merged.repositories,
    // 只有用户显式配置的 seriesRepos 才参与迁移。
    // 默认配置里由 repositories 派生的 seriesRepos 仅供向后兼容读取，
    // 若拿它做迁移会反向覆盖掉用户已配置的注册表条目。
    seriesRepos: safeUserConfig.seriesRepos
  })
}

/**
 * 按 series 解析目标仓库（融合用户配置与仓库注册表）
 * 供 store / 视图层直接使用：传入 configStore.config 与 series，得到 { owner, repo }
 * @param {object} userConfig - configStore.config（localStorage 中的用户配置）
 * @param {string} series
 * @param {{ repoId?: string, sizeMap?: Record<string, number> }} [options] - 手动指定仓库 / 容量数据
 * @returns {{ owner: string, repo: string }}
 */
export function resolveSeriesRepoForConfig(userConfig = {}, series = '', options = {}) {
  const safeUserConfig = userConfig || {}
  const merged = resolveAppConfig({ repository: safeUserConfig }).repository
  const fallback = {
    owner: safeUserConfig.owner || merged.owner,
    repo: safeUserConfig.repo || merged.repo,
    defaultRepoId: safeUserConfig.defaultRepoId || merged.defaultRepoId || DEFAULT_REPO_ID
  }

  const registry = resolveRepositoryRegistry(safeUserConfig)

  const context = allocateRepo(registry, series, {
    ...options,
    defaultRepoId: fallback.defaultRepoId
  })

  return {
    owner: context?.owner ?? fallback.owner,
    repo: context?.repo ?? fallback.repo
  }
}
