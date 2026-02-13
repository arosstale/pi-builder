/**
 * Agent Memory System
 * Stores and learns from agent decisions and outcomes
 *
 * @module agents/agent-memory
 */

import type { Task, TaskResult } from './agent'
import { AgentLogger } from './logger'

/**
 * A single memory entry - decision + outcome + feedback
 */
export interface MemoryEntry {
  id: string
  timestamp: Date
  agentId: string
  taskId: string
  task: Task
  decision: unknown
  result: TaskResult
  feedback?: unknown
  tags?: string[]
  metadata?: Record<string, unknown>
}

/**
 * Pattern identified from multiple memories
 */
export interface Pattern {
  id: string
  name: string
  description: string
  frequency: number // how often observed
  confidence: number // 0-1
  affectedAgents: string[]
  conditions: unknown[]
  outcome: unknown
  firstObserved: Date
  lastObserved: Date
}

/**
 * Optimization suggestion based on patterns
 */
export interface Optimization {
  id: string
  pattern: Pattern
  suggestion: string
  expectedImprovement: string // e.g., "20% faster" or "30% cheaper"
  difficulty: 'easy' | 'medium' | 'hard'
  estimatedEffort: number // in hours
  priority: number // 1-10
  implementation?: string // code snippet or instructions
}

/**
 * Agent Memory - stores decisions and learns
 */
export class AgentMemory {
  private entries: Map<string, MemoryEntry> = new Map()
  private patterns: Map<string, Pattern> = new Map()
  private logger: AgentLogger
  private autoAnalyze: boolean = true
  private maxEntries: number = 10000

  // Analytics
  private analytics = {
    totalEntries: 0,
    successfulDecisions: 0,
    failedDecisions: 0,
    averageLatency: 0,
    averageCost: 0,
    patternsIdentified: 0
  }

  constructor(maxEntries: number = 10000, logger?: AgentLogger) {
    this.maxEntries = maxEntries
    this.logger = logger || new AgentLogger('Memory')
  }

  /**
   * Record a decision and its outcome
   */
  async recordDecision(
    agentId: string,
    task: Task,
    decision: unknown,
    result: TaskResult,
    feedback?: unknown
  ): Promise<MemoryEntry> {
    const entry: MemoryEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      agentId,
      taskId: task.id,
      task,
      decision,
      result,
      feedback,
      metadata: {
        success: result.success,
        latency: result.latency,
        cost: result.cost
      }
    }

    this.entries.set(entry.id, entry)
    this.analytics.totalEntries++

    if (result.success) {
      this.analytics.successfulDecisions++
    } else {
      this.analytics.failedDecisions++
    }

    this.analytics.averageLatency =
      (this.analytics.averageLatency * (this.analytics.totalEntries - 1) +
        result.latency) /
      this.analytics.totalEntries

    if (result.cost) {
      this.analytics.averageCost =
        (this.analytics.averageCost * (this.analytics.totalEntries - 1) + result.cost) /
        this.analytics.totalEntries
    }

    // Auto-analyze if enabled
    if (this.autoAnalyze && this.entries.size % 100 === 0) {
      await this.analyzePatterns()
    }

    // Cleanup if over capacity
    if (this.entries.size > this.maxEntries) {
      this.cleanup()
    }

    return entry
  }

  /**
   * Tag entries for easier retrieval
   */
  tagEntries(query: Partial<MemoryEntry>, tags: string[]): void {
    for (const entry of this.entries.values()) {
      if (this.matchesQuery(entry, query)) {
        entry.tags = [...(entry.tags || []), ...tags]
      }
    }
  }

  /**
   * Query memories by criteria
   */
  query(criteria: Partial<MemoryEntry>): MemoryEntry[] {
    return Array.from(this.entries.values()).filter(entry =>
      this.matchesQuery(entry, criteria)
    )
  }

  /**
   * Get memories by agent
   */
  getByAgent(agentId: string): MemoryEntry[] {
    return this.query({ agentId })
  }

  /**
   * Get memories by task
   */
  getByTask(taskId: string): MemoryEntry[] {
    return this.query({ taskId })
  }

  /**
   * Get successful decisions
   */
  getSuccessful(): MemoryEntry[] {
    return Array.from(this.entries.values()).filter(e => e.result.success)
  }

  /**
   * Get failed decisions
   */
  getFailed(): MemoryEntry[] {
    return Array.from(this.entries.values()).filter(e => !e.result.success)
  }

  /**
   * Analyze memories for patterns
   */
  async analyzePatterns(): Promise<Pattern[]> {
    const patterns: Pattern[] = []

    // Pattern 1: Agent success rate by task type
    const taskTypeSuccess = new Map<string, { success: number; total: number }>()

    for (const entry of this.entries.values()) {
      const taskType = entry.task.type
      const current = taskTypeSuccess.get(taskType) || { success: 0, total: 0 }
      current.total++
      if (entry.result.success) current.success++
      taskTypeSuccess.set(taskType, current)
    }

    // Convert to patterns
    for (const [taskType, stats] of taskTypeSuccess.entries()) {
      if (stats.total < 5) continue // minimum samples

      const pattern: Pattern = {
        id: this.generateId(),
        name: `Agent effectiveness for ${taskType}`,
        description: `Pattern observed across ${stats.total} executions`,
        frequency: stats.total,
        confidence: stats.success / stats.total,
        affectedAgents: this.getAgentsForTaskType(taskType),
        conditions: [{ type: 'taskType', value: taskType }],
        outcome: {
          successRate: stats.success / stats.total,
          avgLatency: this.getAvgLatencyForTaskType(taskType),
          totalCost: this.getTotalCostForTaskType(taskType)
        },
        firstObserved: this.getFirstObservedForTaskType(taskType),
        lastObserved: new Date()
      }

      patterns.push(pattern)
    }

    // Pattern 2: Cost outliers
    const costOutliers = this.identifyCostOutliers()
    for (const outlier of costOutliers) {
      const pattern: Pattern = {
        id: this.generateId(),
        name: `Cost anomaly for ${outlier.taskType}`,
        description: `Task ${outlier.taskType} costs are higher than normal`,
        frequency: outlier.frequency,
        confidence: 0.8,
        affectedAgents: outlier.agents,
        conditions: [
          { type: 'taskType', value: outlier.taskType },
          { type: 'costThreshold', value: outlier.threshold }
        ],
        outcome: {
          expectedCost: outlier.expectedCost,
          actualCost: outlier.actualCost,
          variance: outlier.actualCost / outlier.expectedCost
        },
        firstObserved: outlier.firstObserved,
        lastObserved: new Date()
      }

      patterns.push(pattern)
    }

    // Update patterns map
    for (const pattern of patterns) {
      this.patterns.set(pattern.id, pattern)
    }

    this.analytics.patternsIdentified = this.patterns.size

    this.logger.info(`Identified ${patterns.length} new patterns from ${this.entries.size} entries`)

    return patterns
  }

  /**
   * Get all identified patterns
   */
  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values())
  }

  /**
   * Suggest optimizations based on patterns
   */
  suggestOptimizations(): Optimization[] {
    const optimizations: Optimization[] = []

    for (const pattern of this.patterns.values()) {
      // Pattern 1: High cost tasks can use cheaper agent
      if (pattern.name.includes('Cost anomaly')) {
        optimizations.push({
          id: this.generateId(),
          pattern,
          suggestion: `Consider routing ${(pattern.conditions[0] as any).value} tasks to cheaper agents`,
          expectedImprovement: `${((1 - (pattern.outcome as any).variance) * 100).toFixed(0)}% cost reduction`,
          difficulty: 'easy',
          estimatedEffort: 2,
          priority: 8
        })
      }

      // Pattern 2: Low confidence task type needs better handling
      if (pattern.confidence < 0.7) {
        optimizations.push({
          id: this.generateId(),
          pattern,
          suggestion: `Low success rate for ${pattern.name.split(' ')[4]}. Consider additional validation or agent selection.`,
          expectedImprovement: `Improve success rate from ${(pattern.confidence * 100).toFixed(0)}% to 90%+`,
          difficulty: 'medium',
          estimatedEffort: 4,
          priority: 7
        })
      }
    }

    return optimizations.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Get analytics
   */
  getAnalytics() {
    return {
      ...this.analytics,
      successRate:
        this.analytics.totalEntries > 0
          ? (this.analytics.successfulDecisions / this.analytics.totalEntries) * 100
          : 0,
      patternCount: this.patterns.size,
      memorySize: this.entries.size
    }
  }

  /**
   * Export memories for backup/analysis
   */
  export(): {
    entries: MemoryEntry[]
    patterns: Pattern[]
    analytics: unknown
  } {
    return {
      entries: Array.from(this.entries.values()),
      patterns: Array.from(this.patterns.values()),
      analytics: this.getAnalytics()
    }
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.entries.clear()
    this.patterns.clear()
  }

  // Helper methods

  private matchesQuery(entry: MemoryEntry, query: Partial<MemoryEntry>): boolean {
    for (const [key, value] of Object.entries(query)) {
      if (key === 'metadata' || key === 'task' || key === 'result') continue
      if ((entry as any)[key] !== value) return false
    }
    return true
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private cleanup(): void {
    // Remove oldest 20% of entries
    const entriesToRemove = Math.floor(this.entries.size * 0.2)
    const entries = Array.from(this.entries.entries()).sort(
      (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
    )

    for (let i = 0; i < entriesToRemove; i++) {
      this.entries.delete(entries[i][0])
    }

    this.logger.info(`Cleaned up ${entriesToRemove} old entries`)
  }

  private getAgentsForTaskType(taskType: string): string[] {
    const agents = new Set<string>()
    for (const entry of this.entries.values()) {
      if (entry.task.type === taskType) {
        agents.add(entry.agentId)
      }
    }
    return Array.from(agents)
  }

  private getAvgLatencyForTaskType(taskType: string): number {
    const entries = this.query({ task: { type: taskType } as any })
    if (entries.length === 0) return 0
    return entries.reduce((sum, e) => sum + e.result.latency, 0) / entries.length
  }

  private getTotalCostForTaskType(taskType: string): number {
    const entries = this.query({ task: { type: taskType } as any })
    return entries.reduce((sum, e) => sum + (e.result.cost || 0), 0)
  }

  private getFirstObservedForTaskType(taskType: string): Date {
    const entries = this.query({ task: { type: taskType } as any })
    if (entries.length === 0) return new Date()
    const earliest = entries.reduce((minDate, e) =>
      e.timestamp < minDate ? e.timestamp : minDate
    )
    return earliest
  }

  private identifyCostOutliers(): Array<{
    taskType: string
    frequency: number
    agents: string[]
    threshold: number
    expectedCost: number
    actualCost: number
    firstObserved: Date
  }> {
    const outliers: Array<any> = []
    const costByTaskType = new Map<string, number[]>()

    // Collect costs by task type
    for (const entry of this.entries.values()) {
      const taskType = entry.task.type
      if (!costByTaskType.has(taskType)) {
        costByTaskType.set(taskType, [])
      }
      costByTaskType.get(taskType)!.push(entry.result.cost || 0)
    }

    // Identify outliers (costs > 2 std dev from mean)
    for (const [taskType, costs] of costByTaskType.entries()) {
      if (costs.length < 5) continue

      const mean = costs.reduce((a, b) => a + b) / costs.length
      const variance =
        costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length
      const stdDev = Math.sqrt(variance)
      const threshold = mean + 2 * stdDev

      const outlierCosts = costs.filter(c => c > threshold)
      if (outlierCosts.length > 0) {
        outliers.push({
          taskType,
          frequency: outlierCosts.length,
          agents: this.getAgentsForTaskType(taskType),
          threshold,
          expectedCost: mean,
          actualCost: outlierCosts.reduce((a, b) => a + b) / outlierCosts.length,
          firstObserved: this.getFirstObservedForTaskType(taskType)
        })
      }
    }

    return outliers
  }
}
