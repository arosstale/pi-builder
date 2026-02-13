import { EventEmitter } from 'events'

export interface OpenClawRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: Tool[]
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface OpenClawResponse {
  id: string
  text: string
  tokens: {
    input: number
    output: number
  }
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class OpenClawProvider extends EventEmitter {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(apiKey: string, baseUrl = 'https://api.openclaw.io', model = 'openclaw-1') {
    super()
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
  }

  async execute(request: OpenClawRequest): Promise<OpenClawResponse> {
    try {
      this.emit('request:start', { model: this.model, prompt: request.prompt })

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          prompt: request.prompt,
          model: request.model || this.model,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2048,
          tools: request.tools || [],
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenClaw API error: ${response.statusText}`)
      }

      const data = (await response.json()) as Record<string, unknown>

      const result: OpenClawResponse = {
        id: (data.id as string) || `openclaw-${Date.now()}`,
        text: (data.text as string) || '',
        tokens: {
          input: ((data.usage as Record<string, number>).prompt_tokens as number) || 0,
          output: ((data.usage as Record<string, number>).completion_tokens as number) || 0,
        },
        model: (data.model as string) || this.model,
        usage: {
          promptTokens: ((data.usage as Record<string, number>).prompt_tokens as number) || 0,
          completionTokens:
            ((data.usage as Record<string, number>).completion_tokens as number) || 0,
          totalTokens: ((data.usage as Record<string, number>).total_tokens as number) || 0,
        },
      }

      this.emit('request:success', result)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.emit('request:error', { error: errorMessage })
      throw error
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  setModel(model: string): void {
    this.model = model
    this.emit('model:changed', model)
  }

  getModel(): string {
    return this.model
  }
}
