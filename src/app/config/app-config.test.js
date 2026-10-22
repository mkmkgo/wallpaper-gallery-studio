import { describe, it, expect } from 'vitest'
import { resolveSeriesRepoForConfig, resolveAppConfig } from './app-config.js'

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
