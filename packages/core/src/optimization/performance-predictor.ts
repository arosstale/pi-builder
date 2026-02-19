/**
 * Performance Predictor
 * Predicts latency, cost, and success rate using historical data
 *
 * @module optimization/performance-predictor
 */

import type { Task } from '../agents'
import { AgentLogger } from '../agents/logger'

/**
 * Performance prediction
 */
export interface PerformancePrediction {
  taskId: string
  predicted: number
  actual?: number
  confidence: number // 0-1
  range: {
    min: number
    max: number
  }
  factors?: string[]
}

/**
 * Cost prediction
 */
export interface CostPrediction extends PerformancePrediction {
  breakdown?: {
    api: number
    processing: number
    storage: number
  }
}

/**
 * Execution forecast
 */
export interface ExecutionForecast {
  taskId: string
  latency: PerformancePrediction
  cost: CostPrediction
  successRate: number
  riskLevel: 'low' | 'medium' | 'high'
  recommendations?: string[]
}

/**
 * Performance Predictor - forecasts task performance
 */
export class PerformancePredictor {
  private history: Map<string, PerformancePrediction[]> = new Map()
  private logger: AgentLogger
  private minDataPoints: number = 5

  constructor(minDataPoints: number = 5) {
    this.minDataPoints = minDataPoints
    this.logger = new AgentLogger('PerformancePredictor')
  }

  /**
   * Predict latency for a task
   */
  async predictLatency(task: Task): Promise<PerformancePrediction> {
    const taskType = task.type
    const history = this.history.get(taskType) || []

    if (history.length < this.minDataPoints) {
      return {
        taskId: task.id,
        predicted: 100, // Default estimate
        confidence: 0.3,
        range: { min: 50, max: 500 },
        factors: ['insufficient_data']
      }
    }

    // Calculate statistics from history
    const latencies = history.map(h => h.predicted)
    const mean = latencies.reduce((a, b) => a + b) / latencies.length
    const variance =
      latencies.reduce((sum, lat) => sum + Math.pow(lat - mean, 2), 0) /
      latencies.length
    const stdDev = Math.sqrt(variance)

    // Adjust for task complexity
    const complexityFactor =
      (task.metadata?.complexity as number) || 1.0

    const predicted = mean * complexityFactor
    const confidence = Math.min(0.95, 0.3 + history.length * 0.1)

    return {
      taskId: task.id,
      predicted,
      confidence,
      range: {
        min: Math.max(0, predicted - 2 * stdDev),
        max: predicted + 2 * stdDev
      },
      factors: ['task_type', 'complexity', 'historical_data']
    }
  }

  /**
   * Predict cost for a task
   */
  async predictCost(task: Task): Promise<CostPrediction> {
    const taskType = task.type
    const history = this.history.get(taskType) || []

    if (history.length < this.minDataPoints) {
      return {
        taskId: task.id,
        predicted: 0.01,
        confidence: 0.3,
        range: { min: 0.001, max: 0.1 },
        breakdown: {
          api: 0.005,
          processing: 0.003,
          storage: 0.002
        }
      }
    }

    const costs = history.map(h => h.predicted)
    const avgCost = costs.reduce((a, b) => a + b) / costs.length
    const confidence = Math.min(0.9, 0.3 + history.length * 0.1)

    // Estimate breakdown
    const apiCost = avgCost * 0.6
    const processingCost = avgCost * 0.3
    const storageCost = avgCost * 0.1

    return {
      taskId: task.id,
      predicted: avgCost,
      confidence,
      range: {
        min: avgCost * 0.7,
        max: avgCost * 1.3
      },
      breakdown: {
        api: apiCost,
        processing: processingCost,
        storage: storageCost
      }
    }
  }

  /**
   * Predict success rate for a task
   */
  async predictSuccessRate(task: Task): Promise<number> {
    // Estimate based on task type and complexity
    const taskType = task.type
    const complexity = (task.metadata?.complexity as number) || 1.0
    const history = this.history.get(taskType) || []

    if (history.length < this.minDataPoints) {
      return 0.85 // Default estimate
    }

    // Calculate historical success rate
    const baseRate = history.filter(h => h.actual !== undefined).length /
      history.length || 0.85

    // Adjust for complexity
    const complexityPenalty = Math.max(0, complexity - 1.0) * 0.1
    const predicted = Math.max(0.3, Math.min(0.99, baseRate - complexityPenalty))

    return predicted
  }

  /**
   * Create comprehensive forecast
   */
  async forecast(task: Task): Promise<ExecutionForecast> {
    const [latency, cost, successRate] = await Promise.all([
      this.predictLatency(task),
      this.predictCost(task),
      this.predictSuccessRate(task)
    ])

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low'
    if (successRate < 0.7) riskLevel = 'high'
    else if (successRate < 0.8) riskLevel = 'medium'

    // Generate recommendations
    const recommendations: string[] = []
    if (latency.predicted > 1000) {
      recommendations.push('Consider enabling caching for faster response')
    }
    if (cost.predicted > 0.1) {
      recommendations.push('Consider using cheaper model for cost savings')
    }
    if (successRate < 0.85) {
      recommendations.push('Success rate is low, consider using different agent')
    }

    return {
      taskId: task.id,
      latency,
      cost,
      successRate,
      riskLevel,
      recommendations
    }
  }

  /**
   * Record actual performance for learning
   */
  recordActual(
    taskType: string,
    metric: string,
    actual: number,
    predicted: number
  ): void {
    if (!this.history.has(taskType)) {
      this.history.set(taskType, [])
    }

    this.history.get(taskType)!.push({
      taskId: `${taskType}-${Date.now()}`,
      predicted,
      actual,
      confidence: 0.8,
      range: { min: predicted * 0.8, max: predicted * 1.2 }
    })
  }

  /**
   * Get prediction accuracy
   */
  getAccuracy(taskType: string): {
    meanAbsoluteError: number
    accuracy: number
    sampleSize: number
  } {
    const predictions = this.history.get(taskType) || []

    if (predictions.length === 0) {
      return {
        meanAbsoluteError: 0,
        accuracy: 0,
        sampleSize: 0
      }
    }

    const actualPredictions = predictions.filter(p => p.actual !== undefined)
    if (actualPredictions.length === 0) {
      return {
        meanAbsoluteError: 0,
        accuracy: 0,
        sampleSize: 0
      }
    }

    const mae = actualPredictions.reduce((sum, p) => {
      return sum + Math.abs((p.actual! - p.predicted) / p.predicted)
    }, 0) / actualPredictions.length

    const accuracy = Math.max(0, 1 - mae)

    return {
      meanAbsoluteError: mae,
      accuracy,
      sampleSize: actualPredictions.length
    }
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history.clear()
  }
}
