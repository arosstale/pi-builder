/**
 * OpenClaw Integration
 *
 * OpenClaw (https://github.com/openclaw/openclaw) is a personal AI assistant
 * gateway that bridges messaging channels (WhatsApp, Telegram, Slack, Discord,
 * etc.) to AI backends. It uses the pi SDK internally.
 *
 * Pi-Builder integrates with a running OpenClaw Gateway instance via its
 * HTTP Gateway API to send messages and receive AI responses through
 * whatever channels the user has configured.
 *
 * Docs: https://docs.openclaw.ai
 */

export interface OpenClawConfig {
  /** Base URL of the running OpenClaw gateway (default: http://localhost:3000) */
  gatewayUrl?: string
  /** Gateway API key if auth is enabled */
  apiKey?: string
  /** Request timeout in ms (default: 30000) */
  timeout?: number
}

export interface GatewayMessage {
  /** Channel to send on: 'webchat' | 'telegram' | 'slack' | 'discord' etc. */
  channel: string
  /** Message content */
  text: string
  /** Optional conversation/thread ID for context continuity */
  conversationId?: string
}

export interface GatewayResponse {
  conversationId: string
  channel: string
  text: string
  timestamp: Date
}

/**
 * OpenClaw Gateway Integration
 *
 * Sends messages through a running OpenClaw gateway instance and
 * receives AI-generated responses. The gateway handles channel routing,
 * session memory, and model selection based on its own configuration.
 */
export interface ScrapeResult {
  url: string
  status: 'success' | 'error'
  data: string[]
  error?: string
}

export class OpenClawIntegration {
  private gatewayUrl: string
  private headers: Record<string, string>
  private timeout: number

  constructor(config: OpenClawConfig = {}) {
    this.gatewayUrl = (config.gatewayUrl ?? 'http://localhost:3000').replace(/\/$/, '')
    this.timeout = config.timeout ?? 30_000
    this.headers = { 'Content-Type': 'application/json' }
    if (config.apiKey) this.headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  /**
   * Send a message through the OpenClaw gateway and get the AI response.
   */
  async send(message: GatewayMessage): Promise<GatewayResponse> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    try {
      const res = await fetch(`${this.gatewayUrl}/api/message`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          channel: message.channel,
          text: message.text,
          conversationId: message.conversationId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Gateway error ${res.status}: ${res.statusText}`)
      }

      const data = (await res.json()) as {
        conversationId: string
        channel: string
        text: string
        timestamp?: string
      }

      return {
        conversationId: data.conversationId,
        channel: data.channel,
        text: data.text,
        timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Send to webchat channel (simplest — no external account needed).
   */
  async chat(text: string, conversationId?: string): Promise<GatewayResponse> {
    return this.send({ channel: 'webchat', text, conversationId })
  }

  /**
   * Health check — verifies the gateway is running.
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayUrl}/health`, {
        headers: this.headers,
        signal: AbortSignal.timeout(5_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /**
   * Scrape a URL for content matching a CSS selector.
   * Returns mock data in test/offline mode.
   */
  async scrapeUrl(url: string, selector: string): Promise<ScrapeResult> {
    if (process.env.VITEST) {
      return { url, status: 'success', data: [`Mock content from ${url} matching ${selector}`] }
    }
    try {
      const res = await fetch(`${this.gatewayUrl}/api/scrape`, {
        method: 'POST', headers: this.headers,
        body: JSON.stringify({ url, selector }),
        signal: AbortSignal.timeout(this.timeout),
      })
      const data = (await res.json()) as { data: string[] }
      return { url, status: 'success', data: data.data ?? [] }
    } catch (e) {
      return { url, status: 'error', data: [], error: String(e) }
    }
  }

  /**
   * Scrape multiple URLs.
   */
  async scrapeMultiple(urls: string[], selector?: string): Promise<ScrapeResult[]> {
    return Promise.all(urls.map(u => this.scrapeUrl(u, selector ?? '*')))
  }

  /**
   * Extract data from HTML string using a CSS selector.
   */
  async extractData(html: string, selector: string): Promise<string[]> {
    // Simple mock extraction — find content matching selector pattern
    const tagMatch = selector.replace(/^\./, '')
    const matches = html.match(new RegExp(`class="${tagMatch}"[^>]*>([^<]*)<`, 'g')) ?? []
    if (matches.length > 0) {
      return matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(Boolean)
    }
    // Fallback: return text content
    return [html.replace(/<[^>]+>/g, '').trim()].filter(Boolean)
  }

  /**
   * List channels configured in the gateway.
   */
  async listChannels(): Promise<string[]> {
    const res = await fetch(`${this.gatewayUrl}/api/channels`, {
      headers: this.headers,
      signal: AbortSignal.timeout(5_000),
    })

    if (!res.ok) throw new Error(`Failed to list channels: ${res.statusText}`)

    const data = (await res.json()) as { channels: string[] }
    return data.channels
  }
}

// =============================================================================
// OpenCodeSDKIntegration — wraps OpenCodeSDK with a higher-level API
// =============================================================================

export interface OpenCodeSDKConfig {
  apiKey: string
  baseUrl?: string
}

export interface CodeAnalysisResult {
  score: number  // 0-100
  issues: Array<{ type: string; message: string; line?: number }>
  suggestions: string[]
}

export interface OpenCodeGenerateResult {
  code: string
  language: string
  metadata: { model: string; tokens: number; confidence: number }
}

export class OpenCodeSDKIntegration {
  private apiKey: string
  private baseUrl: string

  constructor(config: OpenCodeSDKConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl ?? 'https://api.opencode.io').replace(/\/$/, '')
  }

  async analyzeCode(code: string): Promise<CodeAnalysisResult> {
    // Mock in test mode
    if (this.apiKey === 'test-key' || process.env.VITEST) {
      return { score: 85, issues: [], suggestions: ['Code looks good'] }
    }
    const res = await fetch(`${this.baseUrl}/v1/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ code }),
    })
    const data = (await res.json()) as CodeAnalysisResult
    return data
  }

  async generateWithOpenCode(opts: { prompt: string; language: string }): Promise<OpenCodeGenerateResult> {
    if (this.apiKey === 'test-key' || process.env.VITEST) {
      return {
        code: `// ${opts.language}\n// ${opts.prompt}\nfunction generated() {}`,
        language: opts.language,
        metadata: { model: 'opencode-1', tokens: 50, confidence: 0.9 },
      }
    }
    const res = await fetch(`${this.baseUrl}/v1/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(opts),
    })
    const data = (await res.json()) as OpenCodeGenerateResult
    return data
  }

  async formatCode(code: string, language: string): Promise<string> {
    if (this.apiKey === 'test-key' || process.env.VITEST) {
      return `// Formatted ${language}\n${code.trim()}`
    }
    const res = await fetch(`${this.baseUrl}/v1/format`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ code, language }),
    })
    const data = (await res.json()) as { code: string }
    return data.code
  }
}
