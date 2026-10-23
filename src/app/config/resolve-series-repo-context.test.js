import { describe, it, expect } from 'vitest'
import { resolveSeriesRepoContextForConfig } from './app-config.js'

/** 三仓注册表：main（mobile/avatar）+ desktop + desktop-2（同 series，priority 更大） */
const THREE_REPO_CONFIG = {
  owner: 'mkmkgo',
  repo: 'nuanXinProPic',
  repositories: [
    { id: 'main', owner: 'mkmkgo', repo: 'nuanXinProPic', accepts: ['mobile', 'avatar'] },
    {
      id: 'desktop',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      accepts: ['desktop'],
      capacityKB: 4718592
    },
    {
      id: 'desktop-2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2',
      accepts: ['desktop'],
      priority: 1,
      capacityKB: 4718592
    }
  ]
}

describe('resolveSeriesRepoContextForConfig', () => {
  it('返回完整上下文（repoId / owner / repo / branch / workflowEvent / rollbackEvent / label）', () => {
    const context = resolveSeriesRepoContextForConfig(
      { owner: 'mkmkgo', repo: 'nuanXinProPic' },
      'desktop'
    )

    expect(context).toEqual({
      repoId: 'desktop',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      branch: 'main',
      workflowEvent: 'process-wallpapers-desktop',
      rollbackEvent: 'rollback-release-desktop',
      label: '桌面壁纸仓'
    })
  })

  it('mobile 回退主仓，事件名取主仓配置', () => {
    const context = resolveSeriesRepoContextForConfig(
      { owner: 'mkmkgo', repo: 'nuanXinProPic' },
      'mobile'
    )

    expect(context.repoId).toBe('main')
    expect(context.repo).toBe('nuanXinProPic')
    expect(context.workflowEvent).toBe('process-wallpapers')
    expect(context.rollbackEvent).toBe('rollback-release')
  })

  it('显式传 repoId 时优先生效（手动选仓覆盖自动分配）', () => {
    const auto = resolveSeriesRepoContextForConfig(THREE_REPO_CONFIG, 'desktop')
    expect(auto.repoId).toBe('desktop')

    const manual = resolveSeriesRepoContextForConfig(THREE_REPO_CONFIG, 'desktop', {
      repoId: 'desktop-2'
    })
    expect(manual).toMatchObject({
      repoId: 'desktop-2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2'
    })
  })

  it('不传 repoId 时走自动分配：超容量跳到下一个候选', () => {
    const context = resolveSeriesRepoContextForConfig(THREE_REPO_CONFIG, 'desktop', {
      sizeMap: { desktop: 1e9 }
    })

    expect(context.repoId).toBe('desktop-2')
    expect(context.repo).toBe('nuanXinProPic-desktop-2')
  })

  it('未知 repoId 回落自动分配（allocateRepo 手动覆盖语义）', () => {
    const context = resolveSeriesRepoContextForConfig(THREE_REPO_CONFIG, 'desktop', {
      repoId: 'not-exist'
    })

    expect(context.repoId).toBe('desktop')
  })

  it('条目未显式配置 rollbackEvent 时按 workflowEvent 推导', () => {
    const userConfig = {
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      repositories: [
        { id: 'main', owner: 'mkmkgo', repo: 'nuanXinProPic', accepts: ['mobile', 'avatar'] },
        {
          id: 'desktop-3',
          owner: 'mkmkgo',
          repo: 'nuanXinProPic-desktop-3',
          accepts: ['desktop'],
          // 只配 workflowEvent，不配 rollbackEvent
          workflowEvent: 'process-wallpapers-desktop'
        }
      ]
    }

    const context = resolveSeriesRepoContextForConfig(userConfig, 'desktop')
    expect(context.repoId).toBe('desktop-3')
    expect(context.workflowEvent).toBe('process-wallpapers-desktop')
    expect(context.rollbackEvent).toBe('rollback-release-desktop')
  })

  it('series 为空时返回默认仓库（options.defaultRepoId 优先，其次用户配置）', () => {
    const byOption = resolveSeriesRepoContextForConfig(THREE_REPO_CONFIG, '', {
      defaultRepoId: 'desktop-2'
    })
    expect(byOption.repoId).toBe('desktop-2')

    const byUserConfig = resolveSeriesRepoContextForConfig(
      { ...THREE_REPO_CONFIG, defaultRepoId: 'desktop-2' },
      ''
    )
    expect(byUserConfig.repoId).toBe('desktop-2')
  })

  it('空配置不抛错，回退默认注册表', () => {
    const context = resolveSeriesRepoContextForConfig(undefined, 'desktop')
    expect(context.repoId).toBe('desktop')
    expect(context.workflowEvent).toBe('process-wallpapers-desktop')
  })
})
