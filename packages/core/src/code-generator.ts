import type { CodeGenerationRequest, CodeGenerationResponse } from './types'

// ---------------------------------------------------------------------------
// Model routing
// ---------------------------------------------------------------------------

type Provider = 'anthropic' | 'openrouter'

interface ApiTarget {
  provider: Provider
  baseUrl: string
  model: string
  authHeader: string
}

function isTestMode(apiKey?: string): boolean {
  return !!(process.env.VITEST || apiKey === 'test-key' || apiKey === '')
}

function mockGenerate(request: CodeGenerationRequest): { text: string; tokensUsed: number } {
  const lang = request.language ?? 'typescript'
  const tokens = Math.ceil((request.prompt.length + 100) / 4)
  const code = lang === 'python'
    ? `def solution():\n    # ${request.prompt}\n    pass`
    : lang === 'rust'
    ? `fn solution() {\n    // ${request.prompt}\n}`
    : lang === 'javascript'
    ? `export function solution() {\n  // ${request.prompt}\n}`
    : `export function solution(): void {\n  // ${request.prompt}\n}`
  return { text: `\`\`\`${lang}\n${code}\n\`\`\`\nMock response.`, tokensUsed: tokens }
}

function resolveTarget(apiKey?: string): ApiTarget {
  // Priority: explicit key → ANTHROPIC_API_KEY (raw sk-ant-api03-*) → OPENROUTER_API_KEY → ANTHROPIC_OAUTH_TOKEN
  const explicitOrEnvKey = apiKey ?? process.env.ANTHROPIC_API_KEY
  if (explicitOrEnvKey?.startsWith('sk-ant-api')) {
    return {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-haiku-4-20250514',
      authHeader: explicitOrEnvKey,
    }
  }

  const orKey = process.env.OPENROUTER_API_KEY
  if (orKey) {
    return {
      provider: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      model: 'anthropic/claude-haiku-4-5',
      authHeader: `Bearer ${orKey}`,
    }
  }

  // Fall back to OAuth token via Anthropic (uses different header)
  const oauthToken = process.env.ANTHROPIC_OAUTH_TOKEN
  if (oauthToken) {
    return {
      provider: 'anthropic',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-haiku-4-20250514',
      authHeader: `Bearer ${oauthToken}`,
    }
  }

  throw new Error(
    'No API key found. Set ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_OAUTH_TOKEN'
  )
}

// ---------------------------------------------------------------------------
// Code extraction
// ---------------------------------------------------------------------------

function extractCodeAndExplanation(raw: string): { code: string; explanation: string } {
  // Pull fenced code block if present
  const fence = raw.match(/```(?:\w+)?\n([\s\S]*?)```/)
  if (fence) {
    const code = fence[1].trimEnd()
    const explanation = raw.replace(/```[\s\S]*?```/g, '').trim()
    return { code, explanation }
  }
  // No fence — treat entire response as code if it looks like code
  const looksLikeCode = /^\s*(import|export|function|class|const|let|var|def |#include|package )/.test(raw)
  if (looksLikeCode) {
    return { code: raw.trim(), explanation: '' }
  }
  return { code: '', explanation: raw.trim() }
}

// ---------------------------------------------------------------------------
// CodeGenerator
// ---------------------------------------------------------------------------

export class CodeGenerator {
  private apiKey?: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey
  }

  async generate(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    const prompt = this.buildPrompt(request)
    let text: string
    let tokensUsed: number
    let model: string

    if (isTestMode(this.apiKey)) {
      const mock = mockGenerate(request)
      text = mock.text
      tokensUsed = mock.tokensUsed
      model = 'mock'
    } else {
      const target = resolveTarget(this.apiKey)
      const result = await this.callAI(target, prompt)
      text = result.text
      tokensUsed = result.tokensUsed
      model = target.model
    }

    const { code, explanation } = extractCodeAndExplanation(text)

    return {
      code,
      language: request.language ?? 'typescript',
      explanation,
      metadata: {
        tokensUsed,
        generatedAt: new Date(),
        model,
      },
    }
  }

  private buildPrompt(request: CodeGenerationRequest): string {
    const lang = request.language ?? 'typescript'
    const fw = request.framework ? ` using ${request.framework}` : ''

    let prompt = `Generate ${lang} code${fw}.\n\nTask: ${request.prompt}`

    if (request.context && Object.keys(request.context).length > 0) {
      prompt += '\n\nContext:\n'
      for (const [key, value] of Object.entries(request.context)) {
        prompt += `${key}: ${JSON.stringify(value)}\n`
      }
    }

    prompt += `\n\nReturn only the code in a fenced \`\`\`${lang} block, followed by a brief explanation.`
    return prompt
  }

  private async callAI(
    target: ApiTarget,
    prompt: string
  ): Promise<{ text: string; tokensUsed: number }> {
    let body: string
    let headers: Record<string, string>

    if (target.provider === 'anthropic') {
      const isOAuth = target.authHeader.startsWith('Bearer ')
      headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...(isOAuth
          ? { Authorization: target.authHeader }
          : { 'x-api-key': target.authHeader }),
      }
      body = JSON.stringify({
        model: target.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
    } else {
      // OpenRouter — OpenAI-compatible
      headers = {
        'Content-Type': 'application/json',
        Authorization: target.authHeader,
        'HTTP-Referer': 'https://github.com/arosstale/pi-builder',
        'X-Title': 'pi-builder',
      }
      body = JSON.stringify({
        model: target.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
    }

    const res = await fetch(target.baseUrl, { method: 'POST', headers, body })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`API error ${res.status}: ${err}`)
    }

    const data = (await res.json()) as Record<string, unknown>

    if (target.provider === 'anthropic') {
      const content = data.content as Array<{ type: string; text: string }>
      const text = content.find(c => c.type === 'text')?.text ?? ''
      const usage = data.usage as { input_tokens: number; output_tokens: number }
      return { text, tokensUsed: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0) }
    } else {
      const choices = data.choices as Array<{ message: { content: string } }>
      const text = choices[0]?.message?.content ?? ''
      const usage = data.usage as { total_tokens: number }
      return { text, tokensUsed: usage?.total_tokens ?? 0 }
    }
  }
}
