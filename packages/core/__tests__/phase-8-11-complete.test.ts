import { describe, it, expect, beforeEach } from 'vitest'
import { SandboxedAgent, SandboxConfig } from '../src/execution/sandboxed-agent'
import { HookEventCapture } from '../src/observability/hook-events'
import { RealtimeDashboardService } from '../src/observability/realtime-dashboard'
import { AdvancedAnalytics } from '../src/analytics/advanced-analytics'

describe('Phases 8-11: Sandbox + Observability + Dashboard + Analytics', () => {
  describe('Phase 8: Sandboxed Agent', () => {
    let agent: SandboxedAgent

    beforeEach(() => {
      agent = new SandboxedAgent('test-agent', {
        isolationLevel: 'strict',
        maxExecutionTime: 10000
      })
    })

    it('should create sandboxed agent', () => {
      expect(agent).toBeDefined()
    })

    it('should initialize sandbox', async () => {
      const config: SandboxConfig = {
        isolationLevel: 'strict',
        maxExecutionTime: 5000,
        maxMemory: 512,
        maxDiskSpace: 1024,
        allowedPackages: [],
        networkAccess: false,
        allowedDomains: [],
        fileSystemAccess: false,
        allowedPaths: []
      }

      const sandbox = await agent.initializeSandbox('test-sandbox-1', config)

      expect(sandbox).toBeDefined()
      expect(sandbox.status).toBe('initialized')
      expect(sandbox.logs.length).toBeGreaterThan(0)
    })

    it('should execute task in sandbox', async () => {
      const task = {
        id: 'task-1',
        type: 'generate' as const,
        description: 'Test task'
      }

      const result = await agent.execute(task)

      expect(result.success).toBe(true)
      expect(result.taskId).toBe('task-1')
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it('should enforce resource limits', async () => {
      const config: SandboxConfig = {
        isolationLevel: 'strict',
        maxExecutionTime: 5000,
        maxMemory: 256,
        maxDiskSpace: 512,
        allowedPackages: [],
        networkAccess: false,
        allowedDomains: [],
        fileSystemAccess: false,
        allowedPaths: []
      }

      const sandbox = await agent.initializeSandbox('test-sandbox-2', config)
      const context = agent.getExecutionContext(sandbox.id)

      if (context) {
        const enforced = await agent.enforceResourceLimits(sandbox.id)
        expect(enforced).toBe(true)
      }
    })

    it('should get sandbox metrics', async () => {
      const task = { id: 'task-2', type: 'generate' as const, description: 'Test' }
      await agent.execute(task)

      const sandboxes = agent.getAllSandboxes()
      if (sandboxes.length > 0) {
        const metrics = agent.getSandboxMetrics(sandboxes[0].id)

        expect(metrics).toBeDefined()
        expect(metrics?.executionTime).toBeGreaterThanOrEqual(0)
        expect(metrics?.cpuPercent).toBeGreaterThanOrEqual(0)
        expect(metrics?.memoryMB).toBeGreaterThanOrEqual(0)
      }
    })

    it('should cleanup sandbox', async () => {
      const config: SandboxConfig = {
        isolationLevel: 'strict',
        maxExecutionTime: 5000,
        maxMemory: 512,
        maxDiskSpace: 1024,
        allowedPackages: [],
        networkAccess: false,
        allowedDomains: [],
        fileSystemAccess: false,
        allowedPaths: []
      }

      const sandbox = await agent.initializeSandbox('cleanup-test', config)
      const cleaned = await agent.cleanupSandbox(sandbox.id)

      expect(cleaned).toBe(true)
      expect(agent.getSandbox(sandbox.id)).toBeNull()
    })
  })

  describe('Phase 9: Hook Event Capture', () => {
    let capture: HookEventCapture

    beforeEach(() => {
      capture = new HookEventCapture()
    })

    it('should create hook event capture', () => {
      expect(capture).toBeDefined()
    })

    it('should capture SessionStart event', async () => {
      const event = await capture.onSessionStart('session-1', 'test-app', 'claude-3.5', {})

      expect(event).toBeDefined()
      expect(event.type).toBe('SessionStart')
      expect(event.sessionId).toBe('session-1')
    })

    it('should capture UserPromptSubmit event', async () => {
      const event = await capture.onUserPromptSubmit('session-1', 'test-app', 'claude-3.5', {
        prompt: 'test prompt'
      })

      expect(event.type).toBe('UserPromptSubmit')
    })

    it('should capture PreToolUse event', async () => {
      const event = await capture.onPreToolUse('session-1', 'test-app', 'claude-3.5', 'git-ls-files', {})

      expect(event.type).toBe('PreToolUse')
      expect(event.toolName).toBe('git-ls-files')
    })

    it('should capture PostToolUse event', async () => {
      const event = await capture.onPostToolUse('session-1', 'test-app', 'claude-3.5', 'git-ls-files', 150, {})

      expect(event.type).toBe('PostToolUse')
      expect(event.metadata.duration).toBe(150)
      expect(event.metadata.status).toBe('success')
    })

    it('should capture PostToolUseFailure event', async () => {
      const event = await capture.onPostToolUseFailure('session-1', 'test-app', 'claude-3.5', 'git-ls-files', 'Command failed', {})

      expect(event.type).toBe('PostToolUseFailure')
      expect(event.metadata.status).toBe('failure')
      expect(event.metadata.errorMessage).toBe('Command failed')
    })

    it('should capture SubagentStart event', async () => {
      const event = await capture.onSubagentStart('session-1', 'test-app', 'claude-3.5', 'subagent-1', {})

      expect(event.type).toBe('SubagentStart')
      expect(event.subagentId).toBe('subagent-1')
    })

    it('should capture SubagentStop event', async () => {
      const event = await capture.onSubagentStop('session-1', 'test-app', 'claude-3.5', 'subagent-1', {})

      expect(event.type).toBe('SubagentStop')
    })

    it('should get session events', async () => {
      await capture.onSessionStart('session-2', 'test-app', 'claude-3.5', {})
      await capture.onUserPromptSubmit('session-2', 'test-app', 'claude-3.5', {})
      await capture.onSessionEnd('session-2', 'test-app', 'claude-3.5', {})

      const events = capture.getSessionEvents('session-2')

      expect(events.length).toBeGreaterThanOrEqual(3)
      expect(events[0].type).toBe('SessionStart')
    })

    it('should get events by type', async () => {
      await capture.onSessionStart('session-3', 'test-app', 'claude-3.5', {})
      await capture.onSessionStart('session-4', 'test-app', 'claude-3.5', {})

      const starts = capture.getEventsByType('SessionStart')

      expect(starts.length).toBeGreaterThanOrEqual(2)
      expect(starts.every((e) => e.type === 'SessionStart')).toBe(true)
    })

    it('should get session statistics', async () => {
      await capture.onSessionStart('session-5', 'test-app', 'claude-3.5', {})
      await capture.onPreToolUse('session-5', 'test-app', 'claude-3.5', 'tool-1', {})
      await capture.onPostToolUse('session-5', 'test-app', 'claude-3.5', 'tool-1', 100, {})
      await capture.onSessionEnd('session-5', 'test-app', 'claude-3.5', {})

      const stats = capture.getSessionStats('session-5')

      expect(stats.eventCount).toBeGreaterThanOrEqual(4)
      expect(stats.eventTypes.SessionStart).toBe(1)
      expect(stats.eventTypes.PostToolUse).toBe(1)
    })

    it('should subscribe to events', () => {
      let called = false

      capture.subscribe('SessionStart', () => {
        called = true
      })

      capture.onSessionStart('session-6', 'test-app', 'claude-3.5', {})

      expect(called).toBe(true)
    })
  })

  describe('Phase 10: Realtime Dashboard', () => {
    let dashboard: RealtimeDashboardService

    beforeEach(() => {
      dashboard = new RealtimeDashboardService()
    })

    it('should create dashboard service', () => {
      expect(dashboard).toBeDefined()
    })

    it('should start execution trace', () => {
      const trace = dashboard.startExecutionTrace('session-1', 'agent-1')

      expect(trace).toBeDefined()
      expect(trace.status).toBe('running')
      expect(trace.agentId).toBe('agent-1')
    })

    it('should get execution trace', () => {
      dashboard.startExecutionTrace('session-2', 'agent-1')
      const trace = dashboard.getExecutionTrace('session-2')

      expect(trace).toBeDefined()
      expect(trace?.sessionId).toBe('session-2')
    })

    it('should create multi-agent orchestration', () => {
      const orch = dashboard.createOrchestration('orch-1', ['agent-1', 'agent-2', 'agent-3'])

      expect(orch).toBeDefined()
      expect(orch.agents.length).toBe(3)
    })

    it('should update agent status', () => {
      dashboard.createOrchestration('orch-2', ['agent-1', 'agent-2'])
      dashboard.updateAgentStatus('orch-2', 'agent-1', 'running')

      const orch = dashboard.getOrchestration('orch-2')
      const agent = orch?.agents.find((a) => a.id === 'agent-1')

      expect(agent?.status).toBe('running')
    })

    it('should record agent handoff', () => {
      dashboard.createOrchestration('orch-3', ['agent-1', 'agent-2'])
      dashboard.recordAgentHandoff('orch-3', 'agent-1', 'agent-2', 'code-review')

      const orch = dashboard.getOrchestration('orch-3')

      expect(orch?.collaborationGraph.get('agent-1')).toContain('agent-2')
    })

    it('should calculate performance metrics', () => {
      dashboard.startExecutionTrace('session-3', 'agent-1')
      dashboard.completeExecutionTrace('session-3', true)

      const metrics = dashboard.calculateMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.avgExecutionTime).toBeGreaterThanOrEqual(0)
      expect(metrics.toolSuccessRate).toBeGreaterThanOrEqual(0)
    })

    it('should generate dashboard widgets', () => {
      dashboard.startExecutionTrace('session-4', 'agent-1')
      dashboard.calculateMetrics()

      const widgets = dashboard.generateDashboardWidgets()

      expect(widgets.length).toBeGreaterThan(0)
      expect(widgets.some((w) => w.type === 'timeline')).toBe(true)
      expect(widgets.some((w) => w.type === 'metrics')).toBe(true)
    })

    it('should get active traces', () => {
      dashboard.startExecutionTrace('session-5', 'agent-1')
      dashboard.startExecutionTrace('session-6', 'agent-2')
      dashboard.completeExecutionTrace('session-5', true)

      const active = dashboard.getActiveTraces()

      expect(active.length).toBe(1)
      expect(active[0].sessionId).toBe('session-6')
    })
  })

  describe('Phase 11: Advanced Analytics', () => {
    let analytics: AdvancedAnalytics

    beforeEach(() => {
      analytics = new AdvancedAnalytics()
    })

    it('should create advanced analytics', () => {
      expect(analytics).toBeDefined()
    })

    it('should calculate agent performance score', () => {
      const score = analytics.calculateAgentPerformanceScore('agent-1')

      expect(score).toBeDefined()
      expect(score.score).toBeGreaterThanOrEqual(0)
      expect(score.score).toBeLessThanOrEqual(100)
    })

    it('should analyze tool usage patterns', () => {
      const patterns = analytics.analyzeToolUsagePatterns()

      expect(patterns).toBeDefined()
      expect(Array.isArray(patterns)).toBe(true)
    })

    it('should perform error analysis', () => {
      const errors = analytics.performErrorAnalysis()

      expect(errors).toBeDefined()
      expect(Array.isArray(errors)).toBe(true)
    })

    it('should calculate cost breakdown', () => {
      const breakdown = analytics.calculateCostBreakdown('month')

      expect(breakdown).toBeDefined()
      expect(breakdown.totalCost).toBeGreaterThanOrEqual(0)
      expect(breakdown.savings).toBeGreaterThanOrEqual(0)
    })

    it('should get top agents', () => {
      analytics.calculateAgentPerformanceScore('agent-1')
      analytics.calculateAgentPerformanceScore('agent-2')
      analytics.calculateAgentPerformanceScore('agent-3')

      const top = analytics.getTopAgents(2)

      expect(top.length).toBeLessThanOrEqual(2)
    })

    it('should get most used tools', () => {
      const tools = analytics.getMostUsedTools(5)

      expect(tools).toBeDefined()
      expect(Array.isArray(tools)).toBe(true)
    })

    it('should get error insights', () => {
      const errors = analytics.getErrorInsights(5)

      expect(errors).toBeDefined()
      expect(Array.isArray(errors)).toBe(true)
    })

    it('should generate optimization recommendations', () => {
      const recommendations = analytics.generateOptimizationRecommendations()

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
    })

    it('should generate comprehensive report', () => {
      const report = analytics.generateComprehensiveReport()

      expect(report).toBeDefined()
      expect(report.executionMetrics).toBeDefined()
      expect(report.costAnalysis).toBeDefined()
      expect(report.agentPerformance).toBeDefined()
      expect(report.toolPatterns).toBeDefined()
      expect(report.errorAnalysis).toBeDefined()
      expect(report.recommendations).toBeDefined()
    })

    it('should predict cost for next period', () => {
      const predicted = analytics.predictCostForNextPeriod(1000, 0.1)

      expect(predicted).toBe(1100)
    })
  })

  describe('Complete Integration Tests', () => {
    it('should orchestrate sandbox with observability', async () => {
      const agent = new SandboxedAgent('test-agent')
      const capture = new HookEventCapture()

      const task = { id: 'task-1', type: 'generate' as const, description: 'Test' }
      const result = await agent.execute(task)

      await capture.onSessionStart('session-1', 'test-app', 'claude-3.5', {})

      expect(result.success).toBe(true)
      expect(capture.getEventCount()).toBeGreaterThan(0)
    })

    it('should run complete end-to-end pipeline', async () => {
      const agent = new SandboxedAgent('agent-1')
      const capture = new HookEventCapture()
      const dashboard = new RealtimeDashboardService()
      const analytics = new AdvancedAnalytics()

      // Execute
      const task = { id: 'task-1', type: 'generate' as const, description: 'Test' }
      const result = await agent.execute(task)

      // Capture events
      await capture.onSessionStart('session-1', 'app', 'claude-3.5', {})
      await capture.onPreToolUse('session-1', 'app', 'claude-3.5', 'tool-1', {})
      await capture.onPostToolUse('session-1', 'app', 'claude-3.5', 'tool-1', 100, {})
      await capture.onSessionEnd('session-1', 'app', 'claude-3.5', {})

      // Dashboard
      dashboard.startExecutionTrace('session-1', 'agent-1')
      dashboard.completeExecutionTrace('session-1', true)
      const widgets = dashboard.generateDashboardWidgets()

      // Analytics
      const report = analytics.generateComprehensiveReport()

      expect(result.success).toBe(true)
      expect(capture.getEventCount()).toBeGreaterThan(0)
      expect(widgets.length).toBeGreaterThan(0)
      expect(report).toBeDefined()
    })
  })
})
