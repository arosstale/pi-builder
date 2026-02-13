import { describe, it, expect, beforeEach } from 'vitest'
import { OpenClawProvider } from '../src/integrations/openclaw-provider'
import { PiMonoProvider } from '../src/integrations/pi-mono-provider'
import { OpenHandsProvider } from '../src/integrations/openhands-provider'
import { OpenCodeSDK } from '../src/integrations/opencode-sdk'

describe('New Providers: OpenClaw, Pi-Mono, OpenHands, OpenCode', () => {
  // OPENCLAW PROVIDER TESTS
  describe('OpenClaw Provider', () => {
    let provider: OpenClawProvider

    beforeEach(() => {
      provider = new OpenClawProvider('test-api-key')
    })

    it('should initialize OpenClaw provider', () => {
      expect(provider).toBeDefined()
      expect(provider).toBeInstanceOf(OpenClawProvider)
    })

    it('should execute requests', async () => {
      const result = await provider.execute({
        prompt: 'Write hello world in Python',
        model: 'openclaw-1',
      })

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.text).toBeDefined()
    })

    it('should track tokens', async () => {
      const result = await provider.execute({
        prompt: 'Test prompt',
        maxTokens: 100,
      })

      expect(result.tokens).toBeDefined()
      expect(result.tokens.input).toBeGreaterThanOrEqual(0)
      expect(result.tokens.output).toBeGreaterThanOrEqual(0)
    })

    it('should support tools', async () => {
      const result = await provider.execute({
        prompt: 'Use tools to solve this',
        tools: [
          {
            name: 'calculator',
            description: 'Calculate math',
            parameters: { operation: 'add' },
          },
        ],
      })

      expect(result).toBeDefined()
    })

    it('should change model', () => {
      provider.setModel('openclaw-2')
      expect(provider.getModel()).toBe('openclaw-2')
    })

    it('should check health', async () => {
      const healthy = await provider.health()
      expect(typeof healthy).toBe('boolean')
    })

    it('should emit events', (done) => {
      provider.on('request:start', () => {
        done()
      })

      provider.execute({ prompt: 'Test' }).catch(() => {
        // Ignore error, we're just testing events
      })
    })
  })

  // PI-MONO PROVIDER TESTS
  describe('Pi-Mono Provider', () => {
    let provider: PiMonoProvider

    beforeEach(() => {
      provider = new PiMonoProvider()
    })

    it('should initialize Pi-Mono provider', () => {
      expect(provider).toBeDefined()
      expect(provider).toBeInstanceOf(PiMonoProvider)
    })

    it('should execute tasks', async () => {
      const result = await provider.execute({
        id: 'task-1',
        name: 'test-task',
        description: 'Test task',
        inputs: { param: 'value' },
      })

      expect(result).toBeDefined()
      expect(result.taskId).toBe('task-1')
      expect(result.status).toBe('success')
    })

    it('should track execution time', async () => {
      const result = await provider.execute({
        id: 'task-2',
        name: 'timed-task',
        description: 'Timed task',
        inputs: {},
      })

      expect(result.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('should retrieve task results', async () => {
      await provider.execute({
        id: 'task-3',
        name: 'retrieve-task',
        description: 'Test retrieval',
        inputs: {},
      })

      const result = await provider.getTaskResult('task-3')
      expect(result).toBeDefined()
      expect(result?.status).toBe('success')
    })

    it('should list all tasks', async () => {
      await provider.execute({
        id: 'task-4',
        name: 'list-task-1',
        description: 'Task 1',
        inputs: {},
      })

      await provider.execute({
        id: 'task-5',
        name: 'list-task-2',
        description: 'Task 2',
        inputs: {},
      })

      const tasks = await provider.listTasks()
      expect(tasks.length).toBeGreaterThanOrEqual(2)
    })

    it('should clear tasks', async () => {
      await provider.execute({
        id: 'task-6',
        name: 'clear-task',
        description: 'Task to clear',
        inputs: {},
      })

      expect(provider.getTaskCount()).toBeGreaterThan(0)
      provider.clearTasks()
      expect(provider.getTaskCount()).toBe(0)
    })

    it('should check health', async () => {
      const healthy = await provider.health()
      expect(healthy).toBe(true)
    })
  })

  // OPENHANDS PROVIDER TESTS
  describe('OpenHands Provider', () => {
    let provider: OpenHandsProvider

    beforeEach(() => {
      provider = new OpenHandsProvider(20)
    })

    it('should initialize OpenHands provider', () => {
      expect(provider).toBeDefined()
      expect(provider).toBeInstanceOf(OpenHandsProvider)
    })

    it('should execute tasks with actions', async () => {
      const result = await provider.execute({
        id: 'hands-task-1',
        objective: 'Complete this task',
        context: 'Some context',
      })

      expect(result).toBeDefined()
      expect(result.status).toBe('complete')
      expect(result.actions.length).toBeGreaterThan(0)
    })

    it('should track thinking steps', async () => {
      const result = await provider.execute({
        id: 'hands-task-2',
        objective: 'Think about this',
      })

      const thinkingActions = result.actions.filter((a) => a.type === 'think')
      expect(thinkingActions.length).toBeGreaterThan(0)
    })

    it('should track execution steps', async () => {
      const result = await provider.execute({
        id: 'hands-task-3',
        objective: 'Execute this',
      })

      const executionActions = result.actions.filter((a) => a.type === 'execute')
      expect(executionActions.length).toBeGreaterThan(0)
    })

    it('should retrieve state', async () => {
      await provider.execute({
        id: 'hands-task-4',
        objective: 'Get state',
      })

      const state = await provider.getState('hands-task-4')
      expect(state).toBeDefined()
      expect(state?.status).toBe('complete')
    })

    it('should continue tasks', async () => {
      const initialState = await provider.execute({
        id: 'hands-task-5',
        objective: 'Continue this',
      })

      const continuedState = await provider.continueTask('hands-task-5', {
        type: 'execute',
        content: 'Additional action',
      })

      expect(continuedState.actions.length).toBeGreaterThan(initialState.actions.length)
    })

    it('should list all states', async () => {
      await provider.execute({
        id: 'hands-task-6',
        objective: 'List state 1',
      })

      await provider.execute({
        id: 'hands-task-7',
        objective: 'List state 2',
      })

      const states = await provider.listStates()
      expect(states.length).toBeGreaterThanOrEqual(2)
    })

    it('should check health', async () => {
      const healthy = await provider.health()
      expect(healthy).toBe(true)
    })
  })

  // OPENCODE SDK TESTS
  describe('OpenCode SDK', () => {
    let sdk: OpenCodeSDK

    beforeEach(() => {
      sdk = new OpenCodeSDK('test-api-key')
    })

    it('should initialize OpenCode SDK', () => {
      expect(sdk).toBeDefined()
      expect(sdk).toBeInstanceOf(OpenCodeSDK)
    })

    it('should generate code', async () => {
      const result = await sdk.generateCode({
        language: 'python',
        prompt: 'Write a function to add two numbers',
      })

      expect(result).toBeDefined()
      expect(result.language).toBe('python')
      expect(result.code).toBeDefined()
    })

    it('should analyze code', async () => {
      const analysis = await sdk.analyzeCode(
        'def add(a, b):\n  return a + b',
        'python'
      )

      expect(analysis).toBeDefined()
      expect(analysis.language).toBe('python')
      expect(analysis.complexity).toBeGreaterThanOrEqual(0)
    })

    it('should refactor code', async () => {
      const result = await sdk.refactorCode(
        'def add(a,b):\n return a+b',
        'python'
      )

      expect(result).toBeDefined()
      expect(result.code).toBeDefined()
      expect(result.explanation).toBeDefined()
    })

    it('should track generation tokens', async () => {
      const result = await sdk.generateCode({
        language: 'javascript',
        prompt: 'Simple hello world',
        maxTokens: 50,
      })

      expect(result.tokens).toBeDefined()
      expect(result.tokens.input).toBeGreaterThanOrEqual(0)
      expect(result.tokens.output).toBeGreaterThanOrEqual(0)
    })

    it('should cache code generation', async () => {
      const request = {
        language: 'python' as const,
        prompt: 'Cached function',
      }

      const result1 = await sdk.generateCode(request)
      const result2 = await sdk.generateCode(request)

      expect(result1.id).toBe(result2.id)
      expect(sdk.getCacheSize()).toBeGreaterThan(0)
    })

    it('should provide quality scores', async () => {
      const result = await sdk.generateCode({
        language: 'javascript',
        prompt: 'Generate quality code',
      })

      expect(result.quality).toBeDefined()
      expect(result.quality.score).toBeGreaterThan(0)
      expect(result.quality.score).toBeLessThanOrEqual(1)
    })

    it('should clear cache', () => {
      sdk.clearCache()
      expect(sdk.getCacheSize()).toBe(0)
    })

    it('should check health', async () => {
      const healthy = await sdk.health()
      expect(typeof healthy).toBe('boolean')
    })

    it('should emit events', (done) => {
      sdk.on('generation:start', () => {
        done()
      })

      sdk.generateCode({
        language: 'python',
        prompt: 'Test',
      }).catch(() => {
        // Ignore error, testing events only
      })
    })
  })

  // INTEGRATION TESTS
  describe('Multi-Provider Integration', () => {
    it('should work with all 4 providers together', async () => {
      const openclaw = new OpenClawProvider('test-key')
      const pimono = new PiMonoProvider()
      const openhands = new OpenHandsProvider()
      const opencode = new OpenCodeSDK('test-key')

      // Test all providers
      const clawResult = await openclaw.execute({ prompt: 'Test' })
      const monoResult = await pimono.execute({
        id: 'task-1',
        name: 'test',
        description: 'test',
        inputs: {},
      })
      const handsResult = await openhands.execute({
        id: 'hands-1',
        objective: 'test',
      })
      const codeResult = await opencode.generateCode({
        language: 'python',
        prompt: 'test',
      })

      expect(clawResult).toBeDefined()
      expect(monoResult).toBeDefined()
      expect(handsResult).toBeDefined()
      expect(codeResult).toBeDefined()
    })

    it('should provide health across providers', async () => {
      const openclaw = new OpenClawProvider('test-key')
      const pimono = new PiMonoProvider()
      const openhands = new OpenHandsProvider()
      const opencode = new OpenCodeSDK('test-key')

      const health = {
        openclaw: await openclaw.health(),
        pimono: await pimono.health(),
        openhands: await openhands.health(),
        opencode: await opencode.health(),
      }

      expect(Object.values(health).every((h) => typeof h === 'boolean')).toBe(true)
    })
  })
})
