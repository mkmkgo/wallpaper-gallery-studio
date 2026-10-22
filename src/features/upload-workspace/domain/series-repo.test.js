import { describe, it, expect } from 'vitest'
import {
  resolveSeriesRepo,
  resolveSeriesWorkflowEvent,
  resolveRepoWorkflowEvent
} from './series-repo.js'

describe('resolveSeriesRepo', () => {
  const baseConfig = {
    owner: 'mkmkgo',
    repo: 'nuanXinProPic',
    branch: 'main'
  }

  it('无 seriesRepos 配置时全部回退主仓', () => {
    expect(resolveSeriesRepo(baseConfig, 'desktop')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
    expect(resolveSeriesRepo(baseConfig, 'mobile')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
    expect(resolveSeriesRepo(baseConfig, '')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
  })

  it('desktop 命中分仓配置', () => {
    const config = {
      ...baseConfig,
      seriesRepos: {
        desktop: { owner: 'mkmkgo', repo: 'nuanXinProPic-desktop' }
      }
    }
    expect(resolveSeriesRepo(config, 'desktop')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop'
    })
  })

  it('desktop 分仓 owner 缺省时沿用主 owner', () => {
    const config = {
      ...baseConfig,
      seriesRepos: {
        desktop: { repo: 'nuanXinProPic-desktop' }
      }
    }
    expect(resolveSeriesRepo(config, 'desktop')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop'
    })
  })

  it('mobile/avatar 未配置分仓时仍回退主仓', () => {
    const config = {
      ...baseConfig,
      seriesRepos: {
        desktop: { repo: 'nuanXinProPic-desktop' }
      }
    }
    expect(resolveSeriesRepo(config, 'mobile')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
    expect(resolveSeriesRepo(config, 'avatar')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
  })

  it('分仓配置 repo 为空字符串时视为未配置', () => {
    const config = {
      ...baseConfig,
      seriesRepos: {
        desktop: { repo: '' }
      }
    }
    expect(resolveSeriesRepo(config, 'desktop')).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic'
    })
  })

  it('空配置不抛错', () => {
    expect(resolveSeriesRepo({}, 'desktop')).toEqual({ owner: '', repo: '' })
    expect(resolveSeriesRepo(undefined, 'desktop')).toEqual({ owner: '', repo: '' })
  })
})

describe('resolveSeriesWorkflowEvent（deprecated 兼容包装）', () => {
  it('desktop 走分仓专用流水线事件', () => {
    expect(resolveSeriesWorkflowEvent('desktop')).toBe('process-wallpapers-desktop')
  })

  it('其余系列走主流水线事件', () => {
    expect(resolveSeriesWorkflowEvent('mobile')).toBe('process-wallpapers')
    expect(resolveSeriesWorkflowEvent('avatar')).toBe('process-wallpapers')
    expect(resolveSeriesWorkflowEvent('')).toBe('process-wallpapers')
  })

  it('传入自定义注册表时按注册表条目取事件', () => {
    const registry = [
      { id: 'main', repo: 'main-repo', accepts: ['mobile'], workflowEvent: 'process-wallpapers' },
      { id: 'a', repo: 'a-repo', accepts: ['desktop'], workflowEvent: 'event-a', priority: 0 },
      { id: 'b', repo: 'b-repo', accepts: ['desktop'], workflowEvent: 'event-b', priority: 1 }
    ]

    expect(resolveSeriesWorkflowEvent('desktop', registry)).toBe('event-a')
  })
})

describe('resolveRepoWorkflowEvent', () => {
  it('从注册表条目读事件，desktop 与 desktop-2 可返回同一事件', () => {
    const registry = [
      {
        id: 'desktop',
        repo: 'nuanXinProPic-desktop',
        accepts: ['desktop'],
        workflowEvent: 'process-wallpapers-desktop'
      },
      {
        id: 'desktop-2',
        repo: 'nuanXinProPic-desktop-2',
        accepts: ['desktop'],
        priority: 1,
        workflowEvent: 'process-wallpapers-desktop'
      }
    ]

    expect(resolveRepoWorkflowEvent(registry, 'desktop')).toBe('process-wallpapers-desktop')
    expect(resolveRepoWorkflowEvent(registry, 'desktop-2')).toBe('process-wallpapers-desktop')
    expect(resolveRepoWorkflowEvent(registry, 'nope')).toBe('')
  })
})

describe('resolveSeriesRepo 手动指定仓库', () => {
  const config = {
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
    expect(resolveSeriesRepo(config, 'desktop', { repoId: 'desktop-2' })).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2'
    })
  })

  it('传 sizeMap 时超容量自动跳到下一个候选', () => {
    expect(resolveSeriesRepo(config, 'desktop', { sizeMap: { desktop: 4718592 } })).toEqual({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2'
    })
  })
})
