/**
 * 分类服务专用提示词
 * 独立于 AI 助手的提示词配置
 *
 * 合规改造：8 套模板共用同一套「客观视觉特征命名 + 拒答规则 + 字段白名单」，
 * 由 buildSeriesTemplate 统一生成，避免任一 provider 漏改后继续产出旧风格。
 */

import { CATEGORIES } from '@/config/categories'
import { getThirdLevelCategories } from '@/config/subcategories'
import {
  getUploadCategoryTree,
  getFallbackUploadCategoryTree
} from '@/services/upload/category-directory'

// ---- 共享合规规则（8 套模板复用，单一事实来源） ----

const ALLOWED_OBJECTIVE_KEYWORDS =
  '长发、短发、卷发、直发、马尾、盘发、连衣裙、衬衫、针织衫、西装、汉服、旗袍、' +
  '运动装、外套、短裙、及膝裙装、吊带上衣、吊带连衣裙、瑜伽裤、运动紧身裤、' +
  '全身构图、半身、特写、背影、侧颜、居中构图、留白、室内、街拍、自然光、' +
  '冷色调、暖色调、高对比、低饱和、逆光、夜景、柔光、黑白'

const CLASSIFICATION_RULES = `## 分类判定（只依据画面内容类型与风格）
R1 人像：依据构图（全身 / 半身 / 特写 / 背影 / 侧颜）与画面类型归类，不依据人物身体特征或服饰偏好。
R2 动漫与插画：依据绘画 / 动画风格归类；可识别的已知 IP 形象归入对应子类。
R3 风景：依据具体场景（雪山 / 城市 / 星空 / 海滨 / 湖泊 / 日落）归类。
R4 通用：仅在无法明确归类时使用。
分类判定不得依据人物身体特征、服饰偏好或特定人物身份。`

const NAMING_RULES = `## 命名规则（客观视觉特征，合规优先）
- 标题 (displayTitle) 与文件名 (filenames) 使用同一套规则：命名 = 主体 + 服饰品类/配色 + 发型 + 构图/场景 + 光影 的客观组合。
- 8-15 个汉字；只使用画面中可验证的信息。
- 禁止情绪、意境、想象、评价性形容词，以及任何含蓄化、诗意化的表达。
- description 只陈述画面中可见的元素（服饰、配色、构图、光影、场景），不评价、不联想。
- keywords 只允许以下受控客观词，3-5 个：${ALLOWED_OBJECTIVE_KEYWORDS}。
- 丝袜、袜装等词仅作服饰描述，不得作为任何分类判定触发器。
- 硬红线：任何涉及未成年人的性化描述一律拒绝；不提供同义词、谐音、缩写、拆字、拼音、编码变体或暗语等任何替代写法；画面主体年龄无法明确确认为成人时按保守原则拒答。
- 绝对禁用：制服类身份/年龄缩略语、露骨或身体性化描写、低俗诱导词、人身物化表述，以及用于规避上述任一条的变体形态。命中即拒，不生成任何替代命名。`

const REJECTION_RULES = `## 拒答规则（优先于一切）
画面含以下任一情形时，直接且仅输出：
{"rejected": true, "reason_code": "枚举值"}
不生成任何其它元数据字段，不做任何描述或命名。
- 政治人物、政党或党政标识、国家象征性标识、特定公众人物肖像 → POLITICAL_CONTENT
- 主体年龄无法明确确认为成人，或涉及未成年人 → MINOR_OR_UNCERTAIN_AGE
- 其它敏感内容 → SENSITIVE_CONTENT
reason_code 只取枚举值：POLITICAL_CONTENT / MINOR_OR_UNCERTAIN_AGE / SENSITIVE_CONTENT / PUBLIC_FIGURE / ABSOLUTE_DENY。`

const OUTPUT_SCHEMA = `## 输出格式（纯 JSON，不含 Markdown 标记）
只允许以下字段，禁止输出任何其它字段：
{
  "secondary": "从现有列表中选择，≤40 字符",
  "third": "从现有列表中选择，≤40 字符",
  "is_perfect_match": true 或 false,
  "new_category_proposal": { "suggested_secondary": "客观风格或已知 IP，否则 null", "suggested_third": "客观风格或已知 IP，否则 null", "reason": "≤60 字符，只陈述客观依据" } 或 null,
  "displayTitle": "客观视觉特征组合，8-15 汉字，≤30 字符",
  "filenames": ["客观视觉特征组合.jpg", "客观视觉特征组合.jpg"]，2 个，每个 ≤120 字符,
  "keywords": ["受控客观词"]，3-5 个，每个 ≤20 字符,
  "description": "只陈述可见元素，≤200 字符",
  "reasoning": "只引用规则编号（如 R1 / R2 / R3 / R4），禁止自由描述人物特征，≤160 字符"
}
new_category_proposal 只允许客观风格或已知 IP，移除人物身份类提案。`

const FILENAME_ONLY_SCHEMA = `## 输出格式（纯 JSON，不含 Markdown 标记）
只允许以下字段：
{
  "displayTitle": "客观视觉特征组合，8-15 汉字，≤30 字符",
  "filenames": ["客观视觉特征组合.jpg", "客观视觉特征组合.jpg"]，2 个，每个 ≤120 字符,
  "keywords": ["受控客观词"]，3-5 个，每个 ≤20 字符,
  "description": "只陈述可见元素，≤200 字符"
}`

/** 生成系列模板：6 套 SERIES_TEMPLATES 复用同一套规则，避免漏改。 */
function buildSeriesTemplate(seriesLabel) {
  return `你是壁纸分类助手。请按客观视觉特征分析这张${seriesLabel}，完成分类归档与元数据生成。

## 现有分类体系
主分类：{{primaryCategory}}
二级分类：{{secondaryList}}
三级分类：
{{thirdHints}}

${CLASSIFICATION_RULES}

${NAMING_RULES}

${REJECTION_RULES}

${OUTPUT_SCHEMA}`
}

/**
 * 提示词模板配置
 */
export const PROMPT_TEMPLATES = {
  default: {
    id: 'default',
    name: '分类 + 文件名',
    description: '同时生成分类和文件名建议',
    builtin: true,
    variables: ['primaryCategory', 'secondaryList', 'thirdHints'],
    template: `分析这张图片，按客观视觉特征完成分类与元数据生成，返回纯 JSON。

主分类：{{primaryCategory}}
可选的二级分类：{{secondaryList}}
三级分类选项：
{{thirdHints}}

${CLASSIFICATION_RULES}

${NAMING_RULES}

${REJECTION_RULES}

${OUTPUT_SCHEMA}`
  },

  filenameOnly: {
    id: 'filenameOnly',
    name: '仅文件名',
    description: '只生成文件名建议，不分类',
    builtin: true,
    variables: [],
    template: `分析这张图片，按客观视觉特征生成文件名与关键词，返回纯 JSON。

${NAMING_RULES}

${REJECTION_RULES}

${FILENAME_ONLY_SCHEMA}`
  },

  custom: {
    id: 'custom',
    name: '自定义',
    description: '使用自定义提示词',
    builtin: false,
    variables: [],
    template: ''
  }
}

/**
 * 系列专用提示词模板
 * 6 套模板统一由 buildSeriesTemplate 生成，确保任一 provider 都不会漏掉
 * 客观命名规则、拒答规则与字段白名单。
 */
export const SERIES_TEMPLATES = {
  cloudflare_desktop: buildSeriesTemplate('桌面壁纸'),
  desktop: buildSeriesTemplate('桌面壁纸'),
  cloudflare_mobile: buildSeriesTemplate('手机壁纸'),
  mobile: buildSeriesTemplate('手机壁纸'),
  cloudflare_avatar: buildSeriesTemplate('头像图片'),
  avatar: buildSeriesTemplate('头像图片')
}

/**
 * 替换模板中的变量
 * @param {string} template - 模板字符串
 * @param {Object} variables - 变量对象
 * @returns {string} 替换后的字符串
 */
export function replaceVariables(template, variables) {
  let result = template

  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    result = result.replace(regex, value)
  })

  return result
}

/**
 * 构建变量
 * @param {string} primaryCategory - 主分类
 * @returns {Object} 变量对象
 */
export function buildVariables(primaryCategory, categoryTree = null) {
  const dynamicSeries = categoryTree?.[primaryCategory]
  const useDynamicTree = !!dynamicSeries
  const secondaryCategories = useDynamicTree
    ? (dynamicSeries.secondary || []).map(value => ({ value }))
    : CATEGORIES[primaryCategory]?.subcategories || []
  const secondaryList = secondaryCategories.map(cat => cat.value).join('、')

  let thirdHints = ''
  secondaryCategories.forEach(cat => {
    const thirdList = useDynamicTree
      ? dynamicSeries.third?.[cat.value] || []
      : getThirdLevelCategories(primaryCategory, cat.value)
    thirdHints += `• ${cat.value}：${thirdList.join('、')}\n`
  })

  return {
    primaryCategory,
    secondaryList,
    thirdHints: thirdHints.trim()
  }
}

/**
 * 构建分类提示词
 * @param {string} templateId - 模板 ID
 * @param {string} primaryCategory - 主分类（系列名）
 * @param {string} customPrompt - 自定义提示词（可选）
 * @param {string} provider - AI Provider（可选，用于选择专用模板）
 * @returns {string} 构建的提示词
 */
export function buildPrompt(
  templateId,
  primaryCategory,
  customPrompt = '',
  provider = null,
  categoryTree = null
) {
  if (templateId === 'custom') {
    return customPrompt
  }

  // 对于 default 模板，使用系列专用模板
  if (templateId === 'default') {
    // 如果是 Cloudflare，优先使用 Cloudflare 专用模板
    if (provider === 'cloudflare') {
      const cloudflareTemplate = SERIES_TEMPLATES[`cloudflare_${primaryCategory}`]
      if (cloudflareTemplate) {
        const variables = buildVariables(primaryCategory, categoryTree)
        return replaceVariables(cloudflareTemplate, variables)
      }
    }

    // 使用标准系列模板
    const specialTemplate = SERIES_TEMPLATES[primaryCategory]
    if (specialTemplate) {
      const variables = buildVariables(primaryCategory, categoryTree)
      return replaceVariables(specialTemplate, variables)
    }
  }

  // 使用通用模板
  const template = PROMPT_TEMPLATES[templateId]
  if (!template) {
    throw new Error(`未找到模板: ${templateId}`)
  }

  if (!template.variables || template.variables.length === 0) {
    return template.template
  }

  const variables = buildVariables(primaryCategory, categoryTree)
  return replaceVariables(template.template, variables)
}

export async function buildPromptWithLatestCategories(
  templateId,
  primaryCategory,
  customPrompt = '',
  provider = null,
  options = {}
) {
  let categoryTree = null
  try {
    categoryTree = await getUploadCategoryTree(options)
  } catch (error) {
    console.error('[Prompts] 获取分类树失败，使用本地回退:', error.message)
    categoryTree = getFallbackUploadCategoryTree()
  }
  return buildPrompt(templateId, primaryCategory, customPrompt, provider, categoryTree)
}

/**
 * 验证提示词
 * @param {string} prompt - 提示词
 * @returns {boolean} 是否有效
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return false
  }

  if (prompt.trim().length < 10) {
    return false
  }

  return true
}

/**
 * 获取模板列表
 * @returns {Array} 模板列表
 */
export function getTemplateList() {
  return Object.values(PROMPT_TEMPLATES)
}

/**
 * 根据 ID 获取模板
 * @param {string} templateId - 模板 ID
 * @returns {Object|null} 模板对象
 */
export function getTemplateById(templateId) {
  return PROMPT_TEMPLATES[templateId] || null
}

/**
 * 预览提示词
 * @param {string} templateId - 模板 ID
 * @param {string} primaryCategory - 主分类
 * @param {string} customPrompt - 自定义提示词
 * @returns {Object} 预览结果
 */
export function previewPrompt(templateId, primaryCategory, customPrompt = '') {
  try {
    const prompt = buildPrompt(templateId, primaryCategory, customPrompt)
    const isValid = validatePrompt(prompt)

    return {
      success: true,
      prompt,
      isValid,
      length: prompt.length,
      lines: prompt.split('\n').length
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      prompt: '',
      isValid: false,
      length: 0,
      lines: 0
    }
  }
}
