import { EventEmitter } from 'events'

export interface OpenCodeRequest {
  language: string
  prompt: string
  context?: string
  temperature?: number
  maxTokens?: number
}

export interface GeneratedCode {
  id: string
  language: string
  code: string
  explanation: string
  tokens: {
    input: number
    output: number
  }
  quality: {
    score: number
    issues: string[]
  }
}

export interface CodeAnalysis {
  language: string
  complexity: number
  issues: Issue[]
  suggestions: string[]
}

export interface Issue {
  type: 'error' | 'warning' | 'info'
  message: string
  line?: number
  severity: 'low' | 'medium' | 'high'
}

export class OpenCodeSDK extends EventEmitter {
  private apiKey: string
  private baseUrl: string
  private cache: Map<string, GeneratedCode>

  constructor(apiKey: string, baseUrl = 'https://api.opencode.io') {
    super()
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.cache = new Map()
  }

  async generateCode(request: OpenCodeRequest): Promise<GeneratedCode> {
    try {
      this.emit('generation:start', {
        language: request.language,
        prompt: request.prompt,
      })

      // Create cache key
      const cacheKey = `${request.language}:${request.prompt}`
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!
      }

      const response = await fetch(`${this.baseUrl}/v1/code/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          language: request.language,
          prompt: request.prompt,
          context: request.context,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 4096,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenCode API error: ${response.statusText}`)
      }

      const data = (await response.json()) as Record<string, unknown>

      const result: GeneratedCode = {
        id: (data.id as string) || `opencode-${Date.now()}`,
        language: request.language,
        code: (data.code as string) || '',
        explanation: (data.explanation as string) || '',
        tokens: {
          input: ((data.tokens as Record<string, number>).input as number) || 0,
          output: ((data.tokens as Record<string, number>).output as number) || 0,
        },
        quality: {
          score: ((data.quality as Record<string, number>).score as number) || 0.8,
          issues: ((data.quality as Record<string, unknown>).issues as string[]) || [],
        },
      }

      this.cache.set(cacheKey, result)
      this.emit('generation:complete', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.emit('generation:error', { error: errorMessage })
      throw error
    }
  }

  async analyzeCode(code: string, language: string): Promise<CodeAnalysis> {
    try {
      this.emit('analysis:start', { language })

      const response = await fetch(`${this.baseUrl}/v1/code/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          code,
          language,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenCode API error: ${response.statusText}`)
      }

      const data = (await response.json()) as Record<string, unknown>

      const result: CodeAnalysis = {
        language,
        complexity: ((data.complexity as number) || 0) as number,
        issues: ((data.issues as Issue[]) || []) as Issue[],
        suggestions: ((data.suggestions as string[]) || []) as string[],
      }

      this.emit('analysis:complete', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.emit('analysis:error', { error: errorMessage })
      throw error
    }
  }

  async refactorCode(code: string, language: string): Promise<GeneratedCode> {
    try {
      this.emit('refactor:start', { language })

      const response = await fetch(`${this.baseUrl}/v1/code/refactor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          code,
          language,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenCode API error: ${response.statusText}`)
      }

      const data = (await response.json()) as Record<string, unknown>

      const result: GeneratedCode = {
        id: (data.id as string) || `opencode-refactor-${Date.now()}`,
        language,
        code: (data.code as string) || code,
        explanation: (data.explanation as string) || 'Refactored code',
        tokens: {
          input: ((data.tokens as Record<string, number>).input as number) || 0,
          output: ((data.tokens as Record<string, number>).output as number) || 0,
        },
        quality: {
          score: ((data.quality as Record<string, number>).score as number) || 0.9,
          issues: [],
        },
      }

      this.emit('refactor:complete', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.emit('refactor:error', { error: errorMessage })
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

  clearCache(): void {
    this.cache.clear()
    this.emit('cache:cleared')
  }

  getCacheSize(): number {
    return this.cache.size
  }
}
