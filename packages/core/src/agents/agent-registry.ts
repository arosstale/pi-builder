import { BaseAgent } from './base-agent'
import { ClaudeAgent } from './claude-agent'
import { AgentLogger as Logger } from './logger'

interface RegistryAgent {
  id: string
  type?: string
  capabilities?: string[]
  [key: string]: unknown
}

export class AgentRegistry {
  private agents: Map<string, BaseAgent | RegistryAgent> = new Map()
  private deregistered: Set<string> = new Set()
  private logger = new Logger('AgentRegistry')

  /** Register by name (legacy API) */
  register(name: string, agent: BaseAgent): void {
    this.logger.info(`Registering agent: ${name}`)
    this.agents.set(name, agent)
  }

  /** Register by agent.id (new API used by tests) */
  registerAgent(agent: RegistryAgent): void {
    this.logger.info(`Registering agent: ${agent.id}`)
    this.agents.set(agent.id, agent as unknown as BaseAgent)
  }

  /** Deregister by id */
  deregisterAgent(id: string): void {
    this.logger.info(`Deregistering agent: ${id}`)
    this.agents.delete(id)
    this.deregistered.add(id)
  }

  /** Get by id or name — returns undefined if deregistered, throws if never seen */
  getAgent(id: string): RegistryAgent | undefined {
    if (this.deregistered.has(id)) return undefined
    const agent = this.agents.get(id)
    if (!agent) throw new Error(`Agent not found: ${id}`)
    return agent as unknown as RegistryAgent
  }

  /** Alias for getAgent — throws if not found */
  requireAgent(id: string): RegistryAgent {
    const agent = this.agents.get(id)
    if (!agent) throw new Error(`Agent not found: ${id}`)
    return agent as unknown as RegistryAgent
  }

  /** Find agent — never throws */
  findAgent(id: string): RegistryAgent | undefined {
    return this.agents.get(id) as unknown as RegistryAgent | undefined
  }

  /** List all agent ids/names */
  listAgents(): string[] {
    return Array.from(this.agents.keys())
  }

  hasAgent(id: string): boolean {
    return this.agents.has(id)
  }

  /** Remove by name (legacy) */
  removeAgent(name: string): void {
    this.logger.info(`Removing agent: ${name}`)
    this.agents.delete(name)
  }

  discoverByCapability(capability: string): RegistryAgent[] {
    return Array.from(this.agents.values())
      .map(a => a as unknown as RegistryAgent)
      .filter(a => Array.isArray(a.capabilities) && a.capabilities.includes(capability))
  }

  discoverByType(type: string): RegistryAgent[] {
    return Array.from(this.agents.values())
      .map(a => a as unknown as RegistryAgent)
      .filter(a => a.type === type)
  }

  discoverWithAll(capabilities: string[]): RegistryAgent[] {
    return Array.from(this.agents.values())
      .map(a => a as unknown as RegistryAgent)
      .filter(a => Array.isArray(a.capabilities) && capabilities.every(c => a.capabilities!.includes(c)))
  }

  getStatistics() {
    const agents = Array.from(this.agents.values()) as unknown as RegistryAgent[]
    const byType: Record<string, number> = {}
    for (const a of agents) {
      if (a.type) byType[a.type] = (byType[a.type] ?? 0) + 1
    }
    return { totalAgents: this.agents.size, byType }
  }

  /** Get Claude agent (default) */
  getClaudeAgent(): ClaudeAgent {
    let agent = this.agents.get('claude') as ClaudeAgent
    if (!agent) {
      agent = new ClaudeAgent()
      this.register('claude', agent)
    }
    return agent
  }
}

export const agentRegistry = new AgentRegistry()
