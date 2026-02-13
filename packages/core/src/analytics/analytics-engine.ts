/**
 * Analytics Engine
 * Advanced analytics and insights generation
 *
 * @module analytics/analytics-engine
 */

import { AgentLogger } from '../agents/logger'
import type { ExecutionMetric, AggregatedMetrics } from './metrics-collector'

/**
 * Insight
 */
export interface Insight {
  id: string
  type: 'opportunity' | 'warning' | 'info'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  recommendation: string
  affectedAgents: string[]
  confidenceScore: number
}

/**
 * Trend analysis
 */
export interface TrendAnalysis {
  metric: string
  currentValue: number
  previousValue: number
  percentageChange: number
  trend: 'up' | 'down' | 'stable'
  forecast7Day: number
  forecast30Day: number
}

/**
 * Anomaly
 */
export interface Anomaly {
  id: string
  timestamp: Date
  agentId: string
  metricName: string
  anomalousValue: number
  expectedValue: number
  deviation: number
  severity: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Analytics Engine
 */
export class AnalyticsEngine {
  private logger: AgentLogger
  private insights: Map<string, Insight> = new Map()
  private anomalies: Map<string, Anomaly> = new Map()
  private historicalData: Map<string, ExecutionMetric[]> = new Map()

  constructor() {
    this.logger = new AgentLogger('AnalyticsEngine')
  }

  /**
   * Store historical data
   */
  storeHistoricalData(agentId: string, metrics: ExecutionMetric[]): void {
    this.historicalData.set(agentId, metrics)
  }

  /**
   * Analyze metrics
   */
  async analyzeMetrics(
    agentId: string,
    aggregated: AggregatedMetrics,
    metrics: ExecutionMetric[]
  ): Promise<Insight[]> {
    const insights: Insight[] = []

    // Analyze cost
    if (aggregated.avgCost > 1.0) {
      insights.push({
        id: `insight_${Date.now()}_1`,
        type: 'opportunity',
        title: 'High Average Cost',
        description: `Average cost per execution is $${aggregated.avgCost.toFixed(2)}`,
        impact: 'high',
        recommendation: 'Consider switching to a cheaper provider or optimizing queries',
        affectedAgents: [agentId],
        confidenceScore: 0.95
      })
    }

    // Analyze cache hits
    if (aggregated.cacheHitRate < 20) {
      insights.push({
        id: `insight_${Date.now()}_2`,
        type: 'opportunity',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate is only ${aggregated.cacheHitRate.toFixed(1)}%`,
        impact: 'medium',
        recommendation: 'Increase cache TTL or cache more frequently used queries',
        affectedAgents: [agentId],
        confidenceScore: 0.85
      })
    }

    // Analyze performance
    if (aggregated.avgDuration > 5000) {
      insights.push({
        id: `insight_${Date.now()}_3`,
        type: 'warning',
        title: 'Slow Execution',
        description: `Average execution time is ${aggregated.avgDuration.toFixed(0)}ms`,
        impact: 'medium',
        recommendation: 'Optimize queries or use local provider for faster response',
        affectedAgents: [agentId],
        confidenceScore: 0.9
      })
    }

    // Analyze error rate
    const errorRate = (aggregated.failedExecutions / aggregated.totalExecutions) * 100
    if (errorRate > 10) {
      insights.push({
        id: `insight_${Date.now()}_4`,
        type: 'warning',
        title: 'High Error Rate',
        description: `Error rate is ${errorRate.toFixed(1)}%`,
        impact: 'high',
        recommendation: 'Review error logs and add fallback providers',
        affectedAgents: [agentId],
        confidenceScore: 0.95
      })
    }

    for (const insight of insights) {
      this.insights.set(insight.id, insight)
    }

    this.logger.info(`Generated ${insights.length} insights for ${agentId}`)

    return insights
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(agentId: string, metric: ExecutionMetric): Anomaly[] {
    const anomalies: Anomaly[] = []
    const historical = this.historicalData.get(agentId) || []

    if (historical.length < 10) {
      return anomalies // Not enough data for anomaly detection
    }

    // Calculate baseline
    const avgCost = historical.reduce((sum, m) => sum + m.cost, 0) / historical.length
    const stdCost = Math.sqrt(
      historical.reduce((sum, m) => sum + Math.pow(m.cost - avgCost, 2), 0) / historical.length
    )

    const avgDuration = historical.reduce((sum, m) => sum + m.duration, 0) / historical.length
    const stdDuration = Math.sqrt(
      historical.reduce((sum, m) => sum + Math.pow(m.duration - avgDuration, 2), 0) / historical.length
    )

    // Detect cost anomaly
    const costDeviation = Math.abs(metric.cost - avgCost) / stdCost
    if (costDeviation > 3) {
      anomalies.push({
        id: `anomaly_${Date.now()}_cost`,
        timestamp: metric.timestamp,
        agentId,
        metricName: 'cost',
        anomalousValue: metric.cost,
        expectedValue: avgCost,
        deviation: costDeviation,
        severity: costDeviation > 5 ? 'critical' : 'high'
      })
    }

    // Detect performance anomaly
    const durationDeviation = Math.abs(metric.duration - avgDuration) / stdDuration
    if (durationDeviation > 3) {
      anomalies.push({
        id: `anomaly_${Date.now()}_duration`,
        timestamp: metric.timestamp,
        agentId,
        metricName: 'duration',
        anomalousValue: metric.duration,
        expectedValue: avgDuration,
        deviation: durationDeviation,
        severity: durationDeviation > 5 ? 'critical' : 'high'
      })
    }

    for (const anomaly of anomalies) {
      this.anomalies.set(anomaly.id, anomaly)
    }

    return anomalies
  }

  /**
   * Analyze trends
   */
  analyzeTrends(metrics: ExecutionMetric[]): TrendAnalysis[] {
    if (metrics.length < 2) return []

    const trends: TrendAnalysis[] = []

    // Cost trend
    const recentCost = metrics.slice(-5).reduce((sum, m) => sum + m.cost, 0) / 5
    const oldCost = metrics.slice(0, 5).reduce((sum, m) => sum + m.cost, 0) / 5
    const costChange = ((recentCost - oldCost) / oldCost) * 100

    trends.push({
      metric: 'cost',
      currentValue: recentCost,
      previousValue: oldCost,
      percentageChange: costChange,
      trend: costChange > 5 ? 'up' : costChange < -5 ? 'down' : 'stable',
      forecast7Day: recentCost * 1.02, // 2% increase
      forecast30Day: recentCost * 1.08 // 8% increase
    })

    // Duration trend
    const recentDuration = metrics.slice(-5).reduce((sum, m) => sum + m.duration, 0) / 5
    const oldDuration = metrics.slice(0, 5).reduce((sum, m) => sum + m.duration, 0) / 5
    const durationChange = ((recentDuration - oldDuration) / oldDuration) * 100

    trends.push({
      metric: 'duration',
      currentValue: recentDuration,
      previousValue: oldDuration,
      percentageChange: durationChange,
      trend: durationChange > 5 ? 'up' : durationChange < -5 ? 'down' : 'stable',
      forecast7Day: recentDuration * 1.01,
      forecast30Day: recentDuration * 1.05
    })

    return trends
  }

  /**
   * Get all insights
   */
  getAllInsights(): Insight[] {
    return Array.from(this.insights.values())
  }

  /**
   * Get insights by type
   */
  getInsightsByType(type: 'opportunity' | 'warning' | 'info'): Insight[] {
    return Array.from(this.insights.values()).filter(i => i.type === type)
  }

  /**
   * Get critical anomalies
   */
  getCriticalAnomalies(): Anomaly[] {
    return Array.from(this.anomalies.values()).filter(a => a.severity === 'critical')
  }

  /**
   * Get recommendations
   */
  getRecommendations(): string[] {
    const insights = this.getAllInsights()
    return insights
      .filter(i => i.type === 'opportunity')
      .sort((a, b) => b.impact === 'high' ? -1 : 1)
      .slice(0, 5)
      .map(i => i.recommendation)
  }

  /**
   * Calculate optimization potential
   */
  calculateOptimizationPotential(metrics: ExecutionMetric[]): {
    costSavingsPotential: number
    performanceGainPotential: number
    reliabilityGainPotential: number
  } {
    if (metrics.length === 0) {
      return {
        costSavingsPotential: 0,
        performanceGainPotential: 0,
        reliabilityGainPotential: 0
      }
    }

    // Calculate potential
    const avgCost = metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length
    const costSavingsPotential = avgCost * 0.40 // 40% potential savings

    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length
    const performanceGainPotential = (avgDuration * 0.30) / avgDuration // 30% improvement

    const successCount = metrics.filter(m => m.success).length
    const currentReliability = (successCount / metrics.length) * 100
    const reliabilityGainPotential = Math.max(0, 99 - currentReliability)

    return {
      costSavingsPotential,
      performanceGainPotential,
      reliabilityGainPotential
    }
  }
}
