import { BaseAIProvider } from './base-provider'

/**
 * ModelScope AI Provider
 * 使用 ModelScope 的 Qwen VL 视觉模型进行图片分析
 */
export class ModelScopeProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config)
    this.baseUrl = config.baseUrl || 'https://api-inference.modelscope.cn/v1'
  }

  validateCredentials(credentials) {
    return !!(credentials?.apiKey && credentials?.model)
  }

  async analyze({ imageBase64, prompt, credentials }) {
    if (!this.validateCredentials(credentials)) {
      throw new Error('ModelScope credentials are invalid')
    }

    const { apiKey, model } = credentials

    // 确保 base64 不含 data URL 前缀
    let base64Data = imageBase64
    if (base64Data.startsWith('data:')) {
      base64Data = base64Data.split(',')[1]
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Data
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 2048,
        temperature: 0.2,
        top_p: 0.8
      })
    })

    if (!response.ok) {
      let errorMessage = `ModelScope API error: ${response.status}`
      try {
        const error = await response.json()
        errorMessage = error.error?.message || error.message || errorMessage
        console.error('ModelScope API Error Details:', error)
      } catch {
        const text = await response.text().catch(() => '')
        console.error('ModelScope API Error Text:', text)
        if (text) errorMessage += ` - ${text}`
      }

      if (response.status === 403 || response.status === 401) {
        errorMessage = 'ModelScope API Key 无效或已过期。请检查您的 API Key 是否正确配置。'
      } else if (response.status === 429) {
        errorMessage = 'API 请求频率超限，请稍后再试。'
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    return this.parseResponse(data)
  }

  parseResponse(data) {
    // ModelScope 返回格式: { content: [{ type: 'text', text: '...' }] }
    const textContent = data.content?.find(c => c.type === 'text')
    const aiText = textContent?.text || ''

    if (!aiText) {
      throw new Error('No content in ModelScope response')
    }

    // 尝试提取 JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in ModelScope response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    console.log('[ModelScope] 原始 AI 返回:', { secondary: parsed.secondary, third: parsed.third })

    // 直接使用 AI 返回的文件名数组
    let filenameSuggestions = parsed.filenames || []

    // 如果 AI 返回的是单个 filename（兼容旧格式）
    if (!filenameSuggestions.length && parsed.filename) {
      filenameSuggestions = [parsed.filename]
    }

    // 如果没有文件名，使用描述或关键词生成
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

    // 清理 third 字段：如果包含路径分隔符，只保留最后一级
    let cleanThird = parsed.third || '通用'
    if (cleanThird.includes('/')) {
      const parts = cleanThird.split('/')
      cleanThird = parts[parts.length - 1].trim()
      console.log('[ModelScope] 清理 third 字段: "%s" → "%s"', parsed.third, cleanThird)
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

    console.log('[ModelScope] 清理后返回:', { secondary: result.secondary, third: result.third })

    return result
  }
}
