/**
 * Provider Monitor - Real-Time Health Monitoring
 *
 * Tracks:
 * - Latency (p50, p95, p99)
 * - Error rates
 * - Availability
 * - Response times
 * - Queue depth
 */

import type { EnhancedProvider } from '../providers/enhanced-provider'

/**
 * Latency percentiles
 */
export interface LatencyPercentiles {
  p50: number
  p95: number
  p99: number
  min: number
  max: number
  avg: number
}

/**
 * Provider metrics snapshot
 */
export interface ProviderMetrics {
  providerName: string
  timestamp: Date
  requestCount: number
  successCount: number
  errorCount: number
  successRate: number
  errorRate: number
  latencies: LatencyPercentiles
  availability: number // 0-1 (uptime)
  queueDepth: number
  costPerRequest: number
  tokenUsage: {
    totalInput: number
    totalOutput: number
    avgInput: number
    avgOutput: number
  }
}

/**
 * Provider health status
 */
export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'OFFLINE'

/**
 * Alert configuration
 */
export interface AlertConfig {
  onHighLatency?: (provider: string, latency: number) => void
  onHighErrorRate?: (provider: string, errorRate: number) => void
  onUnavailable?: (provider: string) => void
  onRecovered?: (provider: string) => void
}

/**
 * Provider Monitor - Tracks real-time health metrics
 */
export class ProviderMonitor {
  private providers: Map<string, EnhancedProvider> = new Map()
  private metrics: Map<string, ProviderMetrics[]> = new Map()
  private maxMetricsPerProvider: number = 1000
  private requestLog: Array<{
    provider: string
    timestamp: Date
    duration: number
    success: boolean
    tokens: number
    cost: number
  }> = []
  private maxRequestLogSize: number = 10000
  private alertConfig: AlertConfig = {}
  private lastHealthStatus: Map<string, HealthStatus> = new Map()

  constructor(providers?: Map<string, EnhancedProvider>) {
    if (providers) {
      this.providers = new Map(providers)
      for (const [name] of providers) {
        this.metrics.set(name, [])
        this.lastHealthStatus.set(name, 'HEALTHY')
      }
    }
  }

  /**
   * Register a provider for monitoring
   */
  registerProvider(name: string, provider: EnhancedProvider): void {
    this.providers.set(name, provider)
    this.metrics.set(name, [])
    this.lastHealthStatus.set(name, 'HEALTHY')
  }

  /**
   * Configure alerts
   */
  setAlertConfig(config: AlertConfig): void {
    this.alertConfig = { ...this.alertConfig, ...config }
  }

  /**
   * Record a request
   */
  recordRequest(
    provider: string,
    duration: number,
    success: boolean,
    tokens: number = 0,
    cost: number = 0
  ): void {
    this.requestLog.push({
      provider,
      timestamp: new Date(),
      duration,
      success,
      tokens,
      cost,
    })

    if (this.requestLog.length > this.maxRequestLogSize) {
      this.requestLog = this.requestLog.slice(-this.maxRequestLogSize)
    }

    // Update health scores
    this.updateProviderHealth(provider)
  }

  /**
   * Update provider health scores
   */
  private updateProviderHealth(providerName: string): void {
    const provider = this.providers.get(providerName)
    if (!provider) return

    // Get recent requests for this provider
    const recentRequests = this.requestLog.filter(
      (r) => r.provider === providerName && Date.now() - r.timestamp.getTime() < 3600000 // 1 hour
    )

    if (recentRequests.length === 0) return

    // Calculate metrics
    const successCount = recentRequests.filter((r) => r.success).length
    const errorCount = recentRequests.length - successCount
    const successRate = recentRequests.length > 0 ? successCount / recentRequests.length : 1
    const errorRate = 1 - successRate

    const latencies = recentRequests.map((r) => r.duration).sort((a, b) => a - b)
    const latencyPercentiles = {
      p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
      p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
      p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      min: Math.min(...latencies),
      max: Math.max(...latencies),
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    }

    const totalTokens = recentRequests.reduce((sum, r) => sum + r.tokens, 0)
    const totalCost = recentRequests.reduce((sum, r) => sum + r.cost, 0)

    // Calculate availability (uptime percentage)
    // Simplified: high success rate = high availability
    const availability = Math.max(0, Math.min(1, successRate * 1.1))

    const metrics: ProviderMetrics = {
      providerName,
      timestamp: new Date(),
      requestCount: recentRequests.length,
      successCount,
      errorCount,
      successRate,
      errorRate,
      latencies: latencyPercentiles,
      availability,
      queueDepth: 0, // Would be populated by request queue
      costPerRequest: totalCost / recentRequests.length,
      tokenUsage: {
        totalInput: totalTokens,
        totalOutput: 0,
        avgInput: totalTokens / recentRequests.length,
        avgOutput: 0,
      },
    }

    // Store metrics
    const providerMetrics = this.metrics.get(providerName) || []
    providerMetrics.push(metrics)
    if (providerMetrics.length > this.maxMetricsPerProvider) {
      providerMetrics.splice(0, providerMetrics.length - this.maxMetricsPerProvider)
    }
    this.metrics.set(providerName, providerMetrics)

    // Update provider health score
    provider.setHealthScore({
      availability,
      latency: latencyPercentiles.p95,
      errorRate,
      costRatio: metrics.costPerRequest / 0.001, // Normalized to baseline
      recommendation: this.getRecommendation(availability, errorRate, latencyPercentiles.p95),
      lastUpdated: new Date(),
    })

    // Check alerts
    this.checkAlerts(providerName, metrics)
  }

  /**
   * Get recommendation based on metrics
   */
  private getRecommendation(
    availability: number,
    errorRate: number,
    latency: number
  ): 'OPTIMAL' | 'ACCEPTABLE' | 'POOR' | 'UNKNOWN' {
    if (availability < 0.95 || errorRate > 0.05 || latency > 1000) {
      return 'POOR'
    }
    if (availability < 0.99 || errorRate > 0.01 || latency > 500) {
      return 'ACCEPTABLE'
    }
    return 'OPTIMAL'
  }

  /**
   * Check and trigger alerts
   */
  private checkAlerts(providerName: string, metrics: ProviderMetrics): void {
    const previousStatus = this.lastHealthStatus.get(providerName)
    const currentStatus = this.getHealthStatus(metrics)

    // Alert on high latency
    if (metrics.latencies.p95 > 1000 && this.alertConfig.onHighLatency) {
      this.alertConfig.onHighLatency(providerName, metrics.latencies.p95)
    }

    // Alert on high error rate
    if (metrics.errorRate > 0.05 && this.alertConfig.onHighErrorRate) {
      this.alertConfig.onHighErrorRate(providerName, metrics.errorRate)
    }

    // Alert on unavailable
    if (currentStatus === 'OFFLINE' && previousStatus !== 'OFFLINE' && this.alertConfig.onUnavailable) {
      this.alertConfig.onUnavailable(providerName)
    }

    // Alert on recovery
    if (currentStatus === 'HEALTHY' && previousStatus === 'OFFLINE' && this.alertConfig.onRecovered) {
      this.alertConfig.onRecovered(providerName)
    }

    this.lastHealthStatus.set(providerName, currentStatus)
  }

  /**
   * Determine health status
   */
  private getHealthStatus(metrics: ProviderMetrics): HealthStatus {
    if (metrics.availability < 0.5) return 'OFFLINE'
    if (metrics.availability < 0.95 || metrics.errorRate > 0.05) return 'UNHEALTHY'
    if (metrics.availability < 0.99 || metrics.errorRate > 0.01) return 'DEGRADED'
    return 'HEALTHY'
  }

  /**
   * Get latest metrics for a provider
   */
  getLatestMetrics(providerName: string): ProviderMetrics | undefined {
    const metrics = this.metrics.get(providerName)
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : undefined
  }

  /**
   * Get all providers' current metrics
   */
  getAllMetrics(): Record<string, ProviderMetrics | undefined> {
    const result: Record<string, ProviderMetrics | undefined> = {}
    for (const [name] of this.providers) {
      result[name] = this.getLatestMetrics(name)
    }
    return result
  }

  /**
   * Get historical metrics for a provider
   */
  getHistoricalMetrics(providerName: string, count: number = 100): ProviderMetrics[] {
    const metrics = this.metrics.get(providerName) || []
    return metrics.slice(-count)
  }

  /**
   * Get health status for all providers
   */
  getHealthStatuses(): Record<string, HealthStatus> {
    const result: Record<string, HealthStatus> = {}
    for (const [name] of this.providers) {
      const metrics = this.getLatestMetrics(name)
      result[name] = metrics ? this.getHealthStatus(metrics) : 'OFFLINE'
    }
    return result
  }

  /**
   * Get provider comparison
   */
  compareProviders(): Array<{
    provider: string
    availability: number
    latency: number
    errorRate: number
    successRate: number
    costPerRequest: number
    status: HealthStatus
  }> {
    const comparisons: Array<{
      provider: string
      availability: number
      latency: number
      errorRate: number
      successRate: number
      costPerRequest: number
      status: HealthStatus
    }> = []

    for (const [name] of this.providers) {
      const metrics = this.getLatestMetrics(name)
      if (metrics) {
        comparisons.push({
          provider: name,
          availability: metrics.availability,
          latency: metrics.latencies.p95,
          errorRate: metrics.errorRate,
          successRate: metrics.successRate,
          costPerRequest: metrics.costPerRequest,
          status: this.getHealthStatus(metrics),
        })
      }
    }

    return comparisons
  }

  /**
   * Get trending data for a provider
   */
  getTrend(
    providerName: string,
    metric: 'latency' | 'errorRate' | 'availability' | 'successRate',
    count: number = 10
  ): Array<{ timestamp: Date; value: number }> {
    const metrics = this.getHistoricalMetrics(providerName, count)
    return metrics.map((m) => {
      let value: number
      switch (metric) {
        case 'latency':
          value = m.latencies.p95
          break
        case 'errorRate':
          value = m.errorRate
          break
        case 'availability':
          value = m.availability
          break
        case 'successRate':
          value = m.successRate
          break
      }
      return { timestamp: m.timestamp, value }
    })
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): Record<string, ProviderMetrics[]> {
    const result: Record<string, ProviderMetrics[]> = {}
    for (const [name, metrics] of this.metrics) {
      result[name] = [...metrics]
    }
    return result
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    for (const [name] of this.providers) {
      this.metrics.set(name, [])
    }
    this.requestLog = []
  }
}

/**
 * Global monitor instance
 */
export const providerMonitor = new ProviderMonitor()
