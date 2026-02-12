/**
 * Agent Registry & Discovery
 * Central registry for all agents in the system
 * Provides discovery, registration, and management capabilities
 *
 * @module agents/agent-registry
 */

import type { IAgent, AgentCapability } from './agent'
import { createProviderAgent } from './provider-agents'
import type { EnhancedProvider } from '../providers/enhanced-provider'
import { AgentLogger } from './logger'

/**
 * Agent registry with discovery and management
 */
export class AgentRegistry {
  private agents: Map<string, IAgent> = new Map()
  private byCapability: Map<string, Set<string>> = new Map()
  private byType: Map<string, Set<string>> = new Map()
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('AgentRegistry')
  }

  /**
   * Register an agent
   */
  registerAgent(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      this.logger.warn(`Agent ${agent.id} already registered, replacing`)
    }

    this.agents.set(agent.id, agent)

    // Index by capability
    for (const capability of agent.capabilities) {
      if (!this.byCapability.has(capability)) {
        this.byCapability.set(capability, new Set())
      }
      this.byCapability.get(capability)!.add(agent.id)
    }

    // Index by type
    if (!this.byType.has(agent.type)) {
      this.byType.set(agent.type, new Set())
    }
    this.byType.get(agent.type)!.add(agent.id)

    this.logger.info(`Agent registered: ${agent.id} (${agent.type})`)
  }

  /**
   * Register a provider as agent
   */
  registerProvider(provider: EnhancedProvider): IAgent {
    const agent = createProviderAgent(provider)
    this.registerAgent(agent)
    return agent
  }

  /**
   * Deregister an agent
   */
  deregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    this.agents.delete(agentId)

    // Remove from capability index
    for (const capability of agent.capabilities) {
      const set = this.byCapability.get(capability)
      if (set) {
        set.delete(agentId)
        if (set.size === 0) {
          this.byCapability.delete(capability)
        }
      }
    }

    // Remove from type index
    const typeSet = this.byType.get(agent.type)
    if (typeSet) {
      typeSet.delete(agentId)
      if (typeSet.size === 0) {
        this.byType.delete(agent.type)
      }
    }

    this.logger.info(`Agent deregistered: ${agentId}`)
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id)
  }

  /**
   * Get all agents
   */
  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Discover agents by capability
   */
  discoverByCapability(capability: string): IAgent[] {
    const agentIds = this.byCapability.get(capability)
    if (!agentIds) return []

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(Boolean) as IAgent[]
  }

  /**
   * Discover agents by type
   */
  discoverByType(type: string): IAgent[] {
    const agentIds = this.byType.get(type)
    if (!agentIds) return []

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(Boolean) as IAgent[]
  }

  /**
   * Discover agents with all of these capabilities
   */
  discoverWithAll(capabilities: string[]): IAgent[] {
    const candidates = this.getAllAgents()

    return candidates.filter(agent =>
      capabilities.every(cap => agent.hasCapability(cap))
    )
  }

  /**
   * Discover agents with any of these capabilities
   */
  discoverWithAny(capabilities: string[]): IAgent[] {
    const candidates = this.getAllAgents()

    return candidates.filter(agent =>
      capabilities.some(cap => agent.hasCapability(cap))
    )
  }

  /**
   * Get all available capabilities
   */
  getAvailableCapabilities(): string[] {
    return Array.from(this.byCapability.keys())
  }

  /**
   * Get all agent types
   */
  getAvailableTypes(): string[] {
    return Array.from(this.byType.keys())
  }

  /**
   * Get agent statistics
   */
  getStatistics(): {
    totalAgents: number
    byType: Record<string, number>
    capabilities: string[]
  } {
    const byType: Record<string, number> = {}
    for (const [type, agents] of this.byType.entries()) {
      byType[type] = agents.size
    }

    return {
      totalAgents: this.agents.size,
      byType,
      capabilities: this.getAvailableCapabilities()
    }
  }

  /**
   * Clear all agents
   */
  clear(): void {
    this.agents.clear()
    this.byCapability.clear()
    this.byType.clear()
    this.logger.info('Agent registry cleared')
  }

  /**
   * Export registry state
   */
  export(): {
    agents: Array<{ id: string; name: string; type: string; capabilities: string[] }>
    statistics: ReturnType<AgentRegistry['getStatistics']>
  } {
    return {
      agents: Array.from(this.agents.values()).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        capabilities: a.capabilities
      })),
      statistics: this.getStatistics()
    }
  }
}

/**
 * Global singleton registry instance
 */
export const globalAgentRegistry = new AgentRegistry()
