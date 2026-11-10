import { describe, it, expect } from 'vitest'
import { validateAiResult, detectModelRejection, REASON_CODES, COMPLIANCE_POLICY } from './index.js'
import {
  isUploadableFile,
  isSkippedFile
} from '@/features/upload-workspace/domain/upload-readiness.js'

const baseResult = (overrides = {}) => ({
  category: '风景',
  subcategory: '建筑',
  path: 'wallpaper/mobile/风景/建筑/示例.jpg',
  filename: '示例.jpg',
  displayTitle: '古建筑柔光特写',
  keywords: ['暖色调', '自然光'],
  description: '室内自然光下的历史建筑',
  reasoning: 'R1',
  ...overrides
})

const ENUM_REASON_CODES = Object.values(REASON_CODES)

describe('策略结构', () => {
  it('严格模式、版本号与防误伤词表就位', () => {
    expect(COMPLIANCE_POLICY.strictMode).toBe(true)
    expect(typeof COMPLIANCE_POLICY.version).toBe('string')
    for (const phrase of ['红色背景', '五角星构图', '历史建筑', '旗袍', '影视剧照', '制服风穿搭']) {
      expect(COMPLIANCE_POLICY.allowlist).toContain(phrase)
    }
    expect(COMPLIANCE_POLICY.blockedCategories).toContain('政治')
  })
})

describe('敏感内容拦截（各字段 + 编码形态）', () => {
  const cases = [
    ['displayTitle', '政治人物肖像壁纸'],
    ['description', '画面含国旗元素'],
    ['filename', '党旗主题.jpg'],
    ['path', 'wallpaper/mobile/风景/伟人/示例.jpg'],
    ['keywords', ['风景', '政党']],
    ['tags', ['国徽']],
    ['reasoning', '依据规则判定为政治宣传'],
    ['thumbnailPath', 'preview/党政标识.jpg'],
    ['title', '领导人肖像特写']
  ]

  for (const [field, value] of cases) {
    it(`${field} 含敏感词组 → 拒绝、不生成中性名、reasonCode 为枚举`, () => {
      const verdict = validateAiResult(baseResult({ [field]: value }))
      expect(verdict.rejected).toBe(true)
      expect(verdict.accepted).toBe(false)
      expect(verdict.sanitized).toBeNull()
      expect(ENUM_REASON_CODES).toContain(verdict.reasonCode)
    })
  }

  it('URL 编码（UTF-8 百分号编码，含大小写变体与双重编码）形态同样拒绝', () => {
    const encoded = encodeURIComponent('国旗')
    for (const value of [encoded, encoded.toLowerCase(), encodeURIComponent(encoded)]) {
      const verdict = validateAiResult(baseResult({ filename: `${value}.jpg` }))
      expect(verdict.rejected).toBe(true)
      expect(ENUM_REASON_CODES).toContain(verdict.reasonCode)
    }
  })

  it('Unicode 归一化：繁体与全角变体同样拒绝', () => {
    expect(validateAiResult(baseResult({ displayTitle: '畫面含國旗元素' })).rejected).toBe(true)
    expect(validateAiResult(baseResult({ displayTitle: '政治人物肖像' })).rejected).toBe(true)
  })

  it('分类名精确相等命中政治黑名单', () => {
    const verdict = validateAiResult(baseResult({ category: '政治' }))
    expect(verdict.rejected).toBe(true)
    expect(verdict.reasonCode).toBe(REASON_CODES.BLOCKED_CATEGORY)
  })
})

describe('模型拒答', () => {
  it('rejected:true 一律拒绝，不回显原始文本、不生成中性名', () => {
    const analysis = {
      rejected: true,
      reason_code: 'POLITICAL_CONTENT',
      raw: { result: { response: '{"rejected":true,"reason_code":"POLITICAL_CONTENT"}' } }
    }
    expect(detectModelRejection(analysis)).toBe(REASON_CODES.MODEL_REJECTED)
    const verdict = validateAiResult(analysis)
    expect(verdict.rejected).toBe(true)
    expect(verdict.reasonCode).toBe(REASON_CODES.MODEL_REJECTED)
    expect(verdict.sanitized).toBeNull()
  })

  it('provider 原始响应内嵌拒答 JSON 也能识别', () => {
    const analysis = {
      raw: {
        choices: [
          { message: { content: '{"rejected": true, "reason_code": "SENSITIVE_CONTENT"}' } }
        ]
      }
    }
    expect(detectModelRejection(analysis)).toBe(REASON_CODES.MODEL_REJECTED)
    expect(validateAiResult(analysis).rejected).toBe(true)
  })

  it('内部合规拒绝标记向下游传递为 MODEL_REJECTED', () => {
    expect(
      detectModelRejection({ complianceRejected: true, complianceReasonCode: 'SENSITIVE_CONTENT' })
    ).toBe(REASON_CODES.MODEL_REJECTED)
  })
})

describe('正常壁纸防误伤（全部放行）', () => {
  const safeCases = [
    { displayTitle: '红色背景静物构图' },
    { displayTitle: '五角星构图夜景' },
    { displayTitle: '星空星形装饰' },
    { description: '历史建筑与纪念馆外景' },
    { keywords: ['旗袍', '暖色调'] },
    { description: '影视剧照制服风穿搭' },
    { filename: '复古海报古建筑.jpg' },
    { keywords: ['旗帜', '旌旗'] },
    { displayTitle: '红色系暖色调街拍' }
  ]

  for (const overrides of safeCases) {
    it(`放行：${JSON.stringify(overrides)}`, () => {
      const verdict = validateAiResult(baseResult(overrides))
      expect(verdict.rejected).toBe(false)
      expect(verdict.accepted).toBe(true)
      expect(verdict.reasonCode).toBeNull()
    })
  }

  it('单独视觉元素放行，与明确标识词共现才命中', () => {
    expect(validateAiResult(baseResult({ displayTitle: '五角星红色背景' })).accepted).toBe(true)
    expect(validateAiResult(baseResult({ displayTitle: '五角星构图搭配国旗' })).rejected).toBe(true)
  })
})

describe('命名策略：中性化替换', () => {
  const neutralizeCases = [
    ['黑丝', '深色袜装'],
    ['白丝', '白色丝袜'],
    ['丝袜', '袜装'],
    ['美腿', '全身构图'],
    ['玉足', '足部特写'],
    ['纯欲', '清冷感']
  ]

  for (const [from, to] of neutralizeCases) {
    it(`${from} → ${to}`, () => {
      const verdict = validateAiResult(baseResult({ displayTitle: `${from}构图人像` }))
      expect(verdict.rejected).toBe(false)
      expect(verdict.sanitized.displayTitle).toBe(`${to}构图人像`)
    })
  }

  it('中性化后二次复检仍命中则拒绝（不生成中性名绕过）', () => {
    const verdict = validateAiResult(baseResult({ displayTitle: '黑丝构图 国旗元素' }))
    expect(verdict.rejected).toBe(true)
    expect(verdict.sanitized).toBeNull()
  })
})

describe('命名策略：绝对禁用（含变体）', () => {
  const denyVariants = [
    'JK制服',
    'jk',
    'ＪＫ',
    'J K',
    'J·K',
    'J-K',
    'j.k',
    '%4A%4B',
    '%4a%4b',
    '女子高中生',
    '高校生制服'
  ]

  for (const value of denyVariants) {
    it(`拒绝：${value}`, () => {
      const verdict = validateAiResult(baseResult({ displayTitle: `${value}人像` }))
      expect(verdict.rejected).toBe(true)
      expect(verdict.reasonCode).toBe(REASON_CODES.ABSOLUTE_DENY)
      expect(verdict.sanitized).toBeNull()
    })
  }

  it('未成年人主体 × 性化语境共现即拒（保守原则）', () => {
    const verdict = validateAiResult(baseResult({ description: '少年 黑丝 人像' }))
    expect(verdict.rejected).toBe(true)
    expect(verdict.reasonCode).toBe(REASON_CODES.ABSOLUTE_DENY)
  })

  it('allowlist 不能用于绕过绝对禁用', () => {
    const verdict = validateAiResult(baseResult({ displayTitle: 'JK制服风穿搭' }))
    expect(verdict.rejected).toBe(true)
    expect(verdict.reasonCode).toBe(REASON_CODES.ABSOLUTE_DENY)
  })
})

describe('字段清洗', () => {
  it('超长字段丢弃用安全默认值', () => {
    const verdict = validateAiResult(baseResult({ displayTitle: '景'.repeat(200) }))
    expect(verdict.accepted).toBe(true)
    expect(verdict.sanitized.displayTitle).toBe('')
  })

  it('非白名单字段（含 raw）不进入 sanitized', () => {
    const verdict = validateAiResult(baseResult({ raw: { foo: 'bar' }, customField: 'x' }))
    expect(verdict.sanitized.raw).toBeUndefined()
    expect(verdict.sanitized.customField).toBeUndefined()
  })

  it('ai 对象递归检测字符串值', () => {
    const verdict = validateAiResult(baseResult({ ai: { nested: { note: '国徽元素' } } }))
    expect(verdict.rejected).toBe(true)
  })
})

describe('上传就绪合规闸门', () => {
  it('complianceRejected:true 返回 false（含预选分类场景，不因 targetPath 放行）', () => {
    const rejected = {
      id: 'r1',
      status: 'pending',
      targetPath: 'wallpaper/mobile/风景/x.jpg',
      aiTaskId: 'ai_1',
      aiTaskStatus: 'completed',
      aiMetadata: { category: '风景' },
      complianceRejected: true
    }
    expect(isUploadableFile(rejected)).toBe(false)
    expect(isSkippedFile(rejected)).toBe(true)
  })

  it('未标记的文件仍按原有规则判定', () => {
    expect(
      isUploadableFile({
        status: 'pending',
        targetPath: 'wallpaper/mobile/风景/x.jpg',
        aiTaskId: 'ai_1',
        aiTaskStatus: 'completed',
        aiMetadata: { category: '风景' }
      })
    ).toBe(true)
  })
})

describe('挂点覆盖：人工编辑与 provider 兜底', () => {
  it('人工编辑后的 displayTitle 含禁用词 → 提交时被拒', () => {
    const edited = {
      series: 'mobile',
      category: '风景',
      subcategory: '建筑',
      filenames: ['示例.jpg'],
      displayTitle: '国旗主题清冷感',
      keywords: ['暖色调'],
      description: '室内自然光',
      reasoning: null
    }
    const verdict = validateAiResult(edited)
    expect(verdict.rejected).toBe(true)
    expect(ENUM_REASON_CODES).toContain(verdict.reasonCode)
  })

  it('人工编辑后的 filenams 含制服缩略语 → 提交时被拒', () => {
    const edited = baseResult({ filenames: ['JK制服街拍.jpg'] })
    expect(validateAiResult(edited).rejected).toBe(true)
  })

  it('provider 兜底生成的文件名也必须过校验', () => {
    const fallbackGenerated = {
      secondary: '通用',
      third: '通用',
      filenameSuggestions: ['党旗主题壁纸.jpg'],
      keywords: ['风景'],
      description: '无描述',
      displayTitle: null
    }
    const verdict = validateAiResult(fallbackGenerated)
    expect(verdict.rejected).toBe(true)
    expect(ENUM_REASON_CODES).toContain(verdict.reasonCode)
  })

  it('provider 兜底名字含中性化词时替换为客观规范词', () => {
    const fallbackGenerated = {
      secondary: '通用',
      third: '通用',
      filenameSuggestions: ['黑丝街拍壁纸.jpg'],
      description: '无描述'
    }
    const verdict = validateAiResult(fallbackGenerated)
    expect(verdict.rejected).toBe(false)
    expect(verdict.sanitized.filenameSuggestions).toContain('深色袜装街拍壁纸.jpg')
  })
})

describe('分类名黑名单覆盖全部文本字段（路径 / 文件名漏检回归）', () => {
  it('blockedCategoryPhrases 由 blockedCategories 派生且未扩词', () => {
    expect(COMPLIANCE_POLICY.blockedCategories).toEqual(['政治'])
    expect(COMPLIANCE_POLICY.blockedCategoryPhrases).toEqual(COMPLIANCE_POLICY.blockedCategories)
  })

  const encodedCategory = encodeURIComponent('政治')
  const encodedPath = `/wallpaper/mobile/${encodedCategory}/%E9%80%9A%E7%94%A8/a.jpg`
  const doubleEncodedPath = encodeURIComponent('/wallpaper/mobile/政治/通用/a.jpg')

  const fieldCases = [
    ['category', '政治', 'category 精确相等'],
    ['path', '/wallpaper/mobile/政治/通用/a.jpg', 'path 明文分段'],
    ['path', encodedPath, 'path URL 编码'],
    ['path', encodedPath.toLowerCase(), 'path URL 编码大小写变体'],
    ['path', doubleEncodedPath, 'path 双重编码'],
    ['filename', '政治主题.jpg', 'filename 明文'],
    ['filename', `${encodedCategory}.jpg`, 'filename URL 编码'],
    ['displayTitle', '政治题材构图', 'displayTitle'],
    ['keywords', ['风景', '政治'], 'keywords 数组'],
    ['tags', ['政治'], 'tags 数组'],
    ['description', '画面属于政治题材', 'description'],
    ['reasoning', '依据规则判定为政治', 'reasoning'],
    ['ai', { nested: { note: '政治分类' } }, 'ai 对象递归'],
    ['thumbnailPath', 'preview/政治/preview.jpg', 'thumbnailPath'],
    ['url', 'https://example.com/政治/a.jpg', 'url'],
    ['title', '政治主题', 'title']
  ]

  for (const [field, value, label] of fieldCases) {
    it(`${label} → rejected、reasonCode=BLOCKED_CATEGORY、sanitized=null`, () => {
      const verdict = validateAiResult(baseResult({ [field]: value }))
      expect(verdict.rejected).toBe(true)
      expect(verdict.accepted).toBe(false)
      expect(verdict.reasonCode).toBe(REASON_CODES.BLOCKED_CATEGORY)
      expect(verdict.sanitized).toBeNull()
    })
  }

  it('Unicode 归一化（全角 / 大小写）后分类名仍命中', () => {
    expect(validateAiResult(baseResult({ displayTitle: 'ＰＯＬＩＴＩＣＳ 政治' })).rejected).toBe(
      true
    )
    expect(
      validateAiResult(baseResult({ path: '/wallpaper/ＭＯＢＩＬＥ/政治/a.jpg' })).reasonCode
    ).toBe(REASON_CODES.BLOCKED_CATEGORY)
  })

  it('不按单字包含匹配，避免误伤含「政」「治」的普通词', () => {
    expect(validateAiResult(baseResult({ displayTitle: '行政与治理主题' })).rejected).toBe(false)
  })

  it('回归：原有全部误伤用例在新检测下仍全部放行', () => {
    const safeCases = [
      { displayTitle: '红色背景静物构图' },
      { displayTitle: '五角星构图夜景' },
      { displayTitle: '星空星形装饰' },
      { description: '历史建筑与纪念馆外景' },
      { keywords: ['旗袍', '暖色调'] },
      { description: '影视剧照制服风穿搭' },
      { filename: '复古海报古建筑.jpg' },
      { keywords: ['旗帜', '旌旗'] },
      { displayTitle: '红色系暖色调街拍' }
    ]
    for (const overrides of safeCases) {
      const verdict = validateAiResult(baseResult(overrides))
      expect(verdict.rejected).toBe(false)
      expect(verdict.accepted).toBe(true)
    }
  })
})
