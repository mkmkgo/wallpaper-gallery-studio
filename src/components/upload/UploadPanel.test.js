import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UploadPanel from './UploadPanel.vue'
import UploadHeader from './UploadPanel/UploadHeader.vue'

const readyFile = id => ({
  id,
  name: `${id}.jpg`,
  status: 'pending',
  targetPath: `wallpaper/mobile/风景/${id}.jpg`
})

const failedFile = id => ({
  id,
  name: `${id}.jpg`,
  status: 'pending',
  targetPath: '',
  aiTaskStatus: 'failed'
})

describe('UploadPanel 上传按钮', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('存在失败任务（605 成功 + 2 失败）时上传按钮仍可用', () => {
    const files = [
      ...Array.from({ length: 605 }, (_, i) => readyFile(`ok-${i}`)),
      failedFile('fail-1'),
      failedFile('fail-2')
    ]

    const wrapper = shallowMount(UploadPanel, {
      props: {
        files,
        uploadMode: 'ai',
        canUpload: true,
        pendingCount: files.length
      }
    })

    const header = wrapper.findComponent(UploadHeader)
    expect(header.exists()).toBe(true)
    // 上传按钮 :disabled="!canStartUpload"，为 true 即按钮可点击
    expect(header.props('canStartUpload')).toBe(true)
    // 2 张失败项作为「跳过项」明确告知用户，而不是静默吞掉
    expect(header.props('skippedCount')).toBe(2)
  })

  it('全部图片都未就绪时上传按钮保持禁用', () => {
    const wrapper = shallowMount(UploadPanel, {
      props: {
        files: [failedFile('f1'), failedFile('f2')],
        uploadMode: 'ai',
        canUpload: true
      }
    })

    expect(wrapper.findComponent(UploadHeader).props('canStartUpload')).toBe(false)
  })
})
