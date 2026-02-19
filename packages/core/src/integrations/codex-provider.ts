/**
 * Codex Provider Integration
 * OpenAI Codex API support for code generation and completion
 *
 * @module integrations/codex-provider
 */


/**
 * Codex configuration
 */
export interface CodexConfig {
  apiKey: string
  model: 'code-davinci-003' | 'code-davinci-002' | 'code-cushman-001'
  maxTokens: number
  temperature: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

/**
 * Code completion request
 */
export interface CodeCompletionRequest {
  prompt: string
  language?: string
  context?: string
  temperature?: number
}

/**
 * Code completion response
 */
export interface CodeCompletionResponse {
  code: string
  language: string
  tokens: number
  confidence: number
}

/**
 * Codex Agent
 */

/**
 * Codex Provider — OpenAI Codex API client for code completion.
 */
export class CodexProvider {
  private config: CodexConfig

  constructor(config: CodexConfig) {
    this.config = config
  }

  async complete(request: CodeCompletionRequest): Promise<CodeCompletionResponse> {
    const res = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: request.prompt,
        max_tokens: request.temperature !== undefined ? this.config.maxTokens : this.config.maxTokens,
        temperature: request.temperature ?? this.config.temperature,
      }),
    })

    if (!res.ok) throw new Error(`Codex API error: ${res.statusText}`)

    const data = (await res.json()) as { choices: Array<{ text: string }>; usage: { total_tokens: number } }

    return {
      code: data.choices[0]?.text ?? '',
      language: request.language ?? 'text',
      tokens: data.usage.total_tokens,
      confidence: 0.9,
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
        signal: AbortSignal.timeout(5000),
      })
      return res.ok
    } catch { return false }
  }
}
