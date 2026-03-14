import { HookEvent } from './hook-events'

export interface DashboardWidget {
  id: string
  title: string
  type: 'timeline' | 'metrics' | 'trace' | 'gauge' | 'table'
  data: any
  refreshInterval: number
}

export interface AgentExecutionTrace {
  sessionId: string
  agentId: string
  startTime: Date
  endTime?: Date
  status: 'running' | 'completed' | 'failed'
  events: HookEvent[]
  toolCalls: string[]
  errorCount: number
  successCount: number
}

export interface MultiAgentOrchestration {
  orchestrationId: string
  agents: {
    id: string
    status: 'idle' | 'running' | 'completed'
    currentTask?: string
    handoffTarget?: string
  }[]
  collaborationGraph: Map<string, string[]>
  timestamp: Date
}

export interface PerformanceMetrics {
  avgExecutionTime: number
  avgToolCallTime: number
  toolSuccessRate: number
  errorRate: number
  throughput: number // tasks per minute
  costPerTask: number
}

export class RealtimeDashboardService {
  private executionTraces: Map<string, AgentExecutionTrace> = new Map()
  private orchestrations: Map<string, MultiAgentOrchestration> = new Map()
  private metricsHistory: PerformanceMetrics[] = []
  private webSocketClients: any[] = []

  constructor() {}

  /**
   * Start execution trace
   */
  startExecutionTrace(sessionId: string, agentId: string): AgentExecutionTrace {
    const trace: AgentExecutionTrace = {
      sessionId,
      agentId,
      startTime: new Date(),
      status: 'running',
      events: [],
      toolCalls: [],
      errorCount: 0,
      successCount: 0
    }

    this.executionTraces.set(sessionId, trace)
    console.log(`📊 Execution trace started: ${sessionId}`)

    return trace
  }

  /**
   * Add event to trace
   */
  addEventToTrace(sessionId: string, event: HookEvent): void {
    const trace = this.executionTraces.get(sessionId)

    if (!trace) return

    trace.events.push(event)

    // Track tool calls
    if (event.type === 'PreToolUse' && event.toolName) {
      trace.toolCalls.push(event.toolName)
    }

    // Track success/failure
    if (event.type === 'PostToolUse') {
      trace.successCount++
    } else if (event.type === 'PostToolUseFailure') {
      trace.errorCount++
    }

    // Broadcast to WebSocket clients
    this.broadcastUpdate({
      type: 'trace-update',
      sessionId,
      trace
    })
  }

  /**
   * Complete execution trace
   */
  completeExecutionTrace(sessionId: string, success: boolean): AgentExecutionTrace | null {
    const trace = this.executionTraces.get(sessionId)

    if (!trace) return null

    trace.status = success ? 'completed' : 'failed'
    trace.endTime = new Date()

    console.log(`✅ Execution trace completed: ${sessionId} (${trace.events.length} events)`)

    // Broadcast completion
    this.broadcastUpdate({
      type: 'trace-complete',
      sessionId,
      trace
    })

    return trace
  }

  /**
   * Create multi-agent orchestration view
   */
  createOrchestration(orchestrationId: string, agentIds: string[]): MultiAgentOrchestration {
    const orch: MultiAgentOrchestration = {
      orchestrationId,
      agents: agentIds.map((id) => ({
        id,
        status: 'idle'
      })),
      collaborationGraph: new Map(),
      timestamp: new Date()
    }

    this.orchestrations.set(orchestrationId, orch)
    console.log(`🤝 Orchestration created: ${orchestrationId} (${agentIds.length} agents)`)

    return orch
  }

  /**
   * Update agent status in orchestration
   */
  updateAgentStatus(orchestrationId: string, agentId: string, status: 'idle' | 'running' | 'completed'): void {
    const orch = this.orchestrations.get(orchestrationId)

    if (!orch) return

    const agent = orch.agents.find((a) => a.id === agentId)
    if (agent) {
      agent.status = status
    }

    this.broadcastUpdate({
      type: 'orchestration-update',
      orchestrationId,
      orchestration: orch
    })
  }

  /**
   * Record agent handoff
   */
  recordAgentHandoff(orchestrationId: string, fromAgentId: string, toAgentId: string, task: string): void {
    const orch = this.orchestrations.get(orchestrationId)

    if (!orch) return

    // Update agent statuses
    const fromAgent = orch.agents.find((a) => a.id === fromAgentId)
    const toAgent = orch.agents.find((a) => a.id === toAgentId)

    if (fromAgent) {
      fromAgent.status = 'completed'
      fromAgent.handoffTarget = toAgentId
    }

    if (toAgent) {
      toAgent.status = 'running'
      toAgent.currentTask = task
    }

    // Update collaboration graph
    if (!orch.collaborationGraph.has(fromAgentId)) {
      orch.collaborationGraph.set(fromAgentId, [])
    }
    orch.collaborationGraph.get(fromAgentId)!.push(toAgentId)

    console.log(`🔄 Agent handoff: ${fromAgentId} -> ${toAgentId}`)

    this.broadcastUpdate({
      type: 'handoff',
      orchestrationId,
      from: fromAgentId,
      to: toAgentId,
      task
    })
  }

  /**
   * Calculate performance metrics
   */
  calculateMetrics(): PerformanceMetrics {
    let totalExecutionTime = 0
    let totalToolTime = 0
    let totalTools = 0
    let successfulTools = 0
    let failedTools = 0
    let totalCost = 0

    for (const trace of this.executionTraces.values()) {
      if (!trace.endTime) continue

      const executionTime = trace.endTime.getTime() - trace.startTime.getTime()
      totalExecutionTime += executionTime

      // Estimate tool time
      totalToolTime += executionTime * 0.7 // ~70% spent in tools

      totalTools += trace.toolCalls.length
      successfulTools += trace.successCount
      failedTools += trace.errorCount

      // Estimate cost per task
      totalCost += trace.toolCalls.length * 0.01
    }

    const traceCount = Array.from(this.executionTraces.values()).filter((t) => t.endTime).length

    const metrics: PerformanceMetrics = {
      avgExecutionTime: traceCount > 0 ? totalExecutionTime / traceCount : 0,
      avgToolCallTime: totalTools > 0 ? totalToolTime / totalTools : 0,
      toolSuccessRate: totalTools > 0 ? (successfulTools / totalTools) * 100 : 0,
      errorRate: totalTools > 0 ? (failedTools / totalTools) * 100 : 0,
      throughput: traceCount / 60, // tasks per minute
      costPerTask: traceCount > 0 ? totalCost / traceCount : 0
    }

    this.metricsHistory.push(metrics)

    // Keep last 100 metrics
    if (this.metricsHistory.length > 100) {
      this.metricsHistory.shift()
    }

    return metrics
  }

  /**
   * Get execution trace
   */
  getExecutionTrace(sessionId: string): AgentExecutionTrace | null {
    return this.executionTraces.get(sessionId) || null
  }

  /**
   * Get orchestration
   */
  getOrchestration(orchestrationId: string): MultiAgentOrchestration | null {
    return this.orchestrations.get(orchestrationId) || null
  }

  /**
   * Get all active traces
   */
  getActiveTraces(): AgentExecutionTrace[] {
    return Array.from(this.executionTraces.values()).filter((t) => t.status === 'running')
  }

  /**
   * Get all orchestrations
   */
  getAllOrchestrations(): MultiAgentOrchestration[] {
    return Array.from(this.orchestrations.values())
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 50): PerformanceMetrics[] {
    return this.metricsHistory.slice(-limit)
  }

  /**
   * Generate dashboard widgets
   */
  generateDashboardWidgets(): DashboardWidget[] {
    const metrics = this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null

    return [
      {
        id: 'execution-timeline',
        title: 'Agent Execution Timeline',
        type: 'timeline',
        data: Array.from(this.executionTraces.values()).map((t) => ({
          sessionId: t.sessionId,
          agentId: t.agentId,
          startTime: t.startTime,
          endTime: t.endTime,
          status: t.status,
          eventCount: t.events.length
        })),
        refreshInterval: 1000
      },
      {
        id: 'multi-agent-view',
        title: 'Multi-Agent Orchestration',
        type: 'trace',
        data: Array.from(this.orchestrations.values()).map((o) => ({
          orchestrationId: o.orchestrationId,
          agentCount: o.agents.length,
          activeAgents: o.agents.filter((a) => a.status === 'running').length,
          collaborations: o.collaborationGraph.size
        })),
        refreshInterval: 1000
      },
      {
        id: 'performance-metrics',
        title: 'Performance Metrics',
        type: 'metrics',
        data: metrics
          ? {
              avgExecutionTime: Math.round(metrics.avgExecutionTime),
              toolSuccessRate: Math.round(metrics.toolSuccessRate),
              errorRate: Math.round(metrics.errorRate),
              costPerTask: metrics.costPerTask.toFixed(4)
            }
          : null,
        refreshInterval: 5000
      },
      {
        id: 'metrics-trend',
        title: 'Metrics Trend',
        type: 'gauge',
        data: this.metricsHistory.map((m) => ({
          timestamp: new Date().getTime(),
          avgExecutionTime: m.avgExecutionTime,
          successRate: m.toolSuccessRate
        })),
        refreshInterval: 5000
      }
    ]
  }

  /**
   * Broadcast update to WebSocket clients
   */
  private broadcastUpdate(update: any): void {
    for (const client of this.webSocketClients) {
      try {
        // Simulate WebSocket send
        console.log(`📡 Broadcasting update to client: ${update.type}`)
      } catch (error) {
        console.error('Failed to broadcast update:', error)
      }
    }
  }

  /**
   * Clear old data
   */
  clearOldData(daysOld: number): number {
    const threshold = Date.now() - daysOld * 24 * 60 * 60 * 1000
    let cleaned = 0

    for (const [sessionId, trace] of this.executionTraces.entries()) {
      if (trace.startTime.getTime() < threshold) {
        this.executionTraces.delete(sessionId)
        cleaned++
      }
    }

    return cleaned
  }
}
