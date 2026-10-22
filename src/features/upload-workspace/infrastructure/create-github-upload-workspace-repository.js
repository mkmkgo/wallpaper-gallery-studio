import { resolveSeriesRepo } from '../domain/series-repo'
import { normalizeUploadWorkspaceManifest } from '../domain/upload-workspace-manifest'

const DEFAULT_SERIES = ['desktop', 'mobile', 'avatar']

export function createGitHubUploadWorkspaceRepository({
  githubClient,
  getRepositoryConfig,
  getAppConfig
}) {
  function getContext(series) {
    const repositoryConfig = getRepositoryConfig()
    const appConfig = getAppConfig()
    const { owner, repo } = resolveSeriesRepo(
      {
        owner: repositoryConfig.owner || appConfig.repository.owner,
        repo: repositoryConfig.repo || appConfig.repository.repo,
        seriesRepos: appConfig.repository.seriesRepos
      },
      series
    )

    return {
      owner,
      repo,
      branch: repositoryConfig.branch || appConfig.repository.branch,
      wallpaperRoot: appConfig.repository.wallpaperRoot,
      metadataPendingDir: appConfig.upload.metadataPendingDir
    }
  }

  async function getDirectoryContents(path, options = {}) {
    const { owner, repo, branch } = getContext(options.series)
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
      const { wallpaperRoot } = getContext(series)
      return getDirectoryContents(`${wallpaperRoot}/${series}`, { ...options, series })
    },
    async getCategoryManifest(options = {}) {
      const { owner, repo, branch } = getContext(options.series)
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
      const { owner, repo, branch } = getContext(options.series)
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
    async getCategoryCounts(seriesKeys = DEFAULT_SERIES) {
      const counts = {}

      for (const series of seriesKeys) {
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
