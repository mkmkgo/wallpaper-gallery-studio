<template>
  <div class="category-sidebar">
    <div class="category-sidebar__header">
      <div class="category-sidebar__header-top">
        <h3 class="category-sidebar__title">
          <el-icon><Folder /></el-icon>
          分类目录
        </h3>
        <span
          class="category-sidebar__status"
          :class="{
            'category-sidebar__status--selected': targetPath,
            'category-sidebar__status--pending': !targetPath
          }"
        >
          {{ targetPath ? '已选择' : '待选择' }}
        </span>
        <span v-if="syncing" class="category-sidebar__syncing">
          <span class="category-sidebar__syncing-dot"></span>
          同步中…
        </span>
        <button
          class="category-sidebar__refresh-btn"
          title="刷新目录"
          :disabled="syncing"
          @click="$emit('refresh')"
        >
          <el-icon><Refresh /></el-icon>
        </button>
      </div>

      <p class="category-sidebar__hint" :title="currentPathLabel">{{ currentPathLabel }}</p>
    </div>

    <div class="category-sidebar__series">
      <button
        v-for="item in seriesList"
        :key="item.value"
        class="category-sidebar__series-btn"
        :class="{ 'category-sidebar__series-btn--active': series === item.value }"
        @click="$emit('select-series', item.value)"
      >
        <span class="category-sidebar__series-icon">{{ item.emoji }}</span>
        <span class="category-sidebar__series-meta">
          <span class="category-sidebar__series-label">{{ item.label }}</span>
        </span>
      </button>
    </div>

    <div class="category-sidebar__tree-shell">
      <div class="category-sidebar__tree-toolbar">
        <span class="category-sidebar__tree-toolbar-label">{{ currentSeriesLabel }}目录</span>
        <span class="category-sidebar__tree-toolbar-tip">点击目录即可设为目标路径</span>
      </div>

      <div v-if="currentPathSegments.length" class="category-sidebar__current-path">
        <span class="category-sidebar__current-path-label">当前路径</span>
        <div class="category-sidebar__current-path-trail">
          <span
            v-for="segment in currentPathSegments"
            :key="segment.key"
            class="category-sidebar__current-path-chip"
          >
            {{ segment.label }}
          </span>
        </div>
      </div>

      <div v-if="loading" class="category-sidebar__loading">
        <div class="category-sidebar__loading-head">
          <span class="category-sidebar__loading-badge">同步中</span>
          <span class="category-sidebar__loading-text">正在拉取目录结构，请稍等</span>
        </div>
        <div class="category-sidebar__loading-list">
          <div v-for="index in 6" :key="index" class="category-sidebar__loading-row">
            <span class="category-sidebar__loading-icon"></span>
            <span class="category-sidebar__loading-line" :style="getLoadingLineStyle(index)"></span>
          </div>
        </div>
      </div>

      <div v-else-if="treeData.length > 0" class="category-sidebar__tree">
        <el-tree
          :data="treeData"
          :props="treeProps"
          :load="loadNode"
          :current-node-key="targetPath || undefined"
          lazy
          highlight-current
          node-key="path"
          @node-click="handleNodeClick"
        >
          <template #default="{ node, data }">
            <div
              class="category-sidebar__tree-node"
              :class="{
                'category-sidebar__tree-node--active': isActiveNode(data.path),
                'category-sidebar__tree-node--ancestor': isAncestorNode(data.path)
              }"
            >
              <span class="category-sidebar__tree-icon">{{
                data.type === 'l1' ? '📁' : '📂'
              }}</span>
              <span class="category-sidebar__tree-label">{{ node.label }}</span>
              <span
                v-if="isActiveNode(data.path)"
                class="category-sidebar__tree-badge category-sidebar__tree-badge--active"
              >
                当前
              </span>
              <span
                v-else-if="isAncestorNode(data.path)"
                class="category-sidebar__tree-badge category-sidebar__tree-badge--ancestor"
              >
                上级
              </span>
              <button
                v-if="authStore.canUpload"
                class="category-sidebar__tree-delete"
                title="删除分类"
                @click.stop="handleDelete(data, node)"
              >
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </template>
        </el-tree>
      </div>

      <div v-else class="category-sidebar__tree-empty">
        <div class="category-sidebar__tree-empty-icon">🗂️</div>
        <strong class="category-sidebar__tree-empty-title">当前系列还没有目录</strong>
        <span class="category-sidebar__tree-empty-text">可以先新建分类，再开始上传。</span>
      </div>
    </div>

    <button v-if="authStore.canUpload" class="category-sidebar__new-btn" @click="$emit('create')">
      <el-icon><Plus /></el-icon>
      新建分类
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Folder, Plus, Delete, Refresh } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

const props = defineProps({
  series: { type: String, required: true },
  treeData: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  syncing: { type: Boolean, default: false },
  targetPath: { type: String, default: '' },
  loadNode: { type: Function, required: true }
})

const emit = defineEmits(['select-series', 'select-category', 'create', 'delete', 'refresh'])

const seriesList = [
  { value: 'desktop', label: '电脑', emoji: '🖥️' },
  { value: 'mobile', label: '手机', emoji: '📱' },
  { value: 'avatar', label: '头像', emoji: '👤' }
]

const treeProps = {
  label: 'name',
  children: 'children',
  isLeaf: data => data.type === 'l2'
}

const currentSeriesLabel = computed(() => {
  return seriesList.find(item => item.value === props.series)?.label || '当前系列'
})

const currentPathLabel = computed(() => {
  return props.targetPath || '请选择上传目录'
})

const currentPathSegments = computed(() => {
  if (!props.targetPath) return []

  const parts = props.targetPath.split('/').filter(Boolean).slice(1)

  return parts.map((part, index) => ({
    key: `${index}-${part}`,
    label: index === 0 ? currentSeriesLabel.value : part
  }))
})

function getLoadingLineStyle(index) {
  const widths = ['72%', '58%', '80%', '64%', '76%', '52%']
  return { width: widths[(index - 1) % widths.length] }
}

function isActiveNode(path) {
  return !!props.targetPath && props.targetPath === path
}

function isAncestorNode(path) {
  return !!props.targetPath && props.targetPath.startsWith(`${path}/`)
}

function handleNodeClick(data, node) {
  emit('select-category', { data, node })
}

function handleDelete(data, node) {
  emit('delete', { data, node })
}
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.category-sidebar {
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
  height: 100%;
  min-height: 0;
  padding: $spacing-4;
  overflow: hidden;
  background: $glass-bg;
  backdrop-filter: blur($glass-blur);
  border: 1px solid $glass-border;
  border-radius: $radius-xl;
  box-shadow: 0 18px 34px rgba(0, 0, 0, 0.14);

  &__header {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    flex-shrink: 0;
  }

  &__header-top {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    min-width: 0;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    margin: 0;
    flex: 1;
    color: $white;
    font-size: $font-size-base;
    font-weight: 700;

    .el-icon {
      color: $primary-start;
    }
  }

  &__hint {
    margin: 0;
    color: $gray-400;
    font-size: $font-size-xs;
    line-height: 1.4;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__status {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 $spacing-3;
    border: 1px solid transparent;
    border-radius: $radius-full;
    font-size: 11px;
    font-weight: 600;

    &--selected {
      color: #d1fae5;
      background: rgba($success, 0.16);
      border-color: rgba($success, 0.28);
    }

    &--pending {
      color: #fde68a;
      background: rgba($warning, 0.14);
      border-color: rgba($warning, 0.26);
    }
  }

  &__syncing {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 $spacing-3;
    color: #c4b5fd;
    font-size: 11px;
    font-weight: 600;
    background: rgba($primary-start, 0.12);
    border: 1px solid rgba($primary-start, 0.2);
    border-radius: $radius-full;
    white-space: nowrap;
  }

  &__syncing-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 0 rgba($primary-start, 0.45);
    animation: category-sidebar-sync-pulse 1.4s infinite;
  }

  &__refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    color: $gray-400;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    transition: all $duration-fast $ease-out;

    &:hover {
      color: $white;
      background: rgba($primary-start, 0.14);
      border-color: rgba($primary-start, 0.24);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      transform: none;
    }

    .el-icon {
      font-size: 14px;
    }
  }

  &__series {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: $spacing-2;
    flex-shrink: 0;
  }

  &__series-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 $spacing-2;
    text-align: left;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: $radius-lg;
    transition: all $duration-normal $ease-out;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.16);
      transform: translateY(-1px);
    }

    &--active {
      background: linear-gradient(135deg, rgba($primary-start, 0.26), rgba($primary-end, 0.18));
      border-color: rgba($primary-start, 0.3);
      box-shadow: 0 10px 24px rgba($primary-start, 0.18);
    }
  }

  &__series-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    font-size: 13px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 8px;
  }

  &__series-meta {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
  }

  &__series-label {
    color: $gray-200;
    font-size: 13px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;

    .category-sidebar__series-btn--active & {
      color: $white;
    }
  }

  &__tree-shell {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
    min-width: 0;
    padding: $spacing-3;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.025));
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: $radius-lg;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  &__tree-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    margin-bottom: $spacing-3;
    padding-bottom: $spacing-3;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);

    &-label {
      display: block;
      min-width: 0;
      color: $gray-500;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    &-tip {
      max-width: 110px;
      flex-shrink: 1;
      color: $gray-500;
      font-size: 11px;
      line-height: 1.5;
      text-align: right;
    }
  }

  &__current-path {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    margin-bottom: $spacing-3;
    padding: $spacing-2 0 $spacing-3;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);

    &-label {
      color: $gray-500;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    &-trail {
      display: flex;
      flex-wrap: wrap;
      gap: $spacing-2;
      min-width: 0;
    }

    &-chip {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      max-width: 100%;
      padding: 0 $spacing-3;
      color: $gray-200;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: $radius-full;

      &:last-child {
        color: $white;
        background: rgba($primary-start, 0.16);
        border-color: rgba($primary-start, 0.24);
      }
    }
  }

  &__loading,
  &__tree,
  &__tree-empty {
    flex: 1;
    min-height: 0;
  }

  &__loading {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: $spacing-4;
  }

  &__loading-head {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__loading-badge {
    width: fit-content;
    min-height: 24px;
    padding: 0 $spacing-2;
    color: $white;
    font-size: 11px;
    line-height: 24px;
    background: rgba($primary-start, 0.16);
    border: 1px solid rgba($primary-start, 0.22);
    border-radius: $radius-full;
  }

  &__loading-text {
    color: $gray-400;
    font-size: $font-size-sm;
  }

  &__loading-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__loading-row {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: $spacing-2 $spacing-1;
    background: rgba(255, 255, 255, 0.03);
    border-radius: $radius-md;
  }

  &__loading-icon,
  &__loading-line {
    position: relative;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.08);

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
      transform: translateX(-100%);
      animation: category-sidebar-shimmer 1.35s infinite;
    }
  }

  &__loading-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: 6px;
  }

  &__loading-line {
    height: 12px;
    border-radius: $radius-full;
  }

  &__tree {
    overflow-y: auto;
    overflow-x: hidden;

    :deep(.el-tree) {
      height: 100%;
      min-width: 0;
    }

    &-node {
      display: flex;
      width: 100%;
      align-items: center;
      gap: $spacing-2;
      padding: 2px $spacing-1 2px 0;
      border-radius: $radius-md;
      transition: transform $duration-fast $ease-out;

      &:hover .category-sidebar__tree-delete {
        opacity: 1;
      }

      &--active {
        .category-sidebar__tree-icon {
          transform: scale(1.05);
        }

        .category-sidebar__tree-label {
          color: $white;
          font-weight: 600;
        }
      }

      &--ancestor {
        .category-sidebar__tree-label {
          color: rgba($white, 0.84);
        }
      }
    }

    &-icon {
      font-size: 14px;
      transition: transform $duration-fast $ease-out;
    }

    &-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      color: $gray-200;
      font-size: $font-size-sm;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &-delete {
      display: flex;
      width: 20px;
      height: 20px;
      align-items: center;
      justify-content: center;
      opacity: 0;
      color: $gray-500;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid transparent;
      border-radius: $radius-sm;
      transition: all $duration-fast $ease-out;

      &:hover {
        color: #fca5a5;
        background: rgba($danger, 0.16);
        border-color: rgba($danger, 0.2);
      }

      .el-icon {
        font-size: 12px;
      }
    }

    &-badge {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      padding: 0 7px;
      border: 1px solid transparent;
      border-radius: $radius-full;
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.02em;
      flex-shrink: 0;

      &--active {
        color: #ede9fe;
        background: rgba($primary-start, 0.18);
        border-color: rgba($primary-start, 0.24);
      }

      &--ancestor {
        color: #cbd5e1;
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.08);
      }
    }

    &-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: $spacing-2;
      padding: $spacing-4;
      color: $gray-500;
      text-align: center;
    }

    &-empty-icon {
      display: flex;
      width: 52px;
      height: 52px;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 18px;
    }

    &-empty-title {
      color: $white;
      font-size: $font-size-sm;
      font-weight: 600;
    }

    &-empty-text {
      font-size: $font-size-xs;
      line-height: 1.6;
    }

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }
  }

  &__new-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    min-height: 42px;
    padding: 0 $spacing-3;
    color: $gray-200;
    font-size: $font-size-sm;
    font-weight: 600;
    cursor: pointer;
    background: linear-gradient(180deg, rgba($primary-start, 0.12), rgba($primary-end, 0.08));
    border: 1px solid rgba($primary-start, 0.18);
    border-radius: $radius-lg;
    transition: all $duration-normal $ease-out;
    flex-shrink: 0;

    &:hover {
      color: $white;
      background: linear-gradient(180deg, rgba($primary-start, 0.18), rgba($primary-end, 0.12));
      border-color: rgba($primary-start, 0.26);
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgba($primary-start, 0.16);
    }
  }
}

:deep(.el-tree) {
  color: $gray-300;
  background: transparent;
  overflow-x: hidden;

  .el-tree-node__content {
    min-height: 38px;
    padding-left: $spacing-1;
    padding-right: $spacing-2;
    border-radius: $radius-md;
    transition:
      background $duration-fast $ease-out,
      box-shadow $duration-fast $ease-out,
      transform $duration-fast $ease-out;

    &:hover {
      background: rgba(255, 255, 255, 0.08);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    }
  }

  .el-tree-node.is-current > .el-tree-node__content {
    color: $white;
    background: linear-gradient(135deg, rgba($primary-start, 0.18), rgba($primary-end, 0.1));
    box-shadow:
      inset 0 0 0 1px rgba($primary-start, 0.18),
      0 8px 18px rgba($primary-start, 0.08);
  }

  .el-tree-node__expand-icon {
    color: $gray-500;
  }
}

@keyframes category-sidebar-shimmer {
  100% {
    transform: translateX(100%);
  }
}

@keyframes category-sidebar-sync-pulse {
  70% {
    box-shadow: 0 0 0 7px rgba($primary-start, 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba($primary-start, 0);
  }
}

@media (max-width: 900px) {
  .category-sidebar {
    &__header-top {
      flex-wrap: wrap;
    }

    &__tree-toolbar {
      flex-direction: column;

      &-tip {
        max-width: none;
        text-align: left;
      }
    }
  }
}
</style>
