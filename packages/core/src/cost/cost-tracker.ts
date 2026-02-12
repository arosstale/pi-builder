/**
 * Cost Tracking Layer - Comprehensive cost tracking for all requests
 *
 * Features:
 * - Per-request cost calculation
 * - Historical cost tracking
 * - Cost analytics
 * - Budget management
 * - Cost optimization recommendations
 */

export interface CostRecord {
  id: string
  timestamp: Date
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costInput: number
  costOutput: number
  totalCost: number
  cacheHit: boolean
  cacheSavings?: number // Cost saved by cache
  userId?: string
  sessionId?: string
  requestId?: string
}

export interface CostSummary {
  totalCost: number
  totalTokens: number
  recordCount: number
  averageCostPerRequest: number
  averageTokensPerRequest: number
  costByProvider: Record<string, number>
  costByModel: Record<string, number>
  costTrend: { date: string; cost: number }[]
}

export interface BudgetSettings {
  dailyBudget?: number
  monthlyBudget?: number
  perRequestLimit?: number
  alerts?: {
    onDailyBudgetExceeded: boolean
    onMonthlyBudgetExceeded: boolean
    onPerRequestLimitExceeded: boolean
    at50Percent: boolean
    at75Percent: boolean
    at90Percent: boolean
  }
}

export class CostTracker {
  private records: CostRecord[] = []
  private maxRecords: number = 100000
  private budgetSettings: BudgetSettings = {}
  private costAlerts: Array<(alert: string) => void> = []

  constructor(maxRecords: number = 100000, budgetSettings?: BudgetSettings) {
    this.maxRecords = maxRecords
    if (budgetSettings) {
      this.budgetSettings = budgetSettings
    }
  }

  /**
   * Record a cost for a request
   */
  recordCost(record: Omit<CostRecord, 'id' | 'timestamp'>): CostRecord {
    const fullRecord: CostRecord = {
      ...record,
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }

    this.records.push(fullRecord)

    // Maintain size limit
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords)
    }

    // Check budget alerts
    this.checkBudgetAlerts(fullRecord)

    return fullRecord
  }

  /**
   * Get all cost records
   */
  getAllRecords(): CostRecord[] {
    return [...this.records]
  }

  /**
   * Get records for a specific period
   */
  getRecordsByPeriod(startDate: Date, endDate: Date): CostRecord[] {
    return this.records.filter((r) => r.timestamp >= startDate && r.timestamp <= endDate)
  }

  /**
   * Get records by provider
   */
  getRecordsByProvider(provider: string): CostRecord[] {
    return this.records.filter((r) => r.provider === provider)
  }

  /**
   * Get records by model
   */
  getRecordsByModel(model: string): CostRecord[] {
    return this.records.filter((r) => r.model === model)
  }

  /**
   * Get records by session
   */
  getRecordsBySession(sessionId: string): CostRecord[] {
    return this.records.filter((r) => r.sessionId === sessionId)
  }

  /**
   * Get cost summary
   */
  getSummary(records: CostRecord[] = this.records): CostSummary {
    const totalCost = records.reduce((sum, r) => sum + r.totalCost, 0)
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0)
    const recordCount = records.length

    // Cost by provider
    const costByProvider: Record<string, number> = {}
    records.forEach((r) => {
      costByProvider[r.provider] = (costByProvider[r.provider] || 0) + r.totalCost
    })

    // Cost by model
    const costByModel: Record<string, number> = {}
    records.forEach((r) => {
      costByModel[r.model] = (costByModel[r.model] || 0) + r.totalCost
    })

    // Cost trend (daily)
    const costByDate: Record<string, number> = {}
    records.forEach((r) => {
      const date = r.timestamp.toISOString().split('T')[0]
      costByDate[date] = (costByDate[date] || 0) + r.totalCost
    })
    const costTrend = Object.entries(costByDate)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalCost,
      totalTokens,
      recordCount,
      averageCostPerRequest: recordCount > 0 ? totalCost / recordCount : 0,
      averageTokensPerRequest: recordCount > 0 ? totalTokens / recordCount : 0,
      costByProvider,
      costByModel,
      costTrend,
    }
  }

  /**
   * Get today's cost
   */
  getTodayCost(): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return this.getRecordsByPeriod(today, tomorrow).reduce((sum, r) => sum + r.totalCost, 0)
  }

  /**
   * Get this month's cost
   */
  getMonthCost(): number {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)

    return this.getRecordsByPeriod(firstDay, now).reduce((sum, r) => sum + r.totalCost, 0)
  }

  /**
   * Get cost optimization recommendations
   */
  getOptimizations(records: CostRecord[] = this.records): string[] {
    const recommendations: string[] = []
    const summary = this.getSummary(records)

    // Check for expensive models
    Object.entries(summary.costByModel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([model, cost]) => {
        const percentage = (cost / summary.totalCost) * 100
        if (percentage > 40) {
          recommendations.push(
            `Model "${model}" accounts for ${percentage.toFixed(1)}% of costs. Consider using cheaper alternatives.`
          )
        }
      })

    // Check for cache hits
    const cacheHitRate = records.filter((r) => r.cacheHit).length / records.length
    if (cacheHitRate < 0.2 && records.length > 100) {
      recommendations.push(
        `Cache hit rate is low (${(cacheHitRate * 100).toFixed(1)}%). Implement caching to reduce costs.`
      )
    }

    // Check for token waste
    const avgTokensPerRequest = summary.averageTokensPerRequest
    if (avgTokensPerRequest > 5000) {
      recommendations.push(
        `Average tokens per request is high (${avgTokensPerRequest.toFixed(0)}). Optimize prompts to reduce token usage.`
      )
    }

    // Provider balance
    const providerCosts = Object.values(summary.costByProvider)
    if (providerCosts.length > 1) {
      const maxCost = Math.max(...providerCosts)
      const minCost = Math.min(...providerCosts)
      const ratio = maxCost / minCost
      if (ratio > 3) {
        recommendations.push(
          `Provider costs vary significantly (${ratio.toFixed(1)}x). Consider balancing across providers.`
        )
      }
    }

    return recommendations
  }

  /**
   * Set budget settings
   */
  setBudgetSettings(settings: BudgetSettings): void {
    this.budgetSettings = { ...this.budgetSettings, ...settings }
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: string) => void): void {
    this.costAlerts.push(callback)
  }

  /**
   * Check budget and trigger alerts
   */
  private checkBudgetAlerts(record: CostRecord): void {
    const dailyCost = this.getTodayCost()
    const monthlyCost = this.getMonthCost()

    // Per-request limit
    if (
      this.budgetSettings.perRequestLimit &&
      record.totalCost > this.budgetSettings.perRequestLimit &&
      this.budgetSettings.alerts?.onPerRequestLimitExceeded
    ) {
      this.triggerAlert(
        `⚠️ Request cost (${record.totalCost.toFixed(4)}) exceeded limit (${this.budgetSettings.perRequestLimit.toFixed(4)})`
      )
    }

    // Daily budget
    if (this.budgetSettings.dailyBudget) {
      if (
        dailyCost > this.budgetSettings.dailyBudget &&
        this.budgetSettings.alerts?.onDailyBudgetExceeded
      ) {
        this.triggerAlert(`🚨 Daily budget exceeded: $${dailyCost.toFixed(2)}`)
      } else if (
        dailyCost > this.budgetSettings.dailyBudget * 0.9 &&
        this.budgetSettings.alerts?.at90Percent
      ) {
        this.triggerAlert(`⚠️ Daily budget at 90%: $${dailyCost.toFixed(2)}`)
      } else if (
        dailyCost > this.budgetSettings.dailyBudget * 0.75 &&
        this.budgetSettings.alerts?.at75Percent
      ) {
        this.triggerAlert(`ℹ️ Daily budget at 75%: $${dailyCost.toFixed(2)}`)
      } else if (
        dailyCost > this.budgetSettings.dailyBudget * 0.5 &&
        this.budgetSettings.alerts?.at50Percent
      ) {
        this.triggerAlert(`ℹ️ Daily budget at 50%: $${dailyCost.toFixed(2)}`)
      }
    }

    // Monthly budget
    if (this.budgetSettings.monthlyBudget) {
      if (
        monthlyCost > this.budgetSettings.monthlyBudget &&
        this.budgetSettings.alerts?.onMonthlyBudgetExceeded
      ) {
        this.triggerAlert(`🚨 Monthly budget exceeded: $${monthlyCost.toFixed(2)}`)
      } else if (
        monthlyCost > this.budgetSettings.monthlyBudget * 0.9 &&
        this.budgetSettings.alerts?.at90Percent
      ) {
        this.triggerAlert(`⚠️ Monthly budget at 90%: $${monthlyCost.toFixed(2)}`)
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(message: string): void {
    for (const callback of this.costAlerts) {
      try {
        callback(message)
      } catch (error) {
        console.error('Error in alert callback:', error)
      }
    }
  }

  /**
   * Clear all records
   */
  clearRecords(): void {
    this.records = []
  }

  /**
   * Export records as JSON
   */
  toJSON(): CostRecord[] {
    return this.getAllRecords()
  }
}

/**
 * Global cost tracker instance
 */
export const costTracker = new CostTracker()
