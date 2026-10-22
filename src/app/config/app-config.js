import { resolveSeriesRepo } from '@/features/upload-workspace/domain/series-repo'

const DEFAULT_REPOSITORY_CONFIG = {
  provider: 'github',
  owner: '',
  repo: '',
  branch: 'main',
  wallpaperRoot: 'wallpaper',
  manifestPath: 'config/upload-workspace.manifest.json',
  // 分仓路由（2026-10-22 图床分仓）：desktop 系列独立仓，其余系列缺省回退主仓
  // owner 留空时沿用主仓 owner（resolveSeriesRepo 的回落规则）
  seriesRepos: {
    desktop: {
      owner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
      repo: import.meta.env.VITE_GITHUB_REPO_NAME_DESKTOP || 'nuanXinProPic-desktop'
    }
  }
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
 * 按 series 解析目标仓库（融合用户配置与默认分仓配置）
 * 供 store / 视图层直接使用：传入 configStore.config 与 series，得到 { owner, repo }
 * @param {object} userConfig - configStore.config（localStorage 中的用户配置）
 * @param {string} series
 * @returns {{ owner: string, repo: string }}
 */
export function resolveSeriesRepoForConfig(userConfig = {}, series = '') {
  const merged = resolveAppConfig({ repository: userConfig }).repository
  return resolveSeriesRepo(
    {
      owner: userConfig.owner || merged.owner,
      repo: userConfig.repo || merged.repo,
      seriesRepos: merged.seriesRepos
    },
    series
  )
}
