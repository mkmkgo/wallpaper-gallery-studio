import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConfigStore } from '@/stores/config'
import {
  allocateRepo,
  createRegistryFromLegacyConfig,
  isValidRepoId,
  listCandidates,
  resolveRepoContext,
  resolveRepoWorkflowEvent
} from './repo-registry.js'

const CAPACITY_KB = 4718592 // 4.5GB

function buildRegistry() {
  return [
    {
      id: 'main',
      label: '主仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      branch: 'main',
      enabled: true,
      accepts: ['mobile', 'avatar'],
      priority: 0,
      capacityKB: 0,
      workflowEvent: 'process-wallpapers',
      cdnTagPrefix: 'v'
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
      capacityKB: CAPACITY_KB,
      workflowEvent: 'process-wallpapers-desktop',
      cdnTagPrefix: 'v'
    },
    {
      id: 'desktop-2',
      label: '桌面壁纸仓 #2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2',
      branch: 'staging',
      enabled: true,
      accepts: ['desktop'],
      priority: 1,
      capacityKB: CAPACITY_KB,
      workflowEvent: 'process-wallpapers-desktop',
      cdnTagPrefix: 'v'
    },
    {
      id: 'retired',
      label: '已停用仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-retired',
      branch: 'main',
      enabled: false,
      accepts: ['desktop'],
      priority: -1,
      capacityKB: CAPACITY_KB,
      workflowEvent: 'process-wallpapers',
      cdnTagPrefix: 'v'
    }
  ]
}

describe('listCandidates', () => {
  it('过滤 enabled=false 的仓库（即使 priority 更小）', () => {
    const candidates = listCandidates(buildRegistry(), 'desktop')
    expect(candidates.map(entry => entry.id)).toEqual(['desktop', 'desktop-2'])
  })

  it('过滤 accepts 不匹配的仓库', () => {
    expect(listCandidates(buildRegistry(), 'mobile').map(entry => entry.id)).toEqual(['main'])
    expect(listCandidates(buildRegistry(), 'avatar').map(entry => entry.id)).toEqual(['main'])
    expect(listCandidates(buildRegistry(), 'unknown-series')).toEqual([])
  })

  it('同 series 多仓按 priority 升序排列', () => {
    const registry = buildRegistry()
    registry[1].priority = 5
    registry[2].priority = 1

    expect(listCandidates(registry, 'desktop').map(entry => entry.id)).toEqual([
      'desktop-2',
      'desktop'
    ])
  })

  it('同优先级时保持配置顺序', () => {
    const registry = buildRegistry()
    registry[1].priority = 0
    registry[2].priority = 0

    expect(listCandidates(registry, 'desktop').map(entry => entry.id)).toEqual([
      'desktop',
      'desktop-2'
    ])
  })

  it('accepts 含 * 的仓库接受任意 series', () => {
    const registry = [{ id: 'any', repo: 'any-repo', accepts: ['*'], enabled: true }]
    expect(listCandidates(registry, 'anything').map(entry => entry.id)).toEqual(['any'])
  })

  it('series 为空时返回全部启用仓库', () => {
    expect(listCandidates(buildRegistry(), '').map(entry => entry.id)).toEqual([
      'main',
      'desktop',
      'desktop-2'
    ])
  })
})

describe('allocateRepo', () => {
  it('手动指定 repoId 优先（跳过 priority 更小的仓库）', () => {
    const context = allocateRepo(buildRegistry(), 'desktop', { repoId: 'desktop-2' })
    expect(context.repoId).toBe('desktop-2')
    expect(context.repo).toBe('nuanXinProPic-desktop-2')
  })

  it('手动指定未知 repoId 时回落自动分配', () => {
    expect(allocateRepo(buildRegistry(), 'desktop', { repoId: 'nope' }).repoId).toBe('desktop')
  })

  it('手动指定已停用 repoId 时回落自动分配', () => {
    expect(allocateRepo(buildRegistry(), 'desktop', { repoId: 'retired' }).repoId).toBe('desktop')
  })

  it('无 sizeMap 时按 priority 取第一个', () => {
    expect(allocateRepo(buildRegistry(), 'desktop').repoId).toBe('desktop')
    expect(allocateRepo(buildRegistry(), 'mobile').repoId).toBe('main')
  })

  it('刚好达到容量阈值即视为超容量（>= 而非 >）', () => {
    expect(
      allocateRepo(buildRegistry(), 'desktop', { sizeMap: { desktop: CAPACITY_KB } }).repoId
    ).toBe('desktop-2')
    expect(
      allocateRepo(buildRegistry(), 'desktop', { sizeMap: { desktop: CAPACITY_KB - 1 } }).repoId
    ).toBe('desktop')
  })

  it('capacityKB 为 0 表示不限容量', () => {
    const sizeMap = { main: Number.MAX_SAFE_INTEGER }
    expect(allocateRepo(buildRegistry(), 'mobile', { sizeMap }).repoId).toBe('main')
  })

  it('缺失体积数据的仓库视为未超容量', () => {
    const sizeMap = { 'desktop-2': CAPACITY_KB }
    expect(allocateRepo(buildRegistry(), 'desktop', { sizeMap }).repoId).toBe('desktop')
  })

  it('全部超容量时降级返回 priority 最小的候选（不返回 null）', () => {
    const sizeMap = { desktop: CAPACITY_KB + 1, 'desktop-2': CAPACITY_KB + 1 }
    const context = allocateRepo(buildRegistry(), 'desktop', { sizeMap })

    expect(context).not.toBeNull()
    expect(context.repoId).toBe('desktop')
  })

  it('无候选时返回 null', () => {
    expect(allocateRepo(buildRegistry(), 'unknown-series')).toBeNull()
  })

  it('没有 series 时返回默认仓库', () => {
    expect(allocateRepo(buildRegistry(), '').repoId).toBe('main')
    expect(allocateRepo(buildRegistry(), '', { defaultRepoId: 'desktop-2' }).repoId).toBe(
      'desktop-2'
    )
  })

  it('branch 跟随分仓条目而非主仓（天花板 4）', () => {
    expect(allocateRepo(buildRegistry(), 'desktop', { repoId: 'desktop-2' }).branch).toBe('staging')
  })

  it('空注册表不抛错', () => {
    expect(allocateRepo([], 'desktop')).toBeNull()
    expect(allocateRepo(undefined, 'desktop')).toBeNull()
    expect(allocateRepo(null, '')).toBeNull()
  })
})

describe('resolveRepoContext', () => {
  it('返回完整上下文', () => {
    expect(resolveRepoContext(buildRegistry(), 'desktop-2')).toEqual({
      repoId: 'desktop-2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2',
      branch: 'staging',
      workflowEvent: 'process-wallpapers-desktop',
      label: '桌面壁纸仓 #2'
    })
  })

  it('未知 repoId 返回 null', () => {
    expect(resolveRepoContext(buildRegistry(), 'does-not-exist')).toBeNull()
  })

  it('已停用的 repoId 返回 null', () => {
    expect(resolveRepoContext(buildRegistry(), 'retired')).toBeNull()
  })

  it('非法 repoId 返回 null', () => {
    expect(resolveRepoContext(buildRegistry(), '')).toBeNull()
    expect(resolveRepoContext(buildRegistry(), null)).toBeNull()
    expect(resolveRepoContext(buildRegistry(), 'has space')).toBeNull()
  })
})

describe('resolveRepoWorkflowEvent', () => {
  it('从注册表条目读事件（不再按 series 硬编码）', () => {
    expect(resolveRepoWorkflowEvent(buildRegistry(), 'desktop')).toBe('process-wallpapers-desktop')
    expect(resolveRepoWorkflowEvent(buildRegistry(), 'desktop-2')).toBe(
      'process-wallpapers-desktop'
    )
    expect(resolveRepoWorkflowEvent(buildRegistry(), 'main')).toBe('process-wallpapers')
  })

  it('未知仓库返回空字符串', () => {
    expect(resolveRepoWorkflowEvent(buildRegistry(), 'nope')).toBe('')
  })
})

describe('isValidRepoId', () => {
  it('接受字母数字与 . _ -', () => {
    expect(isValidRepoId('main')).toBe(true)
    expect(isValidRepoId('desktop-2')).toBe(true)
    expect(isValidRepoId('repo_v1.2')).toBe(true)
  })

  it('拒绝空值、空格与非法字符', () => {
    expect(isValidRepoId('')).toBe(false)
    expect(isValidRepoId(null)).toBe(false)
    expect(isValidRepoId(undefined)).toBe(false)
    expect(isValidRepoId('has space')).toBe(false)
    expect(isValidRepoId('bad/id')).toBe(false)
  })
})

describe('createRegistryFromLegacyConfig', () => {
  it('旧 seriesRepos 迁移成注册表条目并补主仓兜底', () => {
    const registry = createRegistryFromLegacyConfig({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      branch: 'main',
      seriesRepos: { desktop: { repo: 'nuanXinProPic-desktop' } }
    })

    expect(registry.map(entry => entry.id)).toEqual(['main', 'legacy-desktop'])
    expect(allocateRepo(registry, 'desktop')).toMatchObject({
      repoId: 'legacy-desktop',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      workflowEvent: 'process-wallpapers-desktop'
    })
    expect(allocateRepo(registry, 'mobile')).toMatchObject({
      repoId: 'main',
      repo: 'nuanXinProPic'
    })
  })

  it('旧 seriesRepos 中 repo 为空的条目视为未配置', () => {
    const registry = createRegistryFromLegacyConfig({
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      seriesRepos: { desktop: { repo: '' } }
    })

    expect(registry.map(entry => entry.id)).toEqual(['main'])
    expect(allocateRepo(registry, 'desktop')).toMatchObject({ repoId: 'main' })
  })

  it('旧 seriesRepos 覆盖同名 series 的新版条目', () => {
    const registry = createRegistryFromLegacyConfig({
      owner: 'someone',
      repo: 'my-main-repo',
      repositories: buildRegistry(),
      seriesRepos: { desktop: { repo: 'my-desktop-repo' } }
    })

    const context = allocateRepo(registry, 'desktop')
    expect(context.repo).toBe('my-desktop-repo')
    expect(context.owner).toBe('someone')
  })

  it('已有 main 条目时不再重复插入兜底主仓', () => {
    const registry = createRegistryFromLegacyConfig({ repositories: buildRegistry() })
    expect(registry.filter(entry => entry.id === 'main')).toHaveLength(1)
  })
})

describe('配置存储往返（天花板 2 回归）', () => {
  const STORAGE_KEY = 'wallpaper_admin_config'

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('含 repositories 的配置写进 localStorage 后再加载不丢', () => {
    const store = useConfigStore()
    store.setConfig({
      repositories: buildRegistry(),
      assignment: 'manual',
      defaultRepoId: 'desktop'
    })

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(raw.repositories).toHaveLength(4)
    expect(raw.assignment).toBe('manual')
    expect(raw.defaultRepoId).toBe('desktop')

    // 重新初始化 store，模拟刷新页面
    setActivePinia(createPinia())
    const reloaded = useConfigStore()

    expect(reloaded.config.repositories).toHaveLength(4)
    expect(reloaded.config.repositories.map(entry => entry.id)).toEqual([
      'main',
      'desktop',
      'desktop-2',
      'retired'
    ])
    expect(reloaded.config.repositories[2].branch).toBe('staging')
    expect(reloaded.config.assignment).toBe('manual')
    expect(reloaded.config.defaultRepoId).toBe('desktop')
    expect(reloaded.config.version).toBe(2)
  })

  it('旧版 localStorage 数据（无 repositories）加载后仍有默认注册表', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ owner: 'mkmkgo', repo: 'nuanXinProPic', branch: 'main' })
    )
    setActivePinia(createPinia())

    const store = useConfigStore()
    expect(store.config.owner).toBe('mkmkgo')
    expect(Array.isArray(store.config.repositories)).toBe(true)
    expect(store.config.repositories.length).toBeGreaterThan(0)
    expect(store.config.assignment).toBe('auto')
  })

  it('repositories 为空数组时回落到默认注册表（避免覆盖掉默认值）', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ repositories: [] }))
    setActivePinia(createPinia())

    const store = useConfigStore()
    expect(store.config.repositories.length).toBeGreaterThan(0)
  })

  it('registry 往返后可继续用于自动选仓', () => {
    const store = useConfigStore()
    store.setConfig({ repositories: buildRegistry() })

    setActivePinia(createPinia())
    const reloaded = useConfigStore()

    expect(allocateRepo(reloaded.config.repositories, 'desktop').repoId).toBe('desktop')
    expect(
      allocateRepo(reloaded.config.repositories, 'desktop', { sizeMap: { desktop: CAPACITY_KB } })
        .repoId
    ).toBe('desktop-2')
  })
})
