/**
 * LM Studio Provider Integration
 * Local LLM UI support for easy model management and inference
 *
 * @module integrations/lm-studio-provider
 */


/**
 * LM Studio configuration
 */
export interface LMStudioConfig {
  endpoint: string // e.g., http://localhost:1234/v1
  model: string // e.g., 'neural-chat-7b'
  temperature: number
  topP: number
  maxTokens: number
  stopSequences?: string[]
  stream: boolean
}

/**
 * LM Studio completion request
 */
export interface LMStudioCompletionRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
}

/**
 * LM Studio completion response
 */
export interface LMStudioCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    text: string
    finishReason: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * LM Studio Agent
 */

/**
 * LM Studio Provider — local LLM via LM Studio's OpenAI-compatible server.
 */
export class LMStudioProvider {
  private baseUrl: string
  private config: LMStudioConfig

  constructor(config: LMStudioConfig) {
    this.config = config
    this.baseUrl = (config.endpoint ?? 'http://localhost:1234').replace(/\/$/, '')
  }

  async complete(request: LMStudioCompletionRequest): Promise<LMStudioCompletionResponse> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`LM Studio error: ${res.statusText}`)

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>
      usage: { prompt_tokens: number; completion_tokens: number }
    }

    const content = data.choices[0]?.message.content ?? ''
    return {
      id: `lm-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
      choices: [{ index: 0, text: content, finishReason: 'stop' }],
      usage: { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.prompt_tokens + data.usage.completion_tokens },
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch { return false }
  }
}
