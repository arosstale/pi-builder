/**
 * Advanced Routing Strategies
 * Failover, circuit breaker, and rate limiting for resilient agent orchestration
 *
 * @module agents/advanced-routing
 */

import type { IAgent, Task, TaskResult } from './agent'
import { AgentLogger } from './logger'

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open'
  failures: number
  successes: number
  openedAt: number
  lastAttempt: number
}

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  tokens: number
  capacity: number
  refillRate: number
  lastRefillTime: number
}

/**
 * Failover strategy with circuit breaker
 */
export class FailoverStrategy {
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map()
  private failureThreshold: number = 5
  private successThreshold: number = 2
  private openTimeout: number = 60000 // 1 minute
  private logger: AgentLogger

  constructor(
    failureThreshold: number = 5,
    successThreshold: number = 2,
    openTimeout: number = 60000
  ) {
    this.failureThreshold = failureThreshold
    this.successThreshold = successThreshold
    this.openTimeout = openTimeout
    this.logger = new AgentLogger('FailoverStrategy')
  }

  /**
   * Execute task with automatic failover
   */
  async execute(
    task: Task,
    agents: IAgent[],
    primaryIndex: number = 0
  ): Promise<TaskResult> {
    if (agents.length === 0) {
      throw new Error('No agents available')
    }

    let lastError: Error | null = null

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[(primaryIndex + i) % agents.length]

      // Check if circuit is open
      if (this.isCircuitOpen(agent.id)) {
        this.logger.info(`Skipping ${agent.id}: circuit open`)
        continue
      }

      try {
        const result = await agent.execute(task)

        // Record success
        this.recordSuccess(agent.id)

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.recordFailure(agent.id)

        if (i < agents.length - 1) {
          this.logger.warn(`Agent ${agent.id} failed, trying next...`)
          continue
        }
      }
    }

    throw lastError || new Error('All agents failed')
  }

  /**
   * Check if circuit is open
   */
  private isCircuitOpen(agentId: string): boolean {
    const state = this.circuitBreaker.get(agentId)
    if (!state) return false

    if (state.status === 'open') {
      const timeSinceOpen = Date.now() - state.openedAt
      if (timeSinceOpen > this.openTimeout) {
        state.status = 'half-open'
        state.lastAttempt = Date.now()
        return false
      }
      return true
    }

    return false
  }

  /**
   * Record failure
   */
  private recordFailure(agentId: string): void {
    const state = this.getOrCreateState(agentId)

    state.failures++
    state.lastAttempt = Date.now()

    if (state.failures >= this.failureThreshold) {
      state.status = 'open'
      state.openedAt = Date.now()
      this.logger.warn(`Circuit opened for ${agentId}`)
    }

    this.circuitBreaker.set(agentId, state)
  }

  /**
   * Record success
   */
  private recordSuccess(agentId: string): void {
    const state = this.getOrCreateState(agentId)

    state.successes++
    state.lastAttempt = Date.now()

    if (state.status === 'half-open') {
      if (state.successes >= this.successThreshold) {
        state.status = 'closed'
        state.failures = 0
        state.successes = 0
        this.logger.info(`Circuit closed for ${agentId}`)
      }
    }

    this.circuitBreaker.set(agentId, state)
  }

  /**
   * Get or create circuit breaker state
   */
  private getOrCreateState(agentId: string): CircuitBreakerState {
    if (!this.circuitBreaker.has(agentId)) {
      this.circuitBreaker.set(agentId, {
        status: 'closed',
        failures: 0,
        successes: 0,
        openedAt: 0,
        lastAttempt: Date.now()
      })
    }

    return this.circuitBreaker.get(agentId)!
  }

  /**
   * Get circuit breaker state
   */
  getState(agentId: string): CircuitBreakerState | undefined {
    return this.circuitBreaker.get(agentId)
  }

  /**
   * Reset circuit breaker
   */
  reset(agentId?: string): void {
    if (agentId) {
      this.circuitBreaker.delete(agentId)
    } else {
      this.circuitBreaker.clear()
    }
  }
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map()
  private defaultCapacity: number = 100
  private defaultRefillRate: number = 1 // tokens per second
  private logger: AgentLogger

  constructor(
    capacity: number = 100,
    refillRate: number = 1
  ) {
    this.defaultCapacity = capacity
    this.defaultRefillRate = refillRate
    this.logger = new AgentLogger('RateLimiter')
  }

  /**
   * Try to acquire tokens
   */
  async acquire(agentId: string, tokens: number = 1): Promise<boolean> {
    const bucket = this.getOrCreateBucket(agentId)

    this.refill(bucket)

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens
      return true
    }

    return false
  }

  /**
   * Acquire tokens, waiting if necessary
   */
  async acquireWait(
    agentId: string,
    tokens: number = 1,
    maxWait: number = 10000
  ): Promise<boolean> {
    const startTime = Date.now()

    while (true) {
      const acquired = await this.acquire(agentId, tokens)
      if (acquired) return true

      const elapsed = Date.now() - startTime
      if (elapsed > maxWait) {
        this.logger.warn(`Rate limit timeout for ${agentId}`)
        return false
      }

      const bucket = this.buckets.get(agentId)!
      const waitTime = Math.min(
        (tokens - bucket.tokens) / bucket.refillRate * 1000,
        100
      )

      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  /**
   * Get bucket
   */
  private getOrCreateBucket(agentId: string): TokenBucket {
    if (!this.buckets.has(agentId)) {
      this.buckets.set(agentId, {
        tokens: this.defaultCapacity,
        capacity: this.defaultCapacity,
        refillRate: this.defaultRefillRate,
        lastRefillTime: Date.now()
      })
    }

    return this.buckets.get(agentId)!
  }

  /**
   * Refill tokens
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now()
    const timePassed = (now - bucket.lastRefillTime) / 1000
    const tokensToAdd = timePassed * bucket.refillRate

    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd)
    bucket.lastRefillTime = now
  }

  /**
   * Reset rate limiter
   */
  reset(agentId?: string): void {
    if (agentId) {
      this.buckets.delete(agentId)
    } else {
      this.buckets.clear()
    }
  }

  /**
   * Get bucket state
   */
  getBucketState(agentId: string): TokenBucket | undefined {
    return this.buckets.get(agentId)
  }
}

/**
 * ML-based routing strategy selector
 */
export class MLRoutingStrategy {
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('MLRouting')
  }

  /**
   * Select best agent for task using ML-like scoring
   */
  async selectBestAgent(task: Task, agents: IAgent[]): Promise<IAgent> {
    if (agents.length === 0) {
      throw new Error('No agents available')
    }

    if (agents.length === 1) {
      return agents[0]
    }

    // Get health metrics for all agents
    const healthData = await Promise.all(
      agents.map(async agent => ({
        agent,
        health: await agent.getHealth()
      }))
    )

    // Score each agent
    const scores = healthData.map(({ agent, health }) => ({
      agent,
      score: this.calculateScore(health, task)
    }))

    // Sort by score
    scores.sort((a, b) => b.score - a.score)

    const selected = scores[0].agent
    this.logger.info(
      `Selected ${selected.id} for ${task.type} (score: ${scores[0].score.toFixed(2)})`
    )

    return selected
  }

  /**
   * Calculate agent score based on health and task
   */
  private calculateScore(health: Awaited<ReturnType<IAgent['getHealth']>>, task: Task): number {
    // Weights for different metrics
    const successWeight = 0.4
    const latencyWeight = 0.3
    const healthWeight = 0.2
    const recencyWeight = 0.1

    // Success score (0-1)
    const successScore = health.isHealthy ? 1 : Math.max(0, 1 - health.errorRate)

    // Latency score (0-1, higher is better, inverse)
    const maxLatency = 5000 // 5 seconds
    const latencyScore = Math.max(0, 1 - health.avgLatency / maxLatency)

    // Health score
    const healthScore = health.isHealthy ? 1 : 0.5

    // Recency score (prefer recently used agents)
    const recencyScore = Math.random() // In real scenario, would use actual timing

    return (
      successScore * successWeight +
      latencyScore * latencyWeight +
      healthScore * healthWeight +
      recencyScore * recencyWeight
    )
  }
}

/**
 * Combined advanced routing manager
 */
export class AdvancedRoutingManager {
  private failover: FailoverStrategy
  private rateLimiter: RateLimiter
  private mlRouter: MLRoutingStrategy
  private logger: AgentLogger

  constructor() {
    this.failover = new FailoverStrategy()
    this.rateLimiter = new RateLimiter()
    this.mlRouter = new MLRoutingStrategy()
    this.logger = new AgentLogger('AdvancedRouting')
  }

  /**
   * Execute with all safety features
   */
  async execute(
    task: Task,
    agents: IAgent[]
  ): Promise<TaskResult> {
    // Select best agent using ML
    const selectedAgent = await this.mlRouter.selectBestAgent(task, agents)

    // Check rate limit
    const canExecute = await this.rateLimiter.acquireWait(selectedAgent.id)
    if (!canExecute) {
      throw new Error(`Rate limit exceeded for ${selectedAgent.id}`)
    }

    // Execute with failover support
    try {
      return await this.failover.execute(
        task,
        agents,
        agents.indexOf(selectedAgent)
      )
    } catch (error) {
      this.logger.error(`Execution failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * Get routing manager state
   */
  getState() {
    return {
      failover: {
        circuitBreakers: Array.from(
          new Map(
            Object.entries({})
          ).entries()
        ).map(([id]) => ({
          agentId: id,
          state: this.failover.getState(id)
        }))
      },
      rateLimiter: {}
    }
  }
}
