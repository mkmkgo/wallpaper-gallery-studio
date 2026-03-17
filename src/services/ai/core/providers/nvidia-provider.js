import { BaseAIProvider } from './base-provider'

/**
 * NVIDIA NIM AI Provider
 * 使用 NVIDIA NIM 的视觉语言模型进行图片分析
 * API 兼容 OpenAI 格式
 */
export class NvidiaProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config)
    // 本地开发走 Vite dev proxy 避免 CORS，线上直连（NVIDIA 支持跨域）
    const isDev = import.meta.env.DEV
    this.baseUrl = config.baseUrl || (isDev ? '/nvidia-api/v1' : 'https://integrate.api.nvidia.com/v1')
  }

  validateCredentials(credentials) {
    return !!(credentials?.apiKey && credentials?.model)
  }

  async analyze({ imageBase64, prompt, credentials }) {
    if (!this.validateCredentials(credentials)) {
      throw new Error('NVIDIA credentials are invalid')
    }

    const { apiKey, model } = credentials

    let imageUrl = imageBase64
    if (!imageBase64.startsWith('data:')) {
      imageUrl = `data:image/jpeg;base64,${imageBase64}`
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.2,
        top_p: 0.7,
        stream: false
      })
    })

    if (!response.ok) {
      let errorMessage = `NVIDIA API error: ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.detail || error.message || errorMessage
        console.error('NVIDIA API Error Details:', error)
      } catch {
        const text = await response.text().catch(() => '')
        if (text) errorMessage += ` - ${text}`
      }

      if (response.status === 401 || response.status === 403) {
        errorMessage = 'NVIDIA API Key 无效或已过期。请检查您的 API Key 是否正确配置。'
      } else if (response.status === 429) {
        errorMessage = 'API 请求频率超限，请稍后再试。'
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return this.parseResponse(data)
  }

  parseResponse(data) {
    const aiText = data.choices?.[0]?.message?.content || ''

    if (!aiText) {
      throw new Error('No content in NVIDIA response')
    }

    // 提取 JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in NVIDIA response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    console.log('[NVIDIA] 原始 AI 返回:', { secondary: parsed.secondary, third: parsed.third })

    let filenameSuggestions = parsed.filenames || []

    if (!filenameSuggestions.length && parsed.filename) {
      filenameSuggestions = [parsed.filename]
    }

    if (!filenameSuggestions.length) {
      const desc = parsed.description || ''
      const keywords = parsed.keywords || []
      if (desc.length > 0) {
        filenameSuggestions = [desc.substring(0, 10) + '.jpg']
      } else if (keywords.length > 0) {
        filenameSuggestions = [keywords.slice(0, 2).join('') + '壁纸.jpg']
      } else {
        filenameSuggestions = ['未命名壁纸.jpg']
      }
    }

    // 清理 third 字段
    let cleanThird = parsed.third || '通用'
    if (cleanThird.includes('/')) {
      const parts = cleanThird.split('/')
      cleanThird = parts[parts.length - 1].trim()
      console.log('[NVIDIA] 清理 third 字段: "%s" → "%s"', parsed.third, cleanThird)
    }

    const result = {
      secondary: parsed.secondary || '通用',
      third: cleanThird,
      keywords: parsed.keywords || [],
      filenameSuggestions,
      description: parsed.description || '无描述',
      confidence: 0.9,
      displayTitle: parsed.displayTitle || parsed.display_title || null,
      is_perfect_match: parsed.is_perfect_match !== undefined ? parsed.is_perfect_match : null,
      new_category_proposal: parsed.new_category_proposal || null,
      reasoning: parsed.reasoning || null,
      raw: data
    }

    console.log('[NVIDIA] 清理后返回:', { secondary: result.secondary, third: result.third })

    return result
  }
}
