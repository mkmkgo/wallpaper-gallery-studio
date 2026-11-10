/**
 * AI 分析失败项勾选（单一事实来源）。
 *
 * 「勾选失败项」必须基于「完整文件数组 + 完整 AI 任务数组」计算，不能只作用于
 * 任务中心的虚拟滚动窗口（visibleTasks 只是可见切片），否则滚出视口的失败项
 * 会被漏选。文件自身同步的 aiTaskStatus / aiMetadata.error 作为兜底标记，
 * 保证即使任务记录尚未恢复、或文件状态未及时同步，也能识别失败项。
 *
 * AI_TASK_FAILED_STATUS 与 @/stores/ai-tasks 中的 AI_TASK_STATUS.FAILED 保持一致，
 * 这里不直接 import store，避免领域层依赖 Pinia / IndexedDB 基础设施。
 */

export const AI_TASK_FAILED_STATUS = 'failed'

/**
 * 判断一个 AI 任务是否处于失败态。
 * @param {{ status?: string } | null | undefined} task AI 任务对象
 * @returns {boolean} 任务状态为 failed 时返回 true
 */
export function isFailedAiTask(task) {
  return !!task && task.status === AI_TASK_FAILED_STATUS
}

/**
 * 判断一个待上传文件是否带有 AI 失败标记。
 * @param {object | null | undefined} file 待上传文件对象
 * @returns {boolean} 文件被标记为失败时返回 true
 */
export function isFailedUploadFile(file) {
  if (!file) return false
  if (file.aiTaskStatus === AI_TASK_FAILED_STATUS) return true
  return !!file.aiMetadata?.error
}

/**
 * 收集所有失败文件的 id。
 *
 * 失败来源有两类，任一命中即算失败：
 *   1. 完整任务数组中存在 status === 'failed' 的任务，其 fileId 或 id 与文件关联；
 *   2. 文件自身带 aiTaskStatus === 'failed' 或 aiMetadata.error（如内容审核拦截）。
 *
 * @param {Array<object>} files 完整文件数组（不是虚拟滚动窗口）
 * @param {Array<object>} tasks 完整 AI 任务数组（不是 visibleTasks）
 * @returns {Array<string|number>} 失败文件 id，按 files 顺序去重返回
 */
export function collectFailedFileIds(files = [], tasks = []) {
  const safeFiles = Array.isArray(files) ? files : []
  const safeTasks = Array.isArray(tasks) ? tasks : []

  const failedTaskFileIds = new Set()
  const failedTaskIds = new Set()
  for (const task of safeTasks) {
    if (!isFailedAiTask(task)) continue
    if (task.fileId != null) failedTaskFileIds.add(task.fileId)
    if (task.id != null) failedTaskIds.add(task.id)
  }

  const result = []
  const seen = new Set()
  for (const file of safeFiles) {
    if (!file || file.id == null) continue
    const markedByTask =
      failedTaskFileIds.has(file.id) || (file.aiTaskId != null && failedTaskIds.has(file.aiTaskId))
    if (!markedByTask && !isFailedUploadFile(file)) continue
    if (seen.has(file.id)) continue
    seen.add(file.id)
    result.push(file.id)
  }
  return result
}
