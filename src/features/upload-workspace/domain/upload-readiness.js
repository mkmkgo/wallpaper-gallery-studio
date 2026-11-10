/**
 * 上传就绪判定（单一事实来源）。
 *
 * AI 智能分类模式下，只有「已分析完成并确定目标目录」的 pending 文件才能上传。
 * 分析失败或尚未完成的文件 targetPath 为空，属于跳过项：它们既不应阻塞整批上传，
 * 也不应被上传到兜底目录。
 *
 * 按钮态、上传入口守卫、实际上传集合三处共用这里的判定，避免逻辑漂移导致
 * 「少数 AI 失败项锁死整批」。
 */
export function isUploadableFile(file) {
  return file.status === 'pending' && !!file.targetPath
}

export function isSkippedFile(file) {
  return file.status === 'pending' && !file.targetPath
}

export function canStartUpload(files, uploading = false) {
  if (uploading) return false
  return files.some(isUploadableFile)
}
