<template>
  <div class="upload-panel">
    <!-- 头部区域 -->
    <UploadHeader
      :upload-mode="uploadMode"
      :current-series="currentSeries"
      :target-path="targetPath"
      :ai-config="aiConfig"
      :ai-analyzing="aiAnalyzing"
      :ai-analyzing-count="aiAnalyzingCount"
      :files-count="files.length"
      :error-count="errorCount"
      :uploading="uploading"
      :progress="progress"
      :can-upload="authStore.canUpload"
      :can-start-upload="canStartUpload"
      :metadata-status="metadataStatus"
      :metadata-error="metadataError"
      @mode-change="handleModeChange"
      @series-change="$emit('series-change', $event)"
      @model-change="$emit('model-change', $event)"
      @retry-metadata="$emit('retry-metadata')"
      @retry="$emit('retry')"
      @clear="handleClear"
      @upload="$emit('upload')"
    />

    <!-- 主内容区 -->
    <div class="upload-panel__main">
      <!-- 拖拽上传区域 -->
      <UploadDropzone
        :disabled="dropzoneDisabled"
        :compact="files.length > 0"
        :uploading="uploading"
        :can-add-files="canAddFiles"
        :can-upload="props.canUpload"
        :upload-mode="uploadMode"
        :ai-config="aiConfig"
        :icon="dropzoneIcon"
        :text="dropzoneText"
        @add-files="handleAddFiles"
      />

      <!-- 文件网格 -->
      <UploadFileGrid
        ref="fileGridRef"
        :files="files"
        :selected-id="selectedId"
        :uploading="uploading"
        :upload-mode="uploadMode"
        @select="$emit('select', $event)"
        @remove="$emit('remove', $event)"
        @change-target="$emit('change-target', $event)"
        @batch-delete="handleBatchDelete"
        @apply-all-ai="$emit('apply-all-ai')"
        @edit-ai="$emit('edit-ai', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import UploadHeader from './UploadPanel/UploadHeader.vue'
import UploadDropzone from './UploadPanel/UploadDropzone.vue'
import UploadFileGrid from './UploadPanel/UploadFileGrid.vue'

const authStore = useAuthStore()

const props = defineProps({
  targetPath: { type: String, default: '' },
  files: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  uploading: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
  pendingCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  uploadMode: { type: String, default: 'ai' },
  currentSeries: { type: String, default: 'desktop' },
  aiConfig: { type: Object, default: null },
  aiAnalyzing: { type: Boolean, default: false },
  aiAnalyzingCount: { type: Number, default: 0 },
  metadataStatus: { type: String, default: 'idle' },
  metadataError: { type: String, default: '' },
  canUpload: { type: Boolean, default: true } // 新增：是否有上传权限
})

const emit = defineEmits([
  'add-files',
  'remove',
  'remove-batch',
  'clear',
  'retry',
  'upload',
  'select',
  'change-target',
  'mode-change',
  'series-change',
  'model-change',
  'retry-metadata',
  'apply-all-ai',
  'edit-ai'
])

const fileGridRef = ref(null)

// 是否可以添加文件
const canAddFiles = computed(() => {
  if (props.uploadMode === 'ai') {
    return true
  }
  return !!props.targetPath
})

// 拖拽区域是否禁用
const dropzoneDisabled = computed(() => {
  if (props.uploading) return true
  if (props.uploadMode === 'ai') return false
  return !props.targetPath
})

// 拖拽区域图标
const dropzoneIcon = computed(() => {
  if (props.uploadMode === 'ai') return '🤖'
  return props.targetPath ? '📁' : '🔒'
})

// 拖拽区域文本
const dropzoneText = computed(() => {
  if (props.uploadMode === 'ai') {
    return props.aiConfig?.provider === 'groq'
      ? '拖拽图片到此处，AI 将自动分类（当前最多 10 张）'
      : '拖拽图片到此处，AI 将自动分类（当前仅支持 1 张）'
  }
  return props.targetPath ? '拖拽图片或文件夹到此处' : '请先选择分类'
})

// 是否可以开始上传（所有文件都有目标路径）
const canStartUpload = computed(() => {
  if (props.uploading) return false
  if (props.pendingCount === 0) return false

  const hasFilesWithoutTarget = props.files.some(f => f.status === 'pending' && !f.targetPath)

  return !hasFilesWithoutTarget
})

// 全局阻止拖拽默认行为
function preventDefaultDrag(e) {
  e.preventDefault()
}

onMounted(() => {
  document.addEventListener('dragover', preventDefaultDrag)
  document.addEventListener('drop', preventDefaultDrag)
})

onUnmounted(() => {
  document.removeEventListener('dragover', preventDefaultDrag)
  document.removeEventListener('drop', preventDefaultDrag)
})

// 处理添加文件
function handleAddFiles(files) {
  if (!props.canUpload) {
    return // 已经在 UploadDropzone 中提示过了
  }
  emit('add-files', files)
}

// 处理模式切换
function handleModeChange(mode) {
  emit('mode-change', mode)
}

// 批量删除确认
async function handleBatchDelete(ids) {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${ids.length} 个文件吗？`, '确认删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    emit('remove-batch', ids)
    fileGridRef.value?.clearSelection()
  } catch {
    // 取消
  }
}

// 全部删除确认
async function handleClear() {
  try {
    await ElMessageBox.confirm(`确定要删除全部 ${props.files.length} 个文件吗？`, '确认删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    emit('clear')
    fileGridRef.value?.clearSelection()
  } catch {
    // 取消
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.upload-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  min-height: 0;

  &__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: $glass-bg;
    backdrop-filter: blur($glass-blur);
    border: 1px solid $glass-border;
    border-radius: $radius-xl;
    padding: $spacing-4;
    overflow: hidden;
    min-height: 0;
    height: 100%;
  }
}
</style>
