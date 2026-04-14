import {
  createChildNodesFromManifest,
  createTreeNodesFromManifest
} from '../domain/upload-workspace-manifest'

function normalizeTreeNodes(items, type) {
  return items
    .filter(item => item.type === 'dir')
    .map(item => ({
      name: item.name,
      path: item.path,
      type,
      children: type === 'l1' ? [] : undefined,
      loaded: type === 'l1' ? false : undefined
    }))
}

export function createUploadWorkspaceService({ repository }) {
  function buildCategoryPath({ series, parentCategory = '', name, level = 'l1' }) {
    const root = repository.getContext?.().wallpaperRoot || 'wallpaper'
    let categoryPath = `${root}/${series}`

    if (level === 'l2' && parentCategory) {
      categoryPath += `/${parentCategory}`
    }

    return `${categoryPath}/${name}`
  }

  function validateCategoryName(name) {
    if (!name?.trim()) {
      throw new Error('分类名称不能为空')
    }

    if (/[/\\:*?"<>|]/.test(name)) {
      throw new Error('分类名称包含非法字符')
    }
  }

  return {
    async loadRootCategories({ series, forceRefresh = false }) {
      const manifest = await repository.getCategoryManifest?.({ forceRefresh })
      if (manifest) {
        const wallpaperRoot = repository.getContext?.().wallpaperRoot || 'wallpaper'
        return createTreeNodesFromManifest(manifest, series, wallpaperRoot)
      }

      const contents = await repository.getSeriesDirectories(series, { forceRefresh })
      return normalizeTreeNodes(contents, 'l1')
    },
    async loadChildCategories({ series, path, forceRefresh = false }) {
      const manifest = await repository.getCategoryManifest?.({ forceRefresh })
      if (manifest) {
        const wallpaperRoot = repository.getContext?.().wallpaperRoot || 'wallpaper'
        const parentName = path.split('/').filter(Boolean).at(-1)
        return createChildNodesFromManifest(manifest, series, parentName, wallpaperRoot)
      }

      const contents = await repository.getDirectoryContents(path, { forceRefresh })
      return normalizeTreeNodes(contents, 'l2').map(item => ({
        name: item.name,
        path: item.path,
        type: 'l2'
      }))
    },
    async loadStats() {
      return repository.getCategoryCounts()
    },
    async createCategory({ series, parentCategory = '', name, level = 'l1' }) {
      validateCategoryName(name)

      const categoryPath =
        (await repository.createCategoryPlaceholder({
          series,
          parentCategory,
          name,
          level
        })) || buildCategoryPath({ series, parentCategory, name, level })

      const synced = await repository.waitForDirectorySync(categoryPath, { shouldExist: true })

      return { path: categoryPath, synced }
    },
    async inspectCategory(path) {
      try {
        let contents = await repository.getDirectoryContents(path)
        if (!Array.isArray(contents)) {
          contents = [contents]
        }

        return {
          hasImages: contents.some(
            item => item.type === 'file' && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)
          ),
          hasSubDirs: contents.some(item => item.type === 'dir')
        }
      } catch (error) {
        if (error.status === 404 || error.type === 'NOT_FOUND') {
          return { hasImages: false, hasSubDirs: false }
        }

        throw error
      }
    },
    async deleteDirectoryRecursive(path) {
      let contents = []

      try {
        contents = await repository.getDirectoryContents(path)
        if (!Array.isArray(contents)) {
          contents = [contents]
        }
      } catch (error) {
        if (error.status === 404 || error.type === 'NOT_FOUND') {
          return
        }
        throw error
      }

      for (const item of contents) {
        if (item.type === 'dir') {
          await this.deleteDirectoryRecursive(item.path)
        } else {
          await repository.deleteFile(item.path, item.sha, `Delete: ${item.name}`)
        }
      }
    },
    async deleteCategory(path) {
      await this.deleteDirectoryRecursive(path)
      const synced = await repository.waitForDirectorySync(path, { shouldExist: false })
      return { path, synced }
    }
  }
}
