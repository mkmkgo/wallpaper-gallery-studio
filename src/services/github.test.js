import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeGitHubContentPath, githubService } from './github'

const IMAGE_PATH = 'wallpaper/desktop/风景/城市/7713_wallhaven壁纸_#7753.jpeg'

beforeEach(() => {
  githubService.clearReposInfoCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('encodeGitHubContentPath', () => {
  it('按路径段编码 URL 保留字符', () => {
    const encodedPath = encodeGitHubContentPath(IMAGE_PATH)
    const url = new URL(`https://api.github.com/repos/owner/repo/contents/${encodedPath}`)

    expect(encodedPath).toContain('%23')
    expect(url.hash).toBe('')
    expect(decodeURIComponent(url.pathname)).toBe(`/repos/owner/repo/contents/${IMAGE_PATH}`)
  })
})

describe('GitHubService.uploadImage', () => {
  it('使用编码后的路径上传并校验返回路径', async () => {
    vi.spyOn(githubService, 'fileToBase64').mockResolvedValue('base64-content')
    vi.spyOn(githubService, 'ensureDirectoryExists').mockResolvedValue()
    const request = vi
      .spyOn(githubService, 'request')
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ content: { path: IMAGE_PATH } })

    await githubService.uploadImage(
      'mkmkgo',
      'nuanXinProPic',
      IMAGE_PATH,
      {},
      'Upload test',
      'main'
    )

    const endpoint = `/repos/mkmkgo/nuanXinProPic/contents/${encodeGitHubContentPath(IMAGE_PATH)}`
    expect(request).toHaveBeenNthCalledWith(1, `${endpoint}?ref=main`)
    expect(request).toHaveBeenNthCalledWith(2, endpoint, expect.objectContaining({ method: 'PUT' }))
  })

  it('返回路径不一致时不能标记上传成功', async () => {
    vi.spyOn(githubService, 'fileToBase64').mockResolvedValue('base64-content')
    vi.spyOn(githubService, 'ensureDirectoryExists').mockResolvedValue()
    vi.spyOn(githubService, 'request')
      .mockRejectedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ content: { path: 'wallpaper/desktop/7713_wallhaven壁纸_' } })

    await expect(
      githubService.uploadImage('mkmkgo', 'nuanXinProPic', IMAGE_PATH, {}, 'Upload test', 'main')
    ).rejects.toMatchObject({
      type: 'UPLOAD_PATH_MISMATCH',
      expectedPath: IMAGE_PATH
    })
  })
})

describe('GitHubService.getRepoInfo', () => {
  it('映射 size / pushed_at / default_branch / permissions', async () => {
    vi.spyOn(githubService, 'request').mockResolvedValue({
      size: 12345,
      pushed_at: '2026-01-01T00:00:00Z',
      default_branch: 'main',
      permissions: { admin: true, push: true, pull: true }
    })

    expect(await githubService.getRepoInfo('mkmkgo', 'nuanXinProPic')).toEqual({
      sizeKB: 12345,
      pushedAt: '2026-01-01T00:00:00Z',
      defaultBranch: 'main',
      permissions: { admin: true, push: true, pull: true }
    })
  })

  it('缺字段时回落安全值', async () => {
    vi.spyOn(githubService, 'request').mockResolvedValue({})

    expect(await githubService.getRepoInfo('mkmkgo', 'empty')).toEqual({
      sizeKB: 0,
      pushedAt: '',
      defaultBranch: '',
      permissions: null
    })
  })
})

describe('GitHubService.getReposInfo', () => {
  const LIST = [
    { repoId: 'desktop', owner: 'mkmkgo', repo: 'nuanXinProPic-desktop' },
    { repoId: 'desktop-2', owner: 'mkmkgo', repo: 'nuanXinProPic-desktop-2' }
  ]

  it('并发批量查询并以 repoId 为键返回', async () => {
    const request = vi.spyOn(githubService, 'request').mockImplementation(async endpoint => ({
      size: String(endpoint).includes('desktop-2') ? 999 : 100,
      default_branch: 'main',
      permissions: { push: true }
    }))

    const result = await githubService.getReposInfo(LIST)

    expect(request).toHaveBeenCalledTimes(2)
    expect(result.desktop).toEqual({
      sizeKB: 100,
      permissions: { push: true },
      defaultBranch: 'main'
    })
    expect(result['desktop-2'].sizeKB).toBe(999)
  })

  it('5 分钟内命中缓存不再打 API', async () => {
    const request = vi.spyOn(githubService, 'request').mockResolvedValue({
      size: 100,
      default_branch: 'main',
      permissions: null
    })

    await githubService.getReposInfo(LIST)
    const second = await githubService.getReposInfo(LIST)

    expect(request).toHaveBeenCalledTimes(2)
    expect(second['desktop-2'].sizeKB).toBe(100)
  })

  it('清缓存后重新查询', async () => {
    const request = vi.spyOn(githubService, 'request').mockResolvedValue({
      size: 100,
      default_branch: 'main',
      permissions: null
    })

    await githubService.getReposInfo(LIST)
    githubService.clearReposInfoCache()
    await githubService.getReposInfo(LIST)

    expect(request).toHaveBeenCalledTimes(4)
  })

  it('单个仓库失败不影响其余（该 repoId 置 null）', async () => {
    vi.spyOn(githubService, 'request').mockImplementation(async endpoint => {
      if (String(endpoint).includes('broken')) {
        throw { type: 'NOT_FOUND', status: 404 }
      }
      return { size: 1, default_branch: 'main', permissions: null }
    })

    const result = await githubService.getReposInfo([
      { repoId: 'ok', owner: 'mkmkgo', repo: 'nuanXinProPic' },
      { repoId: 'broken', owner: 'mkmkgo', repo: 'broken-repo' }
    ])

    expect(result.ok).toEqual({ sizeKB: 1, permissions: null, defaultBranch: 'main' })
    expect(result.broken).toBeNull()
  })

  it('跳过缺 owner / repo / repoId 的条目', async () => {
    const request = vi.spyOn(githubService, 'request').mockResolvedValue({
      size: 1,
      default_branch: 'main',
      permissions: null
    })

    await githubService.getReposInfo([
      { repoId: '', owner: 'mkmkgo', repo: 'nuanXinProPic' },
      { repoId: 'no-owner', owner: '', repo: 'nuanXinProPic' },
      undefined
    ])

    expect(request).not.toHaveBeenCalled()
  })

  it('空入参不抛错', async () => {
    await expect(githubService.getReposInfo()).resolves.toEqual({})
    await expect(githubService.getReposInfo([])).resolves.toEqual({})
  })
})
