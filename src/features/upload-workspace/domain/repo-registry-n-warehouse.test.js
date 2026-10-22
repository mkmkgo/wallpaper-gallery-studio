import { describe, it, expect } from 'vitest'
import {
  allocateRepo,
  listCandidates,
  resolveRepoWorkflowEvent,
  normalizeRegistry
} from './repo-registry.js'

// sizeMap 的单位是 KB，1 GB = 1048576 KB
const GB = 1048576
const CAPACITY_4_5GB = 4718592

/**
 * 构造一个含 4 个仓库的注册表：
 * 主仓（mobile/avatar）+ 桌面仓 #1 #2 #3
 * 用来验证「第 3/4/5 个仓库」的扩展路径是纯配置、零代码改动。
 */
function makeRegistry() {
  return normalizeRegistry([
    {
      id: 'main',
      label: '主仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic',
      accepts: ['mobile', 'avatar'],
      priority: 0,
      capacityKB: CAPACITY_4_5GB,
      workflowEvent: 'process-wallpapers'
    },
    {
      id: 'desktop',
      label: '桌面壁纸仓',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop',
      accepts: ['desktop'],
      priority: 0,
      capacityKB: CAPACITY_4_5GB,
      workflowEvent: 'process-wallpapers-desktop'
    },
    {
      id: 'desktop-2',
      label: '桌面壁纸仓 #2',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-2',
      accepts: ['desktop'],
      priority: 1,
      capacityKB: CAPACITY_4_5GB,
      workflowEvent: 'process-wallpapers-desktop'
    },
    {
      id: 'desktop-3',
      label: '桌面壁纸仓 #3',
      owner: 'mkmkgo',
      repo: 'nuanXinProPic-desktop-3',
      accepts: ['desktop'],
      priority: 2,
      capacityKB: CAPACITY_4_5GB,
      workflowEvent: 'process-wallpapers-desktop'
    }
  ])
}

describe('N 仓扩展：同一 series 分布在多个仓库', () => {
  it('仓都空闲时推荐 priority 最小的', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', {
      sizeMap: { desktop: 0.1 * GB, 'desktop-2': 0.05 * GB, 'desktop-3': 0.01 * GB }
    })
    expect(r.repoId).toBe('desktop')
    expect(r.repo).toBe('nuanXinProPic-desktop')
    expect(r.branch).toBe('main')
  })

  it('第一个仓写满 4.6GB 时自动切到第二个仓', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', {
      sizeMap: { desktop: 4.6 * GB, 'desktop-2': 0.5 * GB, 'desktop-3': 0.01 * GB }
    })
    expect(r.repoId).toBe('desktop-2')
  })

  it('前两个仓都写满时切到第三个仓', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', {
      sizeMap: { desktop: 4.6 * GB, 'desktop-2': 4.6 * GB, 'desktop-3': 0.01 * GB }
    })
    expect(r.repoId).toBe('desktop-3')
  })

  it('手动指定优先于容量与优先级', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', {
      repoId: 'desktop-3',
      sizeMap: { desktop: 0.1 * GB }
    })
    expect(r.repoId).toBe('desktop-3')
  })

  it('所有仓都写满时降级到首选仓，而不是返回 null', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', {
      sizeMap: { desktop: 4.6 * GB, 'desktop-2': 4.6 * GB, 'desktop-3': 4.6 * GB }
    })
    expect(r).not.toBeNull()
    expect(r.repoId).toBe('desktop')
  })

  it('缺少某仓体积数据时视为未超容量，不误切仓', () => {
    const r = allocateRepo(makeRegistry(), 'desktop', { sizeMap: { desktop: 4.6 * GB } })
    expect(r.repoId).toBe('desktop-2')
  })

  it('未分仓的 series 仍走主仓，不受桌面分仓影响', () => {
    const r = allocateRepo(makeRegistry(), 'mobile', { sizeMap: { main: 2 * GB } })
    expect(r.repoId).toBe('main')
    expect(r.repo).toBe('nuanXinProPic')
  })

  it('同一 series 的多个仓共用一条流水线事件', () => {
    const registry = makeRegistry()
    for (const id of ['desktop', 'desktop-2', 'desktop-3']) {
      expect(resolveRepoWorkflowEvent(registry, id)).toBe('process-wallpapers-desktop')
    }
  })

  it('候选列表随注册表自动扩展，UI 无需改代码', () => {
    expect(listCandidates(makeRegistry(), 'desktop').length).toBe(3)
    expect(listCandidates(makeRegistry(), 'mobile').length).toBe(1)
  })

  it('没有候选时返回 null 而不是抛错', () => {
    expect(allocateRepo(makeRegistry(), 'nonexistent')).toBeNull()
  })
})
