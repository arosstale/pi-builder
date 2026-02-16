import { BaseAgent } from './base-agent'
import { ClaudeAgent } from './claude-agent'
import { AgentLogger as Logger } from './logger'

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map()
  private logger = new Logger('AgentRegistry')

  /**
   * Register an agent
   */
  register(name: string, agent: BaseAgent): void {
    this.logger.info(`Registering agent: ${name}`)
    this.agents.set(name, agent)
  }

  /**
   * Get an agent
   */
  getAgent(name: string): BaseAgent {
    const agent = this.agents.get(name)

    if (!agent) {
      throw new Error(`Agent not found: ${name}`)
    }

    return agent
  }

  /**
   * List all agents
   */
  listAgents(): string[] {
    return Array.from(this.agents.keys())
  }

  /**
   * Check if agent exists
   */
  hasAgent(name: string): boolean {
    return this.agents.has(name)
  }

  /**
   * Remove an agent
   */
  removeAgent(name: string): void {
    this.logger.info(`Removing agent: ${name}`)
    this.agents.delete(name)
  }

  /**
   * Get Claude agent (default)
   */
  getClaudeAgent(): ClaudeAgent {
    let agent = this.agents.get('claude') as ClaudeAgent

    if (!agent) {
      agent = new ClaudeAgent()
      this.register('claude', agent)
    }

    return agent
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry()
