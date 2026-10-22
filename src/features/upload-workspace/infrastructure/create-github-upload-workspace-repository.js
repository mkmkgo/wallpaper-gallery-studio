import {
  allocateRepo,
  collectRegistrySeries,
  createRegistryFromLegacyConfig
} from '../domain/repo-registry'
import { normalizeUploadWorkspaceManifest } from '../domain/upload-workspace-manifest'

// 注册表里聚合不出 series 时的兜底值（与旧版保持一致）
const LEGACY_DEFAULT_SERIES = ['desktop', 'mobile', 'avatar']

/**
 * 兼容旧签名：getContext(series: string)
 * 新签名：getContext({ series, repoId })
 * @param {string | { series?: string, repoId?: string } | undefined} input
 * @returns {{ series: string, repoId: string }}
 */
function toContextInput(input) {
  if (typeof input === 'string') {
    return { series: input, repoId: '' }
  }
  if (input && typeof input === 'object') {
    return { series: input.series || '', repoId: input.repoId || '' }
  }
  return { series: '', repoId: '' }
}

export function createGitHubUploadWorkspaceRepository({
  githubClient,
  getRepositoryConfig,
  getAppConfig
}) {
  function resolveFallback() {
    const repositoryConfig = getRepositoryConfig() || {}
    const appConfig = getAppConfig() || {}
    const repository = appConfig.repository || {}
    const upload = appConfig.upload || {}

    return {
      repositoryConfig,
      repository,
      upload,
      fallback: {
        owner: repositoryConfig.owner || repository.owner || '',
        repo: repositoryConfig.repo || repository.repo || '',
        branch: repositoryConfig.branch || repository.branch || 'main',
        defaultRepoId: repositoryConfig.defaultRepoId || repository.defaultRepoId || 'main'
      }
    }
  }

  function getRegistry(repositoryConfig, repository, fallback) {
    const repositories =
      Array.isArray(repositoryConfig.repositories) && repositoryConfig.repositories.length
        ? repositoryConfig.repositories
        : repository.repositories

    return createRegistryFromLegacyConfig({
      ...fallback,
      repositories,
      // 只认用户显式配置的旧 seriesRepos；默认配置派生的 seriesRepos 不参与迁移，
      // 否则会反向覆盖掉用户已配置的注册表条目
      seriesRepos: repositoryConfig.seriesRepos
    })
  }

  function getContext(input) {
    const { series, repoId } = toContextInput(input)
    const { repositoryConfig, repository, upload, fallback } = resolveFallback()
    const registry = getRegistry(repositoryConfig, repository, fallback)
    const context = allocateRepo(registry, series, {
      repoId,
      defaultRepoId: fallback.defaultRepoId
    })

    return {
      repoId: context?.repoId || '',
      owner: context?.owner || fallback.owner,
      repo: context?.repo || fallback.repo,
      // branch 跟随分仓条目（registry 条目自带 branch），不再是恒等于主仓 branch
      branch: context?.branch || fallback.branch,
      workflowEvent: context?.workflowEvent || '',
      label: context?.label || '',
      wallpaperRoot: repository.wallpaperRoot,
      metadataPendingDir: upload.metadataPendingDir
    }
  }

  function getDefaultSeries() {
    const { repositoryConfig, repository, fallback } = resolveFallback()
    return (
      collectRegistrySeries(getRegistry(repositoryConfig, repository, fallback)) || [
        ...LEGACY_DEFAULT_SERIES
      ]
    )
  }

  async function getDirectoryContents(path, options = {}) {
    const { owner, repo, branch } = getContext({ series: options.series, repoId: options.repoId })
    return githubClient.getContents(owner, repo, path, branch, options)
  }

  return {
    githubClient,
    getContext,
    getRateLimit() {
      return githubClient.getRateLimit()
    },
    clearDirectoryCache() {
      githubClient.clearDirectoryCache?.()
    },
    getDirectoryContents,
    async getSeriesDirectories(series, options = {}) {
      const { wallpaperRoot } = getContext({ series, repoId: options.repoId })
      return getDirectoryContents(`${wallpaperRoot}/${series}`, { ...options, series })
    },
    async getCategoryManifest(options = {}) {
      const { owner, repo, branch } = getContext({ series: options.series, repoId: options.repoId })
      const manifestPath = getAppConfig().repository.manifestPath

      if (!manifestPath) {
        return null
      }

      try {
        const file = await githubClient.getContents(owner, repo, manifestPath, branch, options)
        const raw = typeof file.content === 'string' ? file.content.replace(/\n/g, '') : ''
        return normalizeUploadWorkspaceManifest(JSON.parse(atob(raw)))
      } catch (error) {
        if (error.status === 404 || error.type === 'NOT_FOUND') {
          return null
        }
        if (error.type === 'MANIFEST_INVALID') {
          throw error
        }
        throw error
      }
    },
    async checkFileExists(path, options = {}) {
      const { owner, repo, branch } = getContext({ series: options.series, repoId: options.repoId })
      return githubClient.checkFileExists(owner, repo, path, branch)
    },
    async uploadImage(path, file, message, series) {
      const { owner, repo, branch } = getContext(series)
      return githubClient.uploadImage(owner, repo, path, file, message, branch)
    },
    async createFile(path, content, message, series) {
      const { owner, repo, branch } = getContext(series)
      return githubClient.createFile(owner, repo, path, content, message, branch)
    },
    async deleteFile(path, sha, message, series) {
      const { owner, repo, branch } = getContext(series)
      return githubClient.deleteFile(owner, repo, path, sha, message, branch)
    },
    async createCategoryPlaceholder({ series, parentCategory = '', name, level = 'l1' }) {
      const { wallpaperRoot } = getContext()
      let categoryPath = `${wallpaperRoot}/${series}`

      if (level === 'l2' && parentCategory) {
        categoryPath += `/${parentCategory}`
      }

      categoryPath += `/${name}`

      await this.createFile(`${categoryPath}/.gitkeep`, '', `Create category: ${name}`, series)
      return categoryPath
    },
    async waitForDirectorySync(path, { shouldExist, attempts = 8, delay = 700 } = {}) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          await getDirectoryContents(path, { forceRefresh: true })
          if (shouldExist) {
            return true
          }
        } catch (error) {
          if (!shouldExist && (error.status === 404 || error.type === 'NOT_FOUND')) {
            return true
          }
        }

        if (attempt < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      return false
    },
    async getCategoryCounts(seriesKeys) {
      const keys = seriesKeys?.length ? seriesKeys : getDefaultSeries()
      const counts = {}

      for (const series of keys) {
        try {
          const { wallpaperRoot } = getContext(series)
          const contents = await getDirectoryContents(`${wallpaperRoot}/${series}`, { series })
          counts[series] = contents.filter(item => item.type === 'dir').length
        } catch {
          counts[series] = 0
        }
      }

      counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0)
      return counts
    }
  }
}
