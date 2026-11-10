import { describe, it, expect } from 'vitest'
import { PROMPT_TEMPLATES, SERIES_TEMPLATES, buildPrompt } from './prompts.js'

const OLD_STYLE = [
  '高雅',
  '富有诗意',
  '唯美含蓄',
  'Glamour',
  '姿态撩人',
  'JK制服',
  '特定明星',
  '只要包含丝袜',
  '诗意标题',
  '优美描述',
  '避免直白'
]

const templates = [
  ...Object.entries(PROMPT_TEMPLATES)
    .filter(([key]) => key !== 'custom')
    .map(([key, value]) => [key, value.template]),
  ...Object.entries(SERIES_TEMPLATES).map(([key, value]) => [key, value])
]

describe('8 套模板合规同步（漏一套即继续产出旧风格）', () => {
  it('恰好 2 套通用模板 + 6 套系列模板', () => {
    expect(templates).toHaveLength(8)
  })

  for (const [name, text] of templates) {
    it(`${name}：客观命名 / 拒答规则 / 字段白名单齐备，且无旧风格措辞`, () => {
      expect(text).toContain('客观')
      expect(text).toContain('rejected')
      expect(text).toContain('displayTitle')
      expect(text).toContain('keywords')
      for (const oldPhrase of OLD_STYLE) {
        expect(text).not.toContain(oldPhrase)
      }
    })
  }

  it('buildPrompt 替换变量后无残留占位符，且保留拒答规则', () => {
    const prompt = buildPrompt('default', 'mobile', '', null)
    expect(prompt).not.toContain('{{')
    expect(prompt).toContain('rejected')
    expect(prompt).toContain('客观')
  })

  it('Cloudflare 专用模板同样已同步（不再输出旧风格）', () => {
    const prompt = buildPrompt('default', 'desktop', '', 'cloudflare')
    expect(prompt).toContain('rejected')
    expect(prompt).not.toContain('{{')
    for (const oldPhrase of OLD_STYLE) {
      expect(prompt).not.toContain(oldPhrase)
    }
  })
})
