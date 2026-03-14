/**
 * Cost Intelligence System
 * Analyzes and optimizes execution costs
 *
 * @module optimization/cost-intelligence
 */

import { AgentLogger } from '../agents/logger'

/**
 * Cost breakdown
 */
export interface CostBreakdown {
  period: string
  total: number
  byAgent: Map<string, number>
  byTaskType: Map<string, number>
  byModel: Map<string, number>
  trends: {
    daily: number[]
    weekly: number
    monthly: number
  }
}

/**
 * Cost saving suggestion
 */
export interface CostSavingSuggestion {
  id: string
  title: string
  description: string
  currentCost: number
  estimatedSavings: number
  savingsPercentage: number
  difficulty: 'easy' | 'medium' | 'hard'
  implementation: string
  priority: number
}

/**
 * Savings report
 */
export interface SavingsReport {
  period: string
  originalCost: number
  optimizedCost: number
  savings: number
  savingsPercentage: number
  appliedSuggestions: CostSavingSuggestion[]
  remainingOpportunities: CostSavingSuggestion[]
  projectedAnnualSavings: number
}

/**
 * Cost Intelligence - analyzes and reduces costs
 */
export class CostIntelligence {
  private costs: Array<{ timestamp: Date; amount: number; agent: string; taskType: string; model: string }> =
    []
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('CostIntelligence')
  }

  /**
   * Record a cost
   */
  recordCost(
    amount: number,
    agent: string,
    taskType: string,
    model: string
  ): void {
    this.costs.push({
      timestamp: new Date(),
      amount,
      agent,
      taskType,
      model
    })
  }

  /**
   * Analyze expense trends
   */
  async analyzeExpenses(period: 'daily' | 'weekly' | 'monthly' = 'monthly'): Promise<CostBreakdown> {
    const now = new Date()
    let cutoffDate = new Date()

    if (period === 'daily') cutoffDate.setDate(now.getDate() - 1)
    else if (period === 'weekly') cutoffDate.setDate(now.getDate() - 7)
    else cutoffDate.setMonth(now.getMonth() - 1)

    const relevantCosts = this.costs.filter(c => c.timestamp > cutoffDate)

    // Calculate totals
    const byAgent = new Map<string, number>()
    const byTaskType = new Map<string, number>()
    const byModel = new Map<string, number>()
    let total = 0

    for (const cost of relevantCosts) {
      total += cost.amount

      byAgent.set(cost.agent, (byAgent.get(cost.agent) || 0) + cost.amount)
      byTaskType.set(
        cost.taskType,
        (byTaskType.get(cost.taskType) || 0) + cost.amount
      )
      byModel.set(cost.model, (byModel.get(cost.model) || 0) + cost.amount)
    }

    // Calculate trends
    const daily: number[] = []
    for (let i = 0; i < 30; i++) {
      const dayStart = new Date(now)
      dayStart.setDate(now.getDate() - i)
      dayStart.setHours(0, 0, 0, 0)

      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayStart.getDate() + 1)

      const dayCosts = this.costs
        .filter(c => c.timestamp >= dayStart && c.timestamp < dayEnd)
        .reduce((sum, c) => sum + c.amount, 0)

      daily.unshift(dayCosts)
    }

    const weekly = daily.slice(0, 7).reduce((a, b) => a + b, 0)
    const monthly = daily.reduce((a, b) => a + b, 0)

    return {
      period: `${period} (ending ${now.toISOString()})`,
      total,
      byAgent,
      byTaskType,
      byModel,
      trends: {
        daily: daily.slice(-7),
        weekly,
        monthly
      }
    }
  }

  /**
   * Suggest cost reductions
   */
  async suggestCuttings(): Promise<CostSavingSuggestion[]> {
    const suggestions: CostSavingSuggestion[] = []
    const breakdown = await this.analyzeExpenses('monthly')

    // Suggestion 1: Switch expensive agents
    let maxAgent = ''
    let maxCost = 0
    for (const [agent, cost] of breakdown.byAgent.entries()) {
      if (cost > maxCost) {
        maxCost = cost
        maxAgent = agent
      }
    }

    if (maxCost > breakdown.total * 0.3) {
      const savings = maxCost * 0.3
      suggestions.push({
        id: `cost-agent-${maxAgent}`,
        title: `Reduce ${maxAgent} usage`,
        description: `${maxAgent} accounts for ${((maxCost / breakdown.total) * 100).toFixed(0)}% of costs. Consider switching to cheaper alternative.`,
        currentCost: maxCost,
        estimatedSavings: savings,
        savingsPercentage: (savings / maxCost) * 100,
        difficulty: 'easy',
        implementation: `Switch to cheaper model or agent for non-critical tasks`,
        priority: 9
      })
    }

    // Suggestion 2: Batch similar tasks
    let maxTaskType = ''
    let maxTaskCost = 0
    for (const [taskType, cost] of breakdown.byTaskType.entries()) {
      if (cost > maxTaskCost) {
        maxTaskCost = cost
        maxTaskType = taskType
      }
    }

    if (maxTaskCost > breakdown.total * 0.2) {
      const savings = maxTaskCost * 0.2
      suggestions.push({
        id: `cost-batch-${maxTaskType}`,
        title: `Batch ${maxTaskType} requests`,
        description: `${maxTaskType} operations can be batched to reduce API calls.`,
        currentCost: maxTaskCost,
        estimatedSavings: savings,
        savingsPercentage: (savings / maxTaskCost) * 100,
        difficulty: 'medium',
        implementation: `Implement request batching for ${maxTaskType}`,
        priority: 7
      })
    }

    // Suggestion 3: Use cache for repeated requests
    suggestions.push({
      id: 'cost-cache',
      title: 'Enable result caching',
      description: 'Cache repeated requests to avoid redundant API calls.',
      currentCost: breakdown.total * 0.2,
      estimatedSavings: breakdown.total * 0.2 * 0.5,
      savingsPercentage: 50,
      difficulty: 'easy',
      implementation: 'Enable result caching with 1-hour TTL',
      priority: 8
    })

    // Suggestion 4: Use smaller models
    suggestions.push({
      id: 'cost-model',
      title: 'Switch to smaller models',
      description: 'Use smaller, faster, cheaper models when possible.',
      currentCost: breakdown.total,
      estimatedSavings: breakdown.total * 0.2,
      savingsPercentage: 20,
      difficulty: 'medium',
      implementation: 'Route non-critical tasks to cheaper models',
      priority: 7
    })

    // Sort by savings
    suggestions.sort((a, b) => b.estimatedSavings - a.estimatedSavings)

    this.logger.info(`Generated ${suggestions.length} cost-saving suggestions`)
    return suggestions
  }

  /**
   * Apply optimizations and measure savings
   */
  async optimizeCosts(
    suggestions: CostSavingSuggestion[]
  ): Promise<SavingsReport> {
    const breakdown = await this.analyzeExpenses('monthly')
    const appliedSuggestions = suggestions.slice(0, 3) // Apply top 3

    // Calculate projected savings
    const totalSavings = appliedSuggestions.reduce(
      (sum, s) => sum + s.estimatedSavings,
      0
    )
    const optimizedCost = Math.max(0, breakdown.total - totalSavings)
    const savingsPercentage = (totalSavings / breakdown.total) * 100

    const report: SavingsReport = {
      period: breakdown.period,
      originalCost: breakdown.total,
      optimizedCost,
      savings: totalSavings,
      savingsPercentage,
      appliedSuggestions,
      remainingOpportunities: suggestions.slice(3),
      projectedAnnualSavings: totalSavings * 12
    }

    this.logger.info(
      `Optimization report: Save $${totalSavings.toFixed(2)} (${savingsPercentage.toFixed(1)}%) monthly`
    )

    return report
  }

  /**
   * Get cost distribution
   */
  async getCostDistribution(): Promise<{
    byAgent: Array<{ agent: string; cost: number; percentage: number }>
    byTaskType: Array<{ taskType: string; cost: number; percentage: number }>
    byModel: Array<{ model: string; cost: number; percentage: number }>
  }> {
    const breakdown = await this.analyzeExpenses('monthly')

    const byAgent = Array.from(breakdown.byAgent.entries())
      .map(([agent, cost]) => ({
        agent,
        cost,
        percentage: (cost / breakdown.total) * 100
      }))
      .sort((a, b) => b.cost - a.cost)

    const byTaskType = Array.from(breakdown.byTaskType.entries())
      .map(([taskType, cost]) => ({
        taskType,
        cost,
        percentage: (cost / breakdown.total) * 100
      }))
      .sort((a, b) => b.cost - a.cost)

    const byModel = Array.from(breakdown.byModel.entries())
      .map(([model, cost]) => ({
        model,
        cost,
        percentage: (cost / breakdown.total) * 100
      }))
      .sort((a, b) => b.cost - a.cost)

    return { byAgent, byTaskType, byModel }
  }

  /**
   * Clear cost history
   */
  clear(): void {
    this.costs = []
  }
}
