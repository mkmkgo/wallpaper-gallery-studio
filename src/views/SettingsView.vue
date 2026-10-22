<template>
  <MainLayout>
    <div ref="viewRef" class="settings-view">
      <div class="settings-view__container">
        <!-- 左侧：系统设置 -->
        <GlassCard :hoverable="false" class="settings-view__card">
          <div class="settings-view__header">
            <span class="settings-view__icon">⚙️</span>
            <h2 class="settings-view__title">系统设置</h2>
          </div>

          <el-form :model="formData" label-position="top" class="settings-view__form">
            <el-form-item label="仓库所有者">
              <el-input v-model="formData.owner" placeholder="GitHub 用户名或组织名" />
            </el-form-item>

            <el-form-item label="仓库名称">
              <el-input v-model="formData.repo" placeholder="仓库名称" />
            </el-form-item>

            <div class="settings-view__row">
              <el-form-item label="默认分支" class="settings-view__row-item">
                <el-input v-model="formData.branch" placeholder="main" />
              </el-form-item>
              <el-form-item label="Client ID" class="settings-view__row-item">
                <el-input v-model="formData.clientId" placeholder="OAuth Client ID" />
              </el-form-item>
            </div>

            <el-form-item label="OAuth Worker URL">
              <el-input
                v-model="formData.oauthWorkerUrl"
                placeholder="https://your-oauth-worker.your-subdomain.workers.dev"
              />
            </el-form-item>

            <div class="settings-view__actions">
              <el-button @click="handleReset">重置默认</el-button>
              <el-button type="primary" :loading="validating" @click="handleSave">
                验证并保存
              </el-button>
            </div>
          </el-form>

          <!-- 验证结果 -->
          <Transition name="fade">
            <div v-if="validationResult" class="settings-view__result">
              <el-alert
                :title="validationResult.success ? '配置验证成功' : '配置验证失败'"
                :type="validationResult.success ? 'success' : 'error'"
                :description="validationResult.message"
                show-icon
                :closable="false"
              />
            </div>
          </Transition>
        </GlassCard>

        <!-- 右侧：当前状态 -->
        <GlassCard :hoverable="false" class="settings-view__card settings-view__card--status">
          <div class="settings-view__header">
            <span class="settings-view__icon">📊</span>
            <h2 class="settings-view__title">当前状态</h2>
          </div>

          <div class="settings-view__status">
            <!-- 用户信息 -->
            <div v-if="authStore.isAuthenticated" class="settings-view__user">
              <el-avatar :size="48" :src="authStore.user?.avatar_url" />
              <div class="settings-view__user-info">
                <span class="settings-view__user-name">{{
                  authStore.user?.name || authStore.user?.login
                }}</span>
                <span class="settings-view__user-login">@{{ authStore.user?.login }}</span>
              </div>
            </div>

            <!-- 状态列表 -->
            <div class="settings-view__status-list">
              <div class="settings-view__status-item">
                <span class="settings-view__status-label">登录状态</span>
                <el-tag :type="authStore.isAuthenticated ? 'success' : 'danger'" size="small">
                  {{ authStore.isAuthenticated ? '已登录' : '未登录' }}
                </el-tag>
              </div>

              <div class="settings-view__status-item">
                <span class="settings-view__status-label">权限级别</span>
                <el-tag
                  :type="authStore.permissionChecked ? permissionTagType : 'info'"
                  size="small"
                  class="settings-view__permission-tag"
                >
                  {{ authStore.permissionChecked ? permissionLabel : '检查中...' }}
                </el-tag>
              </div>

              <div class="settings-view__status-item">
                <span class="settings-view__status-label">目标仓库</span>
                <a :href="repoUrl" target="_blank" class="settings-view__repo-link">
                  {{ configStore.config.owner }}/{{ configStore.config.repo }}
                </a>
              </div>
            </div>

            <!-- 快捷操作 -->
            <div class="settings-view__quick-actions">
              <a :href="repoUrl" target="_blank" class="settings-view__quick-btn">
                <span>🔗</span> 访问仓库
              </a>
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                class="settings-view__quick-btn"
              >
                <span>🔑</span> 管理 Token
              </a>
            </div>
          </div>
        </GlassCard>

        <!-- 下侧横跨两栏：分仓仓库管理 -->
        <GlassCard :hoverable="false" class="settings-view__card settings-view__card--repos">
          <div class="settings-view__header">
            <span class="settings-view__icon">🗂️</span>
            <h2 class="settings-view__title">分仓仓库</h2>
            <div class="settings-view__header-actions">
              <el-button size="small" :loading="capacityLoading" @click="loadRepoCapacity(true)">
                刷新容量
              </el-button>
              <el-button size="small" type="primary" @click="openRepoDialog()">新增仓库</el-button>
            </div>
          </div>

          <!-- 分配模式 -->
          <div class="settings-view__assignment">
            <el-form-item label="分配模式">
              <el-radio-group v-model="assignment">
                <el-radio value="auto">自动推荐</el-radio>
                <el-radio value="manual">手动指定</el-radio>
              </el-radio-group>
            </el-form-item>
            <p class="settings-view__hint">
              <template v-if="assignment === 'auto'">
                自动：按 priority 与剩余容量挑仓库；上传页会把推荐结果作为默认值，仍可临时改。
              </template>
              <template v-else> 手动：以上传页显式选择的仓库为准，不参与容量自动切换。 </template>
            </p>
            <el-form-item label="默认仓库（未指定系列时的落点）">
              <el-select v-model="defaultRepoId" size="small" class="settings-view__default-select">
                <el-option
                  v-for="entry in repoEntries"
                  :key="entry.id"
                  :value="entry.id"
                  :label="`${entry.label} · ${entry.id}`"
                />
              </el-select>
            </el-form-item>
          </div>

          <!-- 仓库列表 -->
          <div v-if="repoEntries.length" class="settings-view__repo-list">
            <div
              v-for="entry in repoEntries"
              :key="entry.id"
              class="settings-view__repo-row"
              :class="{ 'settings-view__repo-row--disabled': !entry.enabled }"
            >
              <div class="settings-view__repo-head">
                <div class="settings-view__repo-title-group">
                  <span class="settings-view__repo-name">{{ entry.label }}</span>
                  <span class="settings-view__repo-mono">{{ entry.owner }}/{{ entry.repo }}</span>
                </div>
                <div class="settings-view__repo-actions">
                  <el-switch
                    :model-value="entry.enabled"
                    size="small"
                    :active-text="entry.enabled ? '启用' : '停用'"
                    @change="() => toggleRepo(entry)"
                  />
                  <el-button size="small" text @click="openRepoDialog(entry)">编辑</el-button>
                  <el-button size="small" text type="danger" @click="handleDeleteRepo(entry)">
                    删除
                  </el-button>
                </div>
              </div>

              <div class="settings-view__repo-meta">
                <el-tag size="small" type="info">分支 {{ entry.branch || 'main' }}</el-tag>
                <el-tag size="small" type="info">优先级 {{ entry.priority }}</el-tag>
                <el-tag
                  v-for="item in entry.accepts"
                  :key="item"
                  size="small"
                  effect="plain"
                  :type="getSeriesTagType(item)"
                >
                  {{ formatSeriesName(item) }}
                </el-tag>
              </div>

              <div class="settings-view__repo-capacity">
                <el-progress
                  v-if="isCapacityKnown(entry)"
                  :percentage="getCapacityPercent(entry)"
                  :status="getCapacityStatus(entry)"
                  :stroke-width="10"
                  :show-text="false"
                  class="settings-view__repo-progress"
                />
                <span class="settings-view__repo-capacity-text">
                  {{ formatRepoCapacity(repoSizeMap, entry) }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="settings-view__repo-empty">
            还没有配置任何仓库，点击右上角「新增仓库」添加。
          </div>
        </GlassCard>
      </div>
    </div>

    <!-- 新增 / 编辑仓库 -->
    <el-dialog
      v-model="showRepoDialog"
      :title="editingRepoId ? '编辑仓库' : '新增仓库'"
      width="580px"
      append-to-body
      @closed="resetRepoForm"
    >
      <el-form
        ref="repoFormRef"
        :model="repoForm"
        :rules="repoRules"
        label-position="top"
        class="settings-view__form"
      >
        <div class="settings-view__row">
          <el-form-item label="仓库 ID" prop="id" class="settings-view__row-item">
            <el-input v-model="repoForm.id" placeholder="desktop-2" :disabled="!!editingRepoId" />
          </el-form-item>
          <el-form-item label="显示名称" prop="label" class="settings-view__row-item">
            <el-input v-model="repoForm.label" placeholder="桌面壁纸仓 #2" />
          </el-form-item>
        </div>

        <div class="settings-view__row">
          <el-form-item label="所有者" prop="owner" class="settings-view__row-item">
            <el-input v-model="repoForm.owner" placeholder="GitHub 用户名或组织名" />
          </el-form-item>
          <el-form-item label="仓库名称" prop="repo" class="settings-view__row-item">
            <el-input v-model="repoForm.repo" placeholder="仓库名称" />
          </el-form-item>
        </div>

        <div class="settings-view__row">
          <el-form-item label="分支" prop="branch" class="settings-view__row-item">
            <el-input v-model="repoForm.branch" placeholder="main" />
          </el-form-item>
          <el-form-item label="优先级" prop="priority" class="settings-view__row-item">
            <el-input-number v-model="repoForm.priority" :step="1" class="settings-view__number" />
          </el-form-item>
        </div>

        <el-form-item label="接受的系列" prop="accepts">
          <el-select
            v-model="repoForm.accepts"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择该仓库接受的系列"
            class="settings-view__accepts-select"
          >
            <el-option
              v-for="option in seriesOptions"
              :key="option.value"
              :value="option.value"
              :label="option.label"
            />
          </el-select>
        </el-form-item>

        <div class="settings-view__row">
          <el-form-item label="容量上限 (GB)" prop="capacityGB" class="settings-view__row-item">
            <el-input-number
              v-model="repoForm.capacityGB"
              :min="0"
              :step="0.5"
              :precision="2"
              class="settings-view__number"
            />
          </el-form-item>
          <el-form-item label="工作流事件" prop="workflowEvent" class="settings-view__row-item">
            <el-input v-model="repoForm.workflowEvent" :placeholder="derivedWorkflowEvent" />
          </el-form-item>
        </div>

        <el-form-item label="回滚事件">
          <el-input v-model="repoForm.rollbackEvent" :placeholder="derivedRollbackEvent" />
        </el-form-item>

        <p class="settings-view__hint">
          容量上限填 0 表示不限容量；工作流事件留空时按 ID 推导；回滚事件留空时按工作流事件推导。
        </p>
      </el-form>

      <template #footer>
        <el-button @click="showRepoDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRepoForm">确定</el-button>
      </template>
    </el-dialog>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MainLayout from '@/components/MainLayout.vue'
import GlassCard from '@/components/GlassCard.vue'
import { githubService } from '@/services/github'
import {
  collectRegistrySeries,
  deriveRollbackEvent,
  isValidRepoId,
  normalizeRegistry
} from '@/features/upload-workspace/domain/repo-registry'
import {
  formatRepoCapacity,
  resolveRepoCapacityPercent,
  resolveRepoCapacityStatus,
  resolveRepoUsedKB
} from '@/features/upload-workspace/domain/repo-capacity'
import { useConfigStore } from '@/stores/config'
import { useAuthStore } from '@/stores/auth'
import { useAnimation } from '@/composables/useAnimation'

/** 默认容量上限：4.5 GB */
const DEFAULT_CAPACITY_GB = 4.5
const KB_PER_GB = 1024 * 1024

const SERIES_LABELS = {
  desktop: '电脑壁纸',
  mobile: '手机壁纸',
  avatar: '头像壁纸',
  '*': '全部系列'
}

function formatSeriesName(series) {
  return SERIES_LABELS[series] || series
}

function getSeriesTagType(series) {
  const types = { desktop: 'primary', mobile: 'success', avatar: 'warning', '*': 'info' }
  return types[series] || 'info'
}

const configStore = useConfigStore()
const authStore = useAuthStore()
const { fadeInUp } = useAnimation()

const viewRef = ref(null)
const validating = ref(false)
const validationResult = ref(null)

// 表单数据
const formData = reactive({
  owner: configStore.config.owner,
  repo: configStore.config.repo,
  branch: configStore.config.branch,
  clientId: configStore.config.clientId,
  oauthWorkerUrl: configStore.config.oauthWorkerUrl
})

// 权限标签
const permissionLabel = computed(() => {
  const labels = { admin: '管理员', write: '协作者', read: '只读', none: '无权限' }
  return labels[authStore.permissionLevel] || '未知'
})

const permissionTagType = computed(() => {
  const types = { admin: 'success', write: 'primary', read: 'warning', none: 'danger' }
  return types[authStore.permissionLevel] || 'info'
})

const repoUrl = computed(
  () => `https://github.com/${configStore.config.owner}/${configStore.config.repo}`
)

// ============ 分仓仓库管理 ============
// 注册表是本界面的唯一数据源；改的是本地草稿，点「验证并保存」才落盘。

const capacityLoading = ref(false)
const repoSizeMap = ref({})
const showRepoDialog = ref(false)
const editingRepoId = ref('')
const repoFormRef = ref(null)

function resolveDraftId(item, index) {
  return String(item?.id ?? item?.repo ?? `repo-${index}`)
}

function createRepoDraft() {
  const source = Array.isArray(configStore.config.repositories)
    ? configStore.config.repositories
    : []

  return source
    .filter(item => item && typeof item === 'object')
    .map(item => ({ ...item, accepts: Array.isArray(item.accepts) ? [...item.accepts] : [] }))
}

const repoDraft = ref(createRepoDraft())
const assignment = ref(configStore.config.assignment === 'manual' ? 'manual' : 'auto')
const defaultRepoId = ref(configStore.config.defaultRepoId || 'main')

/** 展示用条目：补上 owner / branch 缺省，保留 enabled=false 的仓库 */
const repoEntries = computed(() =>
  normalizeRegistry(repoDraft.value, {
    owner: formData.owner,
    branch: formData.branch
  })
)

/** accepts 可选项 = 内置三个系列 ∪ 注册表里已出现的系列 */
const seriesOptions = computed(() => {
  const known = collectRegistrySeries(repoDraft.value) || []
  return [...new Set(['desktop', 'mobile', 'avatar', ...known])].map(value => ({
    value,
    label: formatSeriesName(value)
  }))
})

function createRepoFormState() {
  return {
    id: '',
    label: '',
    owner: '',
    repo: '',
    branch: 'main',
    accepts: [],
    priority: 0,
    capacityGB: DEFAULT_CAPACITY_GB,
    workflowEvent: '',
    rollbackEvent: '',
    enabled: true,
    cdnTagPrefix: 'v'
  }
}

const repoForm = reactive(createRepoFormState())

/** 未填 workflowEvent 时的推导值（按 id） */
const derivedWorkflowEvent = computed(() => {
  const id = String(repoForm.id || '').trim()
  if (!id || id === 'main') return 'process-wallpapers'
  return `process-wallpapers-${id}`
})

/** 未填 rollbackEvent 时的推导值（按 workflowEvent） */
const derivedRollbackEvent = computed(() =>
  deriveRollbackEvent(String(repoForm.workflowEvent || '').trim() || derivedWorkflowEvent.value)
)

const repoRules = {
  id: [
    { required: true, message: '请输入仓库 ID', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!isValidRepoId(value)) {
          callback(new Error('ID 只能包含字母、数字、点、下划线和连字符'))
          return
        }

        const duplicated = repoDraft.value.some(
          item => item.id === value && value !== editingRepoId.value
        )
        if (duplicated) {
          callback(new Error('该 ID 已存在'))
          return
        }

        callback()
      },
      trigger: 'blur'
    }
  ],
  label: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
  owner: [
    { required: true, message: '请输入仓库所有者', trigger: 'blur' },
    {
      validator: (_rule, value, callback) =>
        configStore.isValidOwnerName(value)
          ? callback()
          : callback(new Error('仓库所有者名称格式不正确')),
      trigger: 'blur'
    }
  ],
  repo: [
    { required: true, message: '请输入仓库名称', trigger: 'blur' },
    {
      validator: (_rule, value, callback) =>
        configStore.isValidRepoName(value) ? callback() : callback(new Error('仓库名称格式不正确')),
      trigger: 'blur'
    }
  ],
  branch: [{ required: true, message: '请输入分支', trigger: 'blur' }],
  accepts: [{ required: true, message: '请至少选择一个系列', trigger: 'change' }]
}

function openRepoDialog(entry = null) {
  editingRepoId.value = entry?.id || ''

  Object.assign(repoForm, createRepoFormState(), {
    id: entry?.id || '',
    label: entry?.label || '',
    owner: entry?.owner || formData.owner,
    repo: entry?.repo || '',
    branch: entry?.branch || 'main',
    accepts: entry?.accepts?.length ? [...entry.accepts] : [],
    priority: Number.isFinite(entry?.priority) ? entry.priority : 0,
    capacityGB: entry?.capacityKB > 0 ? Number((entry.capacityKB / KB_PER_GB).toFixed(2)) : 0,
    workflowEvent: entry?.workflowEvent || '',
    rollbackEvent: entry?.rollbackEvent || '',
    enabled: entry?.enabled !== false,
    cdnTagPrefix: entry?.cdnTagPrefix || 'v'
  })

  showRepoDialog.value = true
  nextTick(() => repoFormRef.value?.clearValidate())
}

function resetRepoForm() {
  editingRepoId.value = ''
}

function toggleRepo(entry) {
  const index = repoDraft.value.findIndex((item, i) => resolveDraftId(item, i) === entry.id)
  if (index === -1) return

  repoDraft.value[index] = { ...repoDraft.value[index], enabled: !entry.enabled }
}

async function handleDeleteRepo(entry) {
  try {
    await ElMessageBox.confirm(
      `确定要从注册表里移除「${entry.label}」吗？\n\n${entry.owner}/${entry.repo}\n\n这只是删除配置，不会动 GitHub 上的仓库。`,
      '删除仓库',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return
  }

  const index = repoDraft.value.findIndex((item, i) => resolveDraftId(item, i) === entry.id)
  if (index > -1) {
    repoDraft.value.splice(index, 1)
  }

  if (defaultRepoId.value === entry.id) {
    defaultRepoId.value = repoEntries.value[0]?.id || 'main'
  }

  ElMessage.success('已移除仓库，记得点「验证并保存」')
}

async function submitRepoForm() {
  if (!repoFormRef.value) return

  try {
    await repoFormRef.value.validate()
  } catch {
    return
  }

  const id = String(repoForm.id || '').trim()
  const workflowEvent = String(repoForm.workflowEvent || '').trim() || derivedWorkflowEvent.value
  const rollbackEvent = String(repoForm.rollbackEvent || '').trim()

  const payload = {
    id,
    label: String(repoForm.label || '').trim() || id,
    owner: String(repoForm.owner || '').trim(),
    repo: String(repoForm.repo || '').trim(),
    branch: String(repoForm.branch || '').trim() || 'main',
    enabled: repoForm.enabled !== false,
    accepts: [...repoForm.accepts],
    priority: Number.isFinite(repoForm.priority) ? repoForm.priority : 0,
    capacityKB: Math.round((Number(repoForm.capacityGB) || 0) * KB_PER_GB),
    workflowEvent,
    rollbackEvent: rollbackEvent || deriveRollbackEvent(workflowEvent),
    cdnTagPrefix: repoForm.cdnTagPrefix || 'v'
  }

  const index = repoDraft.value.findIndex(
    (item, i) => resolveDraftId(item, i) === editingRepoId.value
  )
  if (editingRepoId.value && index > -1) {
    repoDraft.value.splice(index, 1, payload)
  } else {
    repoDraft.value.push(payload)
  }

  showRepoDialog.value = false
  ElMessage.success(editingRepoId.value ? '已更新仓库' : '已新增仓库')
  await loadRepoCapacity(true)
}

/**
 * 并发拉取全部仓库的容量（getReposInfo 内部有 5 分钟缓存 + 单仓失败置 null）
 * 拉不到的仓在界面上显示「未知」，不影响其它仓库
 */
async function loadRepoCapacity(force = false) {
  const list = repoEntries.value
    .filter(entry => entry.owner && entry.repo)
    .map(entry => ({ repoId: entry.id, owner: entry.owner, repo: entry.repo }))

  if (!list.length) {
    repoSizeMap.value = {}
    return
  }

  if (force) {
    githubService.clearReposInfoCache()
  }

  capacityLoading.value = true
  try {
    const result = await githubService.getReposInfo(list)
    repoSizeMap.value = { ...repoSizeMap.value, ...result }
  } catch {
    // 忽略：容量仅用于提示与自动选仓
  } finally {
    capacityLoading.value = false
  }
}

/** 保存前的注册表校验，返回第一条错误文案；通过返回空串 */
function validateRepoDraft() {
  const ids = []

  for (const [index, item] of repoDraft.value.entries()) {
    const name = item.label || item.repo || item.id || `第 ${index + 1} 个仓库`

    if (!isValidRepoId(item.id)) {
      return `仓库「${name}」的 ID 不合法（只能包含字母、数字、点、下划线、连字符）`
    }
    if (!configStore.isValidRepoName(item.repo)) {
      return `仓库「${name}」的仓库名格式不正确`
    }
    if (item.owner && !configStore.isValidOwnerName(item.owner)) {
      return `仓库「${name}」的所有者名称格式不正确`
    }

    ids.push(item.id)
  }

  if (new Set(ids).size !== ids.length) {
    return '仓库 ID 不能重复'
  }

  return ''
}

function getCapacityPercent(entry) {
  return resolveRepoCapacityPercent(repoSizeMap.value, entry)
}

function getCapacityStatus(entry) {
  return resolveRepoCapacityStatus(repoSizeMap.value, entry)
}

function isCapacityKnown(entry) {
  return resolveRepoUsedKB(repoSizeMap.value, entry.id) !== undefined
}

// 保存配置
async function handleSave() {
  if (!configStore.isValidOwnerName(formData.owner)) {
    ElMessage.error('仓库所有者名称格式不正确')
    return
  }
  if (!configStore.isValidRepoName(formData.repo)) {
    ElMessage.error('仓库名称格式不正确')
    return
  }

  const repoError = validateRepoDraft()
  if (repoError) {
    ElMessage.error(repoError)
    return
  }

  validating.value = true
  validationResult.value = null

  try {
    configStore.setConfig({
      owner: formData.owner,
      repo: formData.repo,
      branch: formData.branch,
      clientId: formData.clientId,
      oauthWorkerUrl: formData.oauthWorkerUrl,
      // 仓库注册表：新增 / 编辑 / 停用 / 删除都在这里落盘
      repositories: repoEntries.value,
      assignment: assignment.value,
      defaultRepoId: defaultRepoId.value
    })

    const valid = await configStore.validateConfig()
    if (valid) {
      validationResult.value = { success: true, message: '仓库访问正常，配置已保存' }
      ElMessage.success('配置保存成功')
      await authStore.checkPermission(formData.owner, formData.repo)
    } else {
      validationResult.value = {
        success: false,
        message: configStore.validationError || '验证失败'
      }
    }
  } catch (error) {
    validationResult.value = { success: false, message: error.message || '验证失败' }
  } finally {
    validating.value = false
  }
}

// 重置配置
function handleReset() {
  configStore.resetConfig()
  formData.owner = configStore.config.owner
  formData.repo = configStore.config.repo
  formData.branch = configStore.config.branch
  formData.clientId = configStore.config.clientId
  formData.oauthWorkerUrl = configStore.config.oauthWorkerUrl

  repoDraft.value = createRepoDraft()
  assignment.value = configStore.config.assignment === 'manual' ? 'manual' : 'auto'
  defaultRepoId.value = configStore.config.defaultRepoId || 'main'

  validationResult.value = null
  ElMessage.success('已重置为默认配置')
  loadRepoCapacity(true)
}

onMounted(async () => {
  if (viewRef.value) fadeInUp(viewRef.value, { duration: 0.5 })
  if (authStore.isAuthenticated && !authStore.permissionChecked) {
    await authStore.checkPermission(configStore.config.owner, configStore.config.repo)
  }
  // 进入页面即并发拉一次各仓容量
  await loadRepoCapacity()
})
</script>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.settings-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: $spacing-6;

  &__container {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: $spacing-5;
    width: 100%;
    max-width: 900px;
    align-items: stretch;
  }

  &__card {
    display: flex;
    flex-direction: column;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    margin-bottom: $spacing-5;
    padding-bottom: $spacing-4;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__icon {
    font-size: 24px;
  }

  &__title {
    font-size: $font-size-lg;
    font-weight: 600;
    color: $white;
    margin: 0;
  }

  &__form {
    :deep(.el-form-item) {
      margin-bottom: $spacing-4;
    }

    :deep(.el-form-item__label) {
      color: $gray-300;
      font-size: $font-size-sm;
      padding-bottom: $spacing-1;
    }
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-4;

    &-item {
      margin-bottom: 0;
    }
  }

  // 分仓仓库卡片：横跨整行
  &__card--repos {
    grid-column: 1 / -1;
  }

  &__header-actions {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    margin-left: auto;
  }

  &__hint {
    margin: 0 0 $spacing-4;
    font-size: $font-size-xs;
    line-height: 1.6;
    color: $gray-500;
  }

  &__assignment {
    :deep(.el-form-item) {
      margin-bottom: $spacing-3;
    }

    :deep(.el-form-item__label) {
      color: $gray-300;
      font-size: $font-size-sm;
      padding-bottom: $spacing-1;
    }
  }

  &__default-select {
    width: 260px;
  }

  &__repo-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
  }

  &__repo-row {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    padding: $spacing-3;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: $radius-lg;
    transition: opacity $duration-normal;

    &--disabled {
      opacity: 0.55;
    }
  }

  &__repo-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-3;
    flex-wrap: wrap;
  }

  &__repo-title-group {
    display: flex;
    align-items: baseline;
    gap: $spacing-2;
    flex-wrap: wrap;
    min-width: 0;
  }

  &__repo-name {
    font-size: $font-size-sm;
    font-weight: 600;
    color: $white;
  }

  &__repo-mono {
    font-family: monospace;
    font-size: $font-size-xs;
    color: $gray-400;
  }

  &__repo-actions {
    display: flex;
    align-items: center;
    gap: $spacing-1;
  }

  &__repo-meta {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    flex-wrap: wrap;
  }

  &__repo-capacity {
    display: flex;
    align-items: center;
    gap: $spacing-3;
  }

  &__repo-progress {
    flex: 1;
    min-width: 120px;
  }

  &__repo-capacity-text {
    font-size: $font-size-xs;
    color: $gray-400;
    white-space: nowrap;
  }

  &__repo-empty {
    padding: $spacing-6;
    text-align: center;
    font-size: $font-size-sm;
    color: $gray-500;
  }

  &__number {
    width: 100%;
  }

  &__accepts-select {
    width: 100%;
  }

  &__actions {
    display: flex;
    gap: $spacing-3;
    margin-top: $spacing-5;
    padding-top: $spacing-4;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__result {
    margin-top: $spacing-4;
  }

  // 状态卡片
  &__status {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  &__user {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    padding: $spacing-3;
    background: rgba(255, 255, 255, 0.05);
    border-radius: $radius-lg;
    margin-bottom: $spacing-4;

    &-info {
      display: flex;
      flex-direction: column;
    }

    &-name {
      font-size: $font-size-sm;
      font-weight: 600;
      color: $white;
    }

    &-login {
      font-size: $font-size-xs;
      color: $gray-500;
    }
  }

  &__status-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    flex: 1;
  }

  &__status-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $spacing-2 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);

    &:last-child {
      border-bottom: none;
    }
  }

  &__status-label {
    font-size: $font-size-sm;
    color: $gray-400;
  }

  &__permission-tag {
    min-width: 70px;
    text-align: center;
  }

  &__repo-link {
    font-size: $font-size-xs;
    color: $primary-start;
    text-decoration: none;
    font-family: monospace;

    &:hover {
      text-decoration: underline;
    }
  }

  &__quick-actions {
    display: flex;
    gap: $spacing-2;
    margin-top: auto;
    padding-top: $spacing-4;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  &__quick-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $spacing-2;
    padding: $spacing-2;
    background: rgba(255, 255, 255, 0.05);
    border-radius: $radius-md;
    color: $gray-300;
    font-size: $font-size-xs;
    text-decoration: none;
    transition: all $duration-normal;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
      color: $white;
    }
  }
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 响应式
@media (max-width: 768px) {
  .settings-view {
    &__container {
      grid-template-columns: 1fr;
    }
  }
}
</style>
