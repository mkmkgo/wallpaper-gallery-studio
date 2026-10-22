/**
 * 仓库容量展示（2026-10-23 图床分仓 v2 的 UI 辅助层）
 *
 * 数据来源是 `githubService.getReposInfo()`：
 *   { [repoId]: { sizeKB, permissions, defaultBranch } | null }
 * 单个仓库查询失败（无权限 / 404 / 限流）时值为 null，
 * 这一层负责把它降级成「未知」而不是让界面崩掉。
 *
 * 纯函数，无副作用，可单测。
 */

/** 1 GB = 1024 * 1024 KB（GitHub 的 size 字段单位是 KB） */
export const KB_PER_GB = 1024 * 1024

/**
 * 格式化体积
 * @param {number | undefined | null} sizeKB
 * @returns {string} 非法值统一返回「未知」
 */
export function formatRepoSize(sizeKB) {
  if (!Number.isFinite(sizeKB) || sizeKB < 0) return '未知'
  if (sizeKB >= KB_PER_GB) return `${(sizeKB / KB_PER_GB).toFixed(2)} GB`
  return `${(sizeKB / 1024).toFixed(1)} MB`
}

/**
 * 取仓库已用体积
 * @param {Record<string, { sizeKB?: number } | null>} infoMap - getReposInfo 的返回值
 * @param {string} repoId
 * @returns {number | undefined} 查不到时返回 undefined
 */
export function resolveRepoUsedKB(infoMap, repoId) {
  const sizeKB = infoMap?.[repoId]?.sizeKB
  return Number.isFinite(sizeKB) ? sizeKB : undefined
}

/**
 * 容量文案，如「2.17 GB / 4.5 GB」；容量未知时显示「未知 / 4.5 GB」，
 * capacityKB <= 0 表示不限容量
 * @param {Record<string, { sizeKB?: number } | null>} infoMap
 * @param {{ id: string, capacityKB?: number }} entry - 归一化后的注册表条目
 * @returns {string}
 */
export function formatRepoCapacity(infoMap, entry) {
  const usedKB = resolveRepoUsedKB(infoMap, entry?.id)
  const capacityKB = entry?.capacityKB || 0

  if (usedKB === undefined) {
    return capacityKB > 0 ? `未知 / ${(capacityKB / KB_PER_GB).toFixed(1)} GB` : '容量未知'
  }

  const used = formatRepoSize(usedKB)
  if (capacityKB <= 0) return `${used} · 不限容量`
  return `${used} / ${(capacityKB / KB_PER_GB).toFixed(1)} GB`
}

/**
 * 容量百分比（0-100）；容量未知或不限容量时为 0
 * @param {Record<string, { sizeKB?: number } | null>} infoMap
 * @param {{ id: string, capacityKB?: number }} entry
 * @returns {number}
 */
export function resolveRepoCapacityPercent(infoMap, entry) {
  const usedKB = resolveRepoUsedKB(infoMap, entry?.id)
  const capacityKB = entry?.capacityKB || 0

  if (!capacityKB || usedKB === undefined) return 0
  return Math.min(100, Math.round((usedKB / capacityKB) * 100))
}

/**
 * el-progress 的状态色：>=90% exception，>=75% warning，其余 success
 * @param {Record<string, { sizeKB?: number } | null>} infoMap
 * @param {{ id: string, capacityKB?: number }} entry
 * @returns {'success' | 'warning' | 'exception'}
 */
export function resolveRepoCapacityStatus(infoMap, entry) {
  const percent = resolveRepoCapacityPercent(infoMap, entry)
  if (percent >= 90) return 'exception'
  if (percent >= 75) return 'warning'
  return 'success'
}
