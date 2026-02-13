/**
 * Metrics Collector
 * Real-time collection of execution metrics and performance data
 *
 * @module analytics/metrics-collector
 */

import { AgentLogger } from '../agents/logger'

/**
 * Execution metric
 */
export interface ExecutionMetric {
  id: string
  timestamp: Date
  agentId: string
  taskId: string
  duration: number // milliseconds
  cost: number
  success: boolean
  tokensUsed: number
  cacheHit: boolean
  provider: string
  model: string
  inputSize: number
  outputSize: number
  errorRate: number
  metadata?: Record<string, unknown>
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  avgDuration: number
  avgCost: number
  totalCost: number
  cacheHitRate: number
  avgTokensUsed: number
  costTrend: 'increasing' | 'decreasing' | 'stable'
  performanceTrend: 'improving' | 'degrading' | 'stable'
}

/**
 * Real-time metric stream
 */
export interface MetricStream {
  agentId: string
  windowSize: number // milliseconds
  metrics: ExecutionMetric[]
  aggregated: AggregatedMetrics
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
  private metrics: Map<string, ExecutionMetric[]> = new Map()
  private logger: AgentLogger
  private maxMetrics: number = 100000
  private streams: Map<string, MetricStream> = new Map()

  constructor(maxMetrics: number = 100000) {
    this.maxMetrics = maxMetrics
    this.logger = new AgentLogger('MetricsCollector')
  }

  /**
   * Record execution metric
   */
  recordMetric(metric: Omit<ExecutionMetric, 'id' | 'timestamp'>): ExecutionMetric {
    const fullMetric: ExecutionMetric = {
      ...metric,
      id: `metric_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date()
    }

    const key = metric.agentId
    if (!this.metrics.has(key)) {
      this.metrics.set(key, [])
    }

    const agentMetrics = this.metrics.get(key)!
    agentMetrics.push(fullMetric)

    // Keep memory bounded
    if (agentMetrics.length > this.maxMetrics) {
      agentMetrics.shift()
    }

    this.logger.info(
      `Metric recorded: ${metric.agentId} - ${metric.duration}ms, cost: $${metric.cost.toFixed(2)}`
    )

    return fullMetric
  }

  /**
   * Get metrics for agent
   */
  getAgentMetrics(agentId: string): ExecutionMetric[] {
    return this.metrics.get(agentId) || []
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(agentId: string): AggregatedMetrics {
    const metrics = this.getAgentMetrics(agentId)

    if (metrics.length === 0) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgDuration: 0,
        avgCost: 0,
        totalCost: 0,
        cacheHitRate: 0,
        avgTokensUsed: 0,
        costTrend: 'stable',
        performanceTrend: 'stable'
      }
    }

    const successful = metrics.filter(m => m.success).length
    const failed = metrics.length - successful
    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
    const avgCost = metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length
    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0)
    const cacheHits = metrics.filter(m => m.cacheHit).length
    const cacheHitRate = (cacheHits / metrics.length) * 100
    const avgTokensUsed = metrics.reduce((sum, m) => sum + m.tokensUsed, 0) / metrics.length

    // Determine trends
    const recentMetrics = metrics.slice(-10)
    const oldMetrics = metrics.slice(0, 10)
    const recentCost = recentMetrics.reduce((sum, m) => sum + m.cost, 0) / recentMetrics.length
    const oldCost = oldMetrics.length > 0 ? oldMetrics.reduce((sum, m) => sum + m.cost, 0) / oldMetrics.length : 0
    const costTrend = recentCost > oldCost ? 'increasing' : recentCost < oldCost ? 'decreasing' : 'stable'

    const recentDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
    const oldDuration = oldMetrics.length > 0 ? oldMetrics.reduce((sum, m) => sum + m.duration, 0) / oldMetrics.length : 0
    const performanceTrend = recentDuration > oldDuration ? 'degrading' : recentDuration < oldDuration ? 'improving' : 'stable'

    return {
      totalExecutions: metrics.length,
      successfulExecutions: successful,
      failedExecutions: failed,
      avgDuration,
      avgCost,
      totalCost,
      cacheHitRate,
      avgTokensUsed,
      costTrend,
      performanceTrend
    }
  }

  /**
   * Get metrics by time window
   */
  getMetricsByTimeWindow(agentId: string, windowMs: number): ExecutionMetric[] {
    const cutoff = Date.now() - windowMs
    const metrics = this.getAgentMetrics(agentId)

    return metrics.filter(m => m.timestamp.getTime() > cutoff)
  }

  /**
   * Get all metrics across agents
   */
  getAllMetrics(): ExecutionMetric[] {
    const all: ExecutionMetric[] = []
    for (const metrics of this.metrics.values()) {
      all.push(...metrics)
    }
    return all
  }

  /**
   * Get metrics stream (real-time updates)
   */
  createMetricStream(agentId: string, windowSize: number = 60000): MetricStream {
    const stream: MetricStream = {
      agentId,
      windowSize,
      metrics: this.getMetricsByTimeWindow(agentId, windowSize),
      aggregated: this.getAggregatedMetrics(agentId)
    }

    this.streams.set(agentId, stream)
    this.logger.info(`Metric stream created for ${agentId}`)

    return stream
  }

  /**
   * Update metric stream
   */
  updateMetricStream(agentId: string): MetricStream | undefined {
    const stream = this.streams.get(agentId)
    if (!stream) return undefined

    stream.metrics = this.getMetricsByTimeWindow(agentId, stream.windowSize)
    stream.aggregated = this.getAggregatedMetrics(agentId)

    return stream
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): {
    provider: string
    totalCost: number
    totalExecutions: number
    avgCost: number
    successRate: number
  }[] {
    const allMetrics = this.getAllMetrics()
    const byProvider = new Map<string, ExecutionMetric[]>()

    for (const metric of allMetrics) {
      if (!byProvider.has(metric.provider)) {
        byProvider.set(metric.provider, [])
      }
      byProvider.get(metric.provider)!.push(metric)
    }

    const stats = []
    for (const [provider, metrics] of byProvider) {
      const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0)
      const successful = metrics.filter(m => m.success).length
      const successRate = (successful / metrics.length) * 100

      stats.push({
        provider,
        totalCost,
        totalExecutions: metrics.length,
        avgCost: totalCost / metrics.length,
        successRate
      })
    }

    return stats.sort((a, b) => b.totalCost - a.totalCost)
  }

  /**
   * Export metrics
   */
  async exportMetrics(agentId?: string): Promise<ExecutionMetric[]> {
    if (agentId) {
      return JSON.parse(JSON.stringify(this.getAgentMetrics(agentId)))
    }
    return JSON.parse(JSON.stringify(this.getAllMetrics()))
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(beforeDate: Date): number {
    let removed = 0

    for (const [, metrics] of this.metrics) {
      const initialLength = metrics.length
      const filtered = metrics.filter(m => m.timestamp >= beforeDate)
      removed += initialLength - filtered.length

      if (filtered.length === 0) {
        this.metrics.delete('')
      } else {
        this.metrics.set('', filtered)
      }
    }

    this.logger.info(`Cleared ${removed} old metrics`)
    return removed
  }
}
