/**
 * Multi-Channel Router
 * Route agent interactions across Telegram, Slack, Email, WhatsApp, SMS, Phone
 */

export type Channel = 'telegram' | 'slack' | 'email' | 'whatsapp' | 'sms' | 'phone'

export interface ChannelMessage {
  id: string
  channel: Channel
  userId: string
  userName?: string
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface ChannelResponse {
  channel: Channel
  userId: string
  content: string
  formatting?: 'plain' | 'markdown' | 'html'
  buttons?: Array<{ label: string; action: string }>
  attachments?: Array<{ type: string; url: string }>
}

/**
 * Channel Provider Interface
 */
export interface IChannelProvider {
  name: Channel
  send(message: ChannelResponse): Promise<void>
  receive(message: ChannelMessage): Promise<void>
  initialize(): Promise<void>
  isConnected(): boolean
}

/**
 * Telegram Channel Provider
 */
export class TelegramProvider implements IChannelProvider {
  name: Channel = 'telegram'
  private botToken: string
  private connected: boolean = false

  constructor(botToken: string) {
    this.botToken = botToken
  }

  async initialize(): Promise<void> {
    if (!this.botToken) {
      throw new Error('Telegram bot token not configured')
    }
    this.connected = true
    console.log('✅ Telegram provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('Telegram provider not connected')

    const text = message.content
    const parseMode = message.formatting === 'markdown' ? 'Markdown' : 'HTML'

    console.log(`📱 [Telegram] → ${message.userId}: ${text}`)

    // Simulate API call
    // await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
    //   method: 'POST',
    //   body: JSON.stringify({ chat_id: userId, text, parse_mode: parseMode })
    // })
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`📱 [Telegram] ← ${message.userId}: ${message.content}`)
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Slack Channel Provider
 */
export class SlackProvider implements IChannelProvider {
  name: Channel = 'slack'
  private token: string
  private connected: boolean = false

  constructor(token: string) {
    this.token = token
  }

  async initialize(): Promise<void> {
    if (!this.token) {
      throw new Error('Slack token not configured')
    }
    this.connected = true
    console.log('✅ Slack provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('Slack provider not connected')

    const blocks = [
      {
        type: 'section',
        text: {
          type: message.formatting === 'markdown' ? 'mrkdwn' : 'plain_text',
          text: message.content
        }
      }
    ]

    if (message.buttons && message.buttons.length > 0) {
      blocks.push({
        type: 'actions',
        text: { type: 'plain_text', text: 'Actions' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...({ elements: message.buttons.map((btn: any) => ({
          type: 'button',
          text: { type: 'plain_text', text: btn.label },
          action_id: btn.action
        })) } as any)
      })
    }

    console.log(`💬 [Slack] → ${message.userId}: ${message.content}`)

    // Simulate API call
    // await fetch('https://slack.com/api/chat.postMessage', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${this.token}` },
    //   body: JSON.stringify({ channel: userId, blocks })
    // })
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`💬 [Slack] ← ${message.userId}: ${message.content}`)
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Email Channel Provider
 */
export class EmailProvider implements IChannelProvider {
  name: Channel = 'email'
  private smtpServer: string
  private connected: boolean = false

  constructor(smtpServer: string) {
    this.smtpServer = smtpServer
  }

  async initialize(): Promise<void> {
    if (!this.smtpServer) {
      throw new Error('SMTP server not configured')
    }
    this.connected = true
    console.log('✅ Email provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('Email provider not connected')

    const html = message.formatting === 'markdown' ? this.markdownToHtml(message.content) : message.content

    console.log(`📧 [Email] → ${message.userId}: ${message.content.substring(0, 50)}...`)

    // Simulate SMTP send
    // await sendEmail({
    //   to: userId,
    //   subject: 'Agent Response',
    //   html,
    //   from: 'noreply@agent.example.com'
    // })
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`📧 [Email] ← ${message.userId}: ${message.content.substring(0, 50)}...`)
  }

  isConnected(): boolean {
    return this.connected
  }

  private markdownToHtml(markdown: string): string {
    // Simple markdown to HTML conversion
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }
}

/**
 * WhatsApp Channel Provider
 */
export class WhatsAppProvider implements IChannelProvider {
  name: Channel = 'whatsapp'
  private apiToken: string
  private connected: boolean = false

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async initialize(): Promise<void> {
    if (!this.apiToken) {
      throw new Error('WhatsApp API token not configured')
    }
    this.connected = true
    console.log('✅ WhatsApp provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('WhatsApp provider not connected')

    console.log(`💭 [WhatsApp] → ${message.userId}: ${message.content}`)

    // Simulate WhatsApp API call
    // await fetch('https://api.whatsapp.com/send', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${this.apiToken}` },
    //   body: JSON.stringify({ to: userId, message: message.content })
    // })
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`💭 [WhatsApp] ← ${message.userId}: ${message.content}`)
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * SMS Channel Provider
 */
export class SMSProvider implements IChannelProvider {
  name: Channel = 'sms'
  private apiKey: string
  private connected: boolean = false

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async initialize(): Promise<void> {
    if (!this.apiKey) {
      throw new Error('SMS API key not configured')
    }
    this.connected = true
    console.log('✅ SMS provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('SMS provider not connected')

    // Limit to 160 chars for SMS
    const smsText = message.content.substring(0, 160)

    console.log(`📞 [SMS] → ${message.userId}: ${smsText}`)

    // Simulate SMS API call
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`📞 [SMS] ← ${message.userId}: ${message.content}`)
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Phone Channel Provider
 */
export class PhoneProvider implements IChannelProvider {
  name: Channel = 'phone'
  private voiceApiToken: string
  private connected: boolean = false

  constructor(voiceApiToken: string) {
    this.voiceApiToken = voiceApiToken
  }

  async initialize(): Promise<void> {
    if (!this.voiceApiToken) {
      throw new Error('Voice API token not configured')
    }
    this.connected = true
    console.log('✅ Phone provider initialized')
  }

  async send(message: ChannelResponse): Promise<void> {
    if (!this.connected) throw new Error('Phone provider not connected')

    console.log(`☎️ [Phone] → ${message.userId}: [voice message]`)

    // Simulate phone API call with text-to-speech
  }

  async receive(message: ChannelMessage): Promise<void> {
    console.log(`☎️ [Phone] ← ${message.userId}: [voice transcribed]`)
  }

  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Multi-Channel Router
 */
export class MultiChannelRouter {
  private providers: Map<Channel, IChannelProvider> = new Map()
  private userChannelMap: Map<string, Channel> = new Map()

  constructor() {
    // Initialize providers (override with real credentials)
    this.registerProvider(new TelegramProvider(process.env.TELEGRAM_BOT_TOKEN || ''))
    this.registerProvider(new SlackProvider(process.env.SLACK_TOKEN || ''))
    this.registerProvider(new EmailProvider(process.env.SMTP_SERVER || 'localhost'))
    this.registerProvider(new WhatsAppProvider(process.env.WHATSAPP_API_TOKEN || ''))
    this.registerProvider(new SMSProvider(process.env.SMS_API_KEY || ''))
    this.registerProvider(new PhoneProvider(process.env.VOICE_API_TOKEN || ''))
  }

  /**
   * Register channel provider
   */
  registerProvider(provider: IChannelProvider): void {
    this.providers.set(provider.name, provider)
    console.log(`✅ Registered provider: ${provider.name}`)
  }

  /**
   * Initialize all providers
   */
  async initializeAll(): Promise<void> {
    for (const provider of this.providers.values()) {
      try {
        await provider.initialize()
      } catch (error) {
        console.warn(`⚠️ Failed to initialize ${provider.name}:`, error)
      }
    }
  }

  /**
   * Send message to user (auto-detect channel)
   */
  async send(userId: string, content: string, formatting: 'plain' | 'markdown' | 'html' = 'plain'): Promise<void> {
    const channel = this.userChannelMap.get(userId)
    if (!channel) {
      console.warn(`⚠️ No channel set for user ${userId}`)
      return
    }

    await this.sendToChannel(channel, userId, content, formatting)
  }

  /**
   * Send message to specific channel
   */
  async sendToChannel(
    channel: Channel,
    userId: string,
    content: string,
    formatting: 'plain' | 'markdown' | 'html' = 'plain'
  ): Promise<void> {
    const provider = this.providers.get(channel)
    if (!provider) {
      throw new Error(`Provider not found: ${channel}`)
    }

    await provider.send({
      channel,
      userId,
      content,
      formatting
    })
  }

  /**
   * Route incoming message
   */
  async route(message: ChannelMessage): Promise<void> {
    const provider = this.providers.get(message.channel)
    if (!provider) {
      throw new Error(`Provider not found: ${message.channel}`)
    }

    // Remember user's preferred channel
    this.userChannelMap.set(message.userId, message.channel)

    // Handle message
    await provider.receive(message)
  }

  /**
   * Set user's preferred channel
   */
  setUserChannel(userId: string, channel: Channel): void {
    this.userChannelMap.set(userId, channel)
    console.log(`✅ Set ${userId} preferred channel: ${channel}`)
  }

  /**
   * Get connected channels
   */
  getConnectedChannels(): Channel[] {
    return Array.from(this.providers.values())
      .filter((p) => p.isConnected())
      .map((p) => p.name)
  }

  /**
   * Broadcast message to all channels
   */
  async broadcast(content: string, excludeChannels: Channel[] = []): Promise<void> {
    const channels = this.getConnectedChannels().filter((c) => !excludeChannels.includes(c))

    console.log(`📢 Broadcasting to ${channels.length} channels`)

    for (const channel of channels) {
      try {
        const provider = this.providers.get(channel)
        if (provider) {
          await provider.send({
            channel,
            userId: 'broadcast',
            content
          })
        }
      } catch (error) {
        console.error(`Failed to broadcast to ${channel}:`, error)
      }
    }
  }
}
