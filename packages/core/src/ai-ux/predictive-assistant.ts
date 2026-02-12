/**
 * Predictive Assistant
 * AI-powered predictions and recommendations
 *
 * @module ai-ux/predictive-assistant
 */

import { AgentLogger } from '../agents/logger'

/**
 * Prediction
 */
export interface Prediction {
  type: string
  value: unknown
  confidence: number
  timestamp: Date
  reasoning: string
}

/**
 * Recommendation
 */
export interface Recommendation {
  id: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  urgency: 'critical' | 'high' | 'normal' | 'low'
  action: string
  estimatedBenefit: string
}

/**
 * Predictive Assistant
 */
export class PredictiveAssistant {
  private predictions: Map<string, Prediction> = new Map()
  private recommendations: Recommendation[] = []
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('PredictiveAssistant')
  }

  /**
   * Predict next action
   */
  async predictNextAction(
    history: Array<{ action: string; timestamp: Date }>
  ): Promise<Prediction> {
    if (history.length === 0) {
      return {
        type: 'next_action',
        value: 'create_agent',
        confidence: 0.5,
        timestamp: new Date(),
        reasoning: 'Based on system initialization patterns'
      }
    }

    // Simple pattern: most common action
    const counts = new Map<string, number>()
    for (const { action } of history) {
      counts.set(action, (counts.get(action) || 0) + 1)
    }

    let maxAction = 'unknown'
    let maxCount = 0
    for (const [action, count] of counts) {
      if (count > maxCount) {
        maxAction = action
        maxCount = count
      }
    }

    const confidence = Math.min(maxCount / history.length, 0.95)

    return {
      type: 'next_action',
      value: maxAction,
      confidence,
      timestamp: new Date(),
      reasoning: `Most frequent action in history (${maxCount}/${history.length})`
    }
  }

  /**
   * Predict resource needs
   */
  async predictResourceNeeds(
    usage: { cpu: number; memory: number; timestamp: Date }[]
  ): Promise<Prediction> {
    if (usage.length === 0) {
      return {
        type: 'resource_needs',
        value: { cpu: 2, memory: 4096 },
        confidence: 0.5,
        timestamp: new Date(),
        reasoning: 'Default recommendation for new systems'
      }
    }

    // Calculate averages
    const avgCpu = usage.reduce((sum, u) => sum + u.cpu, 0) / usage.length
    const avgMemory = usage.reduce((sum, u) => sum + u.memory, 0) / usage.length

    // Add 20% headroom
    const recommendedCpu = Math.ceil(avgCpu * 1.2)
    const recommendedMemory = Math.ceil(avgMemory * 1.2)

    return {
      type: 'resource_needs',
      value: { cpu: recommendedCpu, memory: recommendedMemory },
      confidence: 0.85,
      timestamp: new Date(),
      reasoning: `Extrapolated from ${usage.length} samples with 20% headroom`
    }
  }

  /**
   * Predict cost trends
   */
  async predictCostTrends(
    costs: { date: Date; amount: number }[]
  ): Promise<Prediction> {
    if (costs.length < 2) {
      return {
        type: 'cost_trend',
        value: { trend: 'stable', projection: 'insufficient data' },
        confidence: 0.3,
        timestamp: new Date(),
        reasoning: 'Insufficient data for trend analysis'
      }
    }

    // Calculate trend
    const first = costs[0].amount
    const last = costs[costs.length - 1].amount
    const changePercent = ((last - first) / first) * 100

    let trend = 'stable'
    if (changePercent > 5) trend = 'increasing'
    if (changePercent < -5) trend = 'decreasing'

    const projection =
      trend === 'increasing'
        ? 'Costs will likely continue rising'
        : trend === 'decreasing'
          ? 'Costs will likely continue falling'
          : 'Costs will remain stable'

    return {
      type: 'cost_trend',
      value: { trend, projection, changePercent: changePercent.toFixed(1) },
      confidence: 0.8,
      timestamp: new Date(),
      reasoning: `Analyzed ${costs.length} cost data points`
    }
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(metrics: {
    errorRate: number
    latency: number
    costEfficiency: number
    uptime: number
  }): Promise<Recommendation[]> {
    const recs: Recommendation[] = []

    // Error rate recommendation
    if (metrics.errorRate > 0.05) {
      recs.push({
        id: 'rec-error-1',
        title: 'High Error Rate',
        description: `Error rate is ${(metrics.errorRate * 100).toFixed(1)}%, above target of 5%`,
        impact: 'high',
        urgency: 'critical',
        action: 'increase_agents',
        estimatedBenefit: 'Reduce errors by 50%'
      })
    }

    // Latency recommendation
    if (metrics.latency > 200) {
      recs.push({
        id: 'rec-latency-1',
        title: 'High Latency',
        description: `Average latency is ${metrics.latency}ms, consider optimization`,
        impact: 'medium',
        urgency: 'high',
        action: 'enable_caching',
        estimatedBenefit: 'Reduce latency by 40-60%'
      })
    }

    // Cost efficiency recommendation
    if (metrics.costEfficiency < 0.6) {
      recs.push({
        id: 'rec-cost-1',
        title: 'Poor Cost Efficiency',
        description: 'Cost efficiency is below target, optimize agent selection',
        impact: 'medium',
        urgency: 'normal',
        action: 'optimize_routing',
        estimatedBenefit: 'Reduce costs by 30-40%'
      })
    }

    // Uptime recommendation
    if (metrics.uptime < 0.99) {
      recs.push({
        id: 'rec-uptime-1',
        title: 'Below Target Uptime',
        description: `Uptime is ${(metrics.uptime * 100).toFixed(2)}%, target is 99%`,
        impact: 'high',
        urgency: 'high',
        action: 'add_failover',
        estimatedBenefit: 'Improve uptime to 99.9%'
      })
    }

    // Positive recommendations
    if (metrics.errorRate < 0.01 && metrics.latency < 100) {
      recs.push({
        id: 'rec-good-1',
        title: 'Excellent Performance',
        description: 'System performance is excellent, maintain current configuration',
        impact: 'high',
        urgency: 'low',
        action: 'monitor_only',
        estimatedBenefit: 'Continue current optimization strategy'
      })
    }

    this.recommendations = recs
    this.logger.info(`Generated ${recs.length} recommendations`)

    return recs
  }

  /**
   * Get urgent recommendations
   */
  getUrgentRecommendations(): Recommendation[] {
    return this.recommendations.filter(
      r => r.urgency === 'critical' || r.urgency === 'high'
    )
  }

  /**
   * Store prediction
   */
  async storePrediction(id: string, prediction: Prediction): Promise<void> {
    this.predictions.set(id, prediction)
    this.logger.info(`Stored prediction: ${id}`)
  }

  /**
   * Get prediction
   */
  getPrediction(id: string): Prediction | undefined {
    return this.predictions.get(id)
  }

  /**
   * List all predictions
   */
  listPredictions(): Prediction[] {
    return Array.from(this.predictions.values())
  }

  /**
   * Calculate prediction accuracy
   */
  async calculateAccuracy(
    predictions: Prediction[],
    actual: Record<string, unknown>
  ): Promise<number> {
    if (predictions.length === 0) return 0

    let correct = 0
    for (const pred of predictions) {
      if (actual[pred.type] === pred.value) {
        correct++
      }
    }

    return (correct / predictions.length) * 100
  }
}
