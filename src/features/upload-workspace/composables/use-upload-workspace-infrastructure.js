import { localStorageService } from '@/services/localStorage'
import { githubService } from '@/services/github'
import { useConfigStore } from '@/stores/config'
import { resolveAppConfig } from '@/app/config/app-config'
import { createUploadWorkspaceService } from '../application/create-upload-workspace-service'
import { createGitHubUploadWorkspaceRepository } from '../infrastructure/create-github-upload-workspace-repository'

const CACHE_TTL = 5 * 60 * 1000

export function useUploadWorkspaceInfrastructure() {
  const configStore = useConfigStore()
  const categoryCache = new Map()

  function getAppConfig() {
    return resolveAppConfig({
      repository: configStore.config
    })
  }

  const repository = createGitHubUploadWorkspaceRepository({
    githubClient: githubService,
    getRepositoryConfig: () => configStore.config,
    getAppConfig
  })

  const service = createUploadWorkspaceService({ repository })

  function getCache(key) {
    const cached = categoryCache.get(key)
    return cached && Date.now() - cached.timestamp < CACHE_TTL ? cached.data : null
  }

  function setCache(key, data) {
    categoryCache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  function clearCategoryCaches() {
    categoryCache.clear()
    repository.clearDirectoryCache()
  }

  async function loadRootCategories(series, forceRefresh = false) {
    const cacheKey = `${series}-root`
    const cached = forceRefresh ? null : getCache(cacheKey)
    if (cached) {
      return cached
    }

    const categories = await service.loadRootCategories({ series, forceRefresh })
    setCache(cacheKey, categories)
    return categories
  }

  async function loadChildCategories(path, forceRefresh = false) {
    const cached = forceRefresh ? null : getCache(path)
    if (cached) {
      return cached
    }

    const series = path.split('/').filter(Boolean)[1] || 'desktop'
    const children = await service.loadChildCategories({ series, path, forceRefresh })
    setCache(path, children)
    return children
  }

  async function refreshStats() {
    return service.loadStats()
  }

  async function createCategory({ series, selectedL1, form }) {
    return service.createCategory({
      series,
      parentCategory: form.level === 'l2' ? selectedL1 : '',
      name: form.name,
      level: form.level
    })
  }

  async function inspectCategory(path) {
    return service.inspectCategory(path)
  }

  async function deleteCategory(path) {
    return service.deleteCategory(path)
  }

  function persistSuccessfulUploads(results, files, fallbackSeries) {
    if (!localStorageService.isInitialized()) {
      return
    }

    const successFiles = results
      .filter(result => result.success)
      .map(result => {
        const file = files.find(item => item.id === result.id)
        return {
          fileName: file?.name || result.id,
          series: file?.targetSeries || fallbackSeries,
          category: file?.targetPath || '',
          size: file?.size || 0
        }
      })

    if (successFiles.length > 0) {
      localStorageService.addUploadRecords(successFiles)
    }
  }

  async function refreshWorkflowPending(workflowStore) {
    const { owner, repo, branch } = configStore.config
    await workflowStore.refreshPendingInfo(owner, repo, branch)

    if (workflowStore.pendingInfo.pendingCount === 0) {
      setTimeout(() => {
        workflowStore.refreshPendingInfo(owner, repo, branch)
      }, 2000)
    }
  }

  return {
    repository,
    clearCategoryCaches,
    loadRootCategories,
    loadChildCategories,
    refreshStats,
    createCategory,
    inspectCategory,
    deleteCategory,
    persistSuccessfulUploads,
    refreshWorkflowPending
  }
}
