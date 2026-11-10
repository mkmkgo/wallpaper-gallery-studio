import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// 测试环境没有 IndexedDB，桩掉持久化层，让「删除后任务同步」用例保持确定性且不产生噪声
vi.mock('@/services/ai/task-storage', () => ({
  clearAiTaskRecords: vi.fn().mockResolvedValue(undefined),
  deleteAiTaskRecord: vi.fn().mockResolvedValue(undefined),
  formatTaskStorageError: vi.fn(error => error?.message || '任务存储不可用'),
  listAiTaskRecords: vi.fn().mockResolvedValue([]),
  patchAiTaskRecord: vi.fn().mockResolvedValue(undefined),
  putAiTaskRecord: vi.fn().mockResolvedValue(undefined)
}))

import UploadFileGrid from './UploadFileGrid.vue'
import { useAiTasksStore } from '@/stores/ai-tasks'
import { useUploadSessionStore } from '@/stores/upload-session'
import { collectFailedFileIds } from '@/features/upload-workspace/domain/failed-file-selection'
import { canStartUpload } from '@/features/upload-workspace/domain/upload-readiness'
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
  aiTaskStatus: 'failed',
  aiMetadata: null
})

// 605 张就绪 + 2 张 AI 分析失败，共 607 张
function buildFiles() {
  return [
    ...Array.from({ length: 605 }, (_, i) => readyFile(`ok-${i}`)),
    failedFile('fail-1'),
    failedFile('fail-2')
  ]
}

function mountGrid(files) {
  return shallowMount(UploadFileGrid, {
    props: { files, uploadMode: 'ai', uploading: false, selectedId: null },
    global: {
      stubs: {
        'el-checkbox': true,
        'el-icon': true,
        transition: false,
        'transition-group': false
      }
    }
  })
}

const deleteButton = wrapper => wrapper.find('.upload-file-grid__batch-delete')
const selectFailedButton = wrapper => wrapper.find('.upload-file-grid__select-failed')

describe('UploadFileGrid「勾选失败项」', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('607 张中 2 张失败：点「勾选失败项」只选中这 2 个 id', async () => {
    const wrapper = mountGrid(buildFiles())
    const button = selectFailedButton(wrapper)

    expect(button.exists()).toBe(true)
    expect(button.text()).toContain('勾选失败项 (2)')
    expect(wrapper.find('.upload-file-grid__failed-count').text()).toContain('失败 2 项')

    await button.trigger('click')

    expect(wrapper.find('.upload-file-grid__selected-count').text()).toContain('已选中 2 项')
    expect(deleteButton(wrapper).text()).toContain('删除选中 (2)')

    await deleteButton(wrapper).trigger('click')

    const emitted = wrapper.emitted('batch-delete')
    expect(emitted).toHaveLength(1)
    expect(emitted[0][0]).toEqual(['fail-1', 'fail-2'])
    expect(emitted[0][0]).not.toContain('ok-0')
  })

  it('无失败项时按钮禁用，且点击不会误选任何文件', async () => {
    const wrapper = mountGrid(buildFiles().slice(0, 605))
    const button = selectFailedButton(wrapper)

    expect(button.text()).toContain('勾选失败项 (0)')
    expect(button.attributes('disabled')).toBeDefined()
    expect(button.element.disabled).toBe(true)
    expect(button.attributes('title')).toContain('当前没有 AI 分析失败的任务')
    expect(wrapper.find('.upload-file-grid__failed-count--empty').text()).toContain('暂无失败项')

    await button.trigger('click')

    expect(deleteButton(wrapper).exists()).toBe(false)
    expect(wrapper.emitted('batch-delete')).toBeUndefined()
  })

  it('失败项滚出虚拟滚动窗口时，仍能从完整任务数组识别并勾选', async () => {
    const files = Array.from({ length: 607 }, (_, i) => ({
      id: `f-${i}`,
      name: `f-${i}.jpg`,
      status: 'pending',
      targetPath: '',
      aiTaskId: `ai_${i}`,
      // 故意保持未同步状态，验证必须依赖完整任务数组
      aiTaskStatus: 'queued'
    }))
    const tasks = files.map((file, index) => ({
      id: file.aiTaskId,
      fileId: file.id,
      status: index >= 605 ? 'failed' : 'completed'
    }))

    const aiTasksStore = useAiTasksStore()
    aiTasksStore.tasks = tasks

    const gridWindow = getVirtualGridWindow({
      itemCount: tasks.length,
      scrollTop: 0,
      viewportHeight: 320,
      columns: 4,
      rowHeight: 74,
      bufferRows: 2
    })
    expect(gridWindow.endIndex).toBeLessThan(605)
    expect(
      tasks
        .slice(gridWindow.startIndex, gridWindow.endIndex)
        .filter(task => task.status === 'failed')
    ).toHaveLength(0)

    const wrapper = mountGrid(files)
    expect(selectFailedButton(wrapper).text()).toContain('勾选失败项 (2)')

    await selectFailedButton(wrapper).trigger('click')
    await deleteButton(wrapper).trigger('click')

    expect(wrapper.emitted('batch-delete')[0][0]).toEqual(['f-605', 'f-606'])
  })

  it('虚拟滚动窗口变化（列表重排）后勾选状态仍保持，删除的仍是这 2 个失败项', async () => {
    const files = buildFiles()
    const wrapper = mountGrid(files)

    await selectFailedButton(wrapper).trigger('click')
    expect(wrapper.find('.upload-file-grid__selected-count').text()).toContain('已选中 2 项')

    // 模拟滚动导致的任务/卡片顺序重算：selectedIds 以文件 id 为准，不依赖索引或 DOM
    await wrapper.setProps({ files: [...files].reverse() })

    expect(wrapper.find('.upload-file-grid__selected-count').text()).toContain('已选中 2 项')
    await deleteButton(wrapper).trigger('click')
    expect(wrapper.emitted('batch-delete')[0][0]).toEqual(['fail-1', 'fail-2'])
  })

  it('删除后剩 605 项、失败数为 0、按钮禁用、上传仍可用', async () => {
    const files = buildFiles()
    const wrapper = mountGrid(files)

    await selectFailedButton(wrapper).trigger('click')
    await deleteButton(wrapper).trigger('click')
    const ids = wrapper.emitted('batch-delete')[0][0]

    // 模拟 UploadView 的 @remove-batch="uploadStore.removeFiles" 与清空选中
    const remaining = files.filter(file => !ids.includes(file.id))
    wrapper.vm.clearSelection()
    await wrapper.setProps({ files: remaining })

    expect(remaining).toHaveLength(605)
    expect(wrapper.find('.upload-file-grid__count').text()).toContain('共 605 个文件')
    expect(wrapper.find('.upload-file-grid__failed-count--empty').text()).toContain('暂无失败项')
    expect(selectFailedButton(wrapper).element.disabled).toBe(true)
    expect(wrapper.find('.upload-file-grid__selected-count').exists()).toBe(false)
    expect(canStartUpload(remaining, false)).toBe(true)
  })

  it('端到端：removeFiles 删除失败项后文件与 AI 任务同步为 605 项、失败数 0', () => {
    const aiTasksStore = useAiTasksStore()
    const uploadStore = useUploadSessionStore()
    // 屏蔽自动恢复逻辑，保证用例只验证本次删除链路
    uploadStore.tasksRestored = true
    aiTasksStore.initialized = true

    const files = buildFiles()
    const tasks = files.map(file => ({
      id: file.aiTaskId,
      fileId: file.id,
      status: file.aiTaskStatus === 'failed' ? 'failed' : 'completed'
    }))
    uploadStore.setFiles(files)
    aiTasksStore.tasks = tasks

    expect(uploadStore.skippedFiles).toHaveLength(2)
    expect(aiTasksStore.failedTasks).toHaveLength(2)

    const failedIds = collectFailedFileIds(uploadStore.files, aiTasksStore.tasks)
    expect(failedIds).toEqual(['fail-1', 'fail-2'])

    uploadStore.removeFiles(failedIds)

    expect(uploadStore.files).toHaveLength(605)
    expect(aiTasksStore.failedTasks).toHaveLength(0)
    expect(uploadStore.skippedFiles).toHaveLength(0)
    expect(uploadStore.uploadableFiles).toHaveLength(605)
    expect(canStartUpload(uploadStore.files, false)).toBe(true)
  })
})
