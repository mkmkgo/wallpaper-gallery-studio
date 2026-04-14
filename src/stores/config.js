import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { githubService } from '@/services/github'

const STORAGE_KEY = 'wallpaper_admin_config'

// 默认配置
// owner / repo / branch 支持通过环境变量预填充，便于部署时免去手动配置
// 开源用户需在 .env.local 中填写自己的仓库信息
const DEFAULT_CONFIG = {
  owner: import.meta.env.VITE_GITHUB_REPO_OWNER || '',
  repo: import.meta.env.VITE_GITHUB_REPO_NAME || '',
  branch: import.meta.env.VITE_GITHUB_REPO_BRANCH || 'main',
  clientId: import.meta.env.VITE_GITHUB_CLIENT_ID || ''
}

export const useConfigStore = defineStore('config', () => {
  // 从 localStorage 加载配置
  // 策略：localStorage 中的值优先（用户手动改过），但如果某项为空则回退到环境变量默认值
  const loadConfig = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return { ...DEFAULT_CONFIG }
      const parsed = JSON.parse(stored)
      // 逐字段合并：localStorage 有值则用，为空时用环境变量默认值
      return {
        owner: parsed.owner || DEFAULT_CONFIG.owner,
        repo: parsed.repo || DEFAULT_CONFIG.repo,
        branch: parsed.branch || DEFAULT_CONFIG.branch,
        clientId: parsed.clientId || DEFAULT_CONFIG.clientId
      }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  // 状态
  const config = ref(loadConfig())
  const validating = ref(false)
  const validationError = ref(null)

  // 计算属性
  const isConfigured = computed(() => {
    return !!(config.value.owner && config.value.repo && config.value.branch)
  })

  const repoFullName = computed(() => {
    return `${config.value.owner}/${config.value.repo}`
  })

  // 保存配置到 localStorage
  function saveConfig() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value))
  }

  // 设置配置
  function setConfig(newConfig) {
    config.value = { ...config.value, ...newConfig }
    saveConfig()
  }

  // 重置为默认配置
  function resetConfig() {
    config.value = { ...DEFAULT_CONFIG }
    saveConfig()
  }

  // 验证配置（检查仓库是否存在和权限）
  async function validateConfig() {
    if (!isConfigured.value) {
      validationError.value = '请填写完整的仓库配置'
      return false
    }

    validating.value = true
    validationError.value = null

    try {
      // 检查仓库是否存在
      await githubService.getContents(
        config.value.owner,
        config.value.repo,
        '',
        config.value.branch
      )
      return true
    } catch (error) {
      if (error.status === 404) {
        validationError.value = '仓库不存在或无访问权限'
      } else if (error.type === 'TOKEN_EXPIRED') {
        validationError.value = '登录已过期，请重新登录'
      } else {
        validationError.value = error.message || '验证失败'
      }
      return false
    } finally {
      validating.value = false
    }
  }

  // 验证仓库名格式
  function isValidRepoName(name) {
    if (!name || typeof name !== 'string') return false
    // GitHub 仓库名规则：字母、数字、连字符、下划线、点
    return /^[a-zA-Z0-9._-]+$/.test(name)
  }

  // 验证用户名格式
  function isValidOwnerName(name) {
    if (!name || typeof name !== 'string') return false
    // GitHub 用户名规则：字母、数字、连字符
    return /^[a-zA-Z0-9-]+$/.test(name)
  }

  return {
    // 状态
    config,
    validating,
    validationError,
    // 计算属性
    isConfigured,
    repoFullName,
    // 方法
    setConfig,
    resetConfig,
    validateConfig,
    isValidRepoName,
    isValidOwnerName
  }
})
