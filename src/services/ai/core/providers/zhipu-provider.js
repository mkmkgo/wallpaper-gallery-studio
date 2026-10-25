import { BaseAIProvider } from './base-provider'
import { createZhipuRateLimiter } from '@/utils/rateLimiter'

const zhipuRateLimiter = createZhipuRateLimiter()

/**
 * 智谱 GLM Provider
 * 使用智谱 BigModel 平台的 GLM-4V 视觉模型进行图片分析
 * 免费模型：glm-4v-flash（直接回答）、glm-4.1v-thinking-flash（带推理）
 */
/**
 * [LOCAL] AI 接口代理地址
 * 浏览器直连 https://open.bigmodel.cn 会被 CORS 拦截（服务端 curl 正常、
 * 浏览器拿不到 Access-Control-Allow-Origin），必须经代理中转。
 *
 * 默认走【同源 EdgeOne Pages 函数】'/api/ai-proxy/zhipu'（路由见
 * cloud-functions/api/ai-proxy/zhipu/chat/completions/index.js，逻辑在
 * cloud-functions/_lib/ai-proxy.js）：相对路径挂在 studio 自己域名下，
 * 换域名不用改代码，同源之后连 CORS 预检都不存在。
 *
 * 教训：曾默认走 Cloudflare Worker（wallpaper-ai-proxy.1109008002.workers.dev），
 * workers.dev 是 CF 公共边缘域名、IP 段在大陆被 GFW 精准阻断（移动必挂、
 * 电信联通看脸），用户两台电脑一台能连一台报 "Failed to fetch"，现已降级
 * 为备用通道。想改回直连或 Worker，用环境变量 VITE_ZHIPU_BASE_URL 覆盖即可。
 */
const DEFAULT_ZHIPU_BASE_URL = '/api/ai-proxy/zhipu'

// 备用通道：同源函数地域抽风时切回 Cloudflare Worker。
// 注意 workers.dev 国内被墙，这条只适合海外/代理环境，放这儿是双保险。
// 可用 VITE_ZHIPU_FALLBACK_URLS（逗号分隔）覆盖。
const WORKER_PROXY_HOST = 'https://wallpaper-ai-proxy.1109008002.workers.dev'
const DEFAULT_ZHIPU_FALLBACK_URLS = [`${WORKER_PROXY_HOST}/zhipu`]

function splitFallbacks(raw) {
  return String(raw || '')
    .split(',')
    .map(item => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * 归一化代理地址：
 * - 相对路径（以 / 开头，即同源 EdgeOne 函数）：原样返回
 * - 裸 workers.dev host：自动补 /zhipu（Worker 靠 URL 首段路径识别厂商，
 *   少了 /zhipu 会返回「未知的 provider」）
 * - 未填：用默认值（同源函数）
 */
function normalizeZhipuBase(raw) {
  const trimmed = String(raw || '')
    .trim()
    .replace(/\/+$/, '')
  if (!trimmed) {
    return DEFAULT_ZHIPU_BASE_URL
  }
  if (trimmed.startsWith('/')) {
    return trimmed
  }
  if (trimmed === WORKER_PROXY_HOST) {
    return `${WORKER_PROXY_HOST}/zhipu`
  }
  return trimmed
}

export class ZhipuProvider extends BaseAIProvider {
  constructor(config = {}) {
    super(config)
    // 智谱 BigModel 官方 API，OpenAI 兼容协议
    // 地址优先级：config.baseUrl → VITE_ZHIPU_BASE_URL → 同源函数默认值
    this.baseUrl = config.baseUrl || normalizeZhipuBase(import.meta.env.VITE_ZHIPU_BASE_URL)
    this.fallbackBaseUrls = splitFallbacks(import.meta.env.VITE_ZHIPU_FALLBACK_URLS)
    if (this.fallbackBaseUrls.length === 0) {
      this.fallbackBaseUrls = DEFAULT_ZHIPU_FALLBACK_URLS
    }
  }

  validateCredentials(credentials) {
    return !!(credentials?.apiKey && credentials?.model)
  }

  async analyze({ imageBase64, prompt, credentials }) {
    if (!this.validateCredentials(credentials)) {
      throw new Error('Zhipu credentials are invalid')
    }

    const { apiKey, model } = credentials

    return zhipuRateLimiter.execute(
      () => this.requestAnalysis({ imageBase64, prompt, apiKey, model }),
      { provider: 'zhipu', model }
    )
  }

  async requestAnalysis({ imageBase64, prompt, apiKey, model }) {
    // 处理 base64 数据：如果已经包含 data URL 前缀，直接使用；否则添加前缀
    let imageUrl = imageBase64
    if (!imageBase64.startsWith('data:')) {
      imageUrl = `data:image/jpeg;base64,${imageBase64}`
    }

    const requestBody = JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      temperature: 0.7,
      // glm-4v-flash 免费模型 max_tokens 上限为 1024
      max_tokens: 1024
    })

    // 故障转移：主地址（同源 EdgeOne 函数）→ 备用地址（Cloudflare Worker）。
    // 触发条件：fetch 抛网络异常（TypeError / Failed to fetch，典型如
    // workers.dev 被墙时请求根本发不出去）或上游 5xx（函数地域抖动）。
    // 4xx 不转移——同样的 key 换通道也是同样的错，让下面的错误码处理生效。
    const candidates = [this.baseUrl, ...this.fallbackBaseUrls.filter(url => url !== this.baseUrl)]
    let lastNetworkError = null

    for (const baseUrl of candidates) {
      let response
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: requestBody
        })
      } catch (error) {
        lastNetworkError = error
        continue
      }

      if (response.status >= 500) {
        lastNetworkError = new Error(`Zhipu proxy error: ${response.status} (${baseUrl})`)
        continue
      }

      if (!response.ok) {
        let errorMessage = `Zhipu API error: ${response.status}`
        let errorData = null
        try {
          errorData = await response.json()
          errorMessage = errorData.error?.message || errorData.message || errorMessage
          console.error('Zhipu API Error Details:', errorData)
        } catch {
          const text = await response.text().catch(() => '')
          console.error('Zhipu API Error Text:', text)
          if (text) errorMessage += ` - ${text}`
        }

        // 智谱特定错误码处理
        const errorCode = errorData?.error?.code
        if (response.status === 401 || errorCode === '1001') {
          errorMessage = '智谱 API Key 无效或已过期。请检查您的 API Key 是否正确配置。'
        } else if (errorCode === '1113') {
          errorMessage =
            '智谱账户余额不足或无可用资源包。免费模型请使用 glm-4v-flash / glm-4.1v-thinking-flash。'
        } else if (errorCode === '1210') {
          errorMessage = '智谱图片解析失败：图片格式不支持或文件损坏。'
        } else if (response.status === 429 || errorCode === '1302') {
          // 保留原始 errorMessage（含重试提示），让 RateLimiter 能解析并自动重试
          errorMessage = `API 请求频率超限: ${errorMessage}`
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()
      return this.parseResponse(data)
    }

    // 所有候选通道都失败：抛出最后一次网络错误
    throw lastNetworkError || new Error('所有智谱代理通道均不可用')
  }

  parseResponse(data) {
    let aiText = data.choices?.[0]?.message?.content || ''

    if (!aiText) {
      throw new Error('No content in Zhipu response')
    }

    // glm-4.1v-thinking-flash 会输出 <think>...</think><answer>...</answer>
    // glm-4v-flash 直接输出 JSON
    // 优先提取 <answer> 标签内的内容
    const answerMatch = aiText.match(/<answer>([\s\S]*?)<\/answer>/)
    if (answerMatch) {
      aiText = answerMatch[1].trim()
    } else {
      // 没有 answer 标签时，剥离 think 标签
      aiText = aiText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    }

    // 尝试提取 JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Zhipu response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    console.log('[Zhipu] 原始 AI 返回:', { secondary: parsed.secondary, third: parsed.third })

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
      console.log('[Zhipu] 清理 third 字段: "%s" → "%s"', parsed.third, cleanThird)
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

    console.log('[Zhipu] 清理后返回:', { secondary: result.secondary, third: result.third })

    return result
  }
}
