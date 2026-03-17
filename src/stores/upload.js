import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { githubService } from '@/services/github'
import { useConfigStore } from './config'
import { useHistoryStore } from './history'
import { useCredentialsStore } from './credentials'
import { previewManager } from '@/utils/previewManager'
import { hashWorker } from '@/utils/hashWorker'
import { imageCompressor } from '@/utils/imageCompressor'
import {
  analyzeImage as classifierAnalyze,
  CLASSIFIER_CONFIG,
  getModelList
} from '@/services/ai/classifier'

// 允许的文件类型
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const UPLOAD_DELAY = 500 // 上传间隔 500ms，避免触发限流
const BATCH_WARNING_THRESHOLD = 50 // 超过 50 张提示警告

// 元数据仓库配置（owner/repo 从 config store 读取，与上传目标仓库一致）
const METADATA_REPO = {
  branch: 'main',
  pendingDir: 'metadata-pending'
}

export const useUploadStore = defineStore('upload', () => {
  // 状态
  const files = ref([])
  const uploading = ref(false)
  const currentFileIndex = ref(-1)

  // 上传模式: 'ai' = AI 智能分类（推荐）, 'manual' = 手动选择分类
  const uploadMode = ref('ai')

  // AI 分析状态
  const aiAnalyzing = ref(false)
  const aiAnalyzingCount = ref(0)

  // AI 配置（可选覆盖默认值）
  const selectedProvider = ref(null) // null = 使用默认
  const selectedModelKey = ref(null) // null = 使用默认

  // 目标路径
  const series = ref('desktop') // desktop | mobile | avatar
  const categoryL1 = ref('')
  const categoryL2 = ref('')

  // 计算属性
  const targetPath = computed(() => {
    if (!categoryL1.value) return ''
    const parts = ['wallpaper', series.value, categoryL1.value]
    if (categoryL2.value) parts.push(categoryL2.value)
    return parts.join('/')
  })

  const totalProgress = computed(() => {
    if (files.value.length === 0) return 0
    const total = files.value.reduce((sum, f) => sum + f.progress, 0)
    return Math.round(total / files.value.length)
  })

  const pendingFiles = computed(() => files.value.filter(f => f.status === 'pending'))
  const uploadingFiles = computed(() => files.value.filter(f => f.status === 'uploading'))
  const successFiles = computed(() => files.value.filter(f => f.status === 'success'))
  const errorFiles = computed(() => files.value.filter(f => f.status === 'error'))

  // 生成唯一 ID
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  // 获取文件扩展名
  function getExtension(filename) {
    return filename.split('.').pop().toLowerCase()
  }

  // 验证文件
  function validateFile(file) {
    // 检查文件类型
    const ext = getExtension(file.name)
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `不支持的文件格式: ${ext}` }
    }

    // 检查 MIME 类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: `不支持的文件类型: ${file.type}` }
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `文件大小超过限制 (最大 25MB)` }
    }

    return { valid: true }
  }

  // 创建预览 URL（使用PreviewManager管理）
  function createPreview(file, fileId) {
    return previewManager.createPreview(fileId, file)
  }

  // ✅ P2优化：添加文件时自动压缩大图片
  async function addFiles(newFiles) {
    const validFiles = []

    for (const file of newFiles) {
      const validation = validateFile(file)

      if (validation.valid) {
        const id = generateId()

        // 尝试压缩图片（仅对大于5MB的文件进行压缩）
        let processedFile = file
        let compressed = false
        let originalSize = file.size

        // 只对超过20MB的文件进行压缩，保护8K图片
        if (file.size > 20 * 1024 * 1024) {
          try {
            const result = await imageCompressor.compress(file, {
              maxWidth: 7680, // 支持8K分辨率
              maxHeight: 4320,
              maxPixels: 33177600, // 8K像素总数，支持非标准尺寸
              quality: 0.95, // 更高质量
              maxSizeMB: 20 // 更大的目标大小
            })

            if (result.compressed) {
              processedFile = result.file
              compressed = true
              console.log(
                `图片已压缩: ${file.name}`,
                `原始: ${(originalSize / 1024 / 1024).toFixed(2)}MB`,
                `压缩后: ${(result.compressedSize / 1024 / 1024).toFixed(2)}MB`,
                `压缩率: ${result.ratio.toFixed(2)}x`
              )
            }
          } catch (error) {
            console.warn(`图片压缩失败，使用原图: ${file.name}`, error)
          }
        }

        validFiles.push({
          id,
          file: processedFile,
          name: file.name,
          size: processedFile.size,
          originalSize,
          compressed,
          preview: createPreview(processedFile, id),
          status: 'pending',
          progress: 0,
          error: null,
          // 每个文件独立的目标路径，默认使用全局设置
          targetPath: targetPath.value,
          targetSeries: series.value,
          targetL1: categoryL1.value,
          targetL2: categoryL2.value,
          // AI 元数据（由 AI 分析填充，可选）
          aiMetadata: null
        })
      } else {
        // 可以在这里触发错误提示
        console.warn(`文件验证失败: ${file.name} - ${validation.error}`)
      }
    }

    files.value.push(...validFiles)

    // AI 模式下自动触发分析
    if (uploadMode.value === 'ai' && validFiles.length > 0) {
      triggerAiAnalysis(validFiles)
    }

    return validFiles
  }

  // AI 智能分析：为文件自动生成分类
  async function triggerAiAnalysis(filesToAnalyze) {
    const credentialsStore = useCredentialsStore()

    // 检查是否有 AI 凭证
    if (!credentialsStore.hasCredentials) {
      console.warn('AI 分析：未配置 AI 凭证')
      return
    }

    // 使用选择的 Provider，或默认的
    const provider = selectedProvider.value || credentialsStore.defaultProvider
    const credentials = credentialsStore.getCredentialsByProvider(provider)

    if (!credentials) {
      console.warn(`AI 分析：未找到 ${provider} 的凭证`)
      return
    }

    // 使用选择的模型，或该 Provider 的默认模型
    const providerModels = getModelList(provider)
    let modelKey = selectedModelKey.value
    if (!modelKey || !providerModels.find(m => m.key === modelKey)) {
      modelKey = providerModels.length > 0 ? providerModels[0].key : CLASSIFIER_CONFIG.defaultModel
    }

    aiAnalyzing.value = true
    aiAnalyzingCount.value = filesToAnalyze.length

    // 并行分析所有文件（但限制并发数）
    const concurrency = 3
    const queue = [...filesToAnalyze]

    async function processNext() {
      while (queue.length > 0) {
        const uploadFile = queue.shift()
        if (!uploadFile) break

        try {
          const result = await classifierAnalyze({
            file: uploadFile.file,
            series: series.value,
            providerType: provider,
            credentials,
            modelKey
          })

          // 构建 AI 元数据（使用统一字段名）
          const aiMetadata = {
            series: series.value,
            category: result.secondary || '通用',
            subcategory: result.third || '',
            // 保留原始字段
            primary: series.value,
            secondary: result.secondary || '通用',
            third: result.third || '',
            // 其他元数据
            keywords: result.keywords || [],
            description: result.description || '',
            filenameSuggestions: result.filenameSuggestions || [],
            displayTitle: result.displayTitle || null,
            confidence: result.confidence || 0,
            reasoning: result.reasoning || null
          }

          // 设置 AI 元数据（会自动应用分类）
          setFileAiMetadata(uploadFile.id, aiMetadata)
        } catch (error) {
          console.error(`AI 分析失败: ${uploadFile.name}`, error)
          // 分析失败时设置一个默认元数据
          const fallbackMetadata = {
            series: series.value,
            category: '通用',
            subcategory: '',
            primary: series.value,
            secondary: '通用',
            third: '',
            keywords: [],
            description: '',
            filenameSuggestions: [],
            displayTitle: null,
            confidence: 0,
            reasoning: null,
            error: error.message
          }
          setFileAiMetadata(uploadFile.id, fallbackMetadata)
        }

        aiAnalyzingCount.value--
      }
    }

    // 启动并发分析
    const workers = []
    for (let i = 0; i < Math.min(concurrency, filesToAnalyze.length); i++) {
      workers.push(processNext())
    }

    await Promise.all(workers)
    aiAnalyzing.value = false
  }

  // 更新单个文件的目标路径
  function updateFileTarget(fileId, newSeries, l1, l2 = '') {
    const file = files.value.find(f => f.id === fileId)
    if (file && file.status === 'pending') {
      file.targetSeries = newSeries
      file.targetL1 = l1
      file.targetL2 = l2
      const parts = ['wallpaper', newSeries, l1]
      if (l2) parts.push(l2)
      file.targetPath = parts.join('/')
    }
  }

  // 批量更新文件目标路径（选中的文件）
  function updateFilesTarget(fileIds, newSeries, l1, l2 = '') {
    const parts = ['wallpaper', newSeries, l1]
    if (l2) parts.push(l2)
    const newPath = parts.join('/')

    fileIds.forEach(id => {
      const file = files.value.find(f => f.id === id)
      if (file && file.status === 'pending') {
        file.targetSeries = newSeries
        file.targetL1 = l1
        file.targetL2 = l2
        file.targetPath = newPath
      }
    })
  }

  // 设置单个文件的 AI 元数据
  // autoApply: 是否自动应用 AI 推荐的分类到文件的 targetPath（默认 true）
  function setFileAiMetadata(fileId, aiMetadata, autoApply = true) {
    const file = files.value.find(f => f.id === fileId)
    if (file) {
      file.aiMetadata = aiMetadata

      // 在 AI 模式下自动应用推荐的分类
      if (autoApply && aiMetadata && file.status === 'pending') {
        // 支持两种字段命名：
        // 1. series/category/subcategory（新格式）
        // 2. primary/secondary/third（AI 分析返回格式）
        const aiSeries = aiMetadata.series || aiMetadata.primary
        const category = aiMetadata.category || aiMetadata.secondary
        const subcategory = aiMetadata.subcategory || aiMetadata.third || ''

        if (aiSeries && category) {
          file.targetSeries = aiSeries
          file.targetL1 = category
          file.targetL2 = subcategory
          const parts = ['wallpaper', aiSeries, category]
          if (subcategory) parts.push(subcategory)
          file.targetPath = parts.join('/')

          // 标准化 aiMetadata 的字段名，确保后续使用一致
          if (!aiMetadata.series) aiMetadata.series = aiSeries
          if (!aiMetadata.category) aiMetadata.category = category
          if (!aiMetadata.subcategory) aiMetadata.subcategory = subcategory
        }
      }
    }
  }

  // 批量设置文件的 AI 元数据
  function setFilesAiMetadata(metadataMap) {
    for (const [fileId, aiMetadata] of Object.entries(metadataMap)) {
      setFileAiMetadata(fileId, aiMetadata)
    }
  }

  // 移除文件
  function removeFile(id) {
    const index = files.value.findIndex(f => f.id === id)
    if (index > -1) {
      // 释放预览 URL（使用PreviewManager）
      previewManager.revokePreview(id)
      // 从数组中移除（包括 aiMetadata 等所有数据）
      files.value.splice(index, 1)
      // 注意：file 对象被移除后，其 aiMetadata 也会被垃圾回收
    }
  }

  // 批量移除文件
  function removeFiles(ids) {
    // 批量释放预览URL
    previewManager.revokePreviews(ids)
    // 从数组中移除（包括 aiMetadata 等所有数据）
    files.value = files.value.filter(f => !ids.includes(f.id))
    // 注意：被过滤掉的 file 对象及其 aiMetadata 会被垃圾回收
  }

  // 清空所有文件
  function clearFiles() {
    // 释放所有预览URL
    previewManager.revokeAll()
    // 清空数组（包括所有 aiMetadata）
    files.value = []
  }

  // 清理成功上传的文件（释放内存）
  function clearSuccessFiles() {
    const successIds = files.value.filter(f => f.status === 'success').map(f => f.id)
    // 批量释放预览URL
    previewManager.revokePreviews(successIds)
    // 从数组中移除
    files.value = files.value.filter(f => f.status !== 'success')
    return successIds.length
  }

  // 检查文件是否存在
  async function checkDuplicate(filename) {
    const configStore = useConfigStore()
    const { owner, repo, branch } = configStore.config
    const path = `${targetPath.value}/${filename}`

    return githubService.checkFileExists(owner, repo, path, branch)
  }

  // 批量检查重复文件
  async function checkDuplicates(filenames) {
    const configStore = useConfigStore()
    const { owner, repo, branch } = configStore.config
    const duplicates = []

    for (const filename of filenames) {
      const path = `${targetPath.value}/${filename}`
      const exists = await githubService.checkFileExists(owner, repo, path, branch)
      if (exists) {
        duplicates.push(filename)
      }
    }

    return duplicates
  }

  // 计算文件内容 Hash（用于检测内容重复）
  // ✅ P1优化：使用Web Worker在后台线程计算，避免阻塞主线程
  async function computeFileHash(file) {
    try {
      return await hashWorker.computeHash(file)
    } catch (error) {
      console.error('Hash计算失败，回退到主线程:', error)
      // 回退方案：主线程计算
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    }
  }

  // ✅ P1优化：localStorage批量操作和内存缓存
  // 检查本地上传记录（避免同一会话重复上传）
  const HASH_STORAGE_KEY = 'uploaded_hashes'
  const HASH_MAX_COUNT = 500 // 最多保留 500 条
  const HASH_EXPIRE_DAYS = 30 // 30 天后过期

  // 内存缓存，减少localStorage读取
  let hashCache = null
  let hashCacheDirty = false
  let saveTimer = null

  function getUploadedHashes() {
    // 使用内存缓存
    if (hashCache) return hashCache

    try {
      const stored = localStorage.getItem(HASH_STORAGE_KEY)
      if (!stored) {
        hashCache = {}
        return hashCache
      }

      const hashes = JSON.parse(stored)
      const now = Date.now()
      const expireMs = HASH_EXPIRE_DAYS * 24 * 60 * 60 * 1000

      // 过滤掉过期的记录
      const valid = {}
      for (const [hash, data] of Object.entries(hashes)) {
        if (now - data.time < expireMs) {
          valid[hash] = data
        }
      }

      hashCache = valid
      return hashCache
    } catch {
      hashCache = {}
      return hashCache
    }
  }

  function saveHashesToStorage() {
    if (!hashCache || !hashCacheDirty) return

    try {
      // 限制数量
      const entries = Object.entries(hashCache)
      if (entries.length > HASH_MAX_COUNT) {
        entries.sort((a, b) => b[1].time - a[1].time)
        hashCache = Object.fromEntries(entries.slice(0, HASH_MAX_COUNT))
      }

      localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(hashCache))
      hashCacheDirty = false
    } catch (error) {
      console.error('保存哈希记录失败:', error)
    }
  }

  function addUploadedHash(hash, filename, path) {
    const hashes = getUploadedHashes()
    hashes[hash] = { filename, path, time: Date.now() }
    hashCacheDirty = true

    // 延迟保存，避免频繁写入localStorage
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveHashesToStorage, 1000)
  }

  function isHashUploaded(hash) {
    const hashes = getUploadedHashes()
    return hashes[hash] || null
  }

  // 清除上传记录（手动清理）
  function clearUploadedHashes() {
    hashCache = {}
    hashCacheDirty = false
    if (saveTimer) clearTimeout(saveTimer)
    localStorage.removeItem(HASH_STORAGE_KEY)
  }

  // 上传单个文件
  async function uploadFile(uploadFile) {
    const configStore = useConfigStore()
    const historyStore = useHistoryStore()
    const { owner, repo, branch } = configStore.config

    // 使用文件自己的目标路径，如果没有则使用全局的
    const fileTargetPath = uploadFile.targetPath || targetPath.value
    const fileSeries = uploadFile.targetSeries || series.value

    if (!fileTargetPath) {
      uploadFile.status = 'error'
      uploadFile.error = '未设置上传目录'
      return { success: false, errorType: 'NO_TARGET', error: uploadFile.error }
    }

    uploadFile.status = 'uploading'
    uploadFile.progress = 0

    // 模拟进度（GitHub API 不支持进度回调）
    const progressInterval = setInterval(() => {
      if (uploadFile.progress < 90) {
        uploadFile.progress += 10
      }
    }, 200)

    try {
      const path = `${fileTargetPath}/${uploadFile.name}`
      const message = `Upload: ${uploadFile.name}`

      // 计算文件 Hash 并检查是否已上传
      const hash = await computeFileHash(uploadFile.file)
      const existingUpload = isHashUploaded(hash)
      if (existingUpload) {
        clearInterval(progressInterval)
        uploadFile.status = 'error'
        uploadFile.error = `文件内容重复，已在 ${existingUpload.path} 上传过`
        return { success: false, errorType: 'DUPLICATE', error: uploadFile.error }
      }

      await githubService.uploadImage(owner, repo, path, uploadFile.file, message, branch)

      uploadFile.progress = 100
      uploadFile.status = 'success'

      // 清理进度定时器
      clearInterval(progressInterval)

      // 记录已上传的 Hash
      addUploadedHash(hash, uploadFile.name, path)

      // 添加到历史记录
      historyStore.addRecord({
        filename: uploadFile.name,
        category: fileTargetPath,
        series: fileSeries,
        status: 'success'
      })

      return { success: true }
    } catch (error) {
      // 清理进度定时器
      clearInterval(progressInterval)

      uploadFile.status = 'error'

      // 根据错误类型设置更具体的错误信息
      if (error.type === 'PERMISSION_DENIED') {
        uploadFile.error = '权限不足：您没有该仓库的写入权限'
      } else if (error.type === 'RATE_LIMITED') {
        uploadFile.error = 'API 请求过于频繁，请稍后重试'
      } else if (error.type === 'TOKEN_EXPIRED') {
        uploadFile.error = '登录已过期，请重新登录'
      } else if (error.type === 'NETWORK_ERROR') {
        uploadFile.error = '网络连接失败，请检查网络'
      } else if (error.message?.includes('sha') || error.message?.includes('already exists')) {
        uploadFile.error = '文件已存在，请勿重复上传'
      } else {
        uploadFile.error = error.message || '上传失败'
      }

      // 添加失败记录
      historyStore.addRecord({
        filename: uploadFile.name,
        category: fileTargetPath,
        series: fileSeries,
        status: 'error'
      })

      return { success: false, errorType: error.type, error: uploadFile.error }
    }
  }

  // 上传所有待上传文件
  async function uploadAll() {
    if (uploading.value || pendingFiles.value.length === 0) return

    // 检查是否所有待上传文件都有目标路径
    const filesWithoutTarget = pendingFiles.value.filter(f => !f.targetPath)
    if (filesWithoutTarget.length > 0) {
      throw new Error(`有 ${filesWithoutTarget.length} 个文件未设置上传目录`)
    }

    uploading.value = true
    const results = []
    const uploadedFiles = [] // 收集成功上传的文件
    let permissionError = false

    for (let i = 0; i < files.value.length; i++) {
      const file = files.value[i]
      if (file.status === 'pending') {
        currentFileIndex.value = i
        const result = await uploadFile(file)
        results.push({ file, ...result })

        // 收集成功上传的文件用于生成 metadata
        if (result.success) {
          uploadedFiles.push(file)
        }

        // 如果是权限错误，停止后续上传
        if (result.errorType === 'PERMISSION_DENIED') {
          permissionError = true
          // 将剩余待上传文件标记为错误
          files.value.forEach(f => {
            if (f.status === 'pending') {
              f.status = 'error'
              f.error = '权限不足：您没有该仓库的写入权限'
            }
          })
          break
        }

        // 上传间隔，避免触发 API 限流
        if (i < files.value.length - 1) {
          await new Promise(r => setTimeout(r, UPLOAD_DELAY))
        }
      }
    }

    currentFileIndex.value = -1
    uploading.value = false

    // 如果有成功上传的文件，生成 metadata-pending
    let metadataResult = null
    if (uploadedFiles.length > 0 && !permissionError) {
      metadataResult = await generatePendingMetadata(uploadedFiles)
    }

    // 返回结果，包含权限错误标记和 metadata 生成结果
    return { results, permissionError, metadataResult }
  }

  // 获取 API 配额信息
  function getRateLimit() {
    return githubService.getRateLimit()
  }

  // 检查批量上传是否需要警告
  function shouldWarnBatchUpload(count) {
    return count > BATCH_WARNING_THRESHOLD
  }

  // 估算上传时间（秒）
  function estimateUploadTime(count) {
    // 每个文件约 2-3 秒（包含间隔）
    return Math.ceil(count * 2.5)
  }

  // 重试失败的文件
  async function retryFailed() {
    const failedFiles = errorFiles.value
    failedFiles.forEach(f => {
      f.status = 'pending'
      f.progress = 0
      f.error = null
    })

    return uploadAll()
  }

  // 生成并上传 metadata-pending 文件
  // 在批量上传完成后调用，将成功上传的图片信息写入 metadata-pending/{timestamp}.json
  async function generatePendingMetadata(uploadedFiles) {
    if (!uploadedFiles || uploadedFiles.length === 0) return null

    const configStore = useConfigStore()
    const { owner, repo, branch } = configStore.config

    // 构建 pending 数据结构
    const pendingData = {
      version: 1,
      createdAt: new Date().toISOString(),
      source: 'studio',
      targetRepo: { owner, repo, branch },
      images: []
    }

    for (const file of uploadedFiles) {
      const fileTargetPath = file.targetPath || targetPath.value
      const fileSeries = file.targetSeries || series.value
      const relativePath = `${fileTargetPath}/${file.name}`

      // 解析分类信息
      const pathParts = fileTargetPath.split('/')
      const category = pathParts[2] || ''
      const subcategory = pathParts[3] || ''

      // 构建图片元数据
      const imageData = {
        series: fileSeries,
        relativePath,
        category,
        subcategory,
        filename: file.name,
        createdAt: new Date().toISOString(),
        size: file.size,
        format: getExtension(file.name),
        ai: file.aiMetadata || {
          keywords: extractKeywordsFromFilename(file.name),
          description: '',
          displayTitle: '',
          filename: '', // AI 建议的文件名（如果有）
          confidence: 0,
          model: 'none',
          analyzedAt: null
        }
      }

      pendingData.images.push(imageData)
    }

    // 生成文件名（时间戳 + 随机数）
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const pendingFilename = `${timestamp}-${random}.json`
    const pendingPath = `${METADATA_REPO.pendingDir}/${pendingFilename}`

    try {
      // 上传到图床仓库的 metadata-pending 目录
      const content = JSON.stringify(pendingData, null, 2)

      await githubService.createFile(
        owner,
        repo,
        pendingPath,
        content,
        `Add pending metadata: ${pendingFilename}`,
        branch
      )

      console.log(`Metadata pending file created: ${pendingPath}`)
      return { success: true, path: pendingPath, count: uploadedFiles.length }
    } catch (error) {
      console.error('Failed to create metadata pending file:', error)
      return { success: false, error: error.message }
    }
  }

  // 从文件名提取关键词（用于非 AI 上传的回退方案）
  function extractKeywordsFromFilename(filename) {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
    const separators = /[-_\s、，,&]+/
    const parts = nameWithoutExt
      .split(separators)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 20)
      .filter(s => !/^\d+$/.test(s))
      .filter(s => !/^(jpg|png|webp|gif|jpeg)$/i.test(s))
    return [...new Set(parts)]
  }

  // 设置目标分类
  function setTarget(newSeries, l1, l2 = '') {
    series.value = newSeries
    categoryL1.value = l1
    categoryL2.value = l2
  }

  // 设置上传模式
  function setUploadMode(mode) {
    if (mode === 'ai' || mode === 'manual') {
      uploadMode.value = mode
    }
  }

  // 应用 AI 推荐的分类到文件
  function applyAiRecommendation(fileId) {
    const file = files.value.find(f => f.id === fileId)
    if (file && file.aiMetadata && file.status === 'pending') {
      // 支持两种字段命名
      const aiSeries = file.aiMetadata.series || file.aiMetadata.primary
      const category = file.aiMetadata.category || file.aiMetadata.secondary
      const subcategory = file.aiMetadata.subcategory || file.aiMetadata.third || ''

      if (aiSeries && category) {
        updateFileTarget(fileId, aiSeries, category, subcategory)
      }
    }
  }

  // 批量应用 AI 推荐
  function applyAllAiRecommendations() {
    const pending = files.value.filter(f => f.status === 'pending' && f.aiMetadata)
    pending.forEach(file => {
      // 支持两种字段命名
      const aiSeries = file.aiMetadata.series || file.aiMetadata.primary
      const category = file.aiMetadata.category || file.aiMetadata.secondary
      const subcategory = file.aiMetadata.subcategory || file.aiMetadata.third || ''

      if (aiSeries && category) {
        updateFileTarget(file.id, aiSeries, category, subcategory)
      }
    })
    return pending.length
  }

  // 检查是否所有待上传文件都已设置目标路径（AI模式下需要等AI分析完成）
  function canStartUpload() {
    const pending = pendingFiles.value
    if (pending.length === 0) return false
    return pending.every(f => f.targetPath)
  }

  // 设置 AI Provider
  function setAiProvider(provider) {
    selectedProvider.value = provider
    // 切换 Provider 时重置模型选择
    selectedModelKey.value = null
  }

  // 设置 AI 模型
  function setAiModel(modelKey) {
    selectedModelKey.value = modelKey
  }

  // 获取当前 AI 配置信息
  function getCurrentAiConfig() {
    const credentialsStore = useCredentialsStore()
    const provider = selectedProvider.value || credentialsStore.defaultProvider
    const providerModels = getModelList(provider)

    let modelKey = selectedModelKey.value
    if (!modelKey || !providerModels.find(m => m.key === modelKey)) {
      modelKey = providerModels.length > 0 ? providerModels[0].key : CLASSIFIER_CONFIG.defaultModel
    }

    const model = providerModels.find(m => m.key === modelKey)

    const providerDisplay = {
      groq: { name: 'Groq AI', icon: '⚡' },
      modelscope: { name: 'ModelScope AI', icon: '🔬' },
      cloudflare: { name: 'Cloudflare AI', icon: '☁️' }
    }
    const display = providerDisplay[provider] || { name: provider, icon: '🤖' }

    return {
      provider,
      providerName: display.name,
      providerIcon: display.icon,
      modelKey,
      modelName: model?.name || modelKey,
      availableModels: providerModels
    }
  }

  // ✅ P1优化：添加清理方法，释放所有资源
  function cleanup() {
    // 释放所有预览URL
    previewManager.revokeAll()
    // 终止Hash Worker
    hashWorker.terminate()
    // 保存哈希缓存到localStorage
    saveHashesToStorage()
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    // 清空文件列表
    files.value = []
  }

  return {
    // 状态
    files,
    uploading,
    currentFileIndex,
    uploadMode,
    series,
    categoryL1,
    categoryL2,
    // AI 分析状态
    aiAnalyzing,
    aiAnalyzingCount,
    // AI 配置
    selectedProvider,
    selectedModelKey,
    // 计算属性
    targetPath,
    totalProgress,
    pendingFiles,
    uploadingFiles,
    successFiles,
    errorFiles,
    // 方法
    validateFile,
    addFiles,
    triggerAiAnalysis,
    removeFile,
    removeFiles,
    clearFiles,
    checkDuplicate,
    uploadFile,
    uploadAll,
    retryFailed,
    setTarget,
    setUploadMode,
    setAiProvider,
    setAiModel,
    getCurrentAiConfig,
    updateFileTarget,
    updateFilesTarget,
    setFileAiMetadata,
    setFilesAiMetadata,
    applyAiRecommendation,
    applyAllAiRecommendations,
    canStartUpload,
    generatePendingMetadata,
    getRateLimit,
    shouldWarnBatchUpload,
    estimateUploadTime,
    clearSuccessFiles,
    checkDuplicates,
    computeFileHash,
    isHashUploaded,
    clearUploadedHashes,
    cleanup
  }
})

// 导出常量供外部使用
export { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, BATCH_WARNING_THRESHOLD }
