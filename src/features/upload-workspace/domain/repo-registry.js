/**
 * 仓库注册表（2026-10-23 图床分仓 v2）
 *
 * 取代旧的 `seriesRepos`（series → 单个仓库 的一对一硬编码），改为「仓库注册表」驱动：
 * - 一个 series 可以落在 N 个仓库（如 desktop 分布到 desktop / desktop-2）
 * - workflow 事件、branch、容量阈值全部写在配置里，不再靠 series 名硬编码
 * - 停用仓库不需要删除配置（enabled: false）
 *
 * 纯函数，无副作用，可单测。
 */

/** 仓库 ID 规则：字母、数字、点、下划线、连字符 */
export const REPO_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

/** 未显式配置 workflowEvent 时使用的默认事件 */
export const DEFAULT_WORKFLOW_EVENT = 'process-wallpapers'

/** 未显式配置 rollbackEvent 时使用的默认事件 */
export const DEFAULT_ROLLBACK_EVENT = 'rollback-release'

/** 兜底主仓的优先级（足够大，保证任何显式条目都排在它前面） */
export const FALLBACK_PRIORITY = 1000

/** 通配 series：接受所有系列 */
export const WILDCARD_SERIES = '*'

/**
 * 校验仓库 ID 合法性
 * @param {unknown} id
 * @returns {boolean}
 */
export function isValidRepoId(id) {
  if (!id || typeof id !== 'string') return false
  return REPO_ID_PATTERN.test(id)
}

/**
 * 默认仓库注册表（从环境变量生成，环境变量缺失时用内置默认值）
 * 这是「env → 注册表」的唯一读取点，app-config / config store 都基于它派生。
 */
export const DEFAULT_REPOSITORY_REGISTRY = [
  {
    id: 'main',
    label: '主仓',
    owner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
    repo: import.meta.env.VITE_GITHUB_REPO_NAME || '',
    branch: import.meta.env.VITE_GITHUB_REPO_BRANCH || 'main',
    enabled: true,
    accepts: ['mobile', 'avatar'],
    priority: 0,
    capacityKB: 0,
    workflowEvent: 'process-wallpapers',
    rollbackEvent: 'rollback-release',
    cdnTagPrefix: 'v'
  },
  {
    id: 'desktop',
    label: '桌面壁纸仓',
    owner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
    repo: import.meta.env.VITE_GITHUB_REPO_NAME_DESKTOP || 'nuanXinProPic-desktop',
    branch: import.meta.env.VITE_GITHUB_REPO_BRANCH || 'main',
    enabled: true,
    accepts: ['desktop'],
    priority: 0,
    capacityKB: 0,
    workflowEvent: 'process-wallpapers-desktop',
    rollbackEvent: 'rollback-release-desktop',
    cdnTagPrefix: 'v'
  }
]

function normalizeAccepts(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
  return raw.filter(item => typeof item === 'string' && item.length > 0)
}

function toNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback
}

/**
 * 由 workflow 事件名推导回滚事件名
 * 规则：把 `process-wallpapers` 前缀换成 `rollback-release`，其余后缀原样保留
 *   process-wallpapers        → rollback-release
 *   process-wallpapers-desktop → rollback-release-desktop
 * 无法识别的事件名（不是 process-wallpapers 前缀）一律回落默认回滚事件
 *
 * @param {string} workflowEvent
 * @returns {string}
 */
export function deriveRollbackEvent(workflowEvent = '') {
  const event = String(workflowEvent ?? '').trim()
  const match = /^process-wallpapers(.*)$/.exec(event)

  if (!match) return DEFAULT_ROLLBACK_EVENT
  return `${DEFAULT_ROLLBACK_EVENT}${match[1]}`
}

/**
 * 归一化注册表：补齐缺省字段，并对每个条目套用主仓回落值
 * @param {Array<object>|null} registry - 原始注册表
 * @param {{ owner?: string, branch?: string }} defaults - 主仓回落值（owner / branch 留空时沿用）
 * @returns {Array<object>} 归一化后的条目数组（不修改入参）
 */
export function normalizeRegistry(registry, defaults = {}) {
  const list = Array.isArray(registry) ? registry : []

  return list
    .filter(entry => entry && typeof entry === 'object')
    .map((entry, index) => {
      const repo = String(entry.repo ?? '')
      const id = String(entry.id ?? repo ?? `repo-${index}`)
      const workflowEvent = String(entry.workflowEvent ?? '') || DEFAULT_WORKFLOW_EVENT

      return {
        id,
        label: String(entry.label ?? '') || repo || id,
        owner: String(entry.owner ?? '') || String(defaults.owner ?? ''),
        repo,
        branch: String(entry.branch ?? '') || String(defaults.branch ?? '') || 'main',
        enabled: entry.enabled !== false,
        accepts: normalizeAccepts(entry.accepts),
        priority: toNumber(entry.priority, 0),
        // capacityKB <= 0 表示不限容量（不参与容量判断）
        capacityKB: toNumber(entry.capacityKB, 0),
        workflowEvent,
        // 未配置时按 workflowEvent 推导（process-wallpapers-x → rollback-release-x）
        rollbackEvent: String(entry.rollbackEvent ?? '') || deriveRollbackEvent(workflowEvent),
        cdnTagPrefix: String(entry.cdnTagPrefix ?? '') || 'v'
      }
    })
}

function acceptsSeries(entry, series) {
  return entry.accepts.includes(series) || entry.accepts.includes(WILDCARD_SERIES)
}

/**
 * 列出某 series 的候选仓库
 * 规则：enabled=true 且 accepts 含该 series（或通配 '*'）；按 priority 升序、同优先级保持配置顺序
 * series 为空时返回全部启用条目（不做 accepts 过滤）
 * @param {Array<object>} registry
 * @param {string} series
 * @returns {Array<object>} 归一化后的候选条目
 */
export function listCandidates(registry, series = '') {
  const key = String(series ?? '').trim()

  return normalizeRegistry(registry)
    .filter(entry => entry.enabled)
    .filter(entry => !key || acceptsSeries(entry, key))
    .sort((a, b) => a.priority - b.priority)
}

/**
 * 是否为某个仓库条目构造上下文（统一返回形状）
 * @param {object} entry - 归一化条目
 * @returns {{ repoId: string, owner: string, repo: string, branch: string, workflowEvent: string, label: string }}
 */
function toRepoContext(entry) {
  return {
    repoId: entry.id,
    owner: entry.owner,
    repo: entry.repo,
    branch: entry.branch,
    workflowEvent: entry.workflowEvent,
    label: entry.label
  }
}

/**
 * 按 repoId 取仓库上下文
 * @param {Array<object>} registry
 * @param {string} repoId
 * @returns {{ repoId, owner, repo, branch, workflowEvent, label } | null} 未知 ID 或已停用时返回 null
 */
export function resolveRepoContext(registry, repoId) {
  if (!isValidRepoId(repoId)) return null

  const entry = normalizeRegistry(registry).find(item => item.id === repoId)
  if (!entry || !entry.enabled) return null

  return toRepoContext(entry)
}

/**
 * 取仓库对应的 workflow repository_dispatch 事件名（写在配置里，不再按 series 硬编码）
 * @param {Array<object>} registry
 * @param {string} repoId
 * @returns {string} 未知仓库返回空字符串
 */
export function resolveRepoWorkflowEvent(registry, repoId) {
  return resolveRepoContext(registry, repoId)?.workflowEvent || ''
}

/**
 * 取仓库对应的回滚 workflow 事件名
 * 与 `resolveRepoContext` 不同：这里不做 enabled 过滤——
 * 停用仓库里已有的历史版本仍需要能回滚。
 *
 * @param {Array<object>} registry
 * @param {string} repoId
 * @returns {string} 未知仓库返回空字符串
 */
export function resolveRepoRollbackEvent(registry, repoId) {
  const entry = normalizeRegistry(registry).find(item => item.id === repoId)
  if (!entry) return ''

  return entry.rollbackEvent || deriveRollbackEvent(entry.workflowEvent)
}

/**
 * 容量判断
 * @param {object} entry - 归一化条目
 * @param {Record<string, number>} sizeMap - { [repoId]: sizeKB }
 * @returns {boolean} true = 已达/超过容量上限
 */
function isOverCapacity(entry, sizeMap = {}) {
  // capacityKB <= 0 视为不限容量
  if (!entry.capacityKB || entry.capacityKB <= 0) return false

  const sizeKB = sizeMap?.[entry.id]
  // 缺失该仓库的体积数据时视为未超容量（避免网络抖动导致全部仓库不可用）
  if (!Number.isFinite(sizeKB)) return false

  return sizeKB >= entry.capacityKB
}

function resolveDefaultRepo(entries, defaultRepoId) {
  const enabled = entries.filter(entry => entry.enabled)
  const byId = enabled.find(entry => entry.id === defaultRepoId)
  if (byId) return toRepoContext(byId)

  const first = [...enabled].sort((a, b) => a.priority - b.priority)[0]
  return first ? toRepoContext(first) : null
}

/**
 * 为某个 series 分配目标仓库
 *
 * 分配顺序：
 *   ① 手动覆盖：传了 repoId 且该仓库存在并启用 → 直接返回（不看 series / 不看容量）
 *   ② series 为空 → 返回默认仓库（defaultRepoId，缺省 'main'）
 *   ③ 无候选 → 返回 null
 *   ④ 候选按 priority 升序取第一个「未超容量」的
 *   ⑤ 全部超容量 → 降级返回 priority 最小的候选（**不返回 null**，避免上传链路崩溃）
 *
 * @param {Array<object>} registry
 * @param {string} series
 * @param {{ repoId?: string, sizeMap?: Record<string, number>, defaultRepoId?: string }} options
 * @returns {{ repoId, owner, repo, branch, workflowEvent, label } | null}
 */
export function allocateRepo(registry, series = '', options = {}) {
  const { repoId, sizeMap = {}, defaultRepoId = 'main' } = options
  const entries = normalizeRegistry(registry)

  // ① 手动覆盖优先
  if (repoId) {
    const manual = resolveRepoContext(entries, repoId)
    if (manual) return manual
  }

  const key = String(series ?? '').trim()

  // ② 未指定 series → 默认仓库
  if (!key) {
    return resolveDefaultRepo(entries, defaultRepoId)
  }

  const candidates = listCandidates(entries, key)
  if (!candidates.length) return null

  // ④ priority 升序 + 未超容量
  const available = candidates.find(entry => !isOverCapacity(entry, sizeMap))
  if (available) return toRepoContext(available)

  // ⑤ 全部超容量 → 降级到 priority 最小的候选
  return toRepoContext(candidates[0])
}

/**
 * 旧 seriesRepos 迁移：从默认注册表里找出接受该 series 的条目，沿用其 workflowEvent
 * 避免迁移时再次写死 `series === 'desktop'` 这类判断
 * @param {string} series
 * @returns {string}
 */
function resolveLegacyWorkflowEvent(series) {
  const hit = DEFAULT_REPOSITORY_REGISTRY.find(
    entry => entry.accepts?.includes(series) && entry.workflowEvent
  )
  return hit?.workflowEvent || DEFAULT_WORKFLOW_EVENT
}

/**
 * 由「旧格式配置」构造注册表，供迁移期与向后兼容路径使用
 *
 * 支持的输入字段：
 * - `repositories`：新版注册表数组
 * - `seriesRepos`：旧版 `{ [series]: { owner, repo, branch } }`，转换成注册表条目并覆盖同 series 的新版条目
 * - `owner` / `repo` / `branch`：主仓权威值，覆盖注册表里 main 条目的同名字段；main 缺失时补一条通配兜底
 *
 * @param {{ owner?: string, repo?: string, branch?: string, repositories?: Array<object>, seriesRepos?: object }} config
 * @returns {Array<object>} 归一化后的注册表
 */
export function createRegistryFromLegacyConfig(config = {}) {
  const safeConfig = config || {}
  const fallback = {
    owner: String(safeConfig.owner ?? ''),
    repo: String(safeConfig.repo ?? ''),
    branch: String(safeConfig.branch ?? '') || 'main'
  }

  const registry = [...normalizeRegistry(safeConfig.repositories, fallback)]

  // 顶层 owner / repo / branch 是主仓的权威值：即使注册表里已有 main 条目也要以它为准，
  // 否则环境变量为空时主仓会被注册表里的空 repo 顶掉（旧版 seriesRepos 的回落语义）
  const mainIndex = registry.findIndex(entry => entry.id === 'main')
  if (mainIndex === -1) {
    registry.push({
      id: 'main',
      label: '主仓',
      owner: fallback.owner,
      repo: fallback.repo,
      branch: fallback.branch,
      enabled: true,
      accepts: [WILDCARD_SERIES],
      priority: FALLBACK_PRIORITY,
      capacityKB: 0,
      workflowEvent: DEFAULT_WORKFLOW_EVENT,
      rollbackEvent: DEFAULT_ROLLBACK_EVENT,
      cdnTagPrefix: 'v'
    })
  } else {
    registry[mainIndex] = {
      ...registry[mainIndex],
      owner: fallback.owner || registry[mainIndex].owner,
      repo: fallback.repo || registry[mainIndex].repo,
      branch: fallback.branch || registry[mainIndex].branch
    }
  }

  const legacy = safeConfig.seriesRepos
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    for (const [series, override] of Object.entries(legacy)) {
      if (!series || !override || typeof override !== 'object') continue

      const repo = String(override.repo ?? '')
      // repo 为空视为未配置，保持与主仓一致的回落语义
      if (!repo) continue

      const legacyWorkflowEvent =
        String(override.workflowEvent ?? '') || resolveLegacyWorkflowEvent(series)

      registry.push({
        // 旧版条目优先级高于同名新版条目（priority 更小）
        id: `legacy-${series}`,
        label: String(override.label ?? '') || `legacy-${series}`,
        owner: String(override.owner ?? '') || fallback.owner,
        repo,
        branch: String(override.branch ?? '') || fallback.branch,
        enabled: override.enabled !== false,
        accepts: [series],
        priority: Number.isFinite(override.priority) ? override.priority : -1,
        capacityKB: Number.isFinite(override.capacityKB) ? override.capacityKB : 0,
        workflowEvent: legacyWorkflowEvent,
        rollbackEvent:
          String(override.rollbackEvent ?? '') || deriveRollbackEvent(legacyWorkflowEvent),
        cdnTagPrefix: String(override.cdnTagPrefix ?? '') || 'v'
      })
    }
  }

  return registry
}

/**
 * 从注册表聚合出全部 series（供目录统计等需要枚举 series 的场景）
 * 排除通配 '*'；聚合结果为空时返回 null，由调用方决定是否走内置兜底
 * @param {Array<object>} registry
 * @returns {string[] | null}
 */
export function collectRegistrySeries(registry) {
  const series = []

  for (const entry of normalizeRegistry(registry)) {
    for (const item of entry.accepts) {
      if (item === WILDCARD_SERIES) continue
      if (!series.includes(item)) series.push(item)
    }
  }

  return series.length ? series : null
}
