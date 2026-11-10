import { describe, it, expect } from 'vitest'
import {
  AI_TASK_FAILED_STATUS,
  collectFailedFileIds,
  isFailedAiTask,
  isFailedUploadFile
} from './failed-file-selection.js'
import { canStartUpload, isSkippedFile } from './upload-readiness.js'
import { getVirtualGridWindow } from '@/utils/virtual-grid.js'

const readyFile = id => ({
  id,
  name: `${id}.jpg`,
  status: 'pending',
  targetPath: `wallpaper/mobile/风景/${id}.jpg`,
  aiTaskId: `ai_${id}`,
  aiTaskStatus: 'completed',
  aiMetadata: { category: '风景' }
})

const failedFile = id => ({
  id,
  name: `${id}.jpg`,
  status: 'pending',
  targetPath: '',
  aiTaskId: `ai_${id}`,
  aiTaskStatus: AI_TASK_FAILED_STATUS,
  aiMetadata: null
})

const taskFor = (file, status) => ({
  id: file.aiTaskId,
  fileId: file.id,
  status
})

// 605 张成功 + 2 张失败（尾部的两项），与真实 607 张场景一致
function build607() {
  const files = [
    ...Array.from({ length: 605 }, (_, i) => readyFile(`ok-${i}`)),
    failedFile('fail-1'),
    failedFile('fail-2')
  ]
  const tasks = files.map(file =>
    taskFor(file, file.aiTaskStatus === AI_TASK_FAILED_STATUS ? AI_TASK_FAILED_STATUS : 'completed')
  )
  return { files, tasks }
}

const windowAt = (scrollTop, itemCount = 607) =>
  getVirtualGridWindow({
    itemCount,
    scrollTop,
    viewportHeight: 320,
    columns: 4,
    rowHeight: 74,
    bufferRows: 2
  })

describe('AI 失败项勾选（607 张中 2 张失败）', () => {
  it('只收集这 2 个失败文件 id，成功项一个都不选', () => {
    const { files, tasks } = build607()

    expect(collectFailedFileIds(files, tasks)).toEqual(['fail-1', 'fail-2'])
    expect(files.filter(isSkippedFile)).toHaveLength(2)
    expect(canStartUpload(files, false)).toBe(true)
  })

  it('失败任务在完整任务数组中即可识别，文件上的状态即使尚未同步也能命中', () => {
    const stale = {
      id: 'stale-1',
      status: 'pending',
      targetPath: 'wallpaper/mobile/风景/x.jpg',
      aiTaskId: 'ai_stale_1',
      aiTaskStatus: 'queued'
    }
    const tasks = [{ id: 'ai_stale_1', fileId: 'stale-1', status: AI_TASK_FAILED_STATUS }]

    expect(collectFailedFileIds([stale], tasks)).toEqual(['stale-1'])
    expect(isFailedAiTask(tasks[0])).toBe(true)
    expect(isFailedAiTask({ status: 'completed' })).toBe(false)
    expect(isFailedAiTask(null)).toBe(false)
  })

  it('AI 结果带 error（如智谱内容审核拦截）也算失败项', () => {
    const blocked = { ...readyFile('blocked'), aiMetadata: { error: 'content filter' } }

    expect(isFailedUploadFile(blocked)).toBe(true)
    expect(collectFailedFileIds([blocked], [])).toEqual(['blocked'])
  })

  it('全部成功时没有失败项，返回空数组', () => {
    const { files, tasks } = build607()

    expect(collectFailedFileIds(files.slice(0, 605), tasks.slice(0, 605))).toEqual([])
  })

  it('去重并容忍脏数据（重复项 / null / 无 id）', () => {
    const duplicated = failedFile('f1')
    expect(
      collectFailedFileIds(
        [duplicated, { ...duplicated }, null, undefined, { id: null }],
        [taskFor(duplicated, AI_TASK_FAILED_STATUS)]
      )
    ).toEqual(['f1'])
    expect(collectFailedFileIds(null, null)).toEqual([])
  })

  it('虚拟滚动窗口变化时失败集合保持不变，且不受 visibleTasks 切片影响', () => {
    const { files, tasks } = build607()
    const expected = ['fail-1', 'fail-2']

    // 首个窗口只渲染前 28 项，两个失败任务完全不在可见窗口内
    const firstWindow = windowAt(0)
    const firstVisibleTasks = tasks.slice(firstWindow.startIndex, firstWindow.endIndex)
    expect(firstWindow.endIndex).toBeLessThan(605)
    expect(firstVisibleTasks.filter(isFailedAiTask)).toHaveLength(0)

    for (const scrollTop of [0, 740, 5180, 11100]) {
      const gridWindow = windowAt(scrollTop)
      const visibleTasks = tasks.slice(gridWindow.startIndex, gridWindow.endIndex)
      // 完整任务数组永远能找出全部失败项；窗口切片最多只能看到部分
      expect(collectFailedFileIds(files, tasks)).toEqual(expected)
      expect(collectFailedFileIds(files, visibleTasks).length).toBeLessThanOrEqual(expected.length)
    }

    // 最后一个窗口覆盖到数组尾部，能看到失败任务
    const lastWindow = windowAt(11100)
    expect(
      tasks.slice(lastWindow.startIndex, lastWindow.endIndex).filter(isFailedAiTask)
    ).toHaveLength(2)
    // 即使任务数组完全不可见（空切片），文件级失败标记仍能兜底
    expect(collectFailedFileIds(files, [])).toEqual(expected)
  })

  it('删除 2 个失败项后剩 605 项，失败数为 0，上传仍可用且无跳过项', () => {
    const { files, tasks } = build607()
    const failedIds = collectFailedFileIds(files, tasks)

    const remainingFiles = files.filter(file => !failedIds.includes(file.id))
    const remainingTasks = tasks.filter(task => !failedIds.includes(task.fileId))

    expect(remainingFiles).toHaveLength(605)
    expect(collectFailedFileIds(remainingFiles, remainingTasks)).toEqual([])
    expect(remainingFiles.filter(isSkippedFile)).toHaveLength(0)
    expect(canStartUpload(remainingFiles, false)).toBe(true)
  })
})
