import { CloudflareProvider } from './cloudflare-provider'
import { GroqProvider } from './groq-provider'
import { ModelScopeProvider } from './modelscope-provider'
import { ZhipuProvider } from './zhipu-provider'

/**
 * AI Provider 类型
 */
export const AI_PROVIDERS = {
  CLOUDFLARE: 'cloudflare',
  GROQ: 'groq',
  MODELSCOPE: 'modelscope',
  ZHIPU: 'zhipu'
}

/**
 * Provider 工厂
 * 根据类型创建对应的 Provider 实例
 */
export class AIProviderFactory {
  static providers = {
    cloudflare: CloudflareProvider,
    groq: GroqProvider,
    modelscope: ModelScopeProvider,
    zhipu: ZhipuProvider
  }

  /**
   * 创建 Provider 实例
   * @param {string} type - Provider 类型 (cloudflare, groq, modelscope, zhipu)
   * @param {Object} config - Provider 配置
   * @returns {BaseAIProvider}
   */
  static create(type, config = {}) {
    const ProviderClass = this.providers[type]
    if (!ProviderClass) {
      throw new Error(`Unknown AI provider type: ${type}`)
    }
    return new ProviderClass(config)
  }

  /**
   * 获取所有支持的 Provider 类型
   * @returns {string[]}
   */
  static getSupportedTypes() {
    return Object.keys(this.providers)
  }

  /**
   * 注册新的 Provider
   * @param {string} type - Provider 类型
   * @param {Class} ProviderClass - Provider 类
   */
  static register(type, ProviderClass) {
    this.providers[type] = ProviderClass
  }
}

/**
 * Provider 显示配置
 */
export const PROVIDER_DISPLAY = {
  [AI_PROVIDERS.ZHIPU]: {
    name: '智谱 GLM',
    icon: '🧠',
    color: '#3B5BFD',
    description: '智谱 GLM-4V 视觉模型，提供免费层',
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
  },
  [AI_PROVIDERS.GROQ]: {
    name: 'Groq AI',
    icon: '⚡',
    color: '#F55036',
    description: 'Groq 超快速 AI 推理服务（免费层每分钟仅 ~1.7 张图）',
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
  },
  [AI_PROVIDERS.MODELSCOPE]: {
    name: 'ModelScope',
    icon: '🚀',
    color: '#6C5CE7',
    description: 'ModelScope 托管的 Qwen VL 视觉模型，国内直连备选（需填 API Key 与模型名）',
    credentialFields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
      {
        key: 'model',
        label: '模型名称',
        type: 'text',
        required: true,
        placeholder: 'qwen-vl-max-latest'
      }
    ]
  },
  [AI_PROVIDERS.CLOUDFLARE]: {
    name: 'Cloudflare Workers AI',
    icon: '☁️',
    color: '#F38020',
    description: 'Cloudflare 提供的 AI 服务',
    disabled: true,
    credentialFields: [
      { key: 'accountId', label: 'Account ID', type: 'text', required: true },
      { key: 'apiToken', label: 'API Token', type: 'password', required: true }
    ]
  }
}

export { BaseAIProvider } from './base-provider'
export { CloudflareProvider, GroqProvider, ModelScopeProvider, ZhipuProvider }
