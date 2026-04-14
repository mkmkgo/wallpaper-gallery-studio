const SERIES_KEYS = ['desktop', 'mobile', 'avatar']

function createManifestError(message) {
  const error = new Error(`MANIFEST_INVALID: ${message}`)
  error.type = 'MANIFEST_INVALID'
  return error
}

function assertLabel(node, path) {
  if (!node || typeof node.label !== 'string' || !node.label.trim()) {
    throw createManifestError(`${path} 缺少有效 label`)
  }
}

function normalizeCategoryNode(node) {
  assertLabel(node, 'category')
  return {
    key: node.key || node.label,
    label: node.label,
    children: Array.isArray(node.children) ? node.children.map(normalizeCategoryNode) : []
  }
}

function normalizeSeriesCategories(categories = []) {
  if (!Array.isArray(categories)) {
    throw createManifestError('categories 必须是数组')
  }
  return categories.map(normalizeCategoryNode)
}

export function normalizeUploadWorkspaceManifest(manifest = {}) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw createManifestError('manifest 必须是对象')
  }

  if (
    !manifest.categories ||
    typeof manifest.categories !== 'object' ||
    Array.isArray(manifest.categories)
  ) {
    throw createManifestError('manifest.categories 必须是对象')
  }

  const categories = {}

  for (const series of SERIES_KEYS) {
    categories[series] = normalizeSeriesCategories(manifest.categories[series] || [])
  }

  return {
    version: manifest.version || 1,
    categories
  }
}

export function createCategoryTreeFromManifest(manifest = {}) {
  const normalized = normalizeUploadWorkspaceManifest(manifest)
  const tree = {}

  for (const series of SERIES_KEYS) {
    const secondary = []
    const third = {}

    for (const category of normalized.categories[series]) {
      secondary.push(category.label)

      if (category.children.length > 0) {
        third[category.label] = category.children.map(child => child.label)
      }
    }

    tree[series] = {
      secondary,
      third
    }
  }

  return tree
}

export function createTreeNodesFromManifest(manifest, series, wallpaperRoot = 'wallpaper') {
  const normalized = normalizeUploadWorkspaceManifest(manifest)
  return normalized.categories[series].map(category => ({
    name: category.label,
    path: `${wallpaperRoot}/${series}/${category.label}`,
    type: 'l1',
    children: [],
    loaded: false
  }))
}

export function createChildNodesFromManifest(
  manifest,
  series,
  parentName,
  wallpaperRoot = 'wallpaper'
) {
  const normalized = normalizeUploadWorkspaceManifest(manifest)
  const parent = normalized.categories[series].find(category => category.label === parentName)

  if (!parent) {
    return []
  }

  return parent.children.map(child => ({
    name: child.label,
    path: `${wallpaperRoot}/${series}/${parent.label}/${child.label}`,
    type: 'l2'
  }))
}
