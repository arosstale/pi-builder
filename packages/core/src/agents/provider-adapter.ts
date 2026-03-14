/**
 * Provider Adapter
 * Wraps existing v1.1 providers as agents for orchestration
 *
 * @module agents/provider-adapter
 */

import type { BaseAgent as Agent, IAgent, Task, TaskResult } from './agent'
import { BaseAgent } from './agent'
import type { EnhancedProvider } from '../providers/enhanced-provider'

/**
 * Adapter that wraps an EnhancedProvider as an Agent
 */
export class ProviderAdapter extends BaseAgent {
  private provider: EnhancedProvider

  constructor(provider: EnhancedProvider) {
    super({
      id: `provider-${provider.id}`,
      type: 'custom',
      name: `${provider.name} Adapter`,
      version: '1.0.0',
      enabled: true,
      capabilities: [],
    })
    this.provider = provider
  }

  /**
   * Execute task using the wrapped provider
   */
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      // Map task input to provider format
      const messages =
        task.input instanceof Array ? task.input : [{ role: 'user', content: task.input }]

      // Execute with provider
      const response = await Promise.race([
        this.provider.generate({
          messages,
          model: this.provider.model,
          temperature: 0.7,
          maxTokens: 1000
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Provider timeout')),
            task.timeout || 30000
          )
        )
      ])

      const latency = Date.now() - startTime
      this.recordExecution(true, latency)

      return {
        success: true,
        data: response,
        latency,
        metadata: {
          provider: this.provider.name,
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
        metadata: {
          provider: this.provider.name,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      }
    }
  }

  /**
   * Get underlying provider
   */
  getProvider(): EnhancedProvider {
    return this.provider
  }

  /**
   * Extract capabilities from provider
   */
  private extractCapabilities(provider: EnhancedProvider): string[] {
    const capabilities: string[] = []

    // Base capability
    capabilities.push('text-generation')

    // Provider-specific capabilities
    if (provider.name.includes('Claude')) {
      capabilities.push('reasoning', 'analysis', 'code-review')
    } else if (provider.name.includes('GPT')) {
      capabilities.push('general-purpose', 'code-generation')
    } else if (provider.name.includes('Gemini')) {
      capabilities.push('multimodal', 'research')
    }

    return capabilities
  }
}

/**
 * Create adapter from provider configuration
 */
export function createProviderAdapter(provider: EnhancedProvider): ProviderAdapter {
  return new ProviderAdapter(provider)
}

/**
 * Create adapters from multiple providers
 */
export function createProviderAdapters(providers: EnhancedProvider[]): ProviderAdapter[] {
  return providers.map(provider => createProviderAdapter(provider))
}
