import { CATEGORIES } from '@/config/categories'
import { SUBCATEGORIES } from '@/config/subcategories'
import { githubService } from '@/services/github'
import { useConfigStore } from '@/stores/config'

const SERIES_KEYS = ['desktop', 'mobile', 'avatar']
const CACHE_TTL = 5 * 60 * 1000

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
    const secondary = (CATEGORIES[seriesKey]?.subcategories || []).map(item => item.value)
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

async function fetchUploadCategoryTree(force = false) {
  const configStore = useConfigStore()
  const { owner, repo, branch } = configStore.config || {}

  if (!owner || !repo || !branch) {
    return getFallbackUploadCategoryTree()
  }

  const fallback = getFallbackUploadCategoryTree()
  const result = cloneCategoryTree(fallback)

  for (const seriesKey of SERIES_KEYS) {
    try {
      const rootContents = await githubService.getContents(
        owner,
        repo,
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
            owner,
            repo,
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
    return pendingRequest.then(cloneCategoryTree)
  }

  pendingRequest = fetchUploadCategoryTree(force)

  try {
    const categoryTree = await pendingRequest
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
