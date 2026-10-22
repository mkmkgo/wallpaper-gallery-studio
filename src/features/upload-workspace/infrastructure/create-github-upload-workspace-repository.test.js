import { describe, it, expect, vi } from 'vitest'
import { createGitHubUploadWorkspaceRepository } from './create-github-upload-workspace-repository.js'
import { resolveAppConfig } from '@/app/config/app-config'

const USER_CONFIG = {
  owner: 'mkmkgo',
  repo: 'nuanXinProPic',
  branch: 'main',
  repositories: [
    {
      id: 'main',
      label: '主仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      branch: 'main',
      enabled: true,
      accepts: ['mobile', 'avatar'],
      priority: 0,
      workflowEvent: 'process-wallpapers'
    },
    {
      id: 'desktop',
      label: '桌面壁纸仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      branch: 'main',
      enabled: true,
      accepts: ['desktop'],
      priority: 0,
      capacityKB: 4718592,
      workflowEvent: 'process-wallpapers-desktop'
    },
    {
      id: 'desktop-2',
      label: '桌面壁纸仓 #2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2',
      // 分仓独立 branch（天花板 4）
      branch: 'release',
      enabled: true,
      accepts: ['desktop'],
      priority: 1,
      capacityKB: 4718592,
      workflowEvent: 'process-wallpapers-desktop'
    }
  ]
}

function createRepository() {
  return createGitHubUploadWorkspaceRepository({
    githubClient: { getContents: vi.fn(async () => []) },
    getRepositoryConfig: () => USER_CONFIG,
    getAppConfig: () => resolveAppConfig({ repository: USER_CONFIG })
  })
}

describe('createGitHubUploadWorkspaceRepository.getContext', () => {
  it('向后兼容：直接传 series 字符串', () => {
    const context = createRepository().getContext('desktop')

    expect(context).toMatchObject({
      repoId: 'desktop',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      branch: 'main',
      workflowEvent: 'process-wallpapers-desktop'
    })
  })

  it('手动指定 repoId 时 branch 跟随分仓条目（天花板 4）', () => {
    const context = createRepository().getContext({ series: 'desktop', repoId: 'desktop-2' })

    expect(context.repo).toBe('nuanXinProPic-desktop-2')
    expect(context.branch).toBe('release')
  })

  it('未分仓的 series（mobile）走主仓', () => {
    expect(createRepository().getContext({ series: 'mobile' })).toMatchObject({
      repoId: 'main',
      repo: 'nuanXinProPic',
      workflowEvent: 'process-wallpapers'
    })
  })

  it('不传参数返回默认仓', () => {
    expect(createRepository().getContext()).toMatchObject({ repoId: 'main' })
  })

  it('用户配置的新注册表不会被默认 seriesRepos 反向覆盖', () => {
    expect(createRepository().getContext('desktop').repoId).toBe('desktop')
  })

  it('保留 wallpaperRoot / metadataPendingDir', () => {
    const context = createRepository().getContext('desktop')
    expect(context.wallpaperRoot).toBe('wallpaper')
    expect(context.metadataPendingDir).toBe('metadata-pending')
  })
})

describe('createGitHubUploadWorkspaceRepository.getCategoryCounts', () => {
  it('默认 series 从注册表 accepts 聚合（不再是硬编码常量）', async () => {
    const counts = await createRepository().getCategoryCounts()
    expect(Object.keys(counts).sort()).toEqual(['avatar', 'desktop', 'mobile', 'total'])
  })
})
