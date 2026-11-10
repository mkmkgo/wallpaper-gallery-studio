<template>
  <section class="ai-task-center">
    <div class="ai-task-center__header">
      <div>
        <div class="ai-task-center__eyebrow">AI Task Center</div>
        <div class="ai-task-center__title-row">
          <strong>任务中心</strong>
          <span v-if="taskStore.pendingCount > 0" class="ai-task-center__badge">
            {{ taskStore.pendingCount }} 待处理
          </span>
        </div>
      </div>

      <div class="ai-task-center__stats">
        <span>排队 {{ taskStore.queuedTasks.length }}</span>
        <span>处理中 {{ taskStore.activeTasks.length }}</span>
        <span>完成 {{ taskStore.completedTasks.length }}</span>
        <span v-if="taskStore.failedTasks.length > 0" class="ai-task-center__stat--error">
          失败 {{ taskStore.failedTasks.length }}
        </span>
        <span class="ai-task-center__stat--total">共 {{ sortedTasks.length }} 个任务</span>
      </div>
    </div>

    <div v-if="sortedTasks.length > 0" class="ai-task-center__hint">
      滚动查看全部 {{ sortedTasks.length }} 个任务 · 仅渲染可见卡片
    </div>

    <div v-if="taskStore.persistenceWarning" class="ai-task-center__warning">
      {{ taskStore.persistenceWarning }}
    </div>

    <div
      v-if="sortedTasks.length > 0"
      ref="scrollerRef"
      class="ai-task-center__scroller"
      @scroll.passive="handleScroll"
    >
      <div class="ai-task-center__phantom" :style="{ height: totalHeight + 'px' }"></div>
      <div
        class="ai-task-center__viewport"
        :style="{ transform: `translateY(${offsetY}px)`, '--ai-task-columns': columns }"
      >
        <article v-for="item in visibleItems" :key="item.task.id" class="ai-task-center__item">
          <img v-if="item.previewUrl" :src="item.previewUrl" class="ai-task-center__thumb" alt="" />
          <div v-else class="ai-task-center__thumb ai-task-center__thumb--empty">🖼</div>

          <div class="ai-task-center__index">{{ item.index + 1 }}</div>

          <div class="ai-task-center__body">
            <div class="ai-task-center__name" :title="item.task.fileName">
              {{ item.task.fileName }}
            </div>
            <div class="ai-task-center__meta">
              <span>{{ getProviderLabel(item.task.provider) }}</span>
              <span>{{ getStatusLabel(item.task.status) }}</span>
              <span v-if="item.task.attempts > 0">第 {{ item.task.attempts }} 次</span>
              <span v-if="item.task.status === 'queued' && queuePosition(item.task) > 0">
                队列第 {{ queuePosition(item.task) }} 位
              </span>
            </div>
            <div v-if="item.task.error" class="ai-task-center__error" :title="item.task.error">
              {{ item.task.error }}
            </div>
          </div>

          <div
            class="ai-task-center__status"
            :class="`ai-task-center__status--${item.task.status}`"
          >
            <span v-if="item.task.status === 'analyzing'" class="ai-task-center__spinner"></span>
            <span v-else-if="item.task.status === 'retrying'">⏱</span>
            <span v-else-if="item.task.status === 'completed'">✓</span>
            <span v-else-if="item.task.status === 'failed'">!</span>
            <span v-else>…</span>
          </div>

          <button
            v-if="item.task.status === 'failed'"
            class="ai-task-center__retry"
            @click="handleRetry(item.task.id)"
          >
            重试
          </button>
        </article>
      </div>
    </div>

    <div v-else class="ai-task-center__empty">暂无 AI 分析任务</div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useAiTasksStore } from '@/stores/ai-tasks'
import { resumeAiTaskQueue, retryAiTask } from '@/services/ai/task-runner'
import { getVirtualGridWindow } from '@/utils/virtual-grid'

const taskStore = useAiTasksStore()

const ROW_HEIGHT = 74 // 卡片 66px + 行间距 8px，与 CSS 保持一致
const GRID_GAP = 8
const MIN_CARD_WIDTH = 250
const BUFFER_ROWS = 2

const scrollerRef = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(320)
const columns = ref(4)

const sortedTasks = computed(() =>
  [...taskStore.tasks].sort((a, b) => {
    const rank = { analyzing: 0, retrying: 1, queued: 2, failed: 3, completed: 4 }
    const rankDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
    if (rankDiff !== 0) return rankDiff
    return (a.createdAt || 0) - (b.createdAt || 0)
  })
)

const windowState = computed(() =>
  getVirtualGridWindow({
    itemCount: sortedTasks.value.length,
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    columns: columns.value,
    rowHeight: ROW_HEIGHT,
    bufferRows: BUFFER_ROWS
  })
)

const totalHeight = computed(() => windowState.value.totalHeight)
const offsetY = computed(() => windowState.value.offsetY)

const visibleTasks = computed(() =>
  sortedTasks.value
    .slice(windowState.value.startIndex, windowState.value.endIndex)
    .map((task, index) => ({ task, index: windowState.value.startIndex + index }))
)

// 只为可见任务创建 objectURL；滚出视口立即 revoke，组件卸载时全部回收。
// 这样 600+ 任务也只会同时存在十几个 blob URL，不会泄漏。
const previewUrls = ref(new Map())

function createObjectUrl(blob) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  return URL.createObjectURL(blob)
}

function revokeObjectUrl(url) {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

watch(
  visibleTasks,
  items => {
    const next = new Map()
    for (const { task } of items) {
      const existing = previewUrls.value.get(task.id)
      if (existing) {
        next.set(task.id, existing)
      } else if (task.blob) {
        const url = createObjectUrl(task.blob)
        if (url) next.set(task.id, url)
      }
    }
    for (const [id, url] of previewUrls.value) {
      if (!next.has(id)) revokeObjectUrl(url)
    }
    previewUrls.value = next
  },
  { immediate: true }
)

const visibleItems = computed(() =>
  visibleTasks.value.map(({ task, index }) => ({
    task,
    index,
    previewUrl: previewUrls.value.get(task.id) || ''
  }))
)

function handleScroll(event) {
  scrollTop.value = event.target.scrollTop
}

function measureViewport() {
  const el = scrollerRef.value
  if (!el) return
  if (el.clientHeight) viewportHeight.value = el.clientHeight
  if (el.clientWidth) {
    columns.value = Math.max(
      1,
      Math.min(6, Math.floor((el.clientWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)))
    )
  }
}

function getProviderLabel(provider) {
  if (provider === 'zhipu') return '智谱 GLM'
  if (provider === 'groq') return 'Groq'
  if (provider === 'modelscope') return 'ModelScope'
  return provider || 'AI'
}

function getStatusLabel(status) {
  const labels = {
    queued: '排队中',
    analyzing: '分析中',
    retrying: '等待重试',
    completed: '已完成',
    failed: '失败'
  }
  return labels[status] || status
}

function queuePosition(task) {
  return taskStore.queuedTasks.findIndex(item => item.id === task.id) + 1
}

async function handleRetry(taskId) {
  try {
    await retryAiTask(taskId)
  } catch (error) {
    ElMessage.error(error.message || '任务重试失败')
  }
}

onMounted(async () => {
  measureViewport()
  window.addEventListener('resize', measureViewport)
  await taskStore.initialize()
  measureViewport()
  resumeAiTaskQueue().catch(error => {
    console.warn('[AiTaskCenter] 自动续跑失败:', error)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', measureViewport)
  for (const url of previewUrls.value.values()) {
    revokeObjectUrl(url)
  }
  previewUrls.value = new Map()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.ai-task-center {
  flex-shrink: 0;
  margin-top: $spacing-3;
  padding: $spacing-3;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: $radius-lg;
  background: rgba(8, 12, 24, 0.5);

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-2;
  }

  &__eyebrow {
    color: $gray-500;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__title-row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    color: $white;
  }

  &__badge {
    padding: 2px 7px;
    border-radius: $radius-full;
    background: rgba($primary-start, 0.18);
    color: $gray-200;
    font-size: 10px;
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: $spacing-2;
    color: $gray-400;
    font-size: 11px;
  }

  &__stat--error {
    color: $danger;
  }

  &__stat--total {
    color: $gray-300;
  }

  &__hint {
    margin-bottom: $spacing-2;
    color: $gray-500;
    font-size: 10px;
  }

  &__warning {
    margin-bottom: $spacing-2;
    padding: $spacing-2;
    border-radius: $radius-md;
    background: rgba($warning, 0.12);
    color: $warning;
    font-size: 11px;
  }

  &__scroller {
    position: relative;
    min-height: 160px;
    max-height: min(30vh, 280px);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.28);
      }
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
    }
  }

  &__phantom {
    width: 1px;
    opacity: 0;
    pointer-events: none;
  }

  &__viewport {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: grid;
    grid-template-columns: repeat(var(--ai-task-columns, 4), minmax(0, 1fr));
    gap: $spacing-2;
    will-change: transform;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    min-width: 0;
    height: 66px;
    padding: $spacing-2;
    border-radius: $radius-md;
    background: rgba(255, 255, 255, 0.04);
  }

  &__thumb {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: $radius-sm;
    object-fit: cover;
    background: rgba(255, 255, 255, 0.06);

    &--empty {
      display: grid;
      place-items: center;
      color: $gray-500;
      font-size: 15px;
    }
  }

  &__index {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: $gray-400;
    font-size: 10px;
  }

  &__body {
    flex: 1;
    min-width: 0;
  }

  &__name {
    overflow: hidden;
    color: $gray-200;
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 2px;
    color: $gray-500;
    font-size: 9px;
  }

  &__error {
    margin-top: 2px;
    overflow: hidden;
    color: $danger;
    font-size: 9px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: $gray-400;

    &--completed {
      background: rgba($success, 0.14);
      color: $success;
    }

    &--failed {
      background: rgba($danger, 0.14);
      color: $danger;
    }

    &--retrying {
      background: rgba($warning, 0.14);
      color: $warning;
    }

    &--analyzing {
      background: rgba($primary-start, 0.14);
      color: $primary-start;
    }
  }

  &__spinner {
    width: 10px;
    height: 10px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: task-spin 0.8s linear infinite;
  }

  &__retry {
    padding: 4px 7px;
    border: 0;
    border-radius: $radius-md;
    background: rgba($danger, 0.14);
    color: $danger;
    font-size: 10px;
    cursor: pointer;
  }

  &__empty {
    padding: $spacing-2;
    color: $gray-500;
    font-size: 11px;
    text-align: center;
  }
}

@keyframes task-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
