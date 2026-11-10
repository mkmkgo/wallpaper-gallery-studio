<template>
  <div v-if="files.length > 0" class="upload-file-grid">
    <!-- 批量操作栏 -->
    <div v-if="!uploading" class="upload-file-grid__batch">
      <div class="upload-file-grid__batch-left">
        <el-checkbox
          :model-value="selectAll"
          :indeterminate="isIndeterminate"
          :disabled="pendingFiles.length === 0"
          @update:model-value="handleSelectAll"
        >
          全选（用于批量删除）
        </el-checkbox>

        <!-- 一键勾选所有 AI 分析失败项，复用「全选 / 删除选中」的同一套 selectedIds -->
        <button
          type="button"
          class="upload-file-grid__select-failed"
          :disabled="failedCount === 0"
          :title="selectFailedTitle"
          @click="handleSelectFailed"
        >
          <el-icon><WarningFilled /></el-icon>
          勾选失败项 ({{ failedCount }})
        </button>

        <!-- 文件数量提示 -->
        <span class="upload-file-grid__count">
          共 {{ files.length }} 个文件
          <template v-if="pendingFiles.length !== files.length">
            （{{ pendingFiles.length }} 待上传）
          </template>
        </span>

        <span v-if="failedCount > 0" class="upload-file-grid__failed-count">
          失败 {{ failedCount }} 项
        </span>
        <span v-else class="upload-file-grid__failed-count upload-file-grid__failed-count--empty">
          暂无失败项
        </span>

        <span v-if="selectedIds.length > 0" class="upload-file-grid__selected-count">
          已选中 {{ selectedIds.length }} 项，点击「删除选中」即可移除
        </span>
      </div>

      <div class="upload-file-grid__batch-right">
        <Transition name="fade">
          <button
            v-if="selectedIds.length > 0"
            class="upload-file-grid__batch-delete"
            @click="$emit('batch-delete', selectedIds)"
          >
            <el-icon><Delete /></el-icon>
            删除选中 ({{ selectedIds.length }})
          </button>
        </Transition>

        <!-- AI 模式：批量应用 AI 推荐 -->
        <Transition name="fade">
          <button
            v-if="uploadMode === 'ai' && filesWithAiButNoTarget > 0"
            class="upload-file-grid__batch-apply"
            @click="$emit('apply-all-ai')"
          >
            <span>🤖</span>
            应用全部 AI 推荐 ({{ filesWithAiButNoTarget }})
          </button>
        </Transition>
      </div>
    </div>

    <!-- 图片网格 -->
    <div class="upload-file-grid__grid">
      <TransitionGroup name="grid">
        <UploadFileItem
          v-for="file in files"
          :key="file.id"
          :file="file"
          :is-selected="selectedId === file.id"
          :is-checked="selectedIds.includes(file.id)"
          :uploading="uploading"
          :upload-mode="uploadMode"
          @select="$emit('select', file)"
          @remove="$emit('remove', $event)"
          @change-target="$emit('change-target', file)"
          @toggle-check="toggleCheck"
          @edit-ai="$emit('edit-ai', file)"
        />
      </TransitionGroup>
    </div>
  </div>

  <!-- 空状态 -->
  <div v-else class="upload-file-grid__empty">
    <span class="upload-file-grid__empty-icon">🖼️</span>
    <p>暂无待上传文件</p>
    <p class="upload-file-grid__empty-hint">支持 JPG、PNG、WebP，单个最大 25MB</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Delete, WarningFilled } from '@element-plus/icons-vue'
import { useAiTasksStore } from '@/stores/ai-tasks'
import { collectFailedFileIds } from '@/features/upload-workspace/domain/failed-file-selection'
import UploadFileItem from './UploadFileItem.vue'

const props = defineProps({
  files: { type: Array, default: () => [] },
  selectedId: { type: String, default: null },
  uploading: { type: Boolean, default: false },
  uploadMode: { type: String, default: 'ai' }
})

defineEmits(['select', 'remove', 'change-target', 'batch-delete', 'apply-all-ai', 'edit-ai'])

const aiTasksStore = useAiTasksStore()

const selectedIds = ref([])

// 失败项必须基于「完整文件数组 + 完整 AI 任务数组」计算：任务中心的 visibleTasks
// 只是虚拟滚动窗口切片，滚出视口的失败项不能被漏选。aiTasksStore.tasks 是全量
// 任务数组；文件上的 aiTaskStatus / aiMetadata.error 作为兜底标记。
const failedFileIds = computed(() => collectFailedFileIds(props.files, aiTasksStore.tasks))
const failedCount = computed(() => failedFileIds.value.length)
const selectFailedTitle = computed(() =>
  failedCount.value > 0
    ? `勾选全部 ${failedCount.value} 个 AI 分析失败项，随后点击「删除选中」即可批量移除`
    : '当前没有 AI 分析失败的任务'
)

// 待处理文件
const pendingFiles = computed(() =>
  props.files.filter(f => f.status === 'pending' || f.status === 'error')
)

// AI 模式下有 AI 数据但未设置目标路径的文件数
const filesWithAiButNoTarget = computed(
  () => props.files.filter(f => f.status === 'pending' && f.aiMetadata && !f.targetPath).length
)

// 全选状态
const selectAll = computed(
  () => pendingFiles.value.length > 0 && selectedIds.value.length === pendingFiles.value.length
)

// 半选状态
const isIndeterminate = computed(
  () => selectedIds.value.length > 0 && selectedIds.value.length < pendingFiles.value.length
)

// 文件列表变化时清理已删除的选中项
watch(
  () => props.files,
  files => {
    const ids = files.map(f => f.id)
    selectedIds.value = selectedIds.value.filter(id => ids.includes(id))
  },
  { deep: true }
)

// 全选/取消全选
function handleSelectAll(val) {
  if (val) {
    selectedIds.value = pendingFiles.value.map(f => f.id)
  } else {
    selectedIds.value = []
  }
}

// 只勾选 AI 分析失败项：复用「全选 / 删除选中」的同一套 selectedIds。
// 先清空再写入，保证点击后的选中集合里不含任何成功项。
// 覆盖式是刻意选择：避免「全选」或历史勾选残留被一并带进 remove-batch 而误删成功项。
function handleSelectFailed() {
  if (failedCount.value === 0) return
  selectedIds.value = [...failedFileIds.value]
}

// 切换单个文件的选中状态
function toggleCheck(fileId) {
  const index = selectedIds.value.indexOf(fileId)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(fileId)
  }
}

// 暴露方法供父组件调用
defineExpose({
  clearSelection: () => {
    selectedIds.value = []
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.upload-file-grid {
  flex: 1;
  margin-top: $spacing-3;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;

  &__batch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-3;
    padding-bottom: $spacing-2;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    flex-wrap: wrap;

    &-left,
    &-right {
      display: flex;
      align-items: center;
      gap: $spacing-3;
    }

    :deep(.el-checkbox__label) {
      color: $gray-400;
      font-size: $font-size-sm;
    }

    &-delete {
      display: flex;
      align-items: center;
      gap: $spacing-1;
      padding: $spacing-1 $spacing-3;
      background: rgba($danger, 0.1);
      border: 1px solid rgba($danger, 0.3);
      border-radius: $radius-md;
      color: $danger;
      font-size: $font-size-xs;
      cursor: pointer;
      transition: all $duration-normal;

      &:hover {
        background: rgba($danger, 0.2);
      }

      .el-icon {
        font-size: 12px;
      }
    }

    &-apply {
      display: flex;
      align-items: center;
      gap: $spacing-1;
      padding: $spacing-1 $spacing-3;
      background: rgba($primary-start, 0.1);
      border: 1px solid rgba($primary-start, 0.3);
      border-radius: $radius-md;
      color: $primary-start;
      font-size: $font-size-xs;
      cursor: pointer;
      transition: all $duration-normal;

      &:hover {
        background: rgba($primary-start, 0.2);
      }

      span {
        font-size: 12px;
      }
    }
  }

  &__count {
    font-size: $font-size-xs;
    color: $gray-500;
    padding: $spacing-1 $spacing-2;
    background: rgba(255, 255, 255, 0.05);
    border-radius: $radius-sm;
  }

  &__select-failed {
    display: flex;
    align-items: center;
    gap: $spacing-1;
    padding: $spacing-1 $spacing-3;
    background: rgba($warning, 0.1);
    border: 1px solid rgba($warning, 0.3);
    border-radius: $radius-md;
    color: $warning;
    font-size: $font-size-xs;
    cursor: pointer;
    transition: all $duration-normal;

    &:hover:not(:disabled) {
      background: rgba($warning, 0.2);
    }

    &:disabled {
      opacity: 0.5;
      border-color: rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.04);
      color: $gray-500;
      cursor: not-allowed;
    }

    .el-icon {
      font-size: 12px;
    }
  }

  &__failed-count,
  &__selected-count {
    padding: $spacing-1 $spacing-2;
    border-radius: $radius-sm;
    background: rgba(255, 255, 255, 0.05);
    color: $gray-400;
    font-size: $font-size-xs;
  }

  &__failed-count {
    color: $danger;

    &--empty {
      color: $gray-500;
    }
  }

  &__selected-count {
    color: $primary-start;
  }

  &__grid {
    --upload-grid-item-size: 144px;

    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--upload-grid-item-size), 1fr));
    grid-auto-rows: var(--upload-grid-item-size);
    gap: $spacing-5;
    overflow-y: auto;
    padding-right: $spacing-2;
    padding-bottom: $spacing-4;
    align-content: start;
    align-items: start;
    justify-items: stretch;
    min-height: 0;
    scrollbar-gutter: stable;

    @media (min-width: 1400px) {
      --upload-grid-item-size: 156px;
    }

    @media (min-width: 1600px) {
      --upload-grid-item-size: 168px;
    }

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
      }
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
    }
  }

  &__empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: $gray-500;
    min-height: 0;

    &-icon {
      font-size: 48px;
      opacity: 0.3;
      margin-bottom: $spacing-3;
    }

    p {
      margin: 0;
      font-size: $font-size-sm;
    }

    &-hint {
      margin-top: $spacing-2 !important;
      font-size: $font-size-xs !important;
      color: $gray-600;
    }
  }
}

// 过渡动画
.grid-enter-active {
  transition: opacity $duration-normal $ease-out;
}

.grid-leave-active {
  transition: opacity $duration-fast $ease-out;
}

.grid-enter-from {
  opacity: 0;
}

.grid-leave-to {
  opacity: 0;
}

.grid-move {
  transition: transform $duration-normal $ease-out;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity $duration-normal;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
