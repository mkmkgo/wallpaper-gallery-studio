/**
 * 合规模块统一出口。
 * 所有 AI 结果、人工编辑结果、上传前最终值共用同一套判定，避免逻辑漂移。
 */

export {
  COMPLIANCE_POLICY,
  REASON_CODES,
  MODEL_REASON_CODES,
  TRADITIONAL_TO_SIMPLIFIED
} from './policy.js'

export { validateAiResult, detectModelRejection } from './validate-ai-result.js'
