import { describe, it, expect } from 'vitest'
import { getVirtualGridWindow } from './virtual-grid.js'

const base = { columns: 4, rowHeight: 74, bufferRows: 2, viewportHeight: 420 }

describe('getVirtualGridWindow', () => {
  it('607 个任务生成足够高的可滚动内容', () => {
    const w = getVirtualGridWindow({ ...base, itemCount: 607 })
    expect(w.rowCount).toBe(152)
    expect(w.totalHeight).toBe(152 * 74)
    expect(w.totalHeight).toBeGreaterThan(base.viewportHeight)
  })

  it('滚动到底部时能覆盖到第 607 个任务', () => {
    const w = getVirtualGridWindow({
      ...base,
      itemCount: 607,
      scrollTop: 152 * 74 - base.viewportHeight
    })
    expect(w.endIndex).toBe(607)
  })

  it('任意滚动位置同时渲染的卡片数有界，不会生成 607 个 DOM', () => {
    for (const scrollTop of [0, 1000, 5000, 11000]) {
      const w = getVirtualGridWindow({ ...base, itemCount: 607, scrollTop })
      expect(w.endIndex - w.startIndex).toBeLessThanOrEqual(40)
    }
  })

  it('少量任务时全部渲染', () => {
    const w = getVirtualGridWindow({ ...base, itemCount: 12 })
    expect(w.endIndex - w.startIndex).toBe(12)
  })

  it('空列表不产生高度与区间', () => {
    const w = getVirtualGridWindow({ ...base, itemCount: 0 })
    expect(w.totalHeight).toBe(0)
    expect(w.endIndex).toBe(0)
  })
})
