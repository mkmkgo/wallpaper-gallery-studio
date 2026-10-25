import { CATEGORIES } from '@/config/categories'
import { SUBCATEGORIES } from '@/config/subcategories'
import { githubService } from '@/services/github'
import { resolveAppConfig, resolveSeriesRepoForConfig } from '@/app/config/app-config'
import { createGitHubUploadWorkspaceRepository } from '@/features/upload-workspace/infrastructure/create-github-upload-workspace-repository'
import { createCategoryTreeFromManifest } from '@/features/upload-workspace/domain/upload-workspace-manifest'
import { useConfigStore } from '@/stores/config'

const SERIES_KEYS = ['desktop', 'mobile', 'avatar']
const CACHE_TTL = 5 * 60 * 1000

// [LOCAL] 合规过滤（2026-10-25）：政治类内容不适合壁纸产品，与小程序
// miniprogram-wallpaper/config/index.js 的 BLOCKED_CATEGORIES 保持同款。
// 动态分类树有三条来源（manifest / GitHub 目录扫描 / 本地回退），
// 任一条漏掉都会让 AI prompt 重新带上政治分类，故在出口统一收口。
const BLOCKED_CATEGORIES = ['政治']

let categoryDirectoryCache = null
let categoryDirectoryTimestamp = 0
let pendingRequest = null

function sortCategoryNames(items = []) {
  return [...items].sort((first, second) =>
    first.localeCompare(second, 'zh-Hans-CN', {
      numeric: true,
      sensitivity: 'base'
    })
  )
}

export function getFallbackUploadCategoryTree() {
  const result = {}

  SERIES_KEYS.forEach(seriesKey => {
    const secondary = (CATEGORIES[seriesKey]?.subcategories || [])
      .map(item => item.value)
      .filter(value => !BLOCKED_CATEGORIES.includes(value))
    const third = {}

    secondary.forEach(category => {
      const thirdCategories = SUBCATEGORIES[seriesKey]?.[category] || []
      if (thirdCategories.length > 0) {
        third[category] = [...thirdCategories]
      }
    })

    result[seriesKey] = {
      secondary,
      third
    }
  })

  return result
}

function cloneCategoryTree(tree) {
  return JSON.parse(JSON.stringify(tree))
}

/**
 * 合规收口：剔除动态分类树中的黑名单分类。
 * 树结构为 { [seriesKey]: { secondary: string[], third: { [secondary]: string[] } } }，
 * 同时清理 secondary 数组与 third 中对应的键。
 */
export function applyCategoryBlocklist(tree) {
  if (!tree || typeof tree !== 'object') {
    return tree
  }

  const filtered = {}

  for (const [seriesKey, seriesTree] of Object.entries(tree)) {
    if (!seriesTree || typeof seriesTree !== 'object') {
      filtered[seriesKey] = seriesTree
      continue
    }

    const secondary = Array.isArray(seriesTree.secondary)
      ? seriesTree.secondary.filter(name => !BLOCKED_CATEGORIES.includes(name))
      : seriesTree.secondary

    const third = {}
    if (seriesTree.third && typeof seriesTree.third === 'object') {
      for (const [category, items] of Object.entries(seriesTree.third)) {
        if (!BLOCKED_CATEGORIES.includes(category)) {
          third[category] = items
        }
      }
    }

    filtered[seriesKey] = { ...seriesTree, secondary, third }
  }

  return filtered
}

async function fetchUploadCategoryTree(force = false) {
  const configStore = useConfigStore()
  const { owner, repo, branch } = configStore.config || {}

  if (!owner || !repo || !branch) {
    return getFallbackUploadCategoryTree()
  }

  const repository = createGitHubUploadWorkspaceRepository({
    githubClient: githubService,
    getRepositoryConfig: () => configStore.config,
    getAppConfig: () =>
      resolveAppConfig({
        repository: configStore.config
      })
  })

  try {
    const manifest = await repository.getCategoryManifest({ forceRefresh: force })
    if (manifest) {
      return createCategoryTreeFromManifest(manifest)
    }
  } catch (error) {
    console.error('[CategoryDirectory] Failed to load manifest:', error)
  }

  const fallback = getFallbackUploadCategoryTree()
  const result = cloneCategoryTree(fallback)

  for (const seriesKey of SERIES_KEYS) {
    try {
      // 分仓路由：desktop 的 wallpaper/desktop 目录从独立仓读取，mobile/avatar 仍走主仓
      const { owner: seriesOwner, repo: seriesRepo } = resolveSeriesRepoForConfig(
        configStore.config,
        seriesKey
      )
      const rootContents = await githubService.getContents(
        seriesOwner,
        seriesRepo,
        `wallpaper/${seriesKey}`,
        branch,
        { forceRefresh: force }
      )
      const secondary = sortCategoryNames(
        rootContents.filter(item => item.type === 'dir').map(item => item.name)
      )

      result[seriesKey].secondary = secondary
      result[seriesKey].third = {}

      for (const secondaryCategory of secondary) {
        try {
          const thirdContents = await githubService.getContents(
            seriesOwner,
            seriesRepo,
            `wallpaper/${seriesKey}/${secondaryCategory}`,
            branch,
            { forceRefresh: force }
          )

          const third = sortCategoryNames(
            thirdContents.filter(item => item.type === 'dir').map(item => item.name)
          )

          if (third.length > 0) {
            result[seriesKey].third[secondaryCategory] = third
          }
        } catch {
          // 部分二级目录没有三级分类时，保持为空即可
        }
      }
    } catch (error) {
      console.error(`[CategoryDirectory] Failed to fetch ${seriesKey}:`, error)
    }
  }

  return result
}

export async function getUploadCategoryTree({ force = false } = {}) {
  const isCacheValid = categoryDirectoryCache && Date.now() - categoryDirectoryTimestamp < CACHE_TTL

  if (!force && isCacheValid) {
    return cloneCategoryTree(categoryDirectoryCache)
  }

  if (!force && pendingRequest) {
    return pendingRequest.then(tree => cloneCategoryTree(applyCategoryBlocklist(tree)))
  }

  pendingRequest = fetchUploadCategoryTree(force)

  try {
    const categoryTree = applyCategoryBlocklist(await pendingRequest)
    categoryDirectoryCache = cloneCategoryTree(categoryTree)
    categoryDirectoryTimestamp = Date.now()
    return cloneCategoryTree(categoryTree)
  } finally {
    pendingRequest = null
  }
}

export function clearUploadCategoryTreeCache() {
  categoryDirectoryCache = null
  categoryDirectoryTimestamp = 0
  pendingRequest = null
}
