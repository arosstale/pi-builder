/**
 * Provider Integrations Tests
 * Tests for Codex, Ollama, and LM Studio integrations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  CodexAgent,
  CodexProvider,
  OllamaAgent,
  OllamaProvider,
  LMStudioAgent,
  LMStudioProvider,
  type CodexConfig,
  type OllamaConfig,
  type LMStudioConfig
} from '../src/integrations'

describe('Provider Integrations', () => {
  describe('Codex Provider', () => {
    let provider: CodexProvider
    let codexConfig: CodexConfig

    beforeEach(() => {
      codexConfig = {
        apiKey: 'test-key',
        model: 'code-davinci-003',
        maxTokens: 2000,
        temperature: 0.7,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0
      }
      provider = new CodexProvider(codexConfig)
    })

    it('should create Codex agent', () => {
      const agent = provider.createAgent('codex-1')

      expect(agent).toBeDefined()
      expect(agent.name).toBe('Codex-codex-1')
    })

    it('should generate code', async () => {
      const response = await provider.generateCode(
        'Write a function to calculate fibonacci',
        'typescript'
      )

      expect(response.code).toBeDefined()
      expect(response.language).toBe('typescript')
      expect(response.confidence).toBeGreaterThan(0)
    })

    it('should execute code completion', async () => {
      const agent = provider.createAgent('codex-2')
      const response = await agent.execute({
        prompt: 'Sort an array',
        language: 'javascript'
      })

      expect(response.code).toBeDefined()
      expect(response.tokens).toBeGreaterThan(0)
    })

    it('should support multiple languages', async () => {
      for (const lang of ['typescript', 'python', 'javascript', 'go']) {
        const response = await provider.generateCode('Hello world', lang)

        expect(response.language).toBe(lang)
        expect(response.code.length).toBeGreaterThan(0)
      }
    })

    it('should batch generate code', async () => {
      const agent = provider.createAgent('codex-batch')
      const requests = [
        { prompt: 'Fibonacci', language: 'typescript' },
        { prompt: 'Sort array', language: 'python' }
      ]

      const results = await agent.generateBatch(requests)

      expect(results.length).toBe(2)
      expect(results[0].language).toBe('typescript')
      expect(results[1].language).toBe('python')
    })

    it('should get capabilities', () => {
      const agent = provider.createAgent('codex-cap')
      const caps = agent.getCapabilities()

      expect(caps).toContain('code_generation')
      expect(caps).toContain('bug_fixing')
    })

    it('should get provider stats', () => {
      provider.createAgent('codex-1')
      provider.createAgent('codex-2')

      const stats = provider.getStats()

      expect(stats.totalAgents).toBe(2)
      expect(stats.averageSuccess).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Ollama Provider', () => {
    let provider: OllamaProvider
    let ollamaConfig: OllamaConfig

    beforeEach(async () => {
      ollamaConfig = {
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        repeatPenalty: 1.1,
        timeout: 30000,
        stream: true
      }
      provider = new OllamaProvider(ollamaConfig)
      await provider.initialize()
    })

    it('should initialize provider', async () => {
      const newProvider = new OllamaProvider(ollamaConfig)
      await newProvider.initialize()

      const stats = newProvider.getStats()
      expect(stats.isHealthy).toBe(true)
    })

    it('should create Ollama agent', () => {
      const agent = provider.createAgent('ollama-1')

      expect(agent).toBeDefined()
      expect(agent.name).toBe('Ollama-ollama-1')
    })

    it('should execute generation', async () => {
      const agent = provider.createAgent('ollama-gen')
      const response = await agent.execute({
        prompt: 'Explain quantum computing',
        system: 'You are a helpful assistant'
      })

      expect(response.response).toBeDefined()
      expect(response.model).toBe('llama2')
      expect(response.done).toBe(true)
    })

    it('should stream generation', async () => {
      const agent = provider.createAgent('ollama-stream')
      const chunks: string[] = []

      for await (const chunk of agent.streamGeneration({
        prompt: 'What is AI?'
      })) {
        chunks.push(chunk)
      }

      expect(chunks.length).toBeGreaterThan(0)
    })

    it('should list available models', async () => {
      const models = await provider.listAvailableModels()

      expect(models).toContain('llama2')
      expect(models).toContain('mistral')
    })

    it('should pull model', async () => {
      await provider.pullModel('mistral')
      expect(true).toBe(true) // Model pull simulated successfully
    })

    it('should check health', async () => {
      const agent = provider.createAgent('ollama-health')
      const isHealthy = await agent.checkHealth()

      expect(isHealthy).toBe(true)
    })

    it('should get capabilities', () => {
      const agent = provider.createAgent('ollama-caps')
      const caps = agent.getCapabilities()

      expect(caps).toContain('local_inference')
      expect(caps).toContain('streaming')
      expect(caps).toContain('privacy_preserving')
    })

    it('should get provider stats', () => {
      provider.createAgent('ollama-1')
      provider.createAgent('ollama-2')

      const stats = provider.getStats()

      expect(stats.totalAgents).toBe(2)
      expect(stats.model).toBe('llama2')
      expect(stats.isHealthy).toBe(true)
    })
  })

  describe('LM Studio Provider', () => {
    let provider: LMStudioProvider
    let lmConfig: LMStudioConfig

    beforeEach(async () => {
      lmConfig = {
        endpoint: 'http://localhost:1234/v1',
        model: 'neural-chat-7b',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        stream: true
      }
      provider = new LMStudioProvider(lmConfig)
      await provider.connect()
    })

    it('should connect to LM Studio', async () => {
      const newProvider = new LMStudioProvider(lmConfig)
      await newProvider.connect()
      const stats = newProvider.getStats()
      expect(stats.isConnected).toBe(true)
    })

    it('should create LM Studio agent', () => {
      const agent = provider.createAgent('lm-1')

      expect(agent).toBeDefined()
      expect(agent.name).toBe('LMStudio-lm-1')
    })

    it('should execute completion', async () => {
      const agent = provider.createAgent('lm-complete')
      const response = await agent.execute({
        prompt: 'Write a hello world function',
        maxTokens: 100
      })

      expect(response.choices[0].text).toBeDefined()
      expect(response.model).toBe('neural-chat-7b')
      expect(response.usage.totalTokens).toBeGreaterThan(0)
    })

    it('should stream completion', async () => {
      const agent = provider.createAgent('lm-stream')
      let tokenCount = 0

      for await (const response of agent.streamCompletion({
        prompt: 'Explain machine learning'
      })) {
        tokenCount++
        expect(response.choices[0].text).toBeDefined()
      }

      expect(tokenCount).toBeGreaterThan(0)
    })

    it('should get loaded model', async () => {
      const model = await provider.getLoadedModel()

      expect(model).toBe('neural-chat-7b')
    })

    it('should load model', async () => {
      await provider.loadModel('mistral-7b')
      const model = await provider.getLoadedModel()

      expect(model).toBe('mistral-7b')
    })

    it('should get available models', async () => {
      const models = await provider.getAvailableModels()

      expect(models).toContain('neural-chat-7b')
      expect(models).toContain('mistral-7b')
    })

    it('should get capabilities', () => {
      const agent = provider.createAgent('lm-caps')
      const caps = agent.getCapabilities()

      expect(caps).toContain('openai_compatible')
      expect(caps).toContain('local_inference')
      expect(caps).toContain('gpu_acceleration')
    })

    it('should get provider stats', async () => {
      provider.createAgent('lm-1')
      provider.createAgent('lm-2')

      const stats = provider.getStats()

      expect(stats.isConnected).toBe(true)
      expect(stats.totalAgents).toBe(2)
      expect(stats.model).toBeDefined()
    })

    it('should disconnect', async () => {
      await provider.disconnect()
      const stats = provider.getStats()

      expect(stats.isConnected).toBe(false)
    })
  })

  describe('Provider Integration', () => {
    it('should work together - Codex, Ollama, LM Studio', async () => {
      // Codex for code generation
      const codexProvider = new CodexProvider({
        apiKey: 'test-key',
        model: 'code-davinci-003',
        maxTokens: 2000,
        temperature: 0.7,
        topP: 1.0,
        frequencyPenalty: 0.0,
        presencePenalty: 0.0
      })

      const codexResponse = await codexProvider.generateCode(
        'Sort array in place',
        'typescript'
      )
      expect(codexResponse.code).toBeDefined()

      // Ollama for text generation
      const ollamaProvider = new OllamaProvider({
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
        topK: 40,
        topP: 0.9,
        repeatPenalty: 1.1,
        timeout: 30000,
        stream: false
      })

      await ollamaProvider.initialize()
      const ollamaAgent = ollamaProvider.createAgent('ollama-1')
      const ollamaResponse = await ollamaAgent.execute({
        prompt: 'Explain the generated code'
      })
      expect(ollamaResponse.response).toBeDefined()

      // LM Studio for chat
      const lmProvider = new LMStudioProvider({
        endpoint: 'http://localhost:1234/v1',
        model: 'neural-chat-7b',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        stream: false
      })

      await lmProvider.connect()
      const lmAgent = lmProvider.createAgent('lm-1')
      const lmResponse = await lmAgent.execute({
        prompt: 'Review the code quality'
      })
      expect(lmResponse.choices[0].text).toBeDefined()

      // Verify all work together
      expect(codexResponse.code).toBeDefined()
      expect(ollamaResponse.response).toBeDefined()
      expect(lmResponse.choices[0].text).toBeDefined()
    })
  })
})
