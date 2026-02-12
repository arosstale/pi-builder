import type {
  CodeGenerationRequest,
  CodeGenerationResponse,
} from './types'

export class CodeGenerator {
  private model: string = 'claude-3.5-sonnet'
  private apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.CLAUDE_API_KEY
  }

  async generate(
    request: CodeGenerationRequest
  ): Promise<CodeGenerationResponse> {
    if (!this.apiKey) {
      throw new Error(
        'API key not configured. Set CLAUDE_API_KEY or pass it to constructor'
      )
    }

    // Build prompt with context
    const fullPrompt = this.buildPrompt(request)

    // Call AI API
    const startTime = Date.now()
    const response = await this.callAI(fullPrompt)
    const tokensUsed = this.estimateTokens(fullPrompt + response.text)

    return {
      code: response.text,
      language: request.language || 'typescript',
      explanation: response.explanation || '',
      metadata: {
        tokensUsed,
        generatedAt: new Date(),
        model: this.model,
      },
    }
  }

  private buildPrompt(request: CodeGenerationRequest): string {
    let prompt = request.prompt

    if (request.context) {
      prompt += '\n\nContext:\n'
      for (const [key, value] of Object.entries(request.context)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`
      }
    }

    if (request.framework) {
      prompt += `\nFramework: ${request.framework}`
    }

    return prompt
  }

  private async callAI(prompt: string): Promise<{ text: string; explanation: string }> {
    // Mock implementation - replace with actual Claude API call
    return {
      text: '// Generated code will appear here\nconsole.log("Hello, Pi Builder!")',
      explanation: 'Mock response from AI provider',
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~1 token per 4 characters
    return Math.ceil(text.length / 4)
  }
}
