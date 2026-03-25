<template>
  <MainLayout>
    <!-- 全局加载状态（仅在必要时显示） -->
    <div v-if="pageLoading" class="upload-view__loading">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-text">加载中...</p>
      </div>
    </div>

    <div v-else ref="viewRef" class="upload-view">
      <!-- 只读提示 -->
      <el-alert
        v-if="authStore.permissionChecked && !authStore.canUpload"
        type="warning"
        :closable="false"
        class="upload-view__readonly-alert"
      >
        <template #title>
          <span>🔒 只读模式 - 当前账号没有上传权限，仅可浏览分类</span>
        </template>
      </el-alert>

      <!-- 顶部信息栏 -->
      <div class="upload-view__header">
        <div class="upload-view__title-area">
          <div class="upload-view__title-badge">🎨 Workspace</div>
          <h1 class="upload-view__title">上传中心</h1>
        </div>

        <!-- 壁纸统计条 -->
        <WallpaperStatsBar
          :stats-data="workflowStore.statsData"
          class="upload-view__stats-bar"
          @show-history="showHistoryModal = true"
        />

        <HeaderStats
          :stats="stats"
          :rate-limit="rateLimit"
          :loading="loadingStats"
          @refresh="refreshStats"
        />
      </div>

      <!-- 三栏布局 -->
      <div class="upload-view__content">
        <CategorySidebar
          :key="treeKey"
          :series="series"
          :tree-data="treeData"
          :loading="loading"
          :target-path="uploadStore.targetPath"
          :load-node="loadNode"
          @select-series="selectSeries"
          @select-category="handleCategorySelect"
          @create="showModal = true"
          @delete="handleDeleteCategory"
          @refresh="handleRefreshCategories"
        />

        <!-- 中间列：上传面板 -->
        <div class="upload-view__center">
          <UploadPanel
            :target-path="uploadStore.targetPath"
            :files="uploadStore.files"
            :selected-id="previewFile?.id"
            :uploading="uploading"
            :progress="uploadStore.totalProgress"
            :pending-count="uploadStore.pendingFiles.length"
            :error-count="uploadStore.errorFiles.length"
            :upload-mode="uploadStore.uploadMode"
            :current-series="series"
            :ai-config="aiConfig"
            :ai-analyzing="uploadStore.aiAnalyzing"
            :ai-analyzing-count="uploadStore.aiAnalyzingCount"
            :metadata-status="uploadStore.metadataStatus"
            :metadata-error="uploadStore.metadataError"
            :can-upload="authStore.canUpload"
            @add-files="addFiles"
            @remove="uploadStore.removeFile"
            @remove-batch="uploadStore.removeFiles"
            @clear="uploadStore.clearFiles"
            @retry="uploadStore.retryFailed"
            @upload="handleUpload"
            @select="selectPreview"
            @change-target="handleChangeTarget"
            @mode-change="handleModeChange"
            @series-change="handleSeriesChange"
            @model-change="handleModelChange"
            @retry-metadata="handleRetryMetadata"
            @apply-all-ai="handleApplyAllAi"
            @edit-ai="handleEditAI"
          />
        </div>

        <!-- 右侧栏：预览 + 工作流 -->
        <div class="upload-view__sidebar">
          <ImagePreview :file="previewFile" class="upload-view__preview" />
          <WorkflowPanel class="upload-view__workflow" />
        </div>
      </div>

      <CreateCategoryModal
        :visible="showModal"
        :parent-category="selectedL1"
        :creating="creating"
        @close="showModal = false"
        @create="createCategory"
      />

      <UploadProgressModal
        v-model="showProgressModal"
        :files="uploadStore.files"
        :uploading="uploading"
        :current-index="uploadStore.currentFileIndex"
        :metadata-status="uploadStore.metadataStatus"
        :metadata-error="uploadStore.metadataError"
        @retry="handleRetry"
        @retry-metadata="handleRetryMetadata"
        @close="showProgressModal = false"
      />

      <!-- 发布历史弹窗 -->
      <ReleaseHistoryModal
        :visible="showHistoryModal"
        :stats-data="workflowStore.statsData"
        @close="showHistoryModal = false"
      />

      <!-- 目录选择弹窗 -->
      <TargetSelectModal
        :visible="showTargetModal"
        :file="targetEditFile"
        :current-series="series"
        @close="showTargetModal = false"
        @confirm="handleTargetConfirm"
      />

      <!-- 删除分类确认弹窗 -->
      <DeleteCategoryModal
        :visible="showDeleteModal"
        :category-name="deleteTarget.data?.name || ''"
        :has-sub-dirs="deleteTarget.hasSubDirs"
        :has-images="deleteTarget.hasImages"
        :deleting="deleting"
        @close="showDeleteModal = false"
        @confirm="confirmDeleteCategory"
      />

      <!-- 编辑 AI 分析结果弹窗 -->
      <EditAIResultModal
        :visible="showEditAIModal"
        :file="editAIFile"
        :saving="savingAI"
        @close="showEditAIModal = false"
        @save="handleSaveAIResult"
      />
    </div>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import MainLayout from '@/components/MainLayout.vue'
import HeaderStats from '@/components/upload/HeaderStats.vue'
import CategorySidebar from '@/components/upload/CategorySidebar.vue'
import UploadPanel from '@/components/upload/UploadPanel.vue'
import ImagePreview from '@/components/upload/ImagePreview.vue'
import WorkflowPanel from '@/components/upload/WorkflowPanel.vue'
import WallpaperStatsBar from '@/components/upload/WallpaperStatsBar.vue'
import ReleaseHistoryModal from '@/components/upload/ReleaseHistoryModal.vue'
import CreateCategoryModal from '@/components/upload/CreateCategoryModal.vue'
import DeleteCategoryModal from '@/components/upload/DeleteCategoryModal.vue'
import UploadProgressModal from '@/components/upload/UploadProgressModal.vue'
import TargetSelectModal from '@/components/upload/TargetSelectModal.vue'
import EditAIResultModal from '@/components/upload/EditAIResultModal.vue'
import { githubService } from '@/services/github'
import { localStorageService } from '@/services/localStorage'
import { useConfigStore } from '@/stores/config'
import { useUploadStore } from '@/stores/upload'
import { useAuthStore } from '@/stores/auth'
import { useWorkflowStore } from '@/stores/workflow'
import { debounce } from '@/utils/debounce'
import { detectBatchImageTypes, getDetectionStats } from '@/utils/image-detector'

const configStore = useConfigStore()
const uploadStore = useUploadStore()
const authStore = useAuthStore()
const workflowStore = useWorkflowStore()

const viewRef = ref(null)
const pageLoading = ref(false) // 页面加载状态，默认不显示 loading
const series = ref('desktop')
const treeData = ref([])
const treeKey = ref(0) // 用于强制刷新树组件
const loading = ref(false)
const loadingStats = ref(false)
const selectedL1 = ref('')
const previewFile = ref(null)
const showModal = ref(false)
const showProgressModal = ref(false)
const showHistoryModal = ref(false)
const showTargetModal = ref(false)
const showDeleteModal = ref(false)
const showEditAIModal = ref(false)
const targetEditFile = ref(null)
const editAIFile = ref(null)
const creating = ref(false)
const deleting = ref(false)
const savingAI = ref(false)
const deleteTarget = reactive({ data: null, hasSubDirs: false, hasImages: false })

const stats = reactive({ desktop: 0, mobile: 0, avatar: 0, total: 0 })

const uploading = computed(() => uploadStore.uploading)
const rateLimit = computed(() => uploadStore.getRateLimit())

// AI 配置
const aiConfig = computed(() => uploadStore.getCurrentAiConfig())

const categoryCache = new Map()
const CACHE_TTL = 5 * 60 * 1000

function getCache(key) {
  const c = categoryCache.get(key)
  return c && Date.now() - c.timestamp < CACHE_TTL ? c.data : null
}

function setCache(key, data) {
  categoryCache.set(key, { data, timestamp: Date.now() })
}

function selectSeries(value) {
  series.value = value
  uploadStore.setTarget(value, '', '')
  selectedL1.value = ''
  loadRootCategories()
}

function handleRefreshCategories() {
  categoryCache.clear()
  treeKey.value++
  loadRootCategories()
}

async function loadRootCategories() {
  const cacheKey = `${series.value}-root`
  const cached = getCache(cacheKey)
  console.log('[loadRootCategories] cacheKey:', cacheKey, 'cached:', !!cached)
  if (cached) {
    treeData.value = cached
    return
  }

  loading.value = true
  try {
    const { owner, repo, branch } = configStore.config
    console.log('[loadRootCategories] Fetching from GitHub...')
    const contents = await githubService.getContents(
      owner,
      repo,
      `wallpaper/${series.value}`,
      branch
    )
    const categories = contents
      .filter(i => i.type === 'dir')
      .map(i => ({
        name: i.name,
        path: i.path,
        type: 'l1',
        children: [],
        loaded: false
      }))
    console.log(
      '[loadRootCategories] Got categories:',
      categories.map(c => c.name)
    )
    treeData.value = categories
    setCache(cacheKey, categories)
  } catch (err) {
    console.error('[loadRootCategories] Error:', err)
    treeData.value = []
  } finally {
    loading.value = false
  }
}

async function loadNode(node, resolve) {
  if (node.level === 0) {
    resolve(treeData.value)
    return
  }
  if (node.data.type !== 'l1') {
    resolve([])
    return
  }

  const cached = getCache(node.data.path)
  if (cached) {
    resolve(cached)
    return
  }

  try {
    const { owner, repo, branch } = configStore.config
    const contents = await githubService.getContents(owner, repo, node.data.path, branch)
    const children = contents
      .filter(i => i.type === 'dir')
      .map(i => ({ name: i.name, path: i.path, type: 'l2' }))
    setCache(node.data.path, children)
    resolve(children)
  } catch {
    resolve([])
  }
}

function handleCategorySelect({ data, node }) {
  if (data.type === 'l1') {
    selectedL1.value = data.name
    uploadStore.setTarget(series.value, data.name, '')
  } else {
    selectedL1.value = node.parent.data.name
    uploadStore.setTarget(series.value, node.parent.data.name, data.name)
  }
}

async function addFiles(files) {
  // 权限检查
  if (!authStore.canUpload) {
    ElMessage.error('🔒 您没有上传权限，无法添加文件')
    return
  }

  const imgs = files.filter(f => f.type.startsWith('image/'))
  if (!imgs.length) {
    ElMessage.warning('请选择图片文件')
    return
  }

  // 大批量上传警告
  if (uploadStore.shouldWarnBatchUpload(imgs.length)) {
    const estimatedTime = uploadStore.estimateUploadTime(imgs.length)
    const minutes = Math.floor(estimatedTime / 60)
    const seconds = estimatedTime % 60
    const timeStr = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`

    ElMessage({
      message: `⚠️ 批量上传 ${imgs.length} 张图片，预计需要 ${timeStr}，建议分批上传`,
      type: 'warning',
      duration: 6000,
      showClose: true
    })
  }

  // 自动检测图片类型
  if (uploadStore.uploadMode === 'ai' && imgs.length > 0) {
    try {
      const detectionResults = await detectBatchImageTypes(imgs)
      const stats = getDetectionStats(detectionResults)

      // 如果大部分图片是同一类型，自动切换
      const dominantType = ['desktop', 'mobile', 'avatar'].reduce((a, b) =>
        stats[a] > stats[b] ? a : b
      )

      if (stats[dominantType] >= imgs.length * 0.7 && dominantType !== series.value) {
        series.value = dominantType
        uploadStore.setSeries(dominantType)

        ElMessage({
          message: `🔍 检测到 ${stats[dominantType]}/${imgs.length} 张${dominantType === 'desktop' ? '桌面' : dominantType === 'mobile' ? '手机' : '头像'}壁纸，已自动切换类型`,
          type: 'success',
          duration: 4000
        })
      } else if (stats.desktop + stats.mobile + stats.avatar < imgs.length) {
        // 有检测失败的
        ElMessage({
          message: `⚠️ 部分图片类型检测失败，请确认当前选择的类型（${series.value}）是否正确`,
          type: 'warning',
          duration: 5000
        })
      }
    } catch (error) {
      console.warn('批量检测图片类型失败:', error)
    }
  }

  const added = await uploadStore.addFiles(imgs)
  if (added.length < imgs.length)
    ElMessage.warning(`${imgs.length - added.length} 个文件不符合要求`)
}

async function handleUpload() {
  // 检查是否有文件没有目标路径
  const filesWithoutTarget = uploadStore.pendingFiles.filter(f => !f.targetPath)
  if (filesWithoutTarget.length > 0) {
    ElMessage.warning(`有 ${filesWithoutTarget.length} 个文件未设置上传目录`)
    return
  }

  // 打开进度弹框
  showProgressModal.value = true

  try {
    const results = await uploadStore.uploadAll()
    const ok = results.results.filter(r => r.success).length
    const fail = results.results.length - ok
    const reused = results.results.filter(r => r.reusedExisting).length

    // 更新会话上传计数
    if (ok > 0) {
      workflowStore.addSessionUpload(ok)
    }

    // 保存上传记录到本地存储
    if (ok > 0 && localStorageService.isInitialized()) {
      const successFiles = results.results
        .filter(r => r.success)
        .map(r => {
          const file = uploadStore.files.find(f => f.id === r.id)
          return {
            fileName: file?.name || r.id,
            series: file?.series || series.value,
            category: file?.targetPath || '',
            size: file?.size || 0
          }
        })
      localStorageService.addUploadRecords(successFiles)
    }

    ElMessage[fail ? 'warning' : 'success'](
      fail
        ? `上传完成：${ok} 成功，${fail} 失败${reused > 0 ? `（其中 ${reused} 个复用已上传图片）` : ''}`
        : `成功处理 ${ok} 个文件${reused > 0 ? `（其中 ${reused} 个复用已上传图片）` : ''}`
    )

    if (results.metadataResult?.success === false) {
      ElMessage.warning(`图片已上传，但元数据生成失败：${results.metadataResult.error}`)
    }

    refreshStats()

    // 清理成功上传的文件（释放内存）
    if (ok > 0 && results.metadataResult?.success !== false) {
      uploadStore.clearSuccessFiles()
    }

    // 上传成功后刷新工作流状态（延迟 2 秒等待 GitHub API 同步）
    if (ok > 0) {
      setTimeout(async () => {
        const { owner, repo, branch } = configStore.config
        await workflowStore.refreshPendingInfo(owner, repo, branch)
        // 如果还是 0，再等 2 秒重试一次
        if (workflowStore.pendingInfo.pendingCount === 0) {
          setTimeout(() => {
            workflowStore.refreshPendingInfo(owner, repo, branch)
          }, 2000)
        }
      }, 2000)
    }
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  }
}

async function handleRetryMetadata() {
  try {
    const result = await uploadStore.retryPendingMetadata()
    if (!result) return

    if (result.success) {
      ElMessage.success('元数据已重新生成并提交')
      uploadStore.clearSuccessFiles()

      const { owner, repo, branch } = configStore.config
      await workflowStore.refreshPendingInfo(owner, repo, branch)
    } else {
      ElMessage.error(result.error || '元数据重试失败')
    }
  } catch (error) {
    ElMessage.error(error.message || '元数据重试失败')
  }
}

function selectPreview(file) {
  previewFile.value = file
}

function handleChangeTarget(file) {
  targetEditFile.value = file
  showTargetModal.value = true
}

function handleTargetConfirm({ series: newSeries, l1, l2 }) {
  if (targetEditFile.value) {
    uploadStore.updateFileTarget(targetEditFile.value.id, newSeries, l1, l2)
  }
  showTargetModal.value = false
  targetEditFile.value = null
}

// 上传模式切换
function handleModeChange(mode) {
  uploadStore.setUploadMode(mode)
  // 切换到手动模式时，如果没有选择目录，清空新添加的文件的目标路径
  if (mode === 'manual' && !uploadStore.targetPath) {
    ElMessage.info('请在左侧选择上传目录')
  }
}

// 系列切换（AI 模式下）
function handleSeriesChange(newSeries) {
  series.value = newSeries
  uploadStore.setTarget(newSeries, '', '')
  // AI 模式下不需要加载分类树
}

// 应用所有 AI 推荐
function handleApplyAllAi() {
  const count = uploadStore.applyAllAiRecommendations()
  if (count > 0) {
    ElMessage.success(`已应用 ${count} 个 AI 推荐分类`)
  } else {
    ElMessage.info('没有待应用的 AI 推荐')
  }
}

function handleModelChange(modelKey) {
  uploadStore.setAiModel(modelKey)
  const config = uploadStore.getCurrentAiConfig()
  ElMessage.success(`已切换到 ${config.modelName}`)
}

// 编辑 AI 分析结果
function handleEditAI(file) {
  editAIFile.value = file
  showEditAIModal.value = true
}

// 保存 AI 分析结果修改
async function handleSaveAIResult({ fileId, aiMetadata }) {
  savingAI.value = true
  try {
    // 更新文件的 AI 元数据
    uploadStore.setFileAiMetadata(fileId, aiMetadata, true)

    ElMessage.success('AI 分析结果已更新')
    showEditAIModal.value = false
    editAIFile.value = null
  } catch (error) {
    ElMessage.error('保存失败：' + error.message)
  } finally {
    savingAI.value = false
  }
}

async function handleRetry() {
  try {
    const results = await uploadStore.retryFailed()
    if (!results) return

    const ok = results.results.filter(r => r.success).length
    const fail = results.results.length - ok

    // 更新会话上传计数
    if (ok > 0) {
      workflowStore.addSessionUpload(ok)
    }

    // 保存上传记录到本地存储
    if (ok > 0 && localStorageService.isInitialized()) {
      const successFiles = results.results
        .filter(r => r.success)
        .map(r => {
          const file = uploadStore.files.find(f => f.id === r.id)
          return {
            fileName: file?.name || r.id,
            series: file?.series || series.value,
            category: file?.targetPath || '',
            size: file?.size || 0
          }
        })
      localStorageService.addUploadRecords(successFiles)
    }

    ElMessage[fail ? 'warning' : 'success'](
      fail ? `重试完成：${ok} 成功，${fail} 失败` : `重试成功，${ok} 个文件已上传`
    )
    refreshStats()

    // 清理成功上传的文件
    if (ok > 0) {
      uploadStore.clearSuccessFiles()
    }

    // 刷新工作流状态
    if (ok > 0) {
      setTimeout(async () => {
        const { owner, repo, branch } = configStore.config
        await workflowStore.refreshPendingInfo(owner, repo, branch)
        if (workflowStore.pendingInfo.pendingCount === 0) {
          setTimeout(() => {
            workflowStore.refreshPendingInfo(owner, repo, branch)
          }, 2000)
        }
      }, 2000)
    }
  } catch (e) {
    ElMessage.error(e.message || '重试失败')
  }
}

async function createCategory(form) {
  if (!form.name?.trim()) {
    ElMessage.error('分类名称不能为空')
    return
  }
  if (/[/\\:*?"<>|]/.test(form.name)) {
    ElMessage.error('分类名称包含非法字符')
    return
  }

  creating.value = true
  try {
    const { owner, repo, branch } = configStore.config
    let path = `wallpaper/${series.value}`

    // 根据是否有父分类决定创建一级还是二级
    if (form.level === 'l2' && selectedL1.value) {
      path += `/${selectedL1.value}`
    }
    path += `/${form.name}/.gitkeep`

    await githubService.createFile(owner, repo, path, '', `Create category: ${form.name}`, branch)
    ElMessage.success('分类创建成功')
    showModal.value = false

    console.log('[createCategory] Clearing cache and refreshing...')

    // 清除缓存
    categoryCache.clear()

    // 先显示 loading 状态，让用户感知到正在刷新
    loading.value = true

    // 等待 GitHub API 同步
    await new Promise(resolve => setTimeout(resolve, 1200))

    // 重新加载分类列表
    console.log('[createCategory] Calling loadRootCategories...')
    await loadRootCategories()
    console.log(
      '[createCategory] Done, treeData:',
      treeData.value.map(c => c.name)
    )

    // 强制刷新树组件（数据加载完成后再刷新，确保新数据被渲染）
    treeKey.value++
    console.log('[createCategory] treeKey incremented to:', treeKey.value)
  } catch (e) {
    ElMessage.error(e.message || '创建失败')
  } finally {
    creating.value = false
  }
}

async function handleDeleteCategory({ data }) {
  const { owner, repo, branch } = configStore.config

  try {
    // 先检查目录内容
    let contents = []
    let hasImages = false
    let hasSubDirs = false

    try {
      contents = await githubService.getContents(owner, repo, data.path, branch)
      if (!Array.isArray(contents)) {
        contents = [contents]
      }
      hasImages = contents.some(
        item => item.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)
      )
      hasSubDirs = contents.some(item => item.type === 'dir')
    } catch (err) {
      if (err.status === 404 || err.type === 'NOT_FOUND') {
        contents = []
      } else {
        throw err
      }
    }

    // 设置删除目标并打开弹窗
    deleteTarget.data = data
    deleteTarget.hasSubDirs = hasSubDirs
    deleteTarget.hasImages = hasImages
    showDeleteModal.value = true
  } catch (e) {
    console.error('Check category error:', e)
    ElMessage.error(e.message || '检查分类失败')
  }
}

async function confirmDeleteCategory() {
  if (!deleteTarget.data) return

  const { owner, repo, branch } = configStore.config
  const data = deleteTarget.data

  deleting.value = true
  try {
    // 递归删除目录下所有文件
    await deleteDirectoryRecursive(owner, repo, data.path, branch)

    // 关闭弹窗
    showDeleteModal.value = false
    ElMessage.success('分类删除成功')

    // 清除缓存并刷新
    categoryCache.clear()
    loading.value = true

    // 等待 GitHub API 同步
    await new Promise(resolve => setTimeout(resolve, 1200))

    // 加载数据
    await loadRootCategories()

    // 强制刷新树组件
    treeKey.value++

    // 如果删除的是当前选中的分类，清空选择
    if (uploadStore.targetPath.includes(data.path)) {
      uploadStore.setTarget(series.value, '', '')
      selectedL1.value = ''
    }
  } catch (e) {
    console.error('Delete category error:', e)
    ElMessage.error(e.message || '删除失败')
  } finally {
    deleting.value = false
  }
}

async function deleteDirectoryRecursive(owner, repo, path, branch) {
  let contents = []

  try {
    contents = await githubService.getContents(owner, repo, path, branch)
    // 确保 contents 是数组
    if (!Array.isArray(contents)) {
      contents = [contents]
    }
  } catch (err) {
    // 目录为空或不存在，无需删除
    if (err.status === 404 || err.type === 'NOT_FOUND') {
      return
    }
    throw err
  }

  for (const item of contents) {
    if (item.type === 'dir') {
      // 递归删除子目录
      await deleteDirectoryRecursive(owner, repo, item.path, branch)
    } else {
      // 删除文件（包括 .gitkeep）
      await githubService.deleteFile(
        owner,
        repo,
        item.path,
        item.sha,
        `Delete: ${item.name}`,
        branch
      )
    }
  }
}

// 原始刷新统计函数
async function _refreshStats() {
  loadingStats.value = true
  try {
    const { owner, repo, branch } = configStore.config
    for (const type of ['desktop', 'mobile', 'avatar']) {
      try {
        const c = await githubService.getContents(owner, repo, `wallpaper/${type}`, branch)
        stats[type] = c.filter(i => i.type === 'dir').length
      } catch {
        stats[type] = 0
      }
    }
    stats.total = stats.desktop + stats.mobile + stats.avatar
  } catch {
    // 忽略统计加载错误
  } finally {
    loadingStats.value = false
  }
}

// 防抖版本的刷新统计函数（2秒防抖）
const refreshStats = debounce(_refreshStats, 2000)

onMounted(async () => {
  try {
    // 1. 检查权限（如果需要的话）
    if (authStore.isAuthenticated && !authStore.permissionChecked) {
      const { owner, repo } = configStore.config
      const cacheKey = `permission_${owner}_${repo}`

      // 清除旧缓存
      sessionStorage.removeItem(cacheKey)
      console.log('[UploadView] 清除权限缓存，重新检查')

      // 重新检查权限
      authStore.permissionChecked = false
      await authStore.checkPermission(owner, repo)

      console.log('[UploadView] 权限检查完成:', {
        permissionLevel: authStore.permissionLevel,
        canUpload: authStore.canUpload,
        permissionChecked: authStore.permissionChecked
      })
    }

    // 2. 加载数据（并行执行）
    await Promise.all([loadRootCategories(), refreshStats()])

    console.log('[UploadView] 数据加载完成')
  } catch (err) {
    console.error('加载失败:', err)
  }
})

// 组件卸载时清理资源
onUnmounted(() => {
  console.log('[UploadView] 组件卸载，清理资源')

  // 清理工作流轮询和定时器
  workflowStore.cleanup()

  // 清理上传store中的预览URL和Worker
  uploadStore.cleanup()

  // 清理分类缓存
  categoryCache.clear()
})

watch(series, () => {
  selectedL1.value = ''
})
watch(
  () => uploadStore.files,
  files => {
    if (files.length > 0 && !previewFile.value) previewFile.value = files[0]
    else if (files.length === 0) previewFile.value = null
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.upload-view__loading {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  z-index: 9999;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-6;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(102, 126, 234, 0.2);
  border-top-color: $primary-start;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: $font-size-xl;
  color: $white;
  font-weight: 500;
  margin: 0;
}

.upload-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: $spacing-6;
  gap: $spacing-5;
  overflow: hidden;

  &__readonly-alert {
    flex-shrink: 0;
    border-radius: $radius-lg;
    background: rgba(230, 162, 60, 0.1);
    border: 1px solid rgba(230, 162, 60, 0.3);

    :deep(.el-alert__content) {
      color: #e6a23c;
    }
  }

  &__header {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: $spacing-6;
    flex-shrink: 0;
    // 移除初始隐藏状态，让元素默认可见
  }

  &__stats-bar {
    justify-self: center;
  }

  &__title-area {
    display: flex;
    align-items: center;
    gap: $spacing-4;
  }

  &__title-badge {
    padding: $spacing-2 $spacing-4;
    background: $glass-bg;
    backdrop-filter: blur($glass-blur);
    border: 1px solid $glass-border;
    border-radius: $radius-full;
    font-size: $font-size-sm;
    color: $gray-300;
  }

  &__title {
    margin: 0;
    font-size: $font-size-2xl;
    font-weight: 700;
    background: $primary-gradient;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  &__content {
    flex: 1;
    display: grid;
    grid-template-columns: 320px 1fr 360px;
    gap: $spacing-5;
    min-height: 0;
    overflow: hidden;

    // 确保子元素撑满且高度固定
    > * {
      min-height: 0;
      height: 100%;
      overflow: hidden;
      // 移除初始隐藏状态，让元素默认可见
    }
  }

  &__center {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    min-height: 0;
    overflow: hidden;
  }

  &__sidebar {
    display: flex;
    flex-direction: column;
    gap: $spacing-4;
    min-height: 0;
    overflow: hidden;
  }

  &__preview {
    flex: 1;
    min-height: 0;
  }

  &__workflow {
    flex: 1.8;
    min-height: 0;
    overflow: hidden;
  }
}

// 响应式
@media (max-width: 1400px) {
  .upload-view__content {
    grid-template-columns: 280px 1fr 320px;
  }
}

@media (max-width: 1200px) {
  .upload-view__content {
    grid-template-columns: 260px 1fr 280px;
  }
}
</style>
