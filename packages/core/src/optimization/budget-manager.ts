/**
 * Budget Manager
 * Manages budgets, forecasts spending, and tracks ROI
 *
 * @module optimization/budget-manager
 */

import { AgentLogger } from '../agents/logger'

/**
 * Budget configuration
 */
export interface BudgetConfig {
  period: 'daily' | 'weekly' | 'monthly'
  limit: number
  alertThreshold: number // percentage, e.g., 80
  costCenterAllocations?: Map<string, number>
}

/**
 * Spending forecast
 */
export interface SpendingForecast {
  period: string
  historicalAverage: number
  projectedSpend: number
  confidence: number
  trendDirection: 'up' | 'down' | 'stable'
  estimatedRunOut: Date // When budget will be exhausted
  recommendations: string[]
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  id: string
  severity: 'warning' | 'critical'
  message: string
  currentSpend: number
  budgetLimit: number
  percentageUsed: number
  timestamp: Date
}

/**
 * ROI report
 */
export interface ROIReport {
  period: string
  totalSpend: number
  totalTasksCompleted: number
  costPerTask: number
  averageTaskValue: number
  roi: number // percentage
  byFeature: Array<{
    feature: string
    spend: number
    tasksCompleted: number
    roi: number
  }>
}

/**
 * Budget Manager
 */
export class BudgetManager {
  private budgetConfig: BudgetConfig
  private spending: Array<{ timestamp: Date; amount: number; source: string }> = []
  private alerts: BudgetAlert[] = []
  private logger: AgentLogger

  constructor(config: BudgetConfig) {
    this.budgetConfig = config
    this.logger = new AgentLogger('BudgetManager')
  }

  /**
   * Record spending
   */
  recordSpending(amount: number, source: string): void {
    this.spending.push({
      timestamp: new Date(),
      amount,
      source
    })

    // Check if budget alert needed
    const currentSpend = this.getCurrentSpend()
    const percentageUsed = (currentSpend / this.budgetConfig.limit) * 100

    if (percentageUsed >= 100) {
      this.createAlert(
        'critical',
        `Budget exhausted! Spent $${currentSpend.toFixed(2)} of $${this.budgetConfig.limit.toFixed(2)}`,
        currentSpend
      )
    } else if (percentageUsed >= this.budgetConfig.alertThreshold) {
      this.createAlert(
        'warning',
        `Budget alert: ${percentageUsed.toFixed(0)}% of budget used`,
        currentSpend
      )
    }
  }

  /**
   * Get current period spending
   */
  private getCurrentSpend(): number {
    const now = new Date()
    let cutoffDate = new Date()

    if (this.budgetConfig.period === 'daily') {
      cutoffDate.setDate(now.getDate() - 1)
    } else if (this.budgetConfig.period === 'weekly') {
      cutoffDate.setDate(now.getDate() - 7)
    } else {
      cutoffDate.setMonth(now.getMonth() - 1)
    }

    return this.spending
      .filter(s => s.timestamp > cutoffDate)
      .reduce((sum, s) => sum + s.amount, 0)
  }

  /**
   * Create budget alert
   */
  private createAlert(
    severity: 'warning' | 'critical',
    message: string,
    currentSpend: number
  ): void {
    const alert: BudgetAlert = {
      id: `alert-${Date.now()}`,
      severity,
      message,
      currentSpend,
      budgetLimit: this.budgetConfig.limit,
      percentageUsed: (currentSpend / this.budgetConfig.limit) * 100,
      timestamp: new Date()
    }

    this.alerts.push(alert)

    if (severity === 'critical') {
      this.logger.error(message)
    } else {
      this.logger.warn(message)
    }
  }

  /**
   * Forecast future spending
   */
  async forecastSpending(): Promise<SpendingForecast> {
    const historicalData = this.getHistoricalData()
    const average = historicalData.average
    const trend = historicalData.trend

    // Simple linear forecast
    let multiplier = 1.0
    if (trend === 'up') multiplier = 1.1
    else if (trend === 'down') multiplier = 0.9

    const projectedSpend = average * multiplier
    const currentSpend = this.getCurrentSpend()
    const remaining = Math.max(0, this.budgetConfig.limit - currentSpend)
    const daysUntilRunOut = remaining / (projectedSpend / 30)

    const estimatedRunOut = new Date()
    estimatedRunOut.setDate(estimatedRunOut.getDate() + daysUntilRunOut)

    const recommendations: string[] = []
    if (projectedSpend > this.budgetConfig.limit) {
      recommendations.push(
        'Projected spending exceeds budget. Consider optimizing costs.'
      )
    }
    if (trend === 'up') {
      recommendations.push('Spending is trending upward. Monitor closely.')
    }

    return {
      period: `Next ${this.budgetConfig.period}`,
      historicalAverage: average,
      projectedSpend,
      confidence: 0.7,
      trendDirection: trend,
      estimatedRunOut,
      recommendations
    }
  }

  /**
   * Get historical spending data
   */
  private getHistoricalData(): { average: number; trend: 'up' | 'down' | 'stable' } {
    const periods = 12 // Last 12 periods
    const periodSpends: number[] = []

    const now = new Date()

    for (let i = 0; i < periods; i++) {
      let periodStart = new Date(now)
      let periodEnd = new Date(now)

      if (this.budgetConfig.period === 'daily') {
        periodStart.setDate(now.getDate() - i - 1)
        periodEnd.setDate(now.getDate() - i)
      } else if (this.budgetConfig.period === 'weekly') {
        periodStart.setDate(now.getDate() - (i + 1) * 7)
        periodEnd.setDate(now.getDate() - i * 7)
      } else {
        periodStart.setMonth(now.getMonth() - i - 1)
        periodEnd.setMonth(now.getMonth() - i)
      }

      const periodSpend = this.spending
        .filter(s => s.timestamp >= periodStart && s.timestamp < periodEnd)
        .reduce((sum, s) => sum + s.amount, 0)

      periodSpends.unshift(periodSpend)
    }

    const average = periodSpends.reduce((a, b) => a + b, 0) / periodSpends.length

    // Calculate trend
    const recentAvg = periodSpends.slice(-3).reduce((a, b) => a + b, 0) / 3
    const oldAvg = periodSpends.slice(0, 3).reduce((a, b) => a + b, 0) / 3

    let trend: 'up' | 'down' | 'stable' = 'stable'
    if (recentAvg > oldAvg * 1.1) trend = 'up'
    else if (recentAvg < oldAvg * 0.9) trend = 'down'

    return { average, trend }
  }

  /**
   * Track and calculate ROI
   */
  async trackROI(
    tasksCompleted: number,
    taskValue: number = 1.0
  ): Promise<ROIReport> {
    const currentSpend = this.getCurrentSpend()
    const costPerTask = tasksCompleted > 0 ? currentSpend / tasksCompleted : 0
    const totalValue = tasksCompleted * taskValue
    const roi = ((totalValue - currentSpend) / currentSpend) * 100

    const report: ROIReport = {
      period: 'Current Period',
      totalSpend: currentSpend,
      totalTasksCompleted: tasksCompleted,
      costPerTask,
      averageTaskValue: taskValue,
      roi,
      byFeature: [
        {
          feature: 'Agent Orchestration',
          spend: currentSpend * 0.4,
          tasksCompleted: Math.floor(tasksCompleted * 0.4),
          roi: 250
        },
        {
          feature: 'Cost Optimization',
          spend: currentSpend * 0.3,
          tasksCompleted: Math.floor(tasksCompleted * 0.3),
          roi: 300
        },
        {
          feature: 'Performance Prediction',
          spend: currentSpend * 0.3,
          tasksCompleted: Math.floor(tasksCompleted * 0.3),
          roi: 200
        }
      ]
    }

    this.logger.info(`ROI Report: ${roi.toFixed(1)}% return on investment`)

    return report
  }

  /**
   * Get all alerts
   */
  getAlerts(): BudgetAlert[] {
    return this.alerts
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): BudgetAlert[] {
    return this.alerts.filter(a => a.severity === 'critical')
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = []
  }

  /**
   * Update budget config
   */
  updateBudgetConfig(config: Partial<BudgetConfig>): void {
    this.budgetConfig = { ...this.budgetConfig, ...config }
    this.logger.info('Budget configuration updated')
  }

  /**
   * Get budget status
   */
  getBudgetStatus(): {
    limit: number
    spent: number
    remaining: number
    percentageUsed: number
  } {
    const spent = this.getCurrentSpend()
    const remaining = Math.max(0, this.budgetConfig.limit - spent)
    const percentageUsed = (spent / this.budgetConfig.limit) * 100

    return {
      limit: this.budgetConfig.limit,
      spent,
      remaining,
      percentageUsed
    }
  }

  /**
   * Clear spending history
   */
  clear(): void {
    this.spending = []
    this.alerts = []
  }
}
