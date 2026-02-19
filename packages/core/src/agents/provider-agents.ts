/**
 * Provider Agents
 * Specialized agent wrappers for different LLM providers
 * Enables all v1.1 providers to work as agents in the orchestration system
 *
 * @module agents/provider-agents
 */

import type { BaseAgent as Agent, Task, TaskResult } from './agent'
import { BaseAgent } from './agent'
import type { EnhancedProvider, ProviderMessage } from '../providers/enhanced-provider'

/**
 * Claude-specific agent wrapper
 */
export class ClaudeAgent extends BaseAgent {
  private provider: EnhancedProvider
  private maxRetries: number = 2

  constructor(provider: EnhancedProvider) {
    super({
      id: `claude-agent-${Date.now()}`,
      type: 'claude',
      name: 'Claude Agent',
      version: '1.0.0',
      enabled: true,
      capabilities: ['reasoning', 'analysis', 'code-review', 'writing', 'planning'],
      metadata: {
        model: provider.model,
        provider: 'Anthropic'
      }
    })
    this.provider = provider
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      // Convert task input to message format
      const messages = this.formatMessages(task.input)

      // Execute with retry logic
      let response: unknown
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          response = await this.provider.generate({
            messages,
            temperature: 0.7,
            maxTokens: (task.metadata?.maxTokens as number) || 2000
          })
          break
        } catch (error) {
          if (attempt === this.maxRetries) throw error
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }

      const latency = Date.now() - startTime
      this.recordExecution(true, latency)

      return {
        success: true,
        data: response,
        latency,
        cost: this.calculateCost(response),
        metadata: {
          agent: 'claude',
          model: this.provider.model,
          tokens: this.estimateTokens(response)
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordExecution(false, latency)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        latency,
        metadata: {
          agent: 'claude',
          error: true,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      }
    }
  }

  private formatMessages(
    input: unknown
  ): ProviderMessage[] {
    if (Array.isArray(input)) {
      return input as ProviderMessage[]
    }

    return [
      {
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input)
      }
    ]
  }

  private calculateCost(response: unknown): number {
    // Estimate based on response size
    const responseSize = JSON.stringify(response).length
    // Rough estimate: Claude pricing ~$0.01 per 1K tokens, ~4 chars per token
    return (responseSize / 4000) * 0.01
  }

  private estimateTokens(response: unknown): number {
    const responseSize = JSON.stringify(response).length
    return Math.ceil(responseSize / 4) // Rough estimate: 4 chars per token
  }
}

/**
 * OpenAI-specific agent wrapper
 */
export class OpenAIAgent extends BaseAgent {
  private provider: EnhancedProvider

  constructor(provider: EnhancedProvider) {
    super({
      id: `openai-agent-${Date.now()}`,
      type: 'custom',
      name: 'OpenAI Agent',
      version: '1.0.0',
      enabled: true,
      capabilities: ['general-purpose', 'code-generation', 'analysis'],
      metadata: {
        model: provider.model,
        provider: 'OpenAI'
      }
    })
    this.provider = provider
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      const messages = this.formatMessages(task.input)

      const response = await this.provider.generate({
        messages,
        temperature: 0.7,
        maxTokens: (task.metadata?.maxTokens as number) || 2000
      })

      const latency = Date.now() - startTime
      this.recordExecution(true, latency)

      return {
        success: true,
        data: response,
        latency,
        cost: this.calculateCost(response),
        metadata: {
          agent: 'openai',
          model: this.provider.model
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordExecution(false, latency)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        latency,
        metadata: { agent: 'openai', error: true }
      }
    }
  }

  private formatMessages(
    input: unknown
  ): ProviderMessage[] {
    if (Array.isArray(input)) {
      return input as ProviderMessage[]
    }

    return [
      {
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input)
      }
    ]
  }

  private calculateCost(response: unknown): number {
    // OpenAI pricing varies by model
    // Estimate: $0.002 per 1K tokens
    const responseSize = JSON.stringify(response).length
    return (responseSize / 4000) * 0.002
  }
}

/**
 * Google Gemini-specific agent wrapper
 */
export class GeminiAgent extends BaseAgent {
  private provider: EnhancedProvider

  constructor(provider: EnhancedProvider) {
    super({
      id: `gemini-agent-${Date.now()}`,
      type: 'custom',
      name: 'Gemini Agent',
      version: '1.0.0',
      enabled: true,
      capabilities: ['multimodal', 'research', 'analysis', 'generation'],
      metadata: {
        model: provider.model,
        provider: 'Google'
      }
    })
    this.provider = provider
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      const messages = this.formatMessages(task.input)

      const response = await this.provider.generate({
        messages,
        temperature: 0.7,
        maxTokens: (task.metadata?.maxTokens as number) || 2000
      })

      const latency = Date.now() - startTime
      this.recordExecution(true, latency)

      return {
        success: true,
        data: response,
        latency,
        cost: this.calculateCost(response),
        metadata: {
          agent: 'gemini',
          model: this.provider.model
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordExecution(false, latency)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        latency,
        metadata: { agent: 'gemini', error: true }
      }
    }
  }

  private formatMessages(
    input: unknown
  ): ProviderMessage[] {
    if (Array.isArray(input)) {
      return input as ProviderMessage[]
    }

    return [
      {
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input)
      }
    ]
  }

  private calculateCost(response: unknown): number {
    // Gemini pricing: free tier available, paid tier $0.001 per 1K tokens
    const responseSize = JSON.stringify(response).length
    return (responseSize / 4000) * 0.001
  }
}

/**
 * Generic provider agent wrapper for unknown providers
 */
export class GenericProviderAgent extends BaseAgent {
  private provider: EnhancedProvider

  constructor(provider: EnhancedProvider) {
    super({
      id: `generic-agent-${Date.now()}`,
      type: 'custom',
      name: `${provider.name} Agent`,
      version: '1.0.0',
      enabled: true,
      capabilities: ['text-generation', 'analysis'],
      metadata: {
        model: provider.model,
        provider: provider.name
      }
    })
    this.provider = provider
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      const messages = this.formatMessages(task.input)

      const response = await this.provider.generate({
        messages,
        temperature: 0.7,
        maxTokens: (task.metadata?.maxTokens as number) || 2000
      })

      const latency = Date.now() - startTime
      this.recordExecution(true, latency)

      return {
        success: true,
        data: response,
        latency,
        cost: this.calculateCost(response),
        metadata: {
          agent: this.provider.name,
          model: this.provider.model
        }
      }
    } catch (error) {
      const latency = Date.now() - startTime
      this.recordExecution(false, latency)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        latency,
        metadata: { agent: this.provider.name, error: true }
      }
    }
  }

  private formatMessages(
    input: unknown
  ): ProviderMessage[] {
    if (Array.isArray(input)) {
      return input as ProviderMessage[]
    }

    return [
      {
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input)
      }
    ]
  }

  private calculateCost(response: unknown): number {
    // Generic estimate
    const responseSize = JSON.stringify(response).length
    return (responseSize / 4000) * 0.01
  }
}

/**
 * Factory function to create appropriate agent for provider
 */
export function createProviderAgent(
  provider: EnhancedProvider
): BaseAgent {
  const name = provider.name.toLowerCase()

  if (name.includes('claude')) {
    return new ClaudeAgent(provider)
  } else if (name.includes('openai') || name.includes('gpt')) {
    return new OpenAIAgent(provider)
  } else if (name.includes('gemini') || name.includes('google')) {
    return new GeminiAgent(provider)
  }

  return new GenericProviderAgent(provider)
}
