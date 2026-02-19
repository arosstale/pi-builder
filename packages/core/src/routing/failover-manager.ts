/**
 * Failover Manager - Automatic Provider Failover & Recovery
 *
 * Handles:
 * - Automatic failure detection
 * - Provider switching
 * - Recovery strategies
 * - Health check scheduling
 */

import type { EnhancedProvider } from '../providers/enhanced-provider'
import type { ProviderMonitor } from '../monitoring/provider-monitor'

/**
 * Failover state for a provider
 */
export interface FailoverState {
  provider: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline'
  failureCount: number
  lastFailureTime?: Date
  lastRecoveryTime?: Date
  consecutiveFailures: number
  consecutiveSuccesses: number
  nextHealthCheckTime: Date
}

/**
 * Failover strategy
 */
export type FailoverStrategy = 'aggressive' | 'balanced' | 'conservative'

/**
 * Failover configuration
 */
export interface FailoverConfig {
  strategy: FailoverStrategy
  failureThreshold: number // failures before failover
  recoveryThreshold: number // successes before recovery
  healthCheckInterval: number // ms
  blacklistDuration: number // ms
  maxRetries: number
  retryDelay: number // ms
}

/**
 * Failover event
 */
export interface FailoverEvent {
  timestamp: Date
  type: 'failure' | 'recovery' | 'switch' | 'blacklist'
  provider: string
  reason: string
  details?: Record<string, any>
}

/**
 * Failover Manager - Handles automatic failover and recovery
 */
export class FailoverManager {
  private providers: Map<string, EnhancedProvider> = new Map()
  private monitor?: ProviderMonitor
  private states: Map<string, FailoverState> = new Map()
  private blacklist: Map<string, Date> = new Map()
  private events: FailoverEvent[] = []
  private maxEvents: number = 1000
  private config: FailoverConfig = {
    strategy: 'balanced',
    failureThreshold: 3,
    recoveryThreshold: 5,
    healthCheckInterval: 30000, // 30 seconds
    blacklistDuration: 300000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000,
  }
  private healthCheckTimer?: ReturnType<typeof setInterval>

  constructor(
    providers?: Map<string, EnhancedProvider>,
    monitor?: ProviderMonitor,
    config?: Partial<FailoverConfig>
  ) {
    if (providers) {
      this.providers = new Map(providers)
      for (const [name] of providers) {
        this.states.set(name, {
          provider: name,
          status: 'healthy',
          failureCount: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          nextHealthCheckTime: new Date(),
        })
      }
    }
    this.monitor = monitor
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Register a provider
   */
  registerProvider(name: string, provider: EnhancedProvider): void {
    this.providers.set(name, provider)
    this.states.set(name, {
      provider: name,
      status: 'healthy',
      failureCount: 0,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      nextHealthCheckTime: new Date(),
    })
  }

  /**
   * Set failover configuration
   */
  setConfig(config: Partial<FailoverConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Record a failure for a provider
   */
  recordFailure(provider: string, reason: string): void {
    const state = this.states.get(provider)
    if (!state) return

    state.consecutiveFailures++
    state.consecutiveSuccesses = 0
    state.failureCount++
    state.lastFailureTime = new Date()

    this.recordEvent({
      timestamp: new Date(),
      type: 'failure',
      provider,
      reason,
      details: { consecutiveFailures: state.consecutiveFailures },
    })

    // Update status based on failure count
    if (state.consecutiveFailures >= this.config.failureThreshold) {
      this.blacklistProvider(provider, reason)
    } else if (state.status === 'healthy') {
      state.status = 'degraded'
    }

    console.warn(`⚠️ Provider ${provider} failure (${state.consecutiveFailures}): ${reason}`)
  }

  /**
   * Record a success for a provider
   */
  recordSuccess(provider: string): void {
    const state = this.states.get(provider)
    if (!state) return

    state.consecutiveSuccesses++
    state.consecutiveFailures = 0

    // Attempt recovery if degraded or offline
    if (
      (state.status === 'degraded' || state.status === 'offline') &&
      state.consecutiveSuccesses >= this.config.recoveryThreshold
    ) {
      this.recoverProvider(provider)
    }

    this.recordEvent({
      timestamp: new Date(),
      type: 'recovery',
      provider,
      reason: `Success (${state.consecutiveSuccesses}/${this.config.recoveryThreshold})`,
    })
  }

  /**
   * Blacklist a provider
   */
  private blacklistProvider(provider: string, reason: string): void {
    const state = this.states.get(provider)
    if (!state) return

    state.status = 'offline'
    this.blacklist.set(provider, new Date(Date.now() + this.config.blacklistDuration))

    this.recordEvent({
      timestamp: new Date(),
      type: 'blacklist',
      provider,
      reason,
      details: {
        duration: this.config.blacklistDuration,
        until: new Date(Date.now() + this.config.blacklistDuration),
      },
    })

    console.error(
      `🚫 Provider ${provider} blacklisted for ${(this.config.blacklistDuration / 1000).toFixed(0)}s: ${reason}`
    )

    // Trigger health check immediately
    this.performHealthCheck(provider)
  }

  /**
   * Recover a provider
   */
  private recoverProvider(provider: string): void {
    const state = this.states.get(provider)
    if (!state) return

    state.status = 'healthy'
    state.consecutiveFailures = 0
    state.consecutiveSuccesses = 0
    state.lastRecoveryTime = new Date()
    this.blacklist.delete(provider)

    this.recordEvent({
      timestamp: new Date(),
      type: 'recovery',
      provider,
      reason: 'Provider recovered after successful operations',
    })

    console.log(`✅ Provider ${provider} recovered`)
  }

  /**
   * Perform health check on a provider
   */
  private performHealthCheck(provider: string): void {
    const state = this.states.get(provider)
    if (!state) return

    const now = new Date()
    if (now < state.nextHealthCheckTime) {
      return
    }

    const providerInstance = this.providers.get(provider)
    if (!providerInstance) return

    try {
      const health = providerInstance.getHealthScore()

      // Check health score
      if (health.recommendation === 'POOR') {
        this.recordFailure(provider, `Health check failed: Poor health (${health.recommendation})`)
      } else if (health.recommendation === 'ACCEPTABLE') {
        if (state.status === 'offline' || state.status === 'unhealthy') {
          // Try to recover
          this.recordSuccess(provider)
        }
      } else if (health.recommendation === 'OPTIMAL') {
        this.recordSuccess(provider)
      }

      // Schedule next check
      state.nextHealthCheckTime = new Date(now.getTime() + this.config.healthCheckInterval)
    } catch (error) {
      this.recordFailure(provider, `Health check error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }

  /**
   * Get available providers (not blacklisted)
   */
  getAvailableProviders(): string[] {
    const available: string[] = []

    for (const [name] of this.providers) {
      if (this.isProviderAvailable(name)) {
        available.push(name)
      }
    }

    return available
  }

  /**
   * Check if provider is available (not blacklisted)
   */
  isProviderAvailable(provider: string): boolean {
    const blacklistTime = this.blacklist.get(provider)
    if (!blacklistTime) return true

    if (new Date() > blacklistTime) {
      this.blacklist.delete(provider)
      const state = this.states.get(provider)
      if (state) {
        state.status = 'degraded'
        console.log(`🔄 Retrying provider ${provider} after blacklist expiration`)
      }
      return true
    }

    return false
  }

  /**
   * Get failover state for a provider
   */
  getState(provider: string): FailoverState | undefined {
    return this.states.get(provider)
  }

  /**
   * Get all states
   */
  getAllStates(): Record<string, FailoverState> {
    const result: Record<string, FailoverState> = {}
    for (const [name, state] of this.states) {
      result[name] = { ...state }
    }
    return result
  }

  /**
   * Record a failover event
   */
  private recordEvent(event: FailoverEvent): void {
    this.events.push(event)
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  /**
   * Get failover events
   */
  getEvents(count?: number): FailoverEvent[] {
    if (count) {
      return this.events.slice(-count)
    }
    return [...this.events]
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) return

    this.healthCheckTimer = setInterval(() => {
      for (const [name] of this.providers) {
        if (this.isProviderAvailable(name)) {
          this.performHealthCheck(name)
        }
      }
    }, this.config.healthCheckInterval)

    console.log(`🏥 Health checks started (interval: ${this.config.healthCheckInterval}ms)`)
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
      console.log('🛑 Health checks stopped')
    }
  }

  /**
   * Get failover statistics
   */
  getStatistics(): {
    totalFailures: number
    totalRecoveries: number
    averageDowntime: number
    failuresByProvider: Record<string, number>
    healthyProviders: number
    blacklistedProviders: number
  } {
    let totalFailures = 0
    let totalRecoveries = 0
    let totalDowntime = 0
    let recoveryCount = 0
    const failuresByProvider: Record<string, number> = {}
    let healthyProviders = 0
    let blacklistedProviders = 0

    for (const [name, state] of this.states) {
      totalFailures += state.failureCount
      failuresByProvider[name] = state.failureCount

      if (state.status === 'healthy') {
        healthyProviders++
      } else if (state.status === 'offline') {
        blacklistedProviders++
      }
    }

    for (const event of this.events) {
      if (event.type === 'recovery') {
        totalRecoveries++
        if (event.details?.duration) {
          totalDowntime += event.details.duration
          recoveryCount++
        }
      }
    }

    const averageDowntime = recoveryCount > 0 ? totalDowntime / recoveryCount : 0

    return {
      totalFailures,
      totalRecoveries,
      averageDowntime,
      failuresByProvider,
      healthyProviders,
      blacklistedProviders,
    }
  }

  /**
   * Reset a provider's state
   */
  resetProvider(provider: string): void {
    const state = this.states.get(provider)
    if (state) {
      state.status = 'healthy'
      state.failureCount = 0
      state.consecutiveFailures = 0
      state.consecutiveSuccesses = 0
      state.lastFailureTime = undefined
      state.lastRecoveryTime = undefined
    }
    this.blacklist.delete(provider)
    console.log(`♻️ Provider ${provider} state reset`)
  }

  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = []
  }

  /**
   * Export state as JSON
   */
  toJSON() {
    return {
      config: this.config,
      states: Object.fromEntries(this.states),
      blacklist: Array.from(this.blacklist.entries()),
      events: this.events,
    }
  }
}

/**
 * Global failover manager instance
 */
export const failoverManager = new FailoverManager()
