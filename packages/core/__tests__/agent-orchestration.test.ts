/**
 * Agent Orchestration Tests
 * Tests for agent system, orchestrator, memory, and adaptation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  BaseAgent,
  AgentOrchestrator,
  AgentMemory,
  type Task,
  type TaskResult,
  type IAgent,
  type AgentConfig
} from '../src/agents'

/**
 * Mock Agent for testing
 */
class MockAgent extends BaseAgent {
  private delay: number
  private failureRate: number

  constructor(
    config: AgentConfig,
    delay: number = 10,
    failureRate: number = 0
  ) {
    super(config)
    this.delay = delay
    this.failureRate = failureRate
  }

  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now()

    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, this.delay))

    const success = Math.random() > this.failureRate

    if (success) {
      this.recordExecution(true, this.delay)
      return {
        success: true,
        data: { result: `Task ${task.id} completed`, type: task.type },
        latency: this.delay,
        cost: 0.01,
        metadata: { agentId: this.id }
      }
    } else {
      this.recordExecution(false, this.delay)
      return {
        success: false,
        error: new Error(`Task ${task.id} failed`),
        latency: this.delay,
        metadata: { agentId: this.id }
      }
    }
  }
}

describe('Agent System', () => {
  describe('BaseAgent', () => {
    it('should create agent with valid config', () => {
      const config: AgentConfig = {
        id: 'agent-1',
        type: 'pi',
        name: 'Test Agent',
        version: '1.0.0',
        enabled: true,
        capabilities: ['test']
      }

      const agent = new MockAgent(config)

      expect(agent.id).toBe('agent-1')
      expect(agent.type).toBe('pi')
      expect(agent.name).toBe('Test Agent')
      expect(agent.capabilities).toContain('test')
    })

    it('should throw on invalid config', () => {
      expect(() => {
        const config = { id: '', type: 'pi', name: '' } as AgentConfig
        new MockAgent(config)
      }).toThrow()
    })

    it('should track health metrics', async () => {
      const agent = new MockAgent(
        {
          id: 'health-test',
          type: 'pi',
          name: 'Health Test',
          version: '1.0.0',
          enabled: true,
          capabilities: ['test']
        },
        10,
        0
      )

      const task: Task = {
        id: 'task-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      // Execute multiple times
      for (let i = 0; i < 5; i++) {
        await agent.execute(task)
      }

      const health = await agent.getHealth()

      expect(health.isHealthy).toBe(true)
      expect(health.successCount).toBe(5)
      expect(health.errorCount).toBe(0)
      expect(health.avgLatency).toBeGreaterThan(0)
    })

    it('should check capabilities', () => {
      const agent = new MockAgent({
        id: 'cap-test',
        type: 'pi',
        name: 'Capability Test',
        version: '1.0.0',
        enabled: true,
        capabilities: ['text-generation', 'analysis']
      })

      expect(agent.hasCapability('text-generation')).toBe(true)
      expect(agent.hasCapability('analysis')).toBe(true)
      expect(agent.hasCapability('code-generation')).toBe(false)
    })
  })

  describe('Agent Orchestrator', () => {
    let orchestrator: AgentOrchestrator
    let agent1: IAgent
    let agent2: IAgent
    let agent3: IAgent

    beforeEach(() => {
      orchestrator = new AgentOrchestrator(
        {
          name: 'Test Orchestrator',
          strategy: 'capability',
          enableMetrics: true,
          enableLogging: false
        }
      )

      agent1 = new MockAgent(
        {
          id: 'agent-1',
          type: 'pi',
          name: 'Agent 1',
          version: '1.0.0',
          enabled: true,
          capabilities: ['text-generation', 'analysis']
        },
        10,
        0
      )

      agent2 = new MockAgent(
        {
          id: 'agent-2',
          type: 'claude',
          name: 'Agent 2',
          version: '1.0.0',
          enabled: true,
          capabilities: ['reasoning', 'analysis']
        },
        5,
        0
      )

      agent3 = new MockAgent(
        {
          id: 'agent-3',
          type: 'code',
          name: 'Agent 3',
          version: '1.0.0',
          enabled: true,
          capabilities: ['code-generation']
        },
        15,
        0
      )

      orchestrator.registerAgent(agent1)
      orchestrator.registerAgent(agent2)
      orchestrator.registerAgent(agent3)
    })

    it('should register and retrieve agents', () => {
      expect(orchestrator.getAgents().length).toBe(3)
      expect(orchestrator.getAgent('agent-1')).toBe(agent1)
    })

    it('should find agents by capability', () => {
      const analysisAgents = orchestrator.findCapableAgents('analysis')
      expect(analysisAgents.length).toBe(2)
      expect(analysisAgents).toContain(agent1)
      expect(analysisAgents).toContain(agent2)
    })

    it('should route by capability', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'analysis',
        priority: 'high',
        input: 'analyze this',
        createdAt: new Date()
      }

      const routing = await orchestrator.routeTask(task)
      expect(routing.selectedAgent).toBeDefined()
      expect([agent1, agent2]).toContain(routing.selectedAgent)
    })

    it('should execute task with routing', async () => {
      const task: Task = {
        id: 'exec-1',
        type: 'text-generation',
        priority: 'high',
        input: 'generate text',
        createdAt: new Date()
      }

      const result = await orchestrator.execute(task)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.latency).toBeGreaterThan(0)
    })

    it('should collaborate with multiple agents', async () => {
      const task: Task = {
        id: 'collab-1',
        type: 'analysis',
        priority: 'high',
        input: 'analyze',
        createdAt: new Date()
      }

      const result = await orchestrator.collaborate(task, ['agent-1', 'agent-2'])

      expect(result.results.size).toBe(2)
      expect(result.bestResult).toBeDefined()
      expect(result.bestResult!.success).toBe(true)
    })

    it('should handle failover routing', async () => {
      const failoverOrchestrator = new AgentOrchestrator(
        {
          name: 'Failover Test',
          strategy: 'failover',
          enableMetrics: true,
          enableLogging: false
        }
      )

      failoverOrchestrator.registerAgent(agent1)
      failoverOrchestrator.registerAgent(agent2)

      const task: Task = {
        id: 'failover-1',
        type: 'analysis',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const routing = await failoverOrchestrator.routeTask(task)

      expect(routing.selectedAgent).toBeDefined()
      expect(routing.alternatives.length).toBeGreaterThan(0)
    })

    it('should track metrics', async () => {
      const task: Task = {
        id: 'metrics-1',
        type: 'text-generation',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      await orchestrator.execute(task)

      const metrics = orchestrator.getMetrics()

      expect(metrics.totalTasks).toBe(1)
      expect(metrics.successfulTasks).toBe(1)
      expect(Object.keys(metrics.agentMetrics).length).toBeGreaterThan(0)
    })

    it('should deregister agents', () => {
      expect(orchestrator.getAgents().length).toBe(3)

      orchestrator.deregisterAgent('agent-1')

      expect(orchestrator.getAgents().length).toBe(2)
      expect(orchestrator.getAgent('agent-1')).toBeUndefined()
    })
  })

  describe('Agent Memory', () => {
    let memory: AgentMemory

    beforeEach(() => {
      memory = new AgentMemory(1000)
    })

    it('should record decisions', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100,
        cost: 0.01
      }

      const entry = await memory.recordDecision('agent-1', task, {}, result)

      expect(entry.id).toBeDefined()
      expect(entry.agentId).toBe('agent-1')
      expect(entry.result.success).toBe(true)
    })

    it('should query memories', async () => {
      const task1: Task = {
        id: 'task-1',
        type: 'analysis',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const task2: Task = {
        id: 'task-2',
        type: 'generation',
        priority: 'low',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100
      }

      await memory.recordDecision('agent-1', task1, {}, result)
      await memory.recordDecision('agent-1', task2, {}, result)

      const byAgent = memory.getByAgent('agent-1')
      expect(byAgent.length).toBe(2)

      const byTask = memory.getByTask('task-1')
      expect(byTask.length).toBe(1)
    })

    it('should get successful decisions', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const successResult: TaskResult = {
        success: true,
        data: 'result',
        latency: 100
      }

      const failResult: TaskResult = {
        success: false,
        error: new Error('failed'),
        latency: 100
      }

      await memory.recordDecision('agent-1', task, {}, successResult)
      await memory.recordDecision('agent-1', task, {}, failResult)

      const successful = memory.getSuccessful()
      const failed = memory.getFailed()

      expect(successful.length).toBe(1)
      expect(failed.length).toBe(1)
    })

    it('should analyze patterns', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'analysis',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100,
        cost: 0.01
      }

      // Record multiple decisions to build pattern
      for (let i = 0; i < 10; i++) {
        await memory.recordDecision('agent-1', task, {}, result)
      }

      const patterns = await memory.analyzePatterns()

      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].frequency).toBeGreaterThan(0)
    })

    it('should suggest optimizations', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'analysis',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100,
        cost: 0.01
      }

      for (let i = 0; i < 10; i++) {
        await memory.recordDecision('agent-1', task, {}, result)
      }

      await memory.analyzePatterns()
      const optimizations = memory.suggestOptimizations()

      expect(optimizations).toBeDefined()
    })

    it('should export and import data', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100
      }

      await memory.recordDecision('agent-1', task, {}, result)

      const exported = memory.export()

      expect(exported.entries.length).toBe(1)
      expect(exported.analytics).toBeDefined()
    })

    it('should get analytics', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result: TaskResult = {
        success: true,
        data: 'result',
        latency: 100,
        cost: 0.01
      }

      await memory.recordDecision('agent-1', task, {}, result)
      await memory.recordDecision('agent-1', task, {}, result)

      const analytics = memory.getAnalytics()

      expect(analytics.totalEntries).toBe(2)
      expect(analytics.successRate).toBe(100)
      expect(analytics.averageLatency).toBe(100)
    })
  })

  describe('Integration Tests', () => {
    it('should orchestrate and learn', async () => {
      // Create orchestrator
      const orchestrator = new AgentOrchestrator(
        {
          name: 'Integration Test',
          strategy: 'capability',
          enableMetrics: true,
          enableLogging: false
        }
      )

      // Create memory
      const memory = new AgentMemory()

      // Create and register agents
      const agent1 = new MockAgent(
        {
          id: 'int-agent-1',
          type: 'pi',
          name: 'Integration Agent 1',
          version: '1.0.0',
          enabled: true,
          capabilities: ['analysis']
        },
        5,
        0
      )

      orchestrator.registerAgent(agent1)

      // Create and execute task
      const task: Task = {
        id: 'int-task-1',
        type: 'analysis',
        priority: 'high',
        input: 'analyze',
        createdAt: new Date()
      }

      const result = await orchestrator.execute(task)

      expect(result.success).toBe(true)

      // Record in memory
      await memory.recordDecision(agent1.id, task, {}, result)

      // Verify memory
      const entries = memory.getByAgent(agent1.id)
      expect(entries.length).toBe(1)
    })
  })
})
