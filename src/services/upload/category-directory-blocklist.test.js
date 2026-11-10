import { describe, it, expect } from 'vitest'
import { applyCategoryBlocklist } from './category-directory.js'

describe('分类树黑名单收口', () => {
  it('third 数组内的黑名单项同样被过滤（不再只清键）', () => {
    const tree = {
      mobile: {
        secondary: ['风景', '政治'],
        third: {
          风景: ['雪山', '政治', '城市'],
          政治: ['人物']
        }
      }
    }
    const result = applyCategoryBlocklist(tree)
    expect(result.mobile.secondary).toEqual(['风景'])
    expect(result.mobile.third['政治']).toBeUndefined()
    expect(result.mobile.third['风景']).toEqual(['雪山', '城市'])
  })

  it('非数组的 third 值保持原样，三条返回路径不受影响', () => {
    const tree = { desktop: { secondary: [], third: { 风景: null } } }
    expect(applyCategoryBlocklist(tree).desktop.third['风景']).toBeNull()
    expect(applyCategoryBlocklist(null)).toBeNull()
  })
})
