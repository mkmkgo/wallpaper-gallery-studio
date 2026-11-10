import { describe, it, expect } from 'vitest'
import { canStartUpload, isUploadableFile, isSkippedFile } from './upload-readiness.js'

const readyFile = id => ({
  id,
  status: 'pending',
  targetPath: `wallpaper/mobile/风景/${id}.jpg`
})

const failedFile = id => ({
  id,
  status: 'pending',
  targetPath: '',
  aiTaskStatus: 'failed'
})

describe('上传就绪判定', () => {
  it('605 张成功 + 2 张 AI 分析失败时，上传按钮仍可用（失败项不锁死整批）', () => {
    const files = [
      ...Array.from({ length: 605 }, (_, i) => readyFile(`ok-${i}`)),
      failedFile('fail-1'),
      failedFile('fail-2')
    ]

    expect(canStartUpload(files, false)).toBe(true)
    expect(files.filter(isUploadableFile)).toHaveLength(605)
    expect(files.filter(isSkippedFile)).toHaveLength(2)
  })

  it('全部为失败/未完成文件时禁止上传', () => {
    expect(canStartUpload([failedFile('f1'), failedFile('f2')], false)).toBe(false)
    expect(canStartUpload([], false)).toBe(false)
  })

  it('正在上传时禁止重复触发', () => {
    expect(canStartUpload([readyFile('a')], true)).toBe(false)
  })

  it('已上传成功 / 上传报错的文件不再算可上传', () => {
    expect(isUploadableFile({ status: 'success', targetPath: 'wallpaper/x' })).toBe(false)
    expect(isUploadableFile({ status: 'error', targetPath: 'wallpaper/x' })).toBe(false)
  })
})
