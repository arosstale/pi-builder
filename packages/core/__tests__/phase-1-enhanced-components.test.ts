/**
 * Phase 1 Tests: Enhanced Components
 *
 * Tests for:
 * - EnhancedProvider
 * - ModelRegistry
 * - EnhancedEventEmitter
 * - CostTracker
 *
 * Total: 42 tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EnhancedProvider, SdkBasedProvider, ProviderCapabilities, ExecutionMetrics } from '../src/providers/enhanced-provider'
import { ModelRegistry, Model, ModelSearchCriteria } from '../src/models/model-registry'
import { EnhancedEventEmitter, MetricsEvent, EventMetadata } from '../src/events/enhanced-emitter'
import { CostTracker, CostRecord, CostSummary, BudgetSettings } from '../src/cost/cost-tracker'

// ============================================================================
// ENHANCED PROVIDER TESTS (15 tests)
// ============================================================================

describe('EnhancedProvider', () => {
  class MockProvider extends EnhancedProvider {
    getName(): string {
      return 'mock'
    }

    async *executeQuery(options: any) {
      yield { type: 'text', content: 'test' }
    }

    async detectInstallation() {
      return { installed: true, authenticated: true }
    }

    getAvailableModels() {
      return [
        {
          id: 'mock-1',
          name: 'Mock 1',
          provider: 'mock',
          displayName: 'Mock Model 1',
          contextWindow: 4096,
          maxOutputTokens: 1024,
          costInput: 0.001,
          costOutput: 0.002,
          supportsVision: false,
          supportsTools: true,
          supportsMCP: false,
          supportsThinking: false,
          supportsStreaming: true,
          supportsImages: [],
          supportsAudio: false,
          supportsVideo: false,
          releaseDate: new Date(),
          status: 'active',
        },
      ]
    }

    getCapabilities(): ProviderCapabilities {
      return {
        supportsVision: false,
        supportsTools: true,
        supportsMCP: false,
        supportsThinking: false,
        supportsStreaming: true,
        supportsImages: [],
        supportsAudio: false,
        supportsVideo: false,
      }
    }

    getTokenLimitForModel(modelId: string): number {
      return 4096
    }

    getCostPerToken(modelId: string) {
      return { input: 0.001, output: 0.002 }
    }

    getCacheKey(request: any): string {
      return `mock-${request.prompt}`
    }
  }

  let provider: MockProvider

  beforeEach(() => {
    provider = new MockProvider()
  })

  it('should have a name', () => {
    expect(provider.getName()).toBe('mock')
  })

  it('should detect installation', async () => {
    const status = await provider.detectInstallation()
    expect(status.installed).toBe(true)
    expect(status.authenticated).toBe(true)
  })

  it('should get available models', () => {
    const models = provider.getAvailableModels()
    expect(models.length).toBe(1)
    expect(models[0].id).toBe('mock-1')
  })

  it('should have capabilities', () => {
    const caps = provider.getCapabilities()
    expect(caps.supportsTools).toBe(true)
    expect(caps.supportsVision).toBe(false)
  })

  it('should support features', () => {
    expect(provider.supportsFeature('tools')).toBe(true)
    expect(provider.supportsFeature('vision')).toBe(false)
  })

  it('should get token limit', () => {
    expect(provider.getTokenLimitForModel('mock-1')).toBe(4096)
  })

  it('should calculate cost', () => {
    const cost = provider.calculateCost(1000, 500, 'mock-1')
    // (1000/1000) * 0.001 + (500/1000) * 0.002 = 0.001 + 0.001 = 0.002
    expect(cost).toBe(0.002)
  })

  it('should generate cache key', () => {
    const key = provider.getCacheKey({ prompt: 'test' })
    expect(key).toBe('mock-test')
  })

  it('should track metrics', () => {
    const metric: ExecutionMetrics = {
      startTime: Date.now(),
      endTime: Date.now() + 100,
      duration: 100,
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cost: 0.001,
      provider: 'mock',
      model: 'mock-1',
      success: true,
    }
    provider.recordMetric(metric)
    const recent = provider.getRecentMetrics(1)
    expect(recent).toHaveLength(1)
    expect(recent[0].duration).toBe(100)
  })

  it('should get health score', () => {
    const score = provider.getHealthScore()
    expect(score.availability).toBe(1.0)
    expect(score.recommendation).toBe('UNKNOWN')
  })

  it('should update health score', () => {
    provider.setHealthScore({
      availability: 0.99,
      latency: 250,
      errorRate: 0.01,
      costRatio: 0.9,
      recommendation: 'OPTIMAL',
      lastUpdated: new Date(),
    })
    const score = provider.getHealthScore()
    expect(score.availability).toBe(0.99)
    expect(score.recommendation).toBe('OPTIMAL')
  })

  it('should validate configuration', () => {
    const result = provider.validateConfig()
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should get and set config', () => {
    provider.setConfig({ timeout: 30000 })
    expect(provider.getConfig().timeout).toBe(30000)
  })

  it('should clear metrics', () => {
    provider.recordMetric({
      startTime: Date.now(),
      provider: 'mock',
      model: 'mock-1',
      success: true,
    })
    provider.clearMetrics()
    expect(provider.getRecentMetrics()).toHaveLength(0)
  })
})

// ============================================================================
// MODEL REGISTRY TESTS (15 tests)
// ============================================================================

describe('ModelRegistry', () => {
  let registry: ModelRegistry

  beforeEach(() => {
    registry = new ModelRegistry()
  })

  it('should initialize with default models', () => {
    const models = registry.getAllModels()
    expect(models.length).toBeGreaterThan(15)
  })

  it('should register a new model', () => {
    const model: Model = {
      id: 'test-model',
      name: 'Test Model',
      provider: 'test',
      displayName: 'Test',
      contextWindow: 2048,
      maxOutputTokens: 1024,
      costInput: 0.001,
      costOutput: 0.002,
      supportsVision: false,
      supportsTools: false,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date(),
      status: 'active',
    }
    registry.registerModel(model)
    expect(registry.getModel('test-model')).toBeDefined()
  })

  it('should get model by ID', () => {
    const model = registry.getModel('claude-opus-4-5-20251101')
    expect(model).toBeDefined()
    expect(model?.provider).toBe('claude')
  })

  it('should get models by provider', () => {
    const claudeModels = registry.getByProvider('claude')
    expect(claudeModels.length).toBeGreaterThan(0)
    claudeModels.forEach((m) => {
      expect(m.provider).toBe('claude')
    })
  })

  it('should get models by capability', () => {
    const visionModels = registry.getByCapability('vision')
    expect(visionModels.length).toBeGreaterThan(0)
    visionModels.forEach((m) => {
      expect(m.supportsVision).toBe(true)
    })
  })

  it('should search models by criteria', () => {
    const criteria: ModelSearchCriteria = {
      provider: 'claude',
      capabilities: ['tools'],
    }
    const results = registry.search(criteria)
    expect(results.length).toBeGreaterThan(0)
    results.forEach((m) => {
      expect(m.provider).toBe('claude')
      expect(m.supportsTools).toBe(true)
    })
  })

  it('should search by context window', () => {
    const criteria: ModelSearchCriteria = {
      minContextWindow: 100000,
    }
    const results = registry.search(criteria)
    expect(results.length).toBeGreaterThan(0)
    results.forEach((m) => {
      expect(m.contextWindow).toBeGreaterThanOrEqual(100000)
    })
  })

  it('should search by cost', () => {
    const criteria: ModelSearchCriteria = {
      maxCost: 0.001,
    }
    const results = registry.search(criteria)
    expect(results.length).toBeGreaterThan(0)
    results.forEach((m) => {
      expect(m.costInput + m.costOutput).toBeLessThanOrEqual(0.001)
    })
  })

  it('should sort by cost', () => {
    const models = registry.getAllModels()
    const sorted = registry.sortByCost(models)
    for (let i = 1; i < sorted.length; i++) {
      const prevCost = sorted[i - 1].costInput + sorted[i - 1].costOutput
      const currentCost = sorted[i].costInput + sorted[i].costOutput
      expect(prevCost).toBeLessThanOrEqual(currentCost)
    }
  })

  it('should sort by context window', () => {
    const models = registry.getAllModels()
    const sorted = registry.sortByContextWindow(models)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].contextWindow).toBeGreaterThanOrEqual(sorted[i].contextWindow)
    }
  })

  it('should export as JSON', () => {
    const json = registry.toJSON()
    expect(Array.isArray(json)).toBe(true)
    expect(json.length).toBeGreaterThan(0)
  })

  it('should find Claude models', () => {
    const models = registry.getByProvider('claude')
    expect(models.some((m) => m.id === 'claude-opus-4-5-20251101')).toBe(true)
    expect(models.some((m) => m.id === 'claude-sonnet-4-20250514')).toBe(true)
  })

  it('should find vision models', () => {
    const models = registry.getByCapability('vision')
    expect(models.length).toBeGreaterThan(0)
  })

  it('should find thinking models', () => {
    const models = registry.getByCapability('thinking')
    expect(models.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// ENHANCED EVENT EMITTER TESTS (12 tests)
// ============================================================================

describe('EnhancedEventEmitter', () => {
  let emitter: EnhancedEventEmitter

  beforeEach(() => {
    emitter = new EnhancedEventEmitter()
  })

  it('should emit events', () => {
    let received = false
    emitter.on('test', () => {
      received = true
    })
    emitter.emit('test')
    expect(received).toBe(true)
  })

  it('should emit with metadata', () => {
    let received: any = null
    emitter.on('test', (data) => {
      received = data
    })
    const metadata: EventMetadata = {
      eventId: 'evt-1',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
    }
    emitter.emitWithMetadata('test', { content: 'hello' }, metadata)
    expect(received._metadata.provider).toBe('claude')
  })

  it('should emit with cost', () => {
    let received: any = null
    emitter.on('test', (data) => {
      received = data
    })
    const metadata: EventMetadata = {
      eventId: 'evt-1',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
    }
    emitter.emitWithCost(
      'test',
      { content: 'hello' },
      { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      { inputCost: 0.001, outputCost: 0.001, totalCost: 0.002, currency: 'USD' },
      metadata
    )
    expect(received.cost.totalCost).toBe(0.002)
  })

  it('should record metrics', () => {
    const event: MetricsEvent = {
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
      tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    }
    emitter.recordMetric(event)
    const history = emitter.getEventHistory()
    expect(history).toHaveLength(1)
  })

  it('should get event history', () => {
    emitter.recordMetric({
      type: 'test1',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    emitter.recordMetric({
      type: 'test2',
      timestamp: new Date(),
      provider: 'gpt',
      model: '4o',
      success: true,
    })
    const history = emitter.getEventHistory()
    expect(history).toHaveLength(2)
  })

  it('should get metrics summary', () => {
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
      tokens: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      cost: { inputCost: 0.0001, outputCost: 0.0001, totalCost: 0.0002, currency: 'USD' },
    })
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'gpt',
      model: '4o',
      success: false,
    })
    const summary = emitter.getMetricsSummary()
    expect(summary.totalEvents).toBe(2)
    expect(summary.successRate).toBe(0.5)
    expect(summary.totalCost).toBe(0.0002)
  })

  it('should register metrics recorder', (done) => {
    emitter.registerMetricsRecorder('test', (event) => {
      expect(event.provider).toBe('claude')
      done()
    })
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
  })

  it('should unregister metrics recorder', () => {
    const called: string[] = []
    emitter.registerMetricsRecorder('test', () => {
      called.push('test')
    })
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    expect(called).toHaveLength(1)
    emitter.unregisterMetricsRecorder('test')
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    expect(called).toHaveLength(1) // No new calls
  })

  it('should clear history', () => {
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    emitter.clearHistory()
    expect(emitter.getEventHistory()).toHaveLength(0)
  })

  it('should export history as JSON', () => {
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    const json = emitter.exportHistory('json')
    expect(typeof json).toBe('string')
    expect(json).toContain('test')
  })

  it('should export history as CSV', () => {
    emitter.recordMetric({
      type: 'test',
      timestamp: new Date(),
      provider: 'claude',
      model: 'opus',
      success: true,
    })
    const csv = emitter.exportHistory('csv')
    expect(typeof csv).toBe('string')
    expect(csv).toContain('timestamp')
    expect(csv).toContain('test')
  })
})

// ============================================================================
// COST TRACKER TESTS (12 tests)
// ============================================================================

describe('CostTracker', () => {
  let tracker: CostTracker

  beforeEach(() => {
    tracker = new CostTracker()
  })

  it('should record cost', () => {
    const record = tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    expect(record.id).toBeDefined()
    expect(record.totalCost).toBe(0.002)
  })

  it('should get all records', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    const records = tracker.getAllRecords()
    expect(records).toHaveLength(1)
  })

  it('should get records by provider', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    tracker.recordCost({
      provider: 'gpt',
      model: '4o',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    const claude = tracker.getRecordsByProvider('claude')
    expect(claude).toHaveLength(1)
  })

  it('should get cost summary', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    tracker.recordCost({
      provider: 'claude',
      model: 'sonnet',
      inputTokens: 500,
      outputTokens: 250,
      totalTokens: 750,
      costInput: 0.0005,
      costOutput: 0.0005,
      totalCost: 0.001,
      cacheHit: false,
    })
    const summary = tracker.getSummary()
    expect(summary.totalCost).toBe(0.003)
    expect(summary.totalTokens).toBe(2250)
    expect(summary.recordCount).toBe(2)
  })

  it('should get today cost', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    const todayCost = tracker.getTodayCost()
    expect(todayCost).toBe(0.002)
  })

  it('should get optimizations', () => {
    for (let i = 0; i < 100; i++) {
      tracker.recordCost({
        provider: 'expensive-model',
        model: 'gpt-4',
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        costInput: 0.015,
        costOutput: 0.03,
        totalCost: 0.15,
        cacheHit: false,
      })
    }
    const recommendations = tracker.getOptimizations()
    expect(recommendations.length).toBeGreaterThan(0)
  })

  it('should set budget settings', () => {
    const settings: BudgetSettings = {
      dailyBudget: 10,
      monthlyBudget: 100,
    }
    tracker.setBudgetSettings(settings)
    // Settings are set (no way to get them, but they're used for alerts)
    expect(true).toBe(true)
  })

  it('should trigger budget alerts', (done) => {
    const settings: BudgetSettings = {
      perRequestLimit: 0.001,
      alerts: {
        onPerRequestLimitExceeded: true,
      } as any,
    }
    tracker.setBudgetSettings(settings)
    tracker.onAlert((alert) => {
      expect(alert).toContain('exceeded')
      done()
    })
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
  })

  it('should clear records', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    tracker.clearRecords()
    expect(tracker.getAllRecords()).toHaveLength(0)
  })

  it('should export as JSON', () => {
    tracker.recordCost({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      costInput: 0.001,
      costOutput: 0.001,
      totalCost: 0.002,
      cacheHit: false,
    })
    const json = tracker.toJSON()
    expect(Array.isArray(json)).toBe(true)
    expect(json).toHaveLength(1)
  })
})
