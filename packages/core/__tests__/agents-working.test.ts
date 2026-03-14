import { describe, it, expect, beforeEach } from 'vitest'
import { BaseAgent, Task, TaskResult } from '../src/agents/base-agent'
import { ClaudeAgent } from '../src/agents/claude-agent'
import { agentRegistry } from '../src/agents/agent-registry'

// Mock agent for testing
class MockAgent extends BaseAgent {
  async execute(task: Task): Promise<TaskResult> {
    return {
      taskId: task.id,
      success: true,
      output: `Mock result for: ${task.description}`
    }
  }
}

describe('Agent System', () => {
  let mockAgent: MockAgent

  beforeEach(() => {
    mockAgent = new MockAgent('Mock')
  })

  describe('BaseAgent', () => {
    it('should create an agent', () => {
      expect(mockAgent).toBeDefined()
    })

    it('should execute a task', async () => {
      const task: Task = {
        id: 'test-1',
        type: 'generate',
        description: 'Generate a simple function'
      }

      const result = await mockAgent.execute(task)

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.taskId).toBe('test-1')
    })

    it('should plan execution', async () => {
      const plan = await mockAgent.plan('Create a REST API')

      expect(plan.steps).toBeDefined()
      expect(plan.steps.length).toBeGreaterThan(0)
      expect(plan.priority).toBeDefined()
    })

    it('should verify output', async () => {
      const isValid = await mockAgent.verify('Some output')
      expect(isValid).toBe(true)
    })

    it('should reject empty output', async () => {
      const isValid = await mockAgent.verify('')
      expect(isValid).toBe(false)
    })

    it('should handle task errors', async () => {
      const task: Task = {
        id: 'error-1',
        type: 'generate',
        description: 'Failing task'
      }

      const error = new Error('Test error')
      const result = await mockAgent.handleError(error, task)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Test error')
      expect(result.taskId).toBe('error-1')
    })

    it('should generate unique IDs', () => {
      const id1 = mockAgent['generateId']()
      const id2 = mockAgent['generateId']()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('should execute multiple tasks', async () => {
      const tasks: Task[] = [
        { id: '1', type: 'generate', description: 'Task 1' },
        { id: '2', type: 'test', description: 'Task 2' },
        { id: '3', type: 'review', description: 'Task 3' }
      ]

      const results = await Promise.all(
        tasks.map(task => mockAgent.execute(task))
      )

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })
  })

  describe('AgentRegistry', () => {
    beforeEach(() => {
      // Clear registry
      const agents = agentRegistry.listAgents()
      agents.forEach(name => agentRegistry.removeAgent(name))
    })

    it('should register an agent', () => {
      agentRegistry.register('test-agent', mockAgent)
      expect(agentRegistry.hasAgent('test-agent')).toBe(true)
    })

    it('should retrieve a registered agent', () => {
      agentRegistry.register('test-agent', mockAgent)
      const agent = agentRegistry.getAgent('test-agent')
      expect(agent).toBe(mockAgent)
    })

    it('should list all agents', () => {
      agentRegistry.register('agent-1', mockAgent)
      agentRegistry.register('agent-2', mockAgent)

      const list = agentRegistry.listAgents()
      expect(list).toContain('agent-1')
      expect(list).toContain('agent-2')
    })

    it('should throw on missing agent', () => {
      expect(() => agentRegistry.getAgent('missing')).toThrow()
    })

    it('should remove an agent', () => {
      agentRegistry.register('test-agent', mockAgent)
      agentRegistry.removeAgent('test-agent')
      expect(agentRegistry.hasAgent('test-agent')).toBe(false)
    })

    it('should get default Claude agent', () => {
      const claude = agentRegistry.getClaudeAgent()
      expect(claude).toBeDefined()
      expect(agentRegistry.hasAgent('claude')).toBe(true)
    })

    it('should return same Claude agent on multiple calls', () => {
      const claude1 = agentRegistry.getClaudeAgent()
      const claude2 = agentRegistry.getClaudeAgent()
      expect(claude1).toBe(claude2)
    })
  })

  describe('ClaudeAgent', () => {
    it('should create Claude agent', () => {
      // Skip if no API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.log('Skipping Claude API tests - no API key')
        return
      }

      const claude = new ClaudeAgent()
      expect(claude).toBeDefined()
    })

    it.skip('should generate code via Claude API', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const claude = new ClaudeAgent()
      const code = await claude.generate('Write a hello world function')

      expect(code).toBeDefined()
      expect(code.length).toBeGreaterThan(0)
    })

    it.skip('should test code', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const claude = new ClaudeAgent()
      const code = 'function add(a, b) { return a + b }'
      const result = await claude.test(code, 'Test if it works correctly')

      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })

    it.skip('should review code', async () => {
      if (!process.env.ANTHROPIC_API_KEY) return

      const claude = new ClaudeAgent()
      const code = 'function add(a, b) { return a + b }'
      const review = await claude.review(code)

      expect(review).toBeDefined()
      expect(review.length).toBeGreaterThan(0)
    })
  })

  describe('Integration Tests', () => {
    it('should execute task through registry', async () => {
      agentRegistry.register('test', mockAgent)
      const agent = agentRegistry.getAgent('test')

      const task: Task = {
        id: 'integration-1',
        type: 'generate',
        description: 'Integration test'
      }

      const result = await agent.execute(task)

      expect(result.success).toBe(true)
      expect(result.output).toContain('Integration test')
    })

    it('should handle agent errors gracefully', async () => {
      const task: Task = {
        id: 'error-test',
        type: 'generate',
        description: 'Test error handling'
      }

      const error = new Error('Intentional test error')
      const result = await mockAgent.handleError(error, task)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Intentional test error')
    })

    it('should manage multiple agents', () => {
      // Clear registry first
      agentRegistry.listAgents().forEach(name => agentRegistry.removeAgent(name))
      
      const agent1 = new MockAgent('Agent1')
      const agent2 = new MockAgent('Agent2')

      agentRegistry.register('agent1', agent1)
      agentRegistry.register('agent2', agent2)

      expect(agentRegistry.listAgents()).toHaveLength(2)
      expect(agentRegistry.getAgent('agent1')).toBe(agent1)
      expect(agentRegistry.getAgent('agent2')).toBe(agent2)
      
      // Clean up
      agentRegistry.removeAgent('agent1')
      agentRegistry.removeAgent('agent2')
    })
  })
})
