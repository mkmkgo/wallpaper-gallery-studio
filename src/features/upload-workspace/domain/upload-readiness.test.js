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

  it('AI 模式预选分类后，失败项即使有 targetPath 也不得混入上传集合', () => {
    // 回归用例：addFiles 在预选分类时会先给所有文件写入 targetPath，
    // 之后 AI 失败的项不能仅凭 targetPath 判定为可上传。
    const preselectedFailed = {
      id: 'fail-preselected',
      status: 'pending',
      targetPath: 'wallpaper/mobile/风景/fail-preselected.jpg',
      aiTaskId: 'ai_fail_1',
      aiTaskStatus: 'failed',
      aiMetadata: null
    }
    expect(isUploadableFile(preselectedFailed)).toBe(false)
    expect(isSkippedFile(preselectedFailed)).toBe(true)

    const files = [
      ...Array.from({ length: 605 }, (_, i) => readyFile(`ok-${i}`)),
      preselectedFailed,
      { ...preselectedFailed, id: 'fail-2', aiTaskId: 'ai_fail_2' }
    ]
    expect(canStartUpload(files, false)).toBe(true)
    expect(files.filter(isUploadableFile)).toHaveLength(605)
    expect(files.filter(isSkippedFile)).toHaveLength(2)
  })

  it('AI 任务进行中（排队/分析中/重试中）的文件即使有 targetPath 也不得上传', () => {
    for (const status of ['queued', 'analyzing', 'retrying']) {
      const file = {
        status: 'pending',
        targetPath: 'wallpaper/mobile/风景/x.jpg',
        aiTaskId: 'ai_1',
        aiTaskStatus: status
      }
      expect(isUploadableFile(file)).toBe(false)
      expect(isSkippedFile(file)).toBe(true)
    }
  })

  it('AI 分析成功且带元数据的文件可上传；手动模式无 aiTaskId 也可上传', () => {
    expect(
      isUploadableFile({
        status: 'pending',
        targetPath: 'wallpaper/mobile/风景/x.jpg',
        aiTaskId: 'ai_1',
        aiTaskStatus: 'completed',
        aiMetadata: { category: '风景' }
      })
    ).toBe(true)
    expect(isUploadableFile(readyFile('manual'))).toBe(true)
  })

  it('AI 结果含 error 的文件不得上传', () => {
    expect(
      isUploadableFile({
        status: 'pending',
        targetPath: 'wallpaper/mobile/风景/x.jpg',
        aiTaskId: 'ai_1',
        aiTaskStatus: 'completed',
        aiMetadata: { error: 'content filter' }
      })
    ).toBe(false)
  })
})
