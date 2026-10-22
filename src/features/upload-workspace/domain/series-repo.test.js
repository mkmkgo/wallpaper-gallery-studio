import { describe, it, expect } from 'vitest'
import { resolveSeriesRepo, resolveSeriesWorkflowEvent } from './series-repo.js'

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

describe('resolveSeriesWorkflowEvent', () => {
  it('desktop 走分仓专用流水线事件', () => {
    expect(resolveSeriesWorkflowEvent('desktop')).toBe('process-wallpapers-desktop')
  })

  it('其余系列走主流水线事件', () => {
    expect(resolveSeriesWorkflowEvent('mobile')).toBe('process-wallpapers')
    expect(resolveSeriesWorkflowEvent('avatar')).toBe('process-wallpapers')
    expect(resolveSeriesWorkflowEvent('')).toBe('process-wallpapers')
  })
})
