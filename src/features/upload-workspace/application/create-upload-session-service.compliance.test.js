import { describe, it, expect, vi } from 'vitest'
import { createUploadSessionService } from './create-upload-session-service.js'

function createService() {
  const uploadImage = vi.fn().mockResolvedValue({})
  const createFile = vi.fn().mockResolvedValue({})
  const mocks = {
    uploadImage,
    createFile,
    getContext: vi.fn(() => ({ owner: 'o', repo: 'r', branch: 'main' })),
    addRecord: vi.fn(),
    isHashUploaded: vi.fn(() => null),
    getPendingUploadedHash: vi.fn(() => null),
    addPendingUploadedHash: vi.fn()
  }
  const service = createUploadSessionService({
    repository: {
      uploadImage: mocks.uploadImage,
      createFile: mocks.createFile,
      getContext: mocks.getContext
    },
    sessionCache: {
      isHashUploaded: mocks.isHashUploaded,
      getPendingUploadedHash: mocks.getPendingUploadedHash,
      addPendingUploadedHash: mocks.addPendingUploadedHash
    },
    historyStore: { addRecord: mocks.addRecord },
    wait: async () => {},
    now: () => 1700000000000,
    random: () => 0.123
  })
  return { service, mocks }
}

const uploadOptions = {
  targetPath: 'wallpaper/mobile/风景/建筑',
  series: 'mobile',
  computeFileHash: async () => 'hash-1'
}

const metadataOptions = {
  targetPath: 'wallpaper/mobile/风景/建筑',
  series: 'mobile',
  getExtension: () => 'jpg',
  extractKeywordsFromFilename: () => []
}

describe('上传服务层合规闸门（绝不入仓）', () => {
  it('写图前命中敏感词 → 返回失败且不调用 repository.uploadImage', async () => {
    const { service, mocks } = createService()
    const file = {
      name: '示例.jpg',
      status: 'pending',
      file: {},
      targetL1: '风景',
      targetL2: '建筑',
      aiMetadata: { displayTitle: '政治人物肖像壁纸', keywords: ['暖色调'] }
    }

    const result = await service.uploadFile(file, uploadOptions)

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('COMPLIANCE_REJECTED')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(file.complianceRejected).toBe(true)
    expect(file.status).toBe('error')
  })

  it('已标记 complianceRejected 的文件即使元数据干净也不再上传', async () => {
    const { service, mocks } = createService()
    const file = {
      name: '已拒.jpg',
      status: 'pending',
      file: {},
      complianceRejected: true,
      aiMetadata: { displayTitle: '柔光室内特写', keywords: ['自然光'] }
    }

    const result = await service.uploadFile(file, uploadOptions)

    expect(result.success).toBe(false)
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('文件名 / targetPath 本身含敏感词也在写图前拦截', async () => {
    const { service, mocks } = createService()
    const file = {
      name: '党旗主题.jpg',
      status: 'pending',
      file: {},
      aiMetadata: { displayTitle: '柔光室内特写', keywords: ['自然光'] }
    }

    const result = await service.uploadFile(file, uploadOptions)
    expect(result.success).toBe(false)
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('写 metadata-pending 之前最终闸门：违规文件不写入 createFile', async () => {
    const { service, mocks } = createService()
    const bad = {
      name: 'bad.jpg',
      status: 'success',
      targetPath: 'wallpaper/mobile/风景/建筑',
      size: 100,
      aiMetadata: { displayTitle: '国旗主题清冷感', keywords: ['暖色调'] }
    }

    const result = await service.generatePendingMetadata([bad], metadataOptions)

    expect(result.success).toBe(false)
    expect(mocks.createFile).not.toHaveBeenCalled()
    expect(bad.complianceRejected).toBe(true)
  })

  it('合规文件仍正常上传与写入 metadata-pending', async () => {
    const { service, mocks } = createService()
    const good = {
      name: 'good.jpg',
      status: 'pending',
      file: {},
      targetPath: 'wallpaper/mobile/风景/建筑',
      size: 100,
      aiMetadata: { displayTitle: '柔光室内特写', keywords: ['自然光'], description: '室内' }
    }

    const uploadResult = await service.uploadFile(good, uploadOptions)
    expect(uploadResult.success).toBe(true)
    expect(mocks.uploadImage).toHaveBeenCalledTimes(1)

    const metadataResult = await service.generatePendingMetadata([good], metadataOptions)
    expect(metadataResult.success).toBe(true)
    expect(mocks.createFile).toHaveBeenCalledTimes(1)
  })

  it('上传目标路径含 /政治/ 分类名 → 服务层闸门拦截，绝不调用 uploadImage', async () => {
    const { service, mocks } = createService()
    const file = {
      name: 'a.jpg',
      status: 'pending',
      file: {},
      aiMetadata: { displayTitle: '柔光室内特写', keywords: ['自然光'] }
    }

    const result = await service.uploadFile(file, {
      targetPath: 'wallpaper/mobile/政治/通用',
      series: 'mobile',
      computeFileHash: async () => 'hash-path'
    })

    expect(result.success).toBe(false)
    expect(result.errorType).toBe('COMPLIANCE_REJECTED')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
    expect(file.complianceRejected).toBe(true)
  })

  it('上传目标路径为 URL 编码分类名 → 同样拦截', async () => {
    const { service, mocks } = createService()
    const file = {
      name: 'a.jpg',
      status: 'pending',
      file: {},
      aiMetadata: { displayTitle: '柔光室内特写' }
    }

    const result = await service.uploadFile(file, {
      targetPath: `wallpaper/mobile/${encodeURIComponent('政治')}/通用`,
      series: 'mobile',
      computeFileHash: async () => 'hash-encoded'
    })

    expect(result.success).toBe(false)
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })
})
