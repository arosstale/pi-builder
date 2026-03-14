import { HookEvent } from '../observability/hook-events'
import { AgentExecutionTrace } from '../observability/realtime-dashboard'

export interface AgentPerformanceScore {
  agentId: string
  score: number // 0-100
  components: {
    successRate: number
    executionSpeed: number
    costEfficiency: number
    reliability: number
  }
}

export interface ToolUsagePattern {
  toolName: string
  usageCount: number
  successRate: number
  avgExecutionTime: number
  totalCost: number
  trends: {
    day: number
    week: number
    month: number
  }
}

export interface ErrorAnalysis {
  errorType: string
  frequency: number
  lastOccurrence: Date
  affectedAgents: string[]
  resolutionRate: number
  resolutionTime: number // average milliseconds
}

export interface CostBreakdown {
  period: string
  totalCost: number
  byModel: Record<string, number>
  byAgent: Record<string, number>
  byTool: Record<string, number>
  savings: number // from optimization
}

export class AdvancedAnalytics {
  private events: HookEvent[] = []
  private traces: Map<string, AgentExecutionTrace> = new Map()
  private performanceScores: Map<string, AgentPerformanceScore> = new Map()
  private toolPatterns: Map<string, ToolUsagePattern> = new Map()
  private errors: Map<string, ErrorAnalysis> = new Map()

  constructor() {}

  /**
   * Add event for analysis
   */
  addEvent(event: HookEvent): void {
    this.events.push(event)
  }

  /**
   * Add trace for analysis
   */
  addTrace(trace: AgentExecutionTrace): void {
    this.traces.set(trace.sessionId, trace)
  }

  /**
   * Calculate agent performance score
   */
  calculateAgentPerformanceScore(agentId: string): AgentPerformanceScore {
    const agentTraces = Array.from(this.traces.values()).filter((t) => t.agentId === agentId)
    const agentEvents = this.events.filter((e) => e.agentId === agentId)

    let totalTools = 0
    let successfulTools = 0
    let totalExecutionTime = 0
    let totalCost = 0

    for (const trace of agentTraces) {
      totalTools += trace.toolCalls.length
      successfulTools += trace.successCount
      totalCost += trace.toolCalls.length * 0.01

      if (trace.endTime) {
        totalExecutionTime += trace.endTime.getTime() - trace.startTime.getTime()
      }
    }

    const successRate = totalTools > 0 ? (successfulTools / totalTools) * 100 : 100
    const avgExecutionTime = agentTraces.length > 0 ? totalExecutionTime / agentTraces.length : 0
    const costPerTool = totalTools > 0 ? totalCost / totalTools : 0

    // Score components (0-100 each)
    const successRateScore = Math.min(successRate, 100)
    const speedScore = Math.max(0, 100 - (avgExecutionTime / 1000) * 10) // slower = lower score
    const costScore = Math.max(0, 100 - costPerTool * 1000) // higher cost = lower score
    const reliabilityScore = agentTraces.length > 0 ? Math.min((agentTraces.length / 10) * 100, 100) : 0

    const score = {
      agentId,
      score: (successRateScore + speedScore + costScore + reliabilityScore) / 4,
      components: {
        successRate: successRateScore,
        executionSpeed: speedScore,
        costEfficiency: costScore,
        reliability: reliabilityScore
      }
    }

    this.performanceScores.set(agentId, score)

    return score
  }

  /**
   * Analyze tool usage patterns
   */
  analyzeToolUsagePatterns(): ToolUsagePattern[] {
    const patterns: Map<string, ToolUsagePattern> = new Map()

    for (const event of this.events) {
      if (event.type === 'PreToolUse' && event.toolName) {
        if (!patterns.has(event.toolName)) {
          patterns.set(event.toolName, {
            toolName: event.toolName,
            usageCount: 0,
            successRate: 0,
            avgExecutionTime: 0,
            totalCost: 0,
            trends: { day: 0, week: 0, month: 0 }
          })
        }

        const pattern = patterns.get(event.toolName)!
        pattern.usageCount++
      }
    }

    // Calculate success rates
    for (const event of this.events) {
      if ((event.type === 'PostToolUse' || event.type === 'PostToolUseFailure') && event.toolName) {
        const pattern = patterns.get(event.toolName)

        if (pattern) {
          const successCount = this.events.filter((e) => e.toolName === event.toolName && e.type === 'PostToolUse').length
          pattern.successRate = (successCount / pattern.usageCount) * 100

          if (event.metadata.duration) {
            pattern.avgExecutionTime = event.metadata.duration
          }

          pattern.totalCost = pattern.usageCount * 0.01
        }
      }
    }

    const patternArray = Array.from(patterns.values())
    this.toolPatterns = patterns

    return patternArray
  }

  /**
   * Perform error analysis
   */
  performErrorAnalysis(): ErrorAnalysis[] {
    const errorMap: Map<string, ErrorAnalysis> = new Map()

    for (const event of this.events) {
      if (event.type === 'PostToolUseFailure' && event.metadata.errorMessage) {
        const errorType = event.metadata.errorMessage
        const agentId = event.agentId || 'unknown'

        if (!errorMap.has(errorType)) {
          errorMap.set(errorType, {
            errorType,
            frequency: 0,
            lastOccurrence: event.timestamp,
            affectedAgents: [],
            resolutionRate: 0,
            resolutionTime: 0
          })
        }

        const error = errorMap.get(errorType)!
        error.frequency++
        error.lastOccurrence = event.timestamp

        if (!error.affectedAgents.includes(agentId)) {
          error.affectedAgents.push(agentId)
        }
      }
    }

    const errorArray = Array.from(errorMap.values())
    this.errors = errorMap

    return errorArray
  }

  /**
   * Calculate cost breakdown
   */
  calculateCostBreakdown(period: string = 'month'): CostBreakdown {
    let totalCost = 0
    const byModel: Record<string, number> = {}
    const byAgent: Record<string, number> = {}
    const byTool: Record<string, number> = {}

    for (const event of this.events) {
      const cost = 0.001 // $0.001 per event

      totalCost += cost

      // By model
      byModel[event.model] = (byModel[event.model] || 0) + cost

      // By agent
      if (event.agentId) {
        byAgent[event.agentId] = (byAgent[event.agentId] || 0) + cost
      }

      // By tool
      if (event.toolName) {
        byTool[event.toolName] = (byTool[event.toolName] || 0) + cost
      }
    }

    // Calculate savings from multi-model optimization
    const savings = totalCost * 0.4 // 40% savings from Stitch routing

    return {
      period,
      totalCost,
      byModel,
      byAgent,
      byTool,
      savings
    }
  }

  /**
   * Get top agents by performance
   */
  getTopAgents(limit: number = 10): AgentPerformanceScore[] {
    const agents = new Set<string>()

    for (const trace of this.traces.values()) {
      agents.add(trace.agentId)
    }

    const scores = Array.from(agents)
      .map((agentId) => this.calculateAgentPerformanceScore(agentId))
      .sort((a, b) => b.score - a.score)

    return scores.slice(0, limit)
  }

  /**
   * Get most used tools
   */
  getMostUsedTools(limit: number = 10): ToolUsagePattern[] {
    const patterns = this.analyzeToolUsagePatterns()

    return patterns
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
  }

  /**
   * Get error insights
   */
  getErrorInsights(limit: number = 10): ErrorAnalysis[] {
    const errors = this.performErrorAnalysis()

    return errors
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
  }

  /**
   * Predict cost for next period
   */
  predictCostForNextPeriod(currentCost: number, growthRate: number = 0.1): number {
    return currentCost * (1 + growthRate)
  }

  /**
   * Generate optimization recommendations
   */
  generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = []

    // Check top error sources
    const topErrors = this.getErrorInsights(5)
    if (topErrors.length > 0) {
      const topError = topErrors[0]
      recommendations.push(`Fix error "${topError.errorType}" affecting ${topError.affectedAgents.length} agents (${topError.frequency} occurrences)`)
    }

    // Check underperforming agents
    const bottomAgents = Array.from(this.performanceScores.values())
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)

    for (const agent of bottomAgents) {
      if (agent.score < 70) {
        recommendations.push(`Optimize agent ${agent.agentId} - performance score: ${agent.score.toFixed(1)}/100`)
      }
    }

    // Check cost optimization
    const costBreakdown = this.calculateCostBreakdown()
    const potentialSavings = costBreakdown.totalCost * 0.2

    if (potentialSavings > 0) {
      recommendations.push(`Potential savings: $${potentialSavings.toFixed(2)}/month through model optimization`)
    }

    // Check tool efficiency
    const inefficientTools = this.getMostUsedTools().filter((t) => t.successRate < 80)
    if (inefficientTools.length > 0) {
      recommendations.push(`Improve reliability of ${inefficientTools[0].toolName} (${inefficientTools[0].successRate.toFixed(1)}% success rate)`)
    }

    return recommendations
  }

  /**
   * Get comprehensive analytics report
   */
  generateComprehensiveReport(): {
    executionMetrics: any
    costAnalysis: any
    agentPerformance: AgentPerformanceScore[]
    toolPatterns: ToolUsagePattern[]
    errorAnalysis: ErrorAnalysis[]
    recommendations: string[]
  } {
    return {
      executionMetrics: {
        totalEvents: this.events.length,
        totalTraces: this.traces.size,
        avgEventsPerTrace: this.traces.size > 0 ? this.events.length / this.traces.size : 0
      },
      costAnalysis: this.calculateCostBreakdown(),
      agentPerformance: this.getTopAgents(10),
      toolPatterns: this.getMostUsedTools(10),
      errorAnalysis: this.getErrorInsights(10),
      recommendations: this.generateOptimizationRecommendations()
    }
  }
}
