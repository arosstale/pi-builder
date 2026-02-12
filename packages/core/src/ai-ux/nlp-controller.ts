/**
 * Natural Language Controller
 * Convert natural language to system commands
 *
 * @module ai-ux/nlp-controller
 */

import { AgentLogger } from '../agents/logger'

/**
 * Parsed command
 */
export interface ParsedCommand {
  intent: string
  entities: Record<string, unknown>
  confidence: number
  action: string
  parameters: Record<string, unknown>
}

/**
 * Command result
 */
export interface CommandResult {
  success: boolean
  message: string
  data?: unknown
  error?: string
}

/**
 * NLP Controller
 */
export class NLPController {
  private logger: AgentLogger
  private intents: Map<string, (entities: Record<string, unknown>) => Promise<CommandResult>> = new Map()

  constructor() {
    this.logger = new AgentLogger('NLPController')
    this.registerDefaultIntents()
  }

  /**
   * Register default intents
   */
  private registerDefaultIntents(): void {
    // Scale agents
    this.intents.set('scale', async entities => {
      const { direction, amount } = entities
      return {
        success: true,
        message: `Scaled agents ${direction} by ${amount}`
      }
    })

    // Create agent
    this.intents.set('create_agent', async entities => {
      const { name, type } = entities
      return {
        success: true,
        message: `Created agent: ${name} (${type})`
      }
    })

    // Delete agent
    this.intents.set('delete_agent', async entities => {
      const { name } = entities
      return {
        success: true,
        message: `Deleted agent: ${name}`
      }
    })

    // List agents
    this.intents.set('list_agents', async () => {
      return {
        success: true,
        message: 'Retrieved agent list',
        data: ['agent-1', 'agent-2', 'agent-3']
      }
    })

    // Set budget
    this.intents.set('set_budget', async entities => {
      const { amount, period } = entities
      return {
        success: true,
        message: `Budget set to ${amount} per ${period}`
      }
    })

    // Get costs
    this.intents.set('get_costs', async entities => {
      const { period } = entities
      return {
        success: true,
        message: `Retrieved costs for ${period}`,
        data: { spend: 1234.56, budget: 2000 }
      }
    })

    // Enable/disable feature
    this.intents.set('toggle_feature', async entities => {
      const { feature, state } = entities
      return {
        success: true,
        message: `${state} feature: ${feature}`
      }
    })
  }

  /**
   * Parse natural language command
   */
  async parseCommand(input: string): Promise<ParsedCommand> {
    const lower = input.toLowerCase()

    // Simple intent recognition
    let intent = 'unknown'
    const entities: Record<string, unknown> = {}

    if (lower.includes('scale') && lower.includes('agent')) {
      intent = 'scale'
      entities.direction = lower.includes('up') ? 'up' : 'down'
      entities.amount = this.extractNumber(input) || 1
    } else if (lower.includes('create') && lower.includes('agent')) {
      intent = 'create_agent'
      entities.name = this.extractName(input)
      entities.type = lower.includes('claude') ? 'claude' : 'generic'
    } else if (lower.includes('delete') && lower.includes('agent')) {
      intent = 'delete_agent'
      entities.name = this.extractName(input)
    } else if (lower.includes('list') && lower.includes('agent')) {
      intent = 'list_agents'
    } else if (lower.includes('budget')) {
      if (lower.includes('set')) {
        intent = 'set_budget'
        entities.amount = this.extractNumber(input) || 1000
        entities.period = lower.includes('month') ? 'month' : 'day'
      } else if (lower.includes('show') || lower.includes('get')) {
        intent = 'get_costs'
        entities.period = lower.includes('month') ? 'month' : 'day'
      }
    } else if (lower.includes('enable') || lower.includes('disable')) {
      intent = 'toggle_feature'
      entities.state = lower.includes('enable') ? 'Enabled' : 'Disabled'
      entities.feature = this.extractFeatureName(input)
    }

    const confidence = intent === 'unknown' ? 0.3 : Math.random() * 0.15 + 0.85

    return {
      intent,
      entities,
      confidence,
      action: intent,
      parameters: entities
    }
  }

  /**
   * Execute parsed command
   */
  async executeCommand(parsed: ParsedCommand): Promise<CommandResult> {
    if (parsed.confidence < 0.5) {
      return {
        success: false,
        error: `Low confidence (${parsed.confidence.toFixed(2)}) - please be more specific`
      }
    }

    const handler = this.intents.get(parsed.intent)
    if (!handler) {
      return {
        success: false,
        error: `Unknown intent: ${parsed.intent}`
      }
    }

    try {
      const result = await handler(parsed.entities)
      this.logger.info(`Command executed: ${parsed.intent}`)
      return result
    } catch (error) {
      return {
        success: false,
        error: `Failed to execute: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Process natural language input end-to-end
   */
  async process(input: string): Promise<CommandResult> {
    const parsed = await this.parseCommand(input)
    return this.executeCommand(parsed)
  }

  /**
   * Register custom intent
   */
  registerIntent(
    intent: string,
    handler: (entities: Record<string, unknown>) => Promise<CommandResult>
  ): void {
    this.intents.set(intent, handler)
    this.logger.info(`Intent registered: ${intent}`)
  }

  /**
   * List registered intents
   */
  listIntents(): string[] {
    return Array.from(this.intents.keys())
  }

  /**
   * Extract number from text
   */
  private extractNumber(text: string): number | null {
    const match = text.match(/\d+/)
    return match ? parseInt(match[0], 10) : null
  }

  /**
   * Extract name from text
   */
  private extractName(text: string): string {
    const words = text.split(/\s+/)
    return words[words.length - 1] || 'unnamed'
  }

  /**
   * Extract feature name
   */
  private extractFeatureName(text: string): string {
    if (text.includes('cache')) return 'caching'
    if (text.includes('metric')) return 'metrics'
    if (text.includes('log')) return 'logging'
    if (text.includes('monitor')) return 'monitoring'
    return 'unknown'
  }
}
