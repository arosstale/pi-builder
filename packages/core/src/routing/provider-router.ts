/**
 * Provider Router - Intelligent Provider Selection
 *
 * Routes requests to the best provider based on:
 * - Cost optimization
 * - Latency optimization
 * - Quality optimization
 * - Failover chains
 */

import type { ExecuteOptions } from '../providers/enhanced-provider'
import type { EnhancedProvider } from '../providers/enhanced-provider'

/**
 * Router strategy for selecting providers
 */
export type RoutingStrategy = 'cost-optimal' | 'latency-optimal' | 'quality-optimal' | 'failover'

/**
 * Provider selection criteria
 */
export interface ProviderSelectionCriteria {
  strategy: RoutingStrategy
  minimumAvailability?: number // 0-1
  maximumLatency?: number // ms
  maximumCost?: number // per 1k tokens
  requiredCapabilities?: string[]
  excludeProviders?: string[]
  preferences?: Record<string, any>
}

/**
 * Router decision result
 */
export interface RouteDecision {
  provider: EnhancedProvider
  providerName: string
  reason: string
  score: number
  metrics: {
    cost?: number
    latency?: number
    availability?: number
    quality?: number
  }
}

/**
 * Failover chain configuration
 */
export interface FailoverChain {
  primary: EnhancedProvider
  backups: EnhancedProvider[]
  fallback?: EnhancedProvider
}

/**
 * Provider Router - Intelligent routing based on multiple criteria
 */
export class ProviderRouter {
  private providers: Map<string, EnhancedProvider> = new Map()
  private routingHistory: RouteDecision[] = []
  private maxHistorySize: number = 10000

  constructor(providers?: Map<string, EnhancedProvider>) {
    if (providers) {
      this.providers = new Map(providers)
    }
  }

  /**
   * Register a provider
   */
  registerProvider(name: string, provider: EnhancedProvider): void {
    this.providers.set(name, provider)
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, EnhancedProvider> {
    return new Map(this.providers)
  }

  /**
   * Select best provider based on strategy
   */
  selectProvider(
    request: ExecuteOptions,
    criteria: ProviderSelectionCriteria
  ): RouteDecision {
    let decision: RouteDecision

    switch (criteria.strategy) {
      case 'cost-optimal':
        decision = this.selectCostOptimal(request, criteria)
        break
      case 'latency-optimal':
        decision = this.selectLatencyOptimal(request, criteria)
        break
      case 'quality-optimal':
        decision = this.selectQualityOptimal(request, criteria)
        break
      case 'failover':
        decision = this.selectFailover(request, criteria)
        break
      default:
        decision = this.selectLatencyOptimal(request, criteria)
    }

    this.recordDecision(decision)
    return decision
  }

  /**
   * Select cheapest provider
   */
  private selectCostOptimal(
    request: ExecuteOptions,
    criteria: ProviderSelectionCriteria
  ): RouteDecision {
    const candidates = this.filterCandidates(criteria)

    if (candidates.length === 0) {
      throw new Error('No providers match criteria')
    }

    // Score by cost (lower is better)
    const scored = candidates.map((provider) => {
      const health = provider.getHealthScore()
      const costPerToken = provider.getCostPerToken(request.model ?? '')
      const totalCost = costPerToken.input + costPerToken.output
      const score = totalCost * (1 + (1 - health.availability) * 0.1) // Penalize low availability

      return {
        provider,
        score,
        cost: totalCost,
        availability: health.availability,
      }
    })

    const best = scored.reduce((prev, current) =>
      current.score < prev.score ? current : prev
    )

    return {
      provider: best.provider,
      providerName: best.provider.getName(),
      reason: `Cost-optimal: ${(best.cost * 1000).toFixed(4)}$ per 1k tokens, ${(best.availability * 100).toFixed(1)}% available`,
      score: best.score,
      metrics: {
        cost: best.cost,
        availability: best.availability,
      },
    }
  }

  /**
   * Select fastest provider
   */
  private selectLatencyOptimal(
    request: ExecuteOptions,
    criteria: ProviderSelectionCriteria
  ): RouteDecision {
    const candidates = this.filterCandidates(criteria)

    if (candidates.length === 0) {
      throw new Error('No providers match criteria')
    }

    // Score by latency (lower is better)
    const scored = candidates.map((provider) => {
      const health = provider.getHealthScore()
      const latencyScore = health.latency + (1 - health.availability) * 1000 // Penalize low availability

      return {
        provider,
        score: latencyScore,
        latency: health.latency,
        availability: health.availability,
      }
    })

    const best = scored.reduce((prev, current) =>
      current.score < prev.score ? current : prev
    )

    return {
      provider: best.provider,
      providerName: best.provider.getName(),
      reason: `Latency-optimal: ${best.latency.toFixed(0)}ms p95, ${(best.availability * 100).toFixed(1)}% available`,
      score: best.score,
      metrics: {
        latency: best.latency,
        availability: best.availability,
      },
    }
  }

  /**
   * Select best quality provider (most capable)
   */
  private selectQualityOptimal(
    request: ExecuteOptions,
    criteria: ProviderSelectionCriteria
  ): RouteDecision {
    const candidates = this.filterCandidates(criteria)

    if (candidates.length === 0) {
      throw new Error('No providers match criteria')
    }

    // Score by capability + reliability
    const scored = candidates.map((provider) => {
      const health = provider.getHealthScore()
      const capabilities = provider.getCapabilities()

      // Count supported capabilities
      let capScore = 0
      if (capabilities.supportsVision) capScore += 2
      if (capabilities.supportsTools) capScore += 2
      if (capabilities.supportsMCP) capScore += 3
      if (capabilities.supportsThinking) capScore += 3
      if (capabilities.supportsStreaming) capScore += 1

      // Adjust for reliability
      const score = capScore * health.availability * (1 - health.errorRate * 0.5)

      return {
        provider,
        score,
        capabilities: capScore,
        availability: health.availability,
      }
    })

    const best = scored.reduce((prev, current) =>
      current.score > prev.score ? current : prev
    )

    return {
      provider: best.provider,
      providerName: best.provider.getName(),
      reason: `Quality-optimal: ${best.capabilities} capability points, ${(best.availability * 100).toFixed(1)}% available`,
      score: best.score,
      metrics: {
        quality: best.capabilities,
        availability: best.availability,
      },
    }
  }

  /**
   * Get failover chain
   */
  private selectFailover(
    request: ExecuteOptions,
    criteria: ProviderSelectionCriteria
  ): RouteDecision {
    const candidates = this.filterCandidates(criteria)

    if (candidates.length === 0) {
      throw new Error('No providers match criteria')
    }

    // Sort by reliability (availability * (1 - errorRate))
    const sorted = candidates
      .map((provider) => {
        const health = provider.getHealthScore()
        const reliability = health.availability * (1 - health.errorRate)
        return { provider, reliability }
      })
      .sort((a, b) => b.reliability - a.reliability)

    const best = sorted[0]

    return {
      provider: best.provider,
      providerName: best.provider.getName(),
      reason: `Failover chain: primary selected with ${(best.reliability * 100).toFixed(1)}% reliability`,
      score: best.reliability,
      metrics: {
        availability: best.provider.getHealthScore().availability,
      },
    }
  }

  /**
   * Filter providers by criteria
   */
  private filterCandidates(criteria: ProviderSelectionCriteria): EnhancedProvider[] {
    const candidates: EnhancedProvider[] = []

    for (const [name, provider] of this.providers) {
      // Skip excluded providers
      if (criteria.excludeProviders?.includes(name)) {
        continue
      }

      const health = provider.getHealthScore()

      // Check availability requirement
      if (criteria.minimumAvailability && health.availability < criteria.minimumAvailability) {
        continue
      }

      // Check latency requirement
      if (criteria.maximumLatency && health.latency > criteria.maximumLatency) {
        continue
      }

      // Check capability requirements
      if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
        const hasAllCapabilities = criteria.requiredCapabilities.every((cap) =>
          provider.supportsFeature(cap)
        )
        if (!hasAllCapabilities) {
          continue
        }
      }

      candidates.push(provider)
    }

    return candidates
  }

  /**
   * Execute with automatic failover
   */
  async executeWithFailover<T>(
    request: ExecuteOptions,
    execute: (provider: EnhancedProvider) => Promise<T>,
    chain: EnhancedProvider[]
  ): Promise<T> {
    let lastError: Error | undefined

    for (const provider of chain) {
      try {
        const health = provider.getHealthScore()
        if (health.recommendation === 'POOR') {
          console.warn(`⚠️ Skipping provider ${provider.getName()} - poor health`)
          continue
        }

        console.log(`📤 Trying provider: ${provider.getName()}`)
        const result = await execute(provider)
        console.log(`✅ Success with ${provider.getName()}`)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`❌ Failed with ${provider.getName()}: ${lastError.message}`)
        continue
      }
    }

    throw new Error(`All providers failed. Last error: ${lastError?.message}`)
  }

  /**
   * Get failover chain for a request
   */
  getFailoverChain(criteria: ProviderSelectionCriteria): FailoverChain {
    const candidates = this.filterCandidates(criteria)

    if (candidates.length === 0) {
      throw new Error('No providers match criteria')
    }

    // Sort by reliability
    const sorted = candidates
      .map((provider) => {
        const health = provider.getHealthScore()
        const reliability = health.availability * (1 - health.errorRate)
        return { provider, reliability }
      })
      .sort((a, b) => b.reliability - a.reliability)

    return {
      primary: sorted[0].provider,
      backups: sorted.slice(1, -1).map((s) => s.provider),
      fallback: sorted.length > 0 ? sorted[sorted.length - 1].provider : undefined,
    }
  }

  /**
   * Record routing decision
   */
  private recordDecision(decision: RouteDecision): void {
    this.routingHistory.push(decision)

    if (this.routingHistory.length > this.maxHistorySize) {
      this.routingHistory = this.routingHistory.slice(-this.maxHistorySize)
    }
  }

  /**
   * Get routing history
   */
  getHistory(count?: number): RouteDecision[] {
    if (count) {
      return this.routingHistory.slice(-count)
    }
    return [...this.routingHistory]
  }

  /**
   * Get routing statistics
   */
  getStatistics(): {
    totalDecisions: number
    decisionsPerProvider: Record<string, number>
    averageScore: number
    preferredProvider: string
  } {
    const decisionsPerProvider: Record<string, number> = {}
    let totalScore = 0

    for (const decision of this.routingHistory) {
      decisionsPerProvider[decision.providerName] =
        (decisionsPerProvider[decision.providerName] || 0) + 1
      totalScore += decision.score
    }

    const totalDecisions = this.routingHistory.length
    const averageScore = totalDecisions > 0 ? totalScore / totalDecisions : 0

    // Find most preferred provider
    const preferredProvider = Object.entries(decisionsPerProvider).reduce((prev, current) =>
      current[1] > prev[1] ? current : prev
    )[0]

    return {
      totalDecisions,
      decisionsPerProvider,
      averageScore,
      preferredProvider,
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.routingHistory = []
  }
}
