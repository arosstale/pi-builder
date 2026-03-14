import { describe, it, expect, beforeEach } from 'vitest'
import { PiAgentSDKIntegration } from '../src/integrations'
import type { CodeGenerationRequest } from '../src/types'

describe('PiAgentSDKIntegration (PRIMARY)', () => {
  let agent: PiAgentSDKIntegration
  let request: CodeGenerationRequest

  beforeEach(() => {
    agent = new PiAgentSDKIntegration({
      sessionId: 'test-session-123',
      steeringMode: 'one-at-a-time',
      followUpMode: 'one-at-a-time',
    })

    request = {
      prompt: 'Create a function that adds two numbers',
      language: 'typescript',
      framework: 'vanilla',
    }
  })

  describe('Initialization', () => {
    it('should create agent instance', () => {
      expect(agent).toBeDefined()
    })

    it('should set session ID', () => {
      expect(agent.getSessionId()).toBe('test-session-123')
    })

    it('should initialize empty task history', () => {
      expect(agent.listTasks()).toHaveLength(0)
    })

    it('should initialize with empty agent state', () => {
      expect(agent.getAgentState()).toEqual({})
    })
  })

  describe('Task Execution', () => {
    it('should execute task and return result', async () => {
      const result = await agent.executeTask(request)

      expect(result).toBeDefined()
      expect(result.taskId).toBeDefined()
      expect(result.code).toBeDefined()
      expect(result.language).toBe('typescript')
      expect(result.metadata.model).toBe('pi-agent-core')
      expect(result.metadata.sessionId).toBe('test-session-123')
    })

    it('should generate TypeScript code', async () => {
      const result = await agent.executeTask(request)
      expect(result.code).toContain('async function')
      expect(result.code).toContain('typescript')
    })

    it('should generate React code', async () => {
      const reactRequest: CodeGenerationRequest = {
        ...request,
        framework: 'react',
      }
      const result = await agent.executeTask(reactRequest)
      expect(result.code).toContain('React')
      expect(result.code).toContain('Component')
    })

    it('should generate Python code', async () => {
      const pythonRequest: CodeGenerationRequest = {
        ...request,
        language: 'python',
      }
      const result = await agent.executeTask(pythonRequest)
      expect(result.code).toContain('def')
      expect(result.code).toContain('async')
    })

    it('should generate JavaScript code', async () => {
      const jsRequest: CodeGenerationRequest = {
        ...request,
        language: 'javascript',
      }
      const result = await agent.executeTask(jsRequest)
      expect(result.code).toContain('async function')
      expect(result.code).toContain('export')
    })

    it('should track task in history', async () => {
      await agent.executeTask(request)
      const tasks = agent.listTasks()
      expect(tasks.length).toBeGreaterThan(0)
    })

    it('should get task status', async () => {
      const result = await agent.executeTask(request)
      const taskStatus = agent.getTaskStatus(result.taskId)
      expect(taskStatus).toBeDefined()
      expect(taskStatus?.prompt).toBe(request.prompt)
    })

    it('should estimate tokens correctly', async () => {
      const result = await agent.executeTask(request)
      expect(result.metadata.tokensUsed).toBeGreaterThan(0)
    })

    it('should handle context in requests', async () => {
      const contextRequest: CodeGenerationRequest = {
        ...request,
        context: {
          projectName: 'test-app',
          apiUrl: 'http://localhost:3000',
        },
      }
      const result = await agent.executeTask(contextRequest)
      expect(result).toBeDefined()
      expect(result.state).toBeDefined()
    })
  })

  describe('Streaming', () => {
    it('should stream task execution', async () => {
      const chunks: string[] = []

      for await (const chunk of agent.streamTask(request)) {
        if (typeof chunk === 'string') {
          chunks.push(chunk)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.some(c => c.includes('Starting'))).toBe(true)
    })

    it('should handle streaming completion', async () => {
      let chunkCount = 0

      for await (const chunk of agent.streamTask(request)) {
        chunkCount++
        expect(chunk).toBeDefined()
      }

      expect(chunkCount).toBeGreaterThan(0)
    })
  })

  describe('Session Management', () => {
    it('should update session ID', () => {
      agent.setSessionId('new-session-456')
      expect(agent.getSessionId()).toBe('new-session-456')
    })

    it('should maintain session across tasks', async () => {
      agent.setSessionId('persistent-session')
      await agent.executeTask(request)
      expect(agent.getSessionId()).toBe('persistent-session')
    })
  })

  describe('State Management', () => {
    it('should get agent state', () => {
      const state = agent.getAgentState()
      expect(state).toBeDefined()
      expect(typeof state).toBe('object')
    })

    it('should update agent state', () => {
      agent.setAgentState({ customKey: 'customValue' })
      const state = agent.getAgentState()
      expect(state.customKey).toBe('customValue')
    })

    it('should preserve state across tasks', async () => {
      agent.setAgentState({ counter: 0 })
      await agent.executeTask(request)

      const state = agent.getAgentState()
      expect(state.counter).toBe(0)
      expect(state.lastTaskId).toBeDefined()
    })

    it('should merge state updates', () => {
      agent.setAgentState({ a: 1 })
      agent.setAgentState({ b: 2 })

      const state = agent.getAgentState()
      expect(state.a).toBe(1)
      expect(state.b).toBe(2)
    })
  })

  describe('Task Management', () => {
    it('should clear task history', async () => {
      await agent.executeTask(request)
      expect(agent.listTasks().length).toBeGreaterThan(0)

      agent.clearTasks()
      expect(agent.listTasks()).toHaveLength(0)
    })

    it('should list all tasks', async () => {
      await agent.executeTask(request)
      await agent.executeTask({ ...request, language: 'python' })

      const tasks = agent.listTasks()
      expect(tasks.length).toBe(2)
    })
  })

  describe('Configuration', () => {
    it('should accept steering mode config', () => {
      const configuredAgent = new PiAgentSDKIntegration({
        steeringMode: 'all',
      })
      expect(configuredAgent).toBeDefined()
    })

    it('should accept follow-up mode config', () => {
      const configuredAgent = new PiAgentSDKIntegration({
        followUpMode: 'all',
      })
      expect(configuredAgent).toBeDefined()
    })

    it('should accept max retry delay config', () => {
      const configuredAgent = new PiAgentSDKIntegration({
        maxRetryDelayMs: 30000,
      })
      expect(configuredAgent).toBeDefined()
    })

    it('should accept API key function', () => {
      const getApiKey = async (provider: string) => `key-for-${provider}`
      const configuredAgent = new PiAgentSDKIntegration({ getApiKey })
      expect(configuredAgent).toBeDefined()
    })
  })

  describe('Integration', () => {
    it('should work with multiple concurrent tasks', async () => {
      const task1 = agent.executeTask(request)
      const task2 = agent.executeTask({ ...request, language: 'python' })
      const task3 = agent.executeTask({ ...request, language: 'javascript' })

      const [result1, result2, result3] = await Promise.all([task1, task2, task3])

      expect(result1.language).toBe('typescript')
      expect(result2.language).toBe('python')
      expect(result3.language).toBe('javascript')
    })

    it('should handle complex context scenarios', async () => {
      const complexRequest: CodeGenerationRequest = {
        prompt: 'Create API client',
        language: 'typescript',
        framework: 'express',
        context: {
          apiVersion: '2.0',
          authentication: 'jwt',
          endpoints: ['users', 'products', 'orders'],
          database: 'postgresql',
        },
      }

      const result = await agent.executeTask(complexRequest)
      expect(result.code).toBeDefined()
      expect(result.state).toBeDefined()
    })
  })
})
