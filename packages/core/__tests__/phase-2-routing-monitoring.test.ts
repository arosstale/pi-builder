/**
 * Phase 2 Tests: Routing & Monitoring
 *
 * Tests for:
 * - ProviderRouter
 * - ProviderMonitor
 * - FailoverManager
 *
 * Total: 37 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProviderRouter, ProviderSelectionCriteria, RouteDecision } from '../src/routing/provider-router'
import { ProviderMonitor, ProviderMetrics } from '../src/monitoring/provider-monitor'
import { FailoverManager, FailoverState } from '../src/routing/failover-manager'
import { EnhancedProvider, ProviderCapabilities } from '../src/providers/enhanced-provider'

// Mock provider for testing
class MockProvider extends EnhancedProvider {
  private name: string

  constructor(name: string, baseLatency: number = 100) {
    super()
    this.name = name
    // Set initial health score
    this.setHealthScore({
      availability: 0.99,
      latency: baseLatency,
      errorRate: 0.01,
      costRatio: 1.0,
      recommendation: 'OPTIMAL',
      lastUpdated: new Date(),
    })
  }

  getName(): string {
    return this.name
  }

  async *executeQuery(options: any) {
    yield { type: 'text', content: 'test' }
  }

  async detectInstallation() {
    return { installed: true, authenticated: true }
  }

  getAvailableModels() {
    return []
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsVision: true,
      supportsTools: true,
      supportsMCP: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png'],
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
    return `${this.name}-${request.prompt}`
  }
}

// ============================================================================
// PROVIDER ROUTER TESTS (12 tests)
// ============================================================================

describe('ProviderRouter', () => {
  let router: ProviderRouter
  let providers: Map<string, MockProvider>

  beforeEach(() => {
    providers = new Map([
      ['claude', new MockProvider('claude', 150)],
      ['gpt4', new MockProvider('gpt4', 200)],
      ['gemini', new MockProvider('gemini', 100)],
    ])

    router = new ProviderRouter(providers as any)
  })

  it('should register providers', () => {
    const newProvider = new MockProvider('test')
    router.registerProvider('test', newProvider as any)
    expect(router.getAllProviders().has('test')).toBe(true)
  })

  it('should select cost-optimal provider', () => {
    const decision = router.selectProvider(
      { model: 'claude-opus' } as any,
      {
        strategy: 'cost-optimal',
        minimumAvailability: 0.9,
      }
    )

    expect(decision.provider).toBeDefined()
    expect(decision.reason).toContain('Cost-optimal')
  })

  it('should select latency-optimal provider', () => {
    const decision = router.selectProvider(
      { model: 'gpt-4o' } as any,
      {
        strategy: 'latency-optimal',
      }
    )

    expect(decision.provider).toBeDefined()
    expect(decision.reason).toContain('Latency-optimal')
    // Gemini should be fastest (100ms)
    expect(decision.providerName).toBe('gemini')
  })

  it('should select quality-optimal provider', () => {
    const decision = router.selectProvider(
      { model: 'test' } as any,
      {
        strategy: 'quality-optimal',
        requiredCapabilities: ['vision', 'tools'],
      }
    )

    expect(decision.provider).toBeDefined()
    expect(decision.reason).toContain('Quality-optimal')
  })

  it('should filter by availability', () => {
    // Make gpt4 unavailable
    const gpt4 = providers.get('gpt4')!
    gpt4.setHealthScore({
      availability: 0.5,
      latency: 200,
      errorRate: 0.1,
      costRatio: 1.0,
      recommendation: 'POOR',
      lastUpdated: new Date(),
    })

    const decision = router.selectProvider(
      { model: 'test' } as any,
      {
        strategy: 'latency-optimal',
        minimumAvailability: 0.9,
      }
    )

    expect(decision.providerName).not.toBe('gpt4')
  })

  it('should filter by required capabilities', () => {
    const decision = router.selectProvider(
      { model: 'test' } as any,
      {
        strategy: 'quality-optimal',
        requiredCapabilities: ['vision', 'tools', 'thinking'],
      }
    )

    expect(decision.provider).toBeDefined()
    expect(decision.provider.supportsFeature('vision')).toBe(true)
    expect(decision.provider.supportsFeature('tools')).toBe(true)
  })

  it('should exclude providers', () => {
    const decision = router.selectProvider(
      { model: 'test' } as any,
      {
        strategy: 'latency-optimal',
        excludeProviders: ['gemini'], // Exclude the fastest
      }
    )

    expect(decision.providerName).not.toBe('gemini')
  })

  it('should get failover chain', () => {
    const chain = router.getFailoverChain({
      strategy: 'failover',
    })

    expect(chain.primary).toBeDefined()
    expect(chain.backups.length).toBeGreaterThan(0)
  })

  it('should execute with failover', async () => {
    const chain = [providers.get('claude')!, providers.get('gpt4')!] as any

    const result = await router.executeWithFailover(
      { model: 'test' } as any,
      async (provider) => `result-from-${provider.getName()}`,
      chain
    )

    expect(result).toContain('result-from-')
  })

  it('should track routing history', () => {
    router.selectProvider(
      { model: 'test' } as any,
      {
        strategy: 'latency-optimal',
      }
    )

    const history = router.getHistory()
    expect(history.length).toBe(1)
    expect(history[0].reason).toBeDefined()
  })

  it('should get routing statistics', () => {
    // Make multiple decisions
    for (let i = 0; i < 3; i++) {
      router.selectProvider(
        { model: 'test' } as any,
        {
          strategy: 'latency-optimal',
        }
      )
    }

    const stats = router.getStatistics()
    expect(stats.totalDecisions).toBe(3)
    expect(stats.preferredProvider).toBe('gemini') // Fastest
  })

  it('should throw on no matching providers', () => {
    expect(() => {
      router.selectProvider(
        { model: 'test' } as any,
        {
          strategy: 'latency-optimal',
          minimumAvailability: 1.0, // 100% availability
          excludeProviders: ['claude', 'gpt4', 'gemini'], // Exclude all
        }
      )
    }).toThrow()
  })
})

// ============================================================================
// PROVIDER MONITOR TESTS (15 tests)
// ============================================================================

describe('ProviderMonitor', () => {
  let monitor: ProviderMonitor
  let providers: Map<string, MockProvider>

  beforeEach(() => {
    providers = new Map([
      ['claude', new MockProvider('claude')],
      ['gpt4', new MockProvider('gpt4')],
    ])

    monitor = new ProviderMonitor(providers as any)
  })

  it('should register providers', () => {
    const newProvider = new MockProvider('test')
    monitor.registerProvider('test', newProvider as any)
    // Verify it's registered by checking if we can get metrics
    monitor.recordRequest('test', 100, true, 100, 0.01)
    const metrics = monitor.getLatestMetrics('test')
    expect(metrics).toBeDefined()
  })

  it('should record successful requests', () => {
    monitor.recordRequest('claude', 150, true, 1000, 0.01)
    const metrics = monitor.getLatestMetrics('claude')

    expect(metrics).toBeDefined()
    expect(metrics!.successCount).toBeGreaterThan(0)
  })

  it('should record failed requests', () => {
    monitor.recordRequest('claude', 150, false, 0, 0)
    monitor.recordRequest('claude', 150, true, 1000, 0.01)

    const metrics = monitor.getLatestMetrics('claude')
    expect(metrics).toBeDefined()
    expect(metrics!.errorCount).toBeGreaterThan(0)
  })

  it('should calculate latency percentiles', () => {
    for (let i = 0; i < 100; i++) {
      monitor.recordRequest('claude', 100 + i, true, 1000, 0.01)
    }

    const metrics = monitor.getLatestMetrics('claude')
    expect(metrics).toBeDefined()
    expect(metrics!.latencies.p50).toBeDefined()
    expect(metrics!.latencies.p95).toBeDefined()
    expect(metrics!.latencies.p99).toBeDefined()
    expect(metrics!.latencies.p50).toBeLessThanOrEqual(metrics!.latencies.p95)
  })

  it('should calculate success rate', () => {
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest('claude', 100, true, 1000, 0.01)
    }
    monitor.recordRequest('claude', 100, false, 0, 0)

    const metrics = monitor.getLatestMetrics('claude')
    expect(metrics!.successRate).toBeGreaterThan(0.8)
  })

  it('should get all metrics', () => {
    monitor.recordRequest('claude', 100, true, 1000, 0.01)
    monitor.recordRequest('gpt4', 100, true, 1000, 0.01)

    const allMetrics = monitor.getAllMetrics()
    expect(Object.keys(allMetrics).length).toBeGreaterThan(0)
  })

  it('should get historical metrics', () => {
    for (let i = 0; i < 5; i++) {
      monitor.recordRequest('claude', 100 + i * 10, true, 1000, 0.01)
    }

    const history = monitor.getHistoricalMetrics('claude', 3)
    expect(history.length).toBeLessThanOrEqual(3)
  })

  it('should get health statuses', () => {
    monitor.recordRequest('claude', 100, true, 1000, 0.01)

    const statuses = monitor.getHealthStatuses()
    expect(statuses.claude).toBeDefined()
  })

  it('should compare providers', () => {
    monitor.recordRequest('claude', 150, true, 1000, 0.01)
    monitor.recordRequest('gpt4', 200, true, 1000, 0.01)

    const comparison = monitor.compareProviders()
    expect(comparison.length).toBeGreaterThan(0)
    expect(comparison[0].provider).toBeDefined()
    expect(comparison[0].latency).toBeDefined()
  })

  it('should get trends', () => {
    for (let i = 0; i < 5; i++) {
      monitor.recordRequest('claude', 100 + i * 20, true, 1000, 0.01)
    }

    const trend = monitor.getTrend('claude', 'latency', 3)
    expect(trend.length).toBeGreaterThan(0)
  })

  it('should configure alerts', () => {
    const alertSpy = vi.fn()
    monitor.setAlertConfig({
      onHighLatency: alertSpy,
    })

    // Record high latency
    for (let i = 0; i < 10; i++) {
      monitor.recordRequest('claude', 1500, true, 1000, 0.01)
    }

    // Alert should have been called
    expect(alertSpy).toHaveBeenCalled()
  })

  it('should export metrics', () => {
    monitor.recordRequest('claude', 100, true, 1000, 0.01)
    const exported = monitor.exportMetrics()

    expect(exported.claude).toBeDefined()
    expect(Array.isArray(exported.claude)).toBe(true)
  })

  it('should clear metrics', () => {
    monitor.recordRequest('claude', 100, true, 1000, 0.01)
    monitor.clearMetrics()

    const metrics = monitor.getLatestMetrics('claude')
    expect(metrics).toBeUndefined()
  })
})

// ============================================================================
// FAILOVER MANAGER TESTS (10 tests)
// ============================================================================

describe('FailoverManager', () => {
  let failover: FailoverManager
  let providers: Map<string, MockProvider>

  beforeEach(() => {
    providers = new Map([
      ['claude', new MockProvider('claude')],
      ['gpt4', new MockProvider('gpt4')],
    ])

    failover = new FailoverManager(providers as any)
  })

  it('should register providers', () => {
    const newProvider = new MockProvider('test')
    failover.registerProvider('test', newProvider as any)

    const state = failover.getState('test')
    expect(state).toBeDefined()
    expect(state!.status).toBe('healthy')
  })

  it('should record failures', () => {
    failover.recordFailure('claude', 'Connection timeout')

    const state = failover.getState('claude')
    expect(state!.failureCount).toBe(1)
    expect(state!.consecutiveFailures).toBe(1)
  })

  it('should record successes', () => {
    failover.recordSuccess('claude')

    const state = failover.getState('claude')
    expect(state!.consecutiveSuccesses).toBe(1)
    expect(state!.consecutiveFailures).toBe(0)
  })

  it('should blacklist after threshold', () => {
    failover.setConfig({ failureThreshold: 3 })

    failover.recordFailure('claude', 'Error 1')
    failover.recordFailure('claude', 'Error 2')
    failover.recordFailure('claude', 'Error 3')

    expect(failover.isProviderAvailable('claude')).toBe(false)
  })

  it('should get available providers', () => {
    failover.setConfig({ failureThreshold: 1 })
    failover.recordFailure('claude', 'Error')

    const available = failover.getAvailableProviders()
    expect(available).toContain('gpt4')
    expect(available).not.toContain('claude')
  })

  it('should recover providers', () => {
    failover.setConfig({
      failureThreshold: 1,
      recoveryThreshold: 2,
    })

    // Fail once
    failover.recordFailure('claude', 'Error')
    expect(failover.isProviderAvailable('claude')).toBe(false)

    // Succeed twice
    failover.recordSuccess('claude')
    failover.recordSuccess('claude')

    const state = failover.getState('claude')
    expect(state!.status).toBe('healthy')
  })

  it('should record failover events', () => {
    failover.recordFailure('claude', 'Test error')

    const events = failover.getEvents()
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].type).toBe('failure')
  })

  it('should get statistics', () => {
    failover.recordFailure('claude', 'Error')
    failover.recordSuccess('claude')

    const stats = failover.getStatistics()
    expect(stats.totalFailures).toBeGreaterThan(0)
    expect(stats.failuresByProvider.claude).toBeGreaterThan(0)
  })

  it('should reset provider state', () => {
    failover.recordFailure('claude', 'Error')
    failover.resetProvider('claude')

    const state = failover.getState('claude')
    expect(state!.status).toBe('healthy')
    expect(state!.failureCount).toBe(0)
  })

  it('should export state as JSON', () => {
    failover.recordFailure('claude', 'Error')

    const json = failover.toJSON()
    expect(json.states.claude).toBeDefined()
    expect(json.events.length).toBeGreaterThan(0)
  })
})
