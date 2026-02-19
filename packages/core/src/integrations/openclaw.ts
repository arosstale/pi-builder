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
