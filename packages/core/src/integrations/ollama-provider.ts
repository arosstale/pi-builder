/**
 * Ollama Provider Integration
 * Local LLM support via Ollama for privacy-first deployments
 *
 * @module integrations/ollama-provider
 */


/**
 * Ollama configuration
 */
export interface OllamaConfig {
  endpoint: string // e.g., http://localhost:11434
  model: string // e.g., 'llama2', 'mistral', 'neural-chat'
  temperature: number
  topK: number
  topP: number
  repeatPenalty: number
  timeout: number
  stream: boolean
}

/**
 * Ollama generation request
 */
export interface OllamaGenerationRequest {
  prompt: string
  system?: string
  context?: string
  temperature?: number
  stream?: boolean
}

/**
 * Ollama generation response
 */
export interface OllamaGenerationResponse {
  response: string
  model: string
  done: boolean
  totalDuration: number
  loadDuration: number
  promptEvalDuration: number
  evalDuration: number
  evalCount: number
  promptEvalCount: number
}

/**
 * Ollama Agent
 */

/**
 * Ollama Provider — local LLM inference via Ollama HTTP API.
 */
export class OllamaProvider {
  private baseUrl: string
  private config: OllamaConfig

  constructor(config: OllamaConfig) {
    this.config = config
    this.baseUrl = (config.endpoint ?? 'http://localhost:11434').replace(/\/$/, '')
  }

  async generate(request: OllamaGenerationRequest): Promise<OllamaGenerationResponse> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: request.prompt,
        stream: false,
        options: { temperature: request.temperature ?? this.config.temperature },
      }),
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`)

    const data = (await res.json()) as { response: string; eval_count: number; prompt_eval_count: number; total_duration: number; load_duration: number; prompt_eval_duration: number }

    return {
      response: data.response,
      model: this.config.model,
      done: true,
      totalDuration: data.total_duration,
      loadDuration: data.load_duration,
      promptEvalDuration: data.prompt_eval_duration,
      evalCount: data.eval_count,
      evalDuration: 0,
      promptEvalCount: data.prompt_eval_count,
    }
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch { return false }
  }
}
