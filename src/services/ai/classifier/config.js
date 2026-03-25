/**
 * 分类服务配置
 * 独立于 AI 助手的配置
 */

import { AI_PROVIDERS } from '../core'

/**
 * 分类服务的模型配置
 */
export const CLASSIFIER_MODELS = {
  // ModelScope AI 模型（默认推荐，精确分类优先）
  'modelscope-qwen3-vl-235b': {
    id: 'Qwen/Qwen3-VL-235B-A22B-Instruct',
    name: 'Qwen3 VL 235B',
    provider: AI_PROVIDERS.MODELSCOPE,
    description: 'Qwen3 最强视觉模型，分析能力最强',
    speed: 'medium',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.2,
    recommended: true
  },

  'modelscope-qwen3-vl-8b-thinking': {
    id: 'Qwen/Qwen3-VL-8B-Thinking',
    name: 'Qwen3 VL 8B Thinking',
    provider: AI_PROVIDERS.MODELSCOPE,
    description: 'Qwen3 推理模型，深度思考分析',
    speed: 'medium',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.2,
    recommended: false
  },

  'modelscope-internvl3-241b': {
    id: 'OpenGVLab/InternVL3_5-241B-A28B',
    name: 'InternVL3.5 241B',
    provider: AI_PROVIDERS.MODELSCOPE,
    description: 'InternVL3.5 视觉模型，备选方案',
    speed: 'medium',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.2,
    recommended: false
  },

  'modelscope-qvq-72b': {
    id: 'Qwen/QVQ-72B-Preview',
    name: 'QVQ 72B Preview',
    provider: AI_PROVIDERS.MODELSCOPE,
    description: 'QVQ 视觉问答模型，72B 参数',
    speed: 'medium',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.2,
    recommended: false
  },

  'modelscope-qwen3-vl-8b': {
    id: 'Qwen/Qwen3-VL-8B-Instruct',
    name: 'Qwen3 VL 8B',
    provider: AI_PROVIDERS.MODELSCOPE,
    description: 'Qwen3 视觉模型，速度快，分类准确',
    speed: 'fast',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.2,
    recommended: false
  },

  // Groq AI 模型
  'groq-llama-4-scout': {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout Vision',
    provider: AI_PROVIDERS.GROQ,
    description: 'Groq 最新视觉模型，速度极快，准确度高',
    speed: 'fast',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 1024,
    temperature: 1,
    recommended: false
  },

  'groq-llama-4-maverick': {
    id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    name: 'Llama 4 Maverick Vision',
    provider: AI_PROVIDERS.GROQ,
    description: 'Groq 超长上下文模型（128K），分析更深入',
    speed: 'fast',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 2048,
    temperature: 1,
    recommended: false
  },

  // Cloudflare Workers AI
  'cloudflare-llama-3.2': {
    id: '@cf/meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 11B Vision (CF)',
    provider: AI_PROVIDERS.CLOUDFLARE,
    description: 'Cloudflare 托管的 Llama 3.2 视觉模型',
    speed: 'medium',
    accuracy: 'high',
    cost: 'low',
    maxTokens: 10000,
    temperature: 0.3,
    recommended: false
  },

  'cloudflare-llava-1.5': {
    id: '@cf/llava-hf/llava-1.5-7b-hf',
    name: 'LLaVA 1.5 7B (CF)',
    provider: AI_PROVIDERS.CLOUDFLARE,
    description: 'Cloudflare 托管的 LLaVA 视觉模型',
    speed: 'medium',
    accuracy: 'medium',
    cost: 'low',
    maxTokens: 2048,
    temperature: 0.3,
    recommended: false
  }
}

/**
 * 分类服务默认配置
 */
export const CLASSIFIER_CONFIG = {
  // 默认 Provider
  defaultProvider: AI_PROVIDERS.MODELSCOPE,

  // 默认模型
  defaultModel: 'modelscope-qwen3-vl-235b',

  // 默认提示词模板
  defaultPromptTemplate: 'default',

  // 图片处理配置
  image: {
    maxSize: 1024,
    quality: 0.9,
    format: 'image/jpeg'
  }
}

/**
 * AI 助手默认配置（与分类服务共享模型列表）
 */
export const ASSISTANT_CONFIG = {
  defaultProvider: AI_PROVIDERS.MODELSCOPE,
  defaultModel: 'modelscope-qwen3-vl-235b',
  defaultSystemPrompt: 'default',
  conversation: {
    maxHistory: 20
  }
}

/**
 * 速度等级映射
 */
export const SPEED_LEVELS = {
  fast: { label: '快', value: 3, color: '#67c23a' },
  medium: { label: '中等', value: 2, color: '#e6a23c' },
  slow: { label: '慢', value: 1, color: '#f56c6c' }
}

/**
 * 准确度等级映射
 */
export const ACCURACY_LEVELS = {
  high: { label: '高', value: 3, color: '#67c23a' },
  medium: { label: '中等', value: 2, color: '#e6a23c' },
  low: { label: '低', value: 1, color: '#f56c6c' }
}

/**
 * 成本等级映射
 */
export const COST_LEVELS = {
  low: { label: '低', value: 1, color: '#67c23a' },
  medium: { label: '中等', value: 2, color: '#e6a23c' },
  high: { label: '高', value: 3, color: '#f56c6c' }
}

/**
 * 获取模型列表
 * @param {string} provider - Provider 类型（可选）
 * @returns {Array} 模型列表
 */
export function getModelList(provider = null) {
  let models = Object.entries(CLASSIFIER_MODELS).map(([key, model]) => ({
    key,
    ...model
  }))

  if (provider) {
    models = models.filter(m => m.provider === provider)
  }

  return models
}

/**
 * 根据 key 获取模型配置
 * @param {string} modelKey - 模型 key
 * @returns {Object|null} 模型配置
 */
export function getModelByKey(modelKey) {
  return CLASSIFIER_MODELS[modelKey] || null
}

/**
 * 获取推荐模型
 * @param {string} provider - Provider 类型（可选）
 * @returns {Object} 推荐模型配置
 */
export function getRecommendedModel(provider = null) {
  const models = getModelList(provider)
  const recommended = models.find(m => m.recommended)
  return recommended || models[0] || null
}
