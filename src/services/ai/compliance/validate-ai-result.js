/**
 * 统一合规校验（纯函数，零副作用）。
 *
 * validateAiResult(raw) 是所有 AI 结果、人工编辑结果、上传前最终值的共用判定入口：
 * - 命中绝对禁用 / 敏感词组 / 模型拒答 → rejected，只返回枚举 reasonCode，
 *   不回显原始文本、不生成中性名、不重试、不降级。
 * - 命中中性化映射 → 替换为客观规范词后复检，二次仍命中则拒绝。
 * - 字段格式异常（超长 / 非白名单字段）→ 丢弃该字段，用安全默认值。
 */

import {
  COMPLIANCE_POLICY,
  REASON_CODES,
  MODEL_REASON_CODES,
  TRADITIONAL_TO_SIMPLIFIED
} from './policy.js'

const POLICY = COMPLIANCE_POLICY
const IDENTITY_PATTERN = new RegExp(POLICY.identityAbbreviationPattern, 'i')

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 一次性替换（避免「白丝→白色丝袜」被后续「丝袜→袜装」二次改写）。 */
const NEUTRALIZE_PATTERN = new RegExp(
  Object.keys(POLICY.neutralizeMap)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|'),
  'g'
)

function toSimplified(text) {
  return text.replace(/[\u3400-\u9fff]/g, char => TRADITIONAL_TO_SIMPLIFIED[char] || char)
}

/** Unicode 归一化：全角/半角（NFKC）+ 繁简 + 大小写。 */
function normalize(text) {
  return toSimplified(String(text).normalize('NFKC')).toLowerCase()
}

function safeDecode(text) {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** 生成「明文 + URL 编码（含大小写、多重编码）」的归一化变体集合。 */
function expandVariants(text) {
  const variants = []
  let current = text
  for (let depth = 0; depth < 3; depth++) {
    for (const candidate of [normalize(current), normalize(safeDecode(current))]) {
      if (candidate && !variants.includes(candidate)) variants.push(candidate)
    }
    const decoded = safeDecode(current)
    if (decoded === current) break
    current = decoded
  }
  return variants
}

function neutralizeText(text) {
  return String(text).replace(NEUTRALIZE_PATTERN, match => POLICY.neutralizeMap[match])
}

const NORMALIZED = {
  blockedPhrases: POLICY.blockedPhrases.map(normalize),
  blockedCategories: POLICY.blockedCategories.map(normalize),
  absoluteDeny: POLICY.absoluteDeny.map(normalize),
  allowlist: POLICY.allowlist.map(normalize),
  combinationalRules: POLICY.combinationalRules.map(rule => ({
    ...rule,
    elementPhrases: rule.elementPhrases.map(normalize),
    markerPhrases: rule.markerPhrases.map(normalize)
  })),
  minorRules: POLICY.minorSexualizationRules.map(rule => ({
    subjectTerms: rule.subjectTerms.map(normalize),
    contextTerms: rule.contextTerms.map(normalize)
  }))
}

/** allowlist 命中优先：先剥离放行语境，再判定剩余内容。 */
function stripAllowlist(text) {
  let stripped = text
  for (const phrase of NORMALIZED.allowlist) {
    if (phrase) stripped = stripped.split(phrase).join('')
  }
  return stripped
}

/** 对单个归一化字符串做硬规则检测，返回 reasonCode 或 null。 */
function detectNormalized(text) {
  // 1) absoluteDeny：独立检测，不受 allowlist 影响，不提供规避路径
  if (IDENTITY_PATTERN.test(text)) return REASON_CODES.ABSOLUTE_DENY
  for (const phrase of NORMALIZED.absoluteDeny) {
    if (phrase && text.includes(phrase)) return REASON_CODES.ABSOLUTE_DENY
  }
  for (const rule of NORMALIZED.minorRules) {
    const hasSubject = rule.subjectTerms.some(term => text.includes(term))
    const hasContext = rule.contextTerms.some(term => text.includes(term))
    if (hasSubject && hasContext) return REASON_CODES.ABSOLUTE_DENY
  }

  // 2) 敏感完整词组：先剥离 allowlist，单独视觉元素不构成命中
  const stripped = stripAllowlist(text)
  for (const phrase of NORMALIZED.blockedPhrases) {
    if (phrase && stripped.includes(phrase)) return REASON_CODES.SENSITIVE_CONTENT
  }

  // 3) 组合规则：元素词与明确标识词组共现才命中
  for (const rule of NORMALIZED.combinationalRules) {
    const hasElement = rule.elementPhrases.some(term => text.includes(term))
    const hasMarker = rule.markerPhrases.some(term => text.includes(term))
    if (hasElement && hasMarker) {
      return rule.reasonCode || REASON_CODES.SENSITIVE_CONTENT
    }
  }
  return null
}

function collectObjectStrings(obj, out, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      out.push(value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') out.push(item)
        else if (item && typeof item === 'object') collectObjectStrings(item, out, depth + 1)
      }
    } else if (value && typeof value === 'object') {
      collectObjectStrings(value, out, depth + 1)
    }
  }
}

/** 收集所有待检测字符串：数组逐元素、ai 等对象递归。 */
function collectStrings(raw) {
  const strings = []
  const fields = [...POLICY.blockedTextFields, ...POLICY.aliasTextFields]
  for (const field of fields) {
    if (!(field in raw)) continue
    const value = raw[field]
    if (typeof value === 'string') {
      strings.push(value)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') strings.push(item)
        else if (item && typeof item === 'object') collectObjectStrings(item, strings, 1)
      }
    } else if (value && typeof value === 'object') {
      collectObjectStrings(value, strings, 1)
    }
  }
  return strings
}

/** 分类名精确相等命中黑名单。 */
function detectBlockedCategory(raw) {
  for (const field of ['category', 'subcategory', 'secondary', 'third']) {
    const value = raw[field]
    if (
      typeof value === 'string' &&
      NORMALIZED.blockedCategories.includes(normalize(value.trim()))
    ) {
      return true
    }
  }
  return false
}

/**
 * 从 provider 结果 / 原始响应探测模型拒答信号。
 * 只返回枚举 reasonCode，绝不回显原始文本。
 */
export function detectModelRejection(analysis) {
  if (!analysis || typeof analysis !== 'object') return null

  const reasonCode = analysis.reason_code || analysis.complianceReasonCode
  const knownReason =
    typeof reasonCode === 'string' &&
    (MODEL_REASON_CODES.includes(reasonCode.trim().toUpperCase()) ||
      Object.values(REASON_CODES).includes(reasonCode.trim().toUpperCase()))

  if (analysis.rejected === true || analysis.complianceRejected === true || knownReason) {
    return REASON_CODES.MODEL_REJECTED
  }

  const rawStrings = []
  if (analysis.raw && typeof analysis.raw === 'object') {
    collectObjectStrings(analysis.raw, rawStrings)
  }
  for (const text of rawStrings) {
    if (/"rejected"\s*:\s*true/i.test(text)) return REASON_CODES.MODEL_REJECTED
  }
  return null
}

function sanitizeObject(obj, depth = 0) {
  const out = {}
  if (depth > 6 || !obj || typeof obj !== 'object') return out
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') out[key] = neutralizeText(value)
    else if (Array.isArray(value)) {
      out[key] = value.map(item => (typeof item === 'string' ? neutralizeText(item) : item))
    } else if (value && typeof value === 'object') out[key] = sanitizeObject(value, depth + 1)
    else out[key] = value
  }
  return out
}

/** 字段清洗：白名单 + 值域/长度校验 + 中性化，非白名单字段丢弃。 */
function sanitizeFields(raw) {
  const out = {}
  const limits = POLICY.fieldLimits
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'raw' || !POLICY.fieldWhitelist.includes(key)) continue

    if (typeof value === 'string') {
      const cleaned = neutralizeText(value)
      out[key] = cleaned.length <= (limits[key] || limits.description) ? cleaned : ''
    } else if (Array.isArray(value)) {
      const limit = limits[key] || limits.description
      out[key] = value
        .filter(item => typeof item === 'string')
        .slice(0, limits.maxArrayItems)
        .map(neutralizeText)
        .filter(item => item.length <= limit)
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeObject(value)
    } else {
      out[key] = value
    }
  }
  return out
}

function scanStrings(strings) {
  for (const text of strings) {
    if (typeof text !== 'string' || text.length === 0) continue
    for (const variant of expandVariants(text)) {
      const reasonCode = detectNormalized(variant)
      if (reasonCode) return reasonCode
    }
  }
  return null
}

/**
 * 统一校验入口。
 * @returns {{accepted:boolean, rejected:boolean, reasonCode:string|null, sanitized:object|null}}
 */
export function validateAiResult(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}

  // 1) 模型拒答（最高优先级：不回显原始文本、不生成中性名）
  const modelRejection = detectModelRejection(source)
  if (modelRejection) {
    return { accepted: false, rejected: true, reasonCode: modelRejection, sanitized: null }
  }

  // 2) 分类名精确相等
  if (detectBlockedCategory(source)) {
    return {
      accepted: false,
      rejected: true,
      reasonCode: REASON_CODES.BLOCKED_CATEGORY,
      sanitized: null
    }
  }

  // 3) 所有文本字段（明文 + 编码 + 归一化变体）
  const firstHit = scanStrings(collectStrings(source))
  if (firstHit) {
    return { accepted: false, rejected: true, reasonCode: firstHit, sanitized: null }
  }

  // 4) 中性化替换 + 字段清洗 → 二次复检，仍命中则拒绝
  const sanitized = sanitizeFields(source)
  const secondHit = scanStrings(collectStrings(sanitized))
  if (secondHit) {
    return { accepted: false, rejected: true, reasonCode: secondHit, sanitized: null }
  }

  return { accepted: true, rejected: false, reasonCode: null, sanitized }
}
