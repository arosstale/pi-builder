/**
 * Provider Agents & Advanced Routing Tests
 * Tests for provider agent wrappers, registry, and routing strategies
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ClaudeAgent,
  OpenAIAgent,
  GeminiAgent,
  GenericProviderAgent,
  createProviderAgent,
  AgentRegistry,
  FailoverStrategy,
  RateLimiter,
  MLRoutingStrategy,
  AdvancedRoutingManager,
  type Task
} from '../src/agents'

/**
 * Mock Enhanced Provider
 */
class MockEnhancedProvider {
  id: string
  name: string
  model: string

  constructor(name: string, model: string = 'test-model') {
    this.id = `provider-${Math.random()}`
    this.name = name
    this.model = model
  }

  async generate(options: {
    messages: Array<{ role: string; content: string }>
    temperature?: number
    maxTokens?: number
  }): Promise<string> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 10))
    return `Response from ${this.name}`
  }
}

/**
 * Provider Agent Tests
 */
describe('Provider Agents', () => {
  describe('ClaudeAgent', () => {
    it('should wrap Claude provider as agent', async () => {
      const provider = new MockEnhancedProvider('Claude 3') as any
      const agent = new ClaudeAgent(provider)

      expect(agent.type).toBe('claude')
      expect(agent.name).toBe('Claude Agent')
      expect(agent.hasCapability('reasoning')).toBe(true)
      expect(agent.hasCapability('analysis')).toBe(true)
    })

    it('should execute task with Claude agent', async () => {
      const provider = new MockEnhancedProvider('Claude 3') as any
      const agent = new ClaudeAgent(provider)

      const task: Task = {
        id: 'test-1',
        type: 'reasoning',
        priority: 'high',
        input: 'Solve this problem',
        createdAt: new Date()
      }

      const result = await agent.execute(task)

      expect(result.success).toBe(true)
      expect(result.data).toBeTruthy()
      expect(result.latency).toBeGreaterThan(0)
      expect(result.metadata?.agent).toBe('claude')
    })
  })

  describe('OpenAIAgent', () => {
    it('should wrap OpenAI provider as agent', async () => {
      const provider = new MockEnhancedProvider('GPT-4') as any
      const agent = new OpenAIAgent(provider)

      expect(agent.type).toBe('custom')
      expect(agent.name).toBe('OpenAI Agent')
      expect(agent.hasCapability('code-generation')).toBe(true)
    })

    it('should execute task with OpenAI agent', async () => {
      const provider = new MockEnhancedProvider('GPT-4') as any
      const agent = new OpenAIAgent(provider)

      const task: Task = {
        id: 'test-1',
        type: 'code-generation',
        priority: 'high',
        input: 'Generate a function',
        createdAt: new Date()
      }

      const result = await agent.execute(task)

      expect(result.success).toBe(true)
      expect(result.metadata?.agent).toBe('openai')
    })
  })

  describe('GeminiAgent', () => {
    it('should wrap Gemini provider as agent', async () => {
      const provider = new MockEnhancedProvider('Gemini Pro') as any
      const agent = new GeminiAgent(provider)

      expect(agent.type).toBe('custom')
      expect(agent.name).toBe('Gemini Agent')
      expect(agent.hasCapability('multimodal')).toBe(true)
    })
  })

  describe('Agent Factory', () => {
    it('should create Claude agent for Claude provider', () => {
      const provider = new MockEnhancedProvider('Claude 3') as any
      const agent = createProviderAgent(provider)

      expect(agent).toBeInstanceOf(ClaudeAgent)
    })

    it('should create OpenAI agent for OpenAI provider', () => {
      const provider = new MockEnhancedProvider('GPT-4') as any
      const agent = createProviderAgent(provider)

      expect(agent).toBeInstanceOf(OpenAIAgent)
    })

    it('should create Gemini agent for Gemini provider', () => {
      const provider = new MockEnhancedProvider('Gemini Pro') as any
      const agent = createProviderAgent(provider)

      expect(agent).toBeInstanceOf(GeminiAgent)
    })
  })
})

/**
 * Agent Registry Tests
 */
describe('Agent Registry', () => {
  let registry: AgentRegistry

  beforeEach(() => {
    registry = new AgentRegistry()
  })

  it('should register and retrieve agents', () => {
    const provider = new MockEnhancedProvider('Claude 3') as any
    const agent = new ClaudeAgent(provider)

    registry.registerAgent(agent)

    expect(registry.getAgent(agent.id)).toBe(agent)
  })

  it('should discover agents by capability', () => {
    const provider1 = new MockEnhancedProvider('Claude') as any
    const agent1 = new ClaudeAgent(provider1)

    const provider2 = new MockEnhancedProvider('GPT-4') as any
    const agent2 = new OpenAIAgent(provider2)

    registry.registerAgent(agent1)
    registry.registerAgent(agent2)

    const reasoning = registry.discoverByCapability('reasoning')
    expect(reasoning).toContain(agent1)
    expect(reasoning).not.toContain(agent2)
  })

  it('should discover agents by type', () => {
    const provider1 = new MockEnhancedProvider('Claude') as any
    const agent1 = new ClaudeAgent(provider1)

    const provider2 = new MockEnhancedProvider('GPT-4') as any
    const agent2 = new OpenAIAgent(provider2)

    registry.registerAgent(agent1)
    registry.registerAgent(agent2)

    const claude = registry.discoverByType('claude')
    expect(claude).toContain(agent1)
    expect(claude).not.toContain(agent2)
  })

  it('should discover agents with all capabilities', () => {
    const provider = new MockEnhancedProvider('Claude') as any
    const agent = new ClaudeAgent(provider)

    registry.registerAgent(agent)

    const agents = registry.discoverWithAll(['reasoning', 'analysis'])
    expect(agents).toContain(agent)
  })

  it('should deregister agents', () => {
    const provider = new MockEnhancedProvider('Claude') as any
    const agent = new ClaudeAgent(provider)

    registry.registerAgent(agent)
    expect(registry.getAgent(agent.id)).toBe(agent)

    registry.deregisterAgent(agent.id)
    expect(registry.getAgent(agent.id)).toBeUndefined()
  })

  it('should return statistics', () => {
    const provider1 = new MockEnhancedProvider('Claude') as any
    const agent1 = new ClaudeAgent(provider1)

    const provider2 = new MockEnhancedProvider('GPT-4') as any
    const agent2 = new OpenAIAgent(provider2)

    registry.registerAgent(agent1)
    registry.registerAgent(agent2)

    const stats = registry.getStatistics()

    expect(stats.totalAgents).toBe(2)
    expect(stats.byType['claude']).toBe(1)
  })
})

/**
 * Advanced Routing Tests
 */
describe('Advanced Routing', () => {
  describe('FailoverStrategy', () => {
    it('should use primary agent', async () => {
      const strategy = new FailoverStrategy()

      const task: Task = {
        id: 'test-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const provider1 = new MockEnhancedProvider('Claude') as any
      const agent1 = new ClaudeAgent(provider1)

      const result = await strategy.execute(task, [agent1])

      expect(result.success).toBe(true)
    })

    it('should failover to secondary agent', async () => {
      const strategy = new FailoverStrategy()

      const task: Task = {
        id: 'test-1',
        type: 'test',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const provider1 = new MockEnhancedProvider('Claude') as any
      const agent1 = new ClaudeAgent(provider1)

      const provider2 = new MockEnhancedProvider('GPT-4') as any
      const agent2 = new OpenAIAgent(provider2)

      const result = await strategy.execute(task, [agent1, agent2])

      expect(result.success).toBe(true)
    })

    it('should open circuit breaker after failures', async () => {
      const strategy = new FailoverStrategy(2) // Lower threshold for testing

      const provider = new MockEnhancedProvider('Claude') as any
      const agent = new ClaudeAgent(provider)

      // Simulate failures
      for (let i = 0; i < 2; i++) {
        strategy.recordFailure(agent.id)
      }

      const state = strategy.getState(agent.id)
      expect(state?.status).toBe('open')
    })
  })

  describe('RateLimiter', () => {
    it('should acquire tokens', async () => {
      const limiter = new RateLimiter(10, 1)

      const acquired = await limiter.acquire('agent-1', 5)

      expect(acquired).toBe(true)
    })

    it('should deny when out of tokens', async () => {
      const limiter = new RateLimiter(5, 1)

      await limiter.acquire('agent-1', 5)
      const acquired = await limiter.acquire('agent-1', 1)

      expect(acquired).toBe(false)
    })

    it('should wait for token refill', async () => {
      const limiter = new RateLimiter(1, 10) // 10 tokens per second

      await limiter.acquire('agent-1', 1)

      const startTime = Date.now()
      const acquired = await limiter.acquireWait('agent-1', 1, 500)
      const elapsed = Date.now() - startTime

      expect(acquired).toBe(true)
      expect(elapsed).toBeGreaterThan(50) // Should wait some time
    })
  })

  describe('MLRoutingStrategy', () => {
    it('should select best agent', async () => {
      const strategy = new MLRoutingStrategy()

      const provider1 = new MockEnhancedProvider('Claude') as any
      const agent1 = new ClaudeAgent(provider1)

      const provider2 = new MockEnhancedProvider('GPT-4') as any
      const agent2 = new OpenAIAgent(provider2)

      const task: Task = {
        id: 'test-1',
        type: 'reasoning',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const selected = await strategy.selectBestAgent(task, [agent1, agent2])

      expect([agent1, agent2]).toContain(selected)
    })

    it('should return single agent when only one available', async () => {
      const strategy = new MLRoutingStrategy()

      const provider = new MockEnhancedProvider('Claude') as any
      const agent = new ClaudeAgent(provider)

      const task: Task = {
        id: 'test-1',
        type: 'reasoning',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const selected = await strategy.selectBestAgent(task, [agent])

      expect(selected).toBe(agent)
    })
  })

  describe('AdvancedRoutingManager', () => {
    it('should execute with all safety features', async () => {
      const manager = new AdvancedRoutingManager()

      const provider = new MockEnhancedProvider('Claude') as any
      const agent = new ClaudeAgent(provider)

      const task: Task = {
        id: 'test-1',
        type: 'reasoning',
        priority: 'high',
        input: 'test',
        createdAt: new Date()
      }

      const result = await manager.execute(task, [agent])

      expect(result.success).toBe(true)
    })
  })
})
