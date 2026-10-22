import { describe, it, expect } from 'vitest'
import {
  KB_PER_GB,
  formatRepoSize,
  resolveRepoUsedKB,
  formatRepoCapacity,
  resolveRepoCapacityPercent,
  resolveRepoCapacityStatus
} from './repo-capacity.js'

const CAPACITY_KB = Math.round(4.5 * KB_PER_GB)

function buildEntry(overrides = {}) {
  return { id: 'desktop', label: '桌面壁纸仓', capacityKB: CAPACITY_KB, ...overrides }
}

describe('formatRepoSize', () => {
  it('按 GB / MB 分档格式化', () => {
    expect(formatRepoSize(2.17 * KB_PER_GB)).toBe('2.17 GB')
    expect(formatRepoSize(2048)).toBe('2.0 MB')
  })

  it('非法值统一显示「未知」', () => {
    expect(formatRepoSize(undefined)).toBe('未知')
    expect(formatRepoSize(null)).toBe('未知')
    expect(formatRepoSize(NaN)).toBe('未知')
    expect(formatRepoSize(-1)).toBe('未知')
  })
})

describe('resolveRepoUsedKB', () => {
  const infoMap = {
    desktop: { sizeKB: 1234, permissions: null, defaultBranch: 'main' },
    broken: null
  }

  it('取到已用体积', () => {
    expect(resolveRepoUsedKB(infoMap, 'desktop')).toBe(1234)
  })

  it('查询失败的仓库返回 undefined（界面显示「未知」）', () => {
    expect(resolveRepoUsedKB(infoMap, 'broken')).toBeUndefined()
    expect(resolveRepoUsedKB(infoMap, 'missing')).toBeUndefined()
  })

  it('infoMap 本身缺失时不抛错', () => {
    expect(resolveRepoUsedKB(null, 'desktop')).toBeUndefined()
    expect(resolveRepoUsedKB(undefined, 'desktop')).toBeUndefined()
  })
})

describe('formatRepoCapacity', () => {
  it('有容量上限时显示「已用 / 上限」', () => {
    const infoMap = { desktop: { sizeKB: 2.17 * KB_PER_GB } }
    expect(formatRepoCapacity(infoMap, buildEntry())).toBe('2.17 GB / 4.5 GB')
  })

  it('容量未知时显示「未知 / 上限」而不是崩溃', () => {
    expect(formatRepoCapacity({}, buildEntry())).toBe('未知 / 4.5 GB')
    expect(formatRepoCapacity({ desktop: null }, buildEntry())).toBe('未知 / 4.5 GB')
  })

  it('capacityKB <= 0 表示不限容量', () => {
    const infoMap = { desktop: { sizeKB: 3 * KB_PER_GB } }
    expect(formatRepoCapacity(infoMap, buildEntry({ capacityKB: 0 }))).toBe('3.00 GB · 不限容量')
  })

  it('无容量上限且拉取失败时显示「容量未知」', () => {
    expect(formatRepoCapacity({}, buildEntry({ capacityKB: 0 }))).toBe('容量未知')
  })
})

describe('resolveRepoCapacityPercent / Status', () => {
  it('百分比按上限换算并封顶 100', () => {
    const infoMap = { desktop: { sizeKB: CAPACITY_KB / 2 } }
    expect(resolveRepoCapacityPercent(infoMap, buildEntry())).toBe(50)

    const overflow = { desktop: { sizeKB: CAPACITY_KB * 2 } }
    expect(resolveRepoCapacityPercent(overflow, buildEntry())).toBe(100)
  })

  it('容量未知或不限容量时百分比为 0', () => {
    expect(resolveRepoCapacityPercent({}, buildEntry())).toBe(0)
    expect(
      resolveRepoCapacityPercent({ desktop: { sizeKB: 1 } }, buildEntry({ capacityKB: 0 }))
    ).toBe(0)
  })

  it('按阈值切换状态色', () => {
    const percent = sizeKB => resolveRepoCapacityStatus({ desktop: { sizeKB } }, buildEntry())

    expect(percent(0)).toBe('success')
    expect(percent(CAPACITY_KB * 0.8)).toBe('warning')
    expect(percent(CAPACITY_KB * 0.95)).toBe('exception')
  })
})
