/**
 * 统一合规策略（纯数据，零副作用）。
 *
 * 设计边界：
 * - 敏感词一律使用「完整词组」匹配，禁止单字包含匹配。
 * - 单独的星形 / 红色 / 旗帜等视觉元素不构成命中；只有与明确人物、组织或
 *   标识词组共现时才命中（见 combinationalRules）。
 * - 命中绝对禁用类别（任务 2 硬红线）一律拒绝，且不提供任何替代命名或
 *   人工放行默认通道。
 * - allowlist 为防误伤放行词，检测时先从文本中剥离放行语境，再判定剩余内容。
 *
 * 注释与词表均保持中性克制，不收录露骨或性化表述。
 */

export const REASON_CODES = Object.freeze({
  SENSITIVE_CONTENT: 'SENSITIVE_CONTENT',
  ABSOLUTE_DENY: 'ABSOLUTE_DENY',
  MODEL_REJECTED: 'MODEL_REJECTED',
  BLOCKED_CATEGORY: 'BLOCKED_CATEGORY'
})

/** 模型拒答 reason_code 白名单（只接受枚举值，不回显原始文本）。 */
export const MODEL_REASON_CODES = Object.freeze([
  'SENSITIVE_CONTENT',
  'ABSOLUTE_DENY',
  'POLITICAL_CONTENT',
  'MINOR_OR_UNCERTAIN_AGE',
  'PUBLIC_FIGURE'
])

/**
 * 常见繁简映射（覆盖本词表用字）。与 NFKC 归一化配合，
 * 用于识别繁体、全角等变体写法。
 */
export const TRADITIONAL_TO_SIMPLIFIED = Object.freeze({
  國: '国',
  黨: '党',
  標: '标',
  識: '识',
  幟: '帜',
  領: '领',
  導: '导',
  偉: '伟',
  紅: '红',
  復: '复',
  複: '复',
  報: '报',
  歷: '历',
  曆: '历',
  築: '筑',
  紀: '纪',
  館: '馆',
  視: '视',
  劇: '剧',
  風: '风',
  絲: '丝',
  襪: '袜',
  純: '纯',
  慾: '欲',
  裝: '装',
  兒: '儿',
  學: '学',
  戀: '恋',
  誘: '诱',
  嫵: '妩',
  邊: '边',
  豐: '丰',
  滿: '满',
  線: '线',
  緊: '紧',
  機: '机',
  關: '关',
  軍: '军',
  產: '产',
  總: '总',
  統: '统',
  議: '议',
  會: '会',
  選: '选',
  舉: '举',
  傳: '传',
  語: '语',
  團: '团',
  畫: '画',
  徵: '征'
})

export const COMPLIANCE_POLICY = Object.freeze({
  version: '1.0.0',
  strictMode: true,

  /** 分类名精确相等（沿用现有「政治」黑名单，不扩词）。 */
  blockedCategories: ['政治'],

  /**
   * 敏感完整词组：政治人物 / 政党 / 国家象征性标识 / 党政标识等类别。
   * 只用完整词组匹配，禁止单字包含匹配。
   */
  blockedPhrases: [
    // 政治人物与特定公众人物肖像
    '政治人物',
    '国家领导人',
    '领导人肖像',
    '领导人画像',
    '政治领袖',
    '伟人',
    '伟人肖像',
    '伟人画像',
    '主席画像',
    '总统肖像',
    '元首肖像',
    '公众人物肖像',
    // 政党与党政标识
    '政党',
    '政党标志',
    '政党党旗',
    '党旗',
    '党徽',
    '党政标识',
    '党政机关',
    '政府标识',
    '政府徽章',
    // 国家象征性标识
    '国旗',
    '国徽',
    '国家象征',
    '国玺',
    // 政治活动与宣传标识
    '政治集会',
    '政治宣传',
    '政治标语',
    '竞选海报'
  ],

  /** 需检测的文本字段（数组逐元素、ai 对象递归）。 */
  blockedTextFields: [
    'category',
    'subcategory',
    'path',
    'filename',
    'displayTitle',
    'title',
    'keywords',
    'tags',
    'description',
    'reasoning',
    'ai',
    'thumbnailPath',
    'previewPath',
    'url'
  ],

  /** 实际数据里与 filename 同义的字段，同样纳入检测。 */
  aliasTextFields: [
    'filenames',
    'filenameSuggestions',
    'secondary',
    'third',
    'series',
    'display_title',
    'targetPath',
    'relativePath',
    'name'
  ],

  /**
   * 命名中性化替换：仅作客观服饰 / 构图描述，
   * 不得作为任何分类判定触发器。按长词优先顺序排列。
   */
  neutralizeMap: {
    黑丝: '深色袜装',
    白丝: '白色丝袜',
    丝袜: '袜装',
    美腿: '全身构图',
    玉足: '足部特写',
    纯欲: '清冷感'
  },

  /**
   * 绝对禁用：命中即拒，不生成中性名、不重试、不降级。
   * 制服类身份/年龄缩略语（含 JK 及大小写、全角、拆字、编码变体）由
   * IDENTITY_ABBREVIATION_PATTERN 统一识别；其余为类别化禁用词。
   */
  absoluteDeny: [
    'jk',
    'jk制服',
    '女子高中生',
    '高校生制服',
    '擦边',
    '福利图',
    '低俗',
    '物化',
    '身材曲线',
    '性感',
    '诱惑',
    '撩人',
    '挑逗',
    '火辣'
  ],

  /** 身份/年龄缩略语变体（大小写、全角、拆字由归一化 + 本正则覆盖）。 */
  identityAbbreviationPattern: '(?:^|[^a-z0-9])j[\\s·.\\-_]*k(?=$|[^a-z0-9])',

  /**
   * 未成年人主体 × 性化语境：共现即拒（保守原则的文本层兜底）。
   * 图像层「主体年龄无法明确确认为成人」由 prompt 拒答规则负责。
   */
  minorSexualizationRules: [
    {
      subjectTerms: [
        '未成年',
        '幼女',
        '儿童',
        '小学生',
        '初中生',
        '高中生',
        '少年',
        '少女',
        '幼态'
      ],
      contextTerms: [
        '性感',
        '诱惑',
        '撩人',
        '挑逗',
        '火辣',
        '擦边',
        '身材',
        '曲线',
        '暴露',
        '丝袜',
        '黑丝',
        '白丝',
        '美腿',
        '玉足',
        '纯欲'
      ]
    }
  ],

  /** 防误伤放行词：检测时先剥离这些客观视觉 / 场景语境，再判定剩余内容。 */
  allowlist: [
    '红色背景',
    '红色系',
    '暖色调',
    '五角星构图',
    '星空',
    '星形装饰',
    '历史建筑',
    '纪念馆',
    '古建筑',
    '复古海报',
    '旗袍',
    '旗帜',
    '旌旗',
    '影视剧照',
    '制服风穿搭'
  ],

  /** 元素词单独出现不命中；仅与明确标识词组共现时命中。 */
  combinationalRules: [
    {
      id: 'ELEMENT_WITH_MARKER',
      elementPhrases: ['五角星', '星形', '红色', '旗帜', '旌旗', '星空', '红底'],
      markerPhrases: [
        '政治人物',
        '政党',
        '党旗',
        '党徽',
        '国徽',
        '国旗',
        '党政',
        '国家象征',
        '政府标识',
        '伟人',
        '政治领袖',
        '公众人物肖像'
      ],
      reasonCode: REASON_CODES.SENSITIVE_CONTENT
    }
  ],

  /** 输出字段白名单（非白名单字段丢弃，用安全默认值替代）。 */
  fieldWhitelist: [
    'category',
    'subcategory',
    'path',
    'filename',
    'filenames',
    'filenameSuggestions',
    'displayTitle',
    'title',
    'keywords',
    'tags',
    'description',
    'reasoning',
    'ai',
    'thumbnailPath',
    'previewPath',
    'url',
    'secondary',
    'third',
    'series',
    'primary',
    'targetPath',
    'relativePath',
    'new_category_proposal',
    'is_perfect_match',
    'confidence'
  ],

  /** 每字段值域 / 最大长度；超长即丢弃该字段用安全默认值。 */
  fieldLimits: {
    displayTitle: 30,
    title: 30,
    description: 200,
    reasoning: 160,
    category: 40,
    subcategory: 40,
    secondary: 40,
    third: 40,
    path: 300,
    filename: 120,
    filenames: 120,
    filenameSuggestions: 120,
    thumbnailPath: 300,
    previewPath: 300,
    url: 300,
    targetPath: 300,
    relativePath: 300,
    keywords: 20,
    tags: 20,
    maxArrayItems: 8
  }
})
