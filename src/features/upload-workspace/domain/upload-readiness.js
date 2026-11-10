/**
 * 上传就绪判定（单一事实来源）。
 *
 * AI 智能分类模式下，只有「已分析完成并确定目标目录」的文件才能上传。
 * 分析失败或尚未完成的文件属于跳过项：它们既不应阻塞整批上传，
 * 也不应被上传到兜底目录或混入上传集合。
 *
 * 按钮态、上传入口守卫、实际上传集合三处共用这里的判定，避免逻辑漂移导致
 * 「少数 AI 失败项锁死整批」或「失败项带空元数据被误传」。
 */

const AI_COMPLETED_STATUS = 'completed'

/**
 * 单个文件是否可上传。
 *
 * 注意：AI 模式下若用户预选了分类，addFiles 会先给所有文件写入 targetPath，
 * 因此不能只用 targetPath 判断就绪——必须同时确认 AI 任务确实分析成功，
 * 否则失败项会带着空的 aiMetadata 混进上传（分组错误、元数据缺失）。
 * 手动上传模式的文件没有 aiTaskId，只要 pending 且有 targetPath 即就绪。
 */
export function isUploadableFile(file) {
  if (!file || file.status !== 'pending' || !file.targetPath) return false
  if (file.aiMetadata?.error) return false
  if (file.aiTaskId && file.aiTaskStatus !== AI_COMPLETED_STATUS) return false
  return true
}

export function isSkippedFile(file) {
  return !!file && file.status === 'pending' && !isUploadableFile(file)
}

export function canStartUpload(files, uploading = false) {
  if (uploading) return false
  return Array.isArray(files) && files.some(isUploadableFile)
}
