import { CloudflareProvider } from './cloudflare-provider'
// import { DoubaoProvider } from './doubao-provider' // 豆包已下架
import { GroqProvider } from './groq-provider'
import { ModelScopeProvider } from './modelscope-provider'
import { NvidiaProvider } from './nvidia-provider'

/**
 * AI Provider 类型
 */
export const AI_PROVIDERS = {
  CLOUDFLARE: 'cloudflare',
  // DOUBAO: 'doubao', // 豆包已下架
  GROQ: 'groq',
  MODELSCOPE: 'modelscope',
  NVIDIA: 'nvidia'
}

/**
 * Provider 工厂
 * 根据类型创建对应的 Provider 实例
 */
export class AIProviderFactory {
  static providers = {
    cloudflare: CloudflareProvider,
    // doubao: DoubaoProvider, // 豆包已下架
    groq: GroqProvider,
    modelscope: ModelScopeProvider,
    nvidia: NvidiaProvider
  }

  /**
   * 创建 Provider 实例
   * @param {string} type - Provider 类型 (cloudflare, groq, modelscope)
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
  [AI_PROVIDERS.MODELSCOPE]: {
    name: 'ModelScope AI',
    icon: '🔬',
    color: '#6B4FBB',
    description: 'ModelScope Qwen VL 视觉模型',
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
  },
  [AI_PROVIDERS.GROQ]: {
    name: 'Groq AI',
    icon: '⚡',
    color: '#F55036',
    description: 'Groq 超快速 AI 推理服务',
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
  },
  [AI_PROVIDERS.NVIDIA]: {
    name: 'NVIDIA NIM',
    icon: '🟢',
    color: '#76B900',
    description: 'NVIDIA NIM 视觉语言模型',
    credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
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
  // 豆包已下架
  // [AI_PROVIDERS.DOUBAO]: {
  //   name: '豆包 AI',
  //   icon: '🫘',
  //   color: '#00C4CC',
  //   description: '字节跳动豆包 AI 服务',
  //   credentialFields: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }]
  // }
}

export { BaseAIProvider } from './base-provider'
export { CloudflareProvider, GroqProvider, ModelScopeProvider, NvidiaProvider }
