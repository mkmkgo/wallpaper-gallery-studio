import { describe, it, expect } from 'vitest'
import {
  resolveSeriesRepoForConfig,
  resolveRepositoryRegistry,
  resolveAppConfig
} from './app-config.js'

describe('resolveSeriesRepoForConfig', () => {
  it('用户配置了主仓时，desktop 解析到分仓、其余回退主仓', () => {
    const userConfig = { owner: 'mkmkgo', repo: 'nuanXinProPic', branch: 'main' }

    expect(resolveSeriesRepoForConfig(userConfig, 'desktop')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop'
    })
    expect(resolveSeriesRepoForConfig(userConfig, 'mobile')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
    expect(resolveSeriesRepoForConfig(userConfig, 'avatar')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
    // 不传 series = 主仓（向后兼容）
    expect(resolveSeriesRepoForConfig(userConfig, '')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
  })

  it('用户配置可覆盖分仓 repo（mergeConfig 深合并）', () => {
    const userConfig = {
      owner: 'someone',
      repo: 'my-main-repo',
      seriesRepos: { desktop: { repo: 'my-desktop-repo' } }
    }

    expect(resolveSeriesRepoForConfig(userConfig, 'desktop')).toEqual({
      owner: 'someone',
      repo: 'my-desktop-repo'
    })
    expect(resolveSeriesRepoForConfig(userConfig, 'mobile')).toEqual({
      owner: 'someone',
      repo: 'my-main-repo'
    })
  })

  it('默认配置自带 desktop 分仓（测试环境无 env 时用内置默认名）', () => {
    const repository = resolveAppConfig().repository
    expect(repository.seriesRepos.desktop.repo).toBe('nuanXinProPic-desktop')
  })

  it('空配置不抛错', () => {
    expect(resolveSeriesRepoForConfig({}, 'desktop')).toEqual({
      owner: '',
      repo: 'nuanXinProPic-desktop'
    })
    expect(resolveSeriesRepoForConfig(undefined, 'mobile')).toEqual({
      owner: '',
      repo: ''
    })
  })
})

describe('resolveRepositoryRegistry', () => {
  it('默认返回注册表（主仓 + desktop 仓）', () => {
    const registry = resolveRepositoryRegistry()
    expect(registry.map(entry => entry.id)).toEqual(['main', 'desktop'])
    expect(registry[1].workflowEvent).toBe('process-wallpapers-desktop')
  })

  it('用户配置的分仓 branch 生效，且同名 series 不被默认 seriesRepos 顶掉', () => {
    const registry = resolveRepositoryRegistry({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      repositories: [
        { id: 'main', owner: 'mkmkgo', repo: 'nuanXinProPic', accepts: ['mobile', 'avatar'] },
        {
          id: 'desktop',
          owner: 'mkmkgo',
          repo: 'nuanXinProPic-desktop',
          branch: 'release',
          accepts: ['desktop']
        },
        {
          id: 'desktop-2',
          owner: 'mkmkgo',
          repo: 'nuanXinProPic-desktop-2',
          accepts: ['desktop'],
          priority: 1
        }
      ]
    })

    expect(registry.map(entry => entry.id)).toEqual(['main', 'desktop', 'desktop-2'])
    expect(registry.find(entry => entry.id === 'desktop').branch).toBe('release')
  })

  it('用户显式配置的旧 seriesRepos 仍会迁移成条目', () => {
    const registry = resolveRepositoryRegistry({
      owner: 'someone',
      repo: 'my-main-repo',
      seriesRepos: { desktop: { repo: 'my-desktop-repo' } }
    })

    // 默认注册表条目仍在，迁移出的 legacy 条目以更高优先级覆盖同名 series
    expect(registry.map(entry => entry.id)).toEqual(['main', 'desktop', 'legacy-desktop'])
    expect(registry.find(entry => entry.id === 'legacy-desktop').priority).toBe(-1)
    expect(
      resolveSeriesRepoForConfig(
        {
          owner: 'someone',
          repo: 'my-main-repo',
          seriesRepos: { desktop: { repo: 'my-desktop-repo' } }
        },
        'desktop'
      )
    ).toEqual({ owner: 'someone', repo: 'my-desktop-repo' })
  })
})

describe('resolveSeriesRepoForConfig 手动指定仓库', () => {
  const userConfig = {
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

  it('传 repoId 时按手动覆盖分配', () => {
    expect(resolveSeriesRepoForConfig(userConfig, 'desktop', { repoId: 'desktop-2' })).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2'
    })
  })

  it('传 sizeMap 时超容量自动跳到下一个候选', () => {
    expect(
      resolveSeriesRepoForConfig(userConfig, 'desktop', { sizeMap: { desktop: 1e9 } })
    ).toEqual({ owner: 'mkmkgo', repo: 'nuanXinProPic-desktop-2' })
  })
})
