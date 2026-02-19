/**
 * Agent Orchestrator
 * Routes tasks to appropriate agents and coordinates multi-agent collaboration
 *
 * @module agents/orchestrator
 */

import type { EventEmitter } from 'events'
import type {
  IAgent,
  Task,
  TaskResult,
  AgentHealth,
  AggregatedResult,
  AgentExecutionEvent
} from './agent'
import { AgentLogger } from './logger'

/**
 * Agent routing strategy
 */
export type RoutingStrategy = 'capability' | 'cost' | 'latency' | 'failover' | 'consensus'

/**
 * Routing decision
 */
export interface RoutingDecision {
  selectedAgent: IAgent
  reason: string
  alternatives: IAgent[]
  confidence: number
  metadata?: Record<string, unknown>
}

/**
 * Orchestration configuration
 */
export interface OrchestratorConfig {
  name: string
  strategy: RoutingStrategy
  enableMetrics: boolean
  enableLogging: boolean
  timeout?: number
  maxConcurrentTasks?: number
  metadata?: Record<string, unknown>
}

/**
 * Agent Orchestrator - Core orchestration engine
 */
export class AgentOrchestrator {
  private agents: Map<string, IAgent> = new Map()
  private config: OrchestratorConfig
  private logger: AgentLogger
  private eventEmitter?: EventEmitter
  private metrics = {
    totalTasks: 0,
    successfulTasks: 0,
    failedTasks: 0,
    totalCost: 0,
    totalLatency: 0,
    agentMetrics: new Map<string, {
      tasksExecuted: number
      successCount: number
      errorCount: number
      totalLatency: number
      totalCost: number
    }>()
  }

  constructor(config: OrchestratorConfig, logger?: AgentLogger) {
    this.config = config
    this.logger = logger || new AgentLogger('Orchestrator')
  }

  /**
   * Set event emitter for real-time updates
   */
  setEventEmitter(emitter: EventEmitter): void {
    this.eventEmitter = emitter
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      this.logger.warn(`Agent ${agent.id} already registered, replacing`)
    }

    this.agents.set(agent.id, agent)
    this.metrics.agentMetrics.set(agent.id, {
      tasksExecuted: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      totalCost: 0
    })

    if (this.config.enableLogging) {
      this.logger.info(`Agent registered: ${agent.id} (${agent.type})`)
    }
  }

  /**
   * Deregister an agent
   */
  deregisterAgent(agentId: string): void {
    this.agents.delete(agentId)
    this.metrics.agentMetrics.delete(agentId)

    if (this.config.enableLogging) {
      this.logger.info(`Agent deregistered: ${agentId}`)
    }
  }

  /**
   * Get all registered agents
   */
  getAgents(): IAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Find agents that can handle a capability
   */
  findCapableAgents(capability: string): IAgent[] {
    return Array.from(this.agents.values()).filter(agent =>
      agent.hasCapability(capability)
    )
  }

  /**
   * Route a task to the best agent based on strategy
   */
  async routeTask(task: Task): Promise<RoutingDecision> {
    const strategy = this.config.strategy

    switch (strategy) {
      case 'capability':
        return this.routeByCapability(task)
      case 'cost':
        return this.routeByCost(task)
      case 'latency':
        return this.routeByLatency(task)
      case 'failover':
        return this.routeWithFailover(task)
      case 'consensus':
        return this.selectForConsensus(task)
      default:
        throw new Error(`Unknown routing strategy: ${strategy}`)
    }
  }

  /**
   * Execute a task with the best agent
   */
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    try {
      // Emit start event
      this.emitEvent({
        agentId: 'orchestrator',
        taskId: task.id,
        type: 'start',
        timestamp: new Date()
      })

      // Route task to best agent
      const routing = await this.routeTask(task)
      const selectedAgent = routing.selectedAgent

      if (this.config.enableLogging) {
        this.logger.info(
          `Routing task ${task.id} to agent ${selectedAgent.id}: ${routing.reason}`
        )
      }

      // Execute task
      const result = await selectedAgent.execute(task)
      const latency = Date.now() - startTime

      // Update metrics
      this.updateMetrics(selectedAgent.id, true, latency, result.cost || 0)

      // Emit completion event
      this.emitEvent({
        agentId: selectedAgent.id,
        taskId: task.id,
        type: 'complete',
        timestamp: new Date(),
        data: result
      })

      return result
    } catch (error) {
      const latency = Date.now() - startTime
      this.updateMetrics('orchestrator', false, latency, 0)

      this.emitEvent({
        agentId: 'orchestrator',
        taskId: task.id,
        type: 'error',
        timestamp: new Date(),
        data: error
      })

      throw error
    }
  }

  /**
   * Collaborate - execute task with multiple agents and aggregate results
   */
  async collaborate(
    task: Task,
    agentIds?: string[]
  ): Promise<AggregatedResult> {
    const startTime = Date.now()
    const agents = agentIds
      ? agentIds.map(id => this.agents.get(id)).filter(Boolean) as IAgent[]
      : Array.from(this.agents.values())

    if (agents.length === 0) {
      throw new Error('No agents available for collaboration')
    }

    const results = new Map<string, TaskResult>()
    const promises = agents.map(agent =>
      agent
        .execute(task)
        .then(result => {
          results.set(agent.id, result)
          return result
        })
        .catch(error => {
          results.set(agent.id, {
            success: false,
            error: error as Error,
            latency: 0
          })
          return null
        })
    )

    await Promise.all(promises)

    const aggregated = this.aggregateResults(task.id, results)
    const executionTime = Date.now() - startTime

    if (this.config.enableLogging) {
      this.logger.info(
        `Collaboration complete for task ${task.id}: ${agents.length} agents, ${executionTime}ms`
      )
    }

    return {
      ...aggregated,
      executionTime,
      timestamp: new Date()
    }
  }

  /**
   * Route by capability - find agent with required capability
   */
  private async routeByCapability(task: Task): Promise<RoutingDecision> {
    const capableAgents = this.findCapableAgents(task.type)

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of handling task type: ${task.type}`)
    }

    // Select first capable agent (can be enhanced with scoring)
    const selected = capableAgents[0]

    return {
      selectedAgent: selected,
      reason: `Agent has capability: ${task.type}`,
      alternatives: capableAgents.slice(1),
      confidence: 0.9
    }
  }

  /**
   * Route by cost - select cheapest agent
   */
  private async routeByLatency(task: Task): Promise<RoutingDecision> {
    const capableAgents = this.findCapableAgents(task.type)

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of handling task type: ${task.type}`)
    }

    // Get health for all agents
    const healthData = await Promise.all(
      capableAgents.map(async agent => ({
        agent,
        health: await agent.getHealth()
      }))
    )

    // Sort by latency (ascending)
    healthData.sort((a, b) => a.health.avgLatency - b.health.avgLatency)

    const selected = healthData[0].agent
    const avgLatency = healthData[0].health.avgLatency

    return {
      selectedAgent: selected,
      reason: `Selected for lowest latency: ${avgLatency.toFixed(2)}ms`,
      alternatives: healthData.slice(1).map(hd => hd.agent),
      confidence: 0.85
    }
  }

  /**
   * Route by cost - select cheapest agent
   */
  private async routeByCost(task: Task): Promise<RoutingDecision> {
    const capableAgents = this.findCapableAgents(task.type)

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of handling task type: ${task.type}`)
    }

    // For now, just use capability routing
    // In production, would look at cost metrics per agent
    return this.routeByCapability(task)
  }

  /**
   * Route with failover - try multiple agents until success
   */
  private async routeWithFailover(task: Task): Promise<RoutingDecision> {
    const capableAgents = this.findCapableAgents(task.type)

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of handling task type: ${task.type}`)
    }

    // Return first capable agent as primary, others as fallback
    return {
      selectedAgent: capableAgents[0],
      reason: `Primary agent selected, ${capableAgents.length - 1} failover agents available`,
      alternatives: capableAgents.slice(1),
      confidence: 0.95
    }
  }

  /**
   * Select agents for consensus voting
   */
  private async selectForConsensus(task: Task): Promise<RoutingDecision> {
    const capableAgents = this.findCapableAgents(task.type)

    if (capableAgents.length === 0) {
      throw new Error(`No agents capable of handling task type: ${task.type}`)
    }

    // Select multiple agents for consensus (at least 3 or all if fewer)
    const consensusSize = Math.min(3, capableAgents.length)
    const selected = capableAgents[0]
    const others = capableAgents.slice(1, consensusSize)

    return {
      selectedAgent: selected,
      reason: `Consensus mode: using ${consensusSize} agents`,
      alternatives: others,
      confidence: 0.99
    }
  }

  /**
   * Aggregate results from multiple agents
   */
  private aggregateResults(
    taskId: string,
    results: Map<string, TaskResult>
  ): Omit<AggregatedResult, 'executionTime' | 'timestamp'> {
    const successfulResults = Array.from(results.values()).filter(r => r.success)

    // Find best result (highest success, lowest latency)
    let bestResult: TaskResult | undefined
    if (successfulResults.length > 0) {
      bestResult = successfulResults.reduce((best, current) =>
        (current.latency ?? 0) < (best.latency ?? 0) ? current : best
      )
    }

    // Simple voting: count successful vs failed
    const votes = new Map<string, number>()
    votes.set('success', successfulResults.length)
    votes.set('failed', results.size - successfulResults.length)

    return {
      taskId,
      results,
      bestResult,
      votes,
      consensus: successfulResults.length > results.size / 2
    }
  }

  /**
   * Update metrics for an agent
   */
  private updateMetrics(
    agentId: string,
    success: boolean,
    latency: number,
    cost: number
  ): void {
    if (!this.config.enableMetrics) return

    const metrics = this.metrics.agentMetrics.get(agentId) || {
      tasksExecuted: 0,
      successCount: 0,
      errorCount: 0,
      totalLatency: 0,
      totalCost: 0
    }

    metrics.tasksExecuted++
    if (success) {
      metrics.successCount++
    } else {
      metrics.errorCount++
    }
    metrics.totalLatency += latency
    metrics.totalCost += cost

    this.metrics.agentMetrics.set(agentId, metrics)

    // Update global metrics
    this.metrics.totalTasks++
    if (success) {
      this.metrics.successfulTasks++
    } else {
      this.metrics.failedTasks++
    }
    this.metrics.totalLatency += latency
    this.metrics.totalCost += cost
  }

  /**
   * Emit execution event
   */
  private emitEvent(event: AgentExecutionEvent): void {
    if (this.eventEmitter) {
      this.eventEmitter.emit('agent:execution', event)
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      agentMetrics: Object.fromEntries(this.metrics.agentMetrics)
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      totalCost: 0,
      totalLatency: 0,
      agentMetrics: new Map()
    }
  }

  /**
   * Get orchestrator health
   */
  async getHealth(): Promise<{
    isHealthy: boolean
    agentCount: number
    uptime: number
    successRate: number
    avgLatency: number
    metrics: unknown
  }> {
    const successRate =
      this.metrics.totalTasks > 0
        ? this.metrics.successfulTasks / this.metrics.totalTasks
        : 0
    const avgLatency =
      this.metrics.totalTasks > 0 ? this.metrics.totalLatency / this.metrics.totalTasks : 0

    const agentHealths = await Promise.all(
      Array.from(this.agents.values()).map(agent => agent.getHealth())
    )

    const isHealthy = agentHealths.some(h => h.isHealthy)

    return {
      isHealthy,
      agentCount: this.agents.size,
      uptime: this.metrics.totalTasks,
      successRate,
      avgLatency,
      metrics: this.getMetrics()
    }
  }
}
