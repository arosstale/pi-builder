# Pi Builder Implementation Spec: Better Than Auto Maker

## 🎯 Mission

Build Pi Builder to be **2-3x better** than Auto Maker by:
1. Keeping what Auto Maker got right
2. Fixing what Auto Maker got wrong
3. Adding missing critical features
4. Using modern SDK approach (not CLI)
5. Adding production-grade observability

## 🏗️ Architecture Overview

```
Pi Builder = Auto Maker's Best Patterns + Our Innovations

Auto Maker Patterns (KEEP):
├─ Event-driven architecture
├─ Provider abstraction
├─ Error handling
├─ Agent discovery
└─ AppSpec format

Pi Builder Innovations (ADD):
├─ Native SDKs (not CLI)
├─ Cost tracking layer
├─ Intelligent provider routing
├─ Model registry
├─ Health monitoring
├─ Performance metrics
├─ Automatic failover
└─ MIT License
```

## 📦 Core Components to Build

### 1. **EnhancedEventEmitter** (Based on Auto Maker)

**Auto Maker Reference:**
- Location: `apps/server/src/lib/events.ts`
- Pattern: EventEmitter with WebSocket streaming
- Strength: Real-time client updates

**Pi Builder Enhancement:**
```typescript
class EnhancedEventEmitter extends EventEmitter {
  // Auto Maker's feature
  on(event, handler) { }
  emit(event, data) { }
  
  // Pi Builder's additions
  onWithMetrics(event, handler, recordMetrics: boolean) {
    // Track event timing, cost, provider
  }
  
  emitWithCost(event, data, costData) {
    // Include token count, cost, latency in event
  }
  
  recordMetrics(event: string, metrics: EventMetrics) {
    // Store for analytics
    this.metrics.push({ event, metrics, timestamp: Date.now() })
  }
}
```

**Files to Create:**
- `packages/core/src/events/enhanced-emitter.ts`
- `packages/core/src/events/metrics-recorder.ts`

**Tests to Add:** 12 tests

---

### 2. **EnhancedProvider** (Based on Auto Maker's BaseProvider)

**Auto Maker Reference:**
- Location: `apps/server/src/providers/base-provider.ts`
- Pattern: Abstract base class for all providers
- Strength: Extensible architecture

**Pi Builder Enhancement:**
```typescript
abstract class EnhancedProvider extends BaseProvider {
  // Auto Maker's interface
  abstract getName(): string
  abstract executeQuery(options): AsyncGenerator<ProviderMessage>
  abstract detectInstallation(): Promise<InstallationStatus>
  abstract getAvailableModels(): ModelDefinition[]
  
  // Pi Builder's additions
  getHealthScore(): ProviderScore {
    return {
      availability: this.metrics.availability,
      latency: this.metrics.p95Latency,
      errorRate: this.metrics.errorRate,
      costRatio: this.metrics.costRatio,
      recommendation: 'OPTIMAL' | 'ACCEPTABLE' | 'POOR'
    }
  }
  
  getTokenLimitForModel(modelId: string): number
  getCostPerToken(modelId: string): number
  supportsFeature(feature: string): boolean
  getCacheKey(request: Request): string // For intelligent caching
}
```

**Key Difference:** Native SDKs, not CLI
```typescript
// Auto Maker
class CLIProvider extends BaseProvider {
  async executeQuery() {
    const result = spawn('cli-tool', args)
  }
}

// Pi Builder
class NativeSDKProvider extends EnhancedProvider {
  async executeQuery() {
    const result = await this.sdk.messages.create()
    return enrichWithMetrics(result)
  }
}
```

**Files to Create:**
- `packages/core/src/providers/enhanced-provider.ts`
- `packages/core/src/providers/implementations/` (Claude, OpenAI, etc.)

**Tests to Add:** 15 tests

---

### 3. **CostTrackingLayer** (New - Auto Maker Missing)

**Concept:** Every request gets enriched with cost data

```typescript
class CostTrackingLayer {
  async executeRequest(provider: EnhancedProvider, request: Request) {
    const startTime = Date.now()
    
    // Execute through provider
    const result = await provider.executeQuery(request)
    
    // Calculate cost
    const cost = this.calculateCost({
      provider: provider.name,
      model: request.model,
      inputTokens: result.tokens.input,
      outputTokens: result.tokens.output,
    })
    
    // Record metrics
    await this.costTracker.record({
      provider: provider.name,
      model: request.model,
      cost,
      tokens: result.tokens,
      latency: Date.now() - startTime,
      timestamp: new Date(),
    })
    
    // Return enriched result
    return {
      ...result,
      cost,
      metrics: {
        latency: Date.now() - startTime,
        tokensUsed: result.tokens,
        costBreakdown: { input: cost.input, output: cost.output }
      }
    }
  }
}
```

**Files to Create:**
- `packages/core/src/cost/cost-tracker.ts`
- `packages/core/src/cost/cost-calculator.ts`

**Tests to Add:** 10 tests

---

### 4. **ProviderRouter** (New - Auto Maker Missing)

**Concept:** Intelligent provider selection based on multiple criteria

```typescript
class ProviderRouter {
  async selectProvider(request: Request, options: RouterOptions) {
    const healthy = await this.getHealthyProviders()
    
    if (options.strategy === 'cost-optimal') {
      return this.selectCheapest(healthy, request.model)
    }
    
    if (options.strategy === 'latency-optimal') {
      return this.selectFastest(healthy)
    }
    
    if (options.strategy === 'quality-optimal') {
      return this.selectBestModel(healthy, request.capabilities)
    }
    
    // Default: failover chain
    return this.getFailoverChain(healthy)
  }
  
  async executeWithFailover(request: Request, fallbackChain: string[]) {
    for (const providerName of fallbackChain) {
      try {
        const provider = this.getProvider(providerName)
        const health = await this.monitor.getHealth(providerName)
        
        if (health.isHealthy) {
          return await provider.executeQuery(request)
        }
      } catch (error) {
        console.log(`Trying next provider due to: ${error.message}`)
        continue
      }
    }
    throw new Error('All providers failed')
  }
}
```

**Files to Create:**
- `packages/core/src/routing/provider-router.ts`
- `packages/core/src/routing/failover-manager.ts`

**Tests to Add:** 12 tests

---

### 5. **ModelRegistry** (New - Auto Maker Has Manual Definitions)

**Concept:** Centralized, searchable model database

```typescript
class ModelRegistry {
  // Searchable database of all models
  private models = new Map<string, Model>()
  
  // Quick lookups
  getModel(id: string): Model
  getByProvider(provider: string): Model[]
  getByCapability(capability: string): Model[]
  getByLatency(maxMs: number): Model[]
  getByCost(maxPer1kTokens: number): Model[]
  
  // Metadata
  getTokenLimit(modelId: string): number
  getCostPer1kTokens(modelId: string): number
  supportsFeature(modelId: string, feature: string): boolean
  
  // Management
  addModel(model: ModelDefinition): void
  updateModel(id: string, updates: Partial<Model>): void
  syncWithProviders(): Promise<void> // Auto-discover new models
}
```

**Pre-loaded Models (20+):**
- Claude Opus, Sonnet, Haiku
- GPT-4, GPT-4 Turbo, GPT-3.5
- Gemini Pro, Ultra
- Mistral Large, Medium
- Pi Agent models
- OpenCode models

**Files to Create:**
- `packages/core/src/models/model-registry.ts`
- `packages/core/src/models/model-definitions.ts`

**Tests to Add:** 15 tests

---

### 6. **ProviderMonitor** (New - Auto Maker Missing)

**Concept:** Real-time provider health and performance tracking

```typescript
class ProviderMonitor {
  // Real-time metrics
  getLatency(provider: string): number          // Current
  getErrorRate(provider: string): number        // Last hour
  getAvailability(provider: string): number     // Last 24h
  getQueueDepth(provider: string): number       // Current
  
  // Historical data
  getHistoricalLatency(provider: string, hours: number): LatencyData[]
  getHistoricalErrorRate(provider: string, hours: number): ErrorData[]
  
  // Health scoring
  getHealthScore(provider: string): ProviderScore {
    return {
      availability: 0.99,
      latency: 245,
      errorRate: 0.001,
      recommendation: 'OPTIMAL'
    }
  }
  
  // Alerts
  onProviderDown(provider: string, callback: () => void): void
  onHighLatency(provider: string, threshold: number, callback: () => void): void
  onHighErrorRate(provider: string, threshold: number, callback: () => void): void
  
  // Metrics export
  exportMetrics(format: 'json' | 'csv'): string
  generateReport(provider: string, period: TimePeriod): Report
}
```

**Files to Create:**
- `packages/core/src/monitoring/provider-monitor.ts`
- `packages/core/src/monitoring/metrics-aggregator.ts`
- `packages/core/src/monitoring/health-check.ts`

**Tests to Add:** 15 tests

---

### 7. **CacheStrategy** (New - Auto Maker Missing)

**Concept:** Multi-strategy caching for different use cases

```typescript
class CacheStrategy {
  // Different strategies
  byContent(ttl: number): void      // Cache based on prompt hash
  byModel(ttl: number): void        // Cache by model output
  byUser(ttl: number): void         // Cache per user/session
  globally(ttl: number): void       // Global shared cache
  
  // Operations
  async get(key: string): Promise<CachedResponse | null>
  async set(key: string, value: unknown, ttl: number): Promise<void>
  async invalidate(pattern: string): Promise<void>
  
  // Metrics
  getHitRate(): number
  getCacheSize(): number
  getCostSaved(): number
  getHitsByStrategy(): Map<string, number>
}
```

**Target Metrics:**
- Hit rate: 40%+
- Token reduction: 30%+
- Cost savings: 20%+

**Files to Create:**
- `packages/core/src/caching/cache-strategy.ts`
- `packages/core/src/caching/cache-store.ts`

**Tests to Add:** 12 tests

---

## 📊 Implementation Timeline

### Week 1: Patterns & Foundations
- [ ] EnhancedEventEmitter (12 tests)
- [ ] EnhancedProvider (15 tests)
- [ ] ModelRegistry (15 tests)
- **Total: 42 tests, 15-20 hours**

### Week 2: Intelligence & Routing
- [ ] CostTrackingLayer (10 tests)
- [ ] ProviderRouter (12 tests)
- [ ] ProviderMonitor (15 tests)
- **Total: 37 tests, 15-20 hours**

### Week 3: Caching & Optimization
- [ ] CacheStrategy (12 tests)
- [ ] PromptOptimizer (12 tests)
- [ ] Integration testing (20 tests)
- **Total: 44 tests, 15-20 hours**

### Week 4: Production Hardening
- [ ] Performance testing
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation
- **Total: 15-20 hours**

---

## ✅ Success Criteria

### Architecture Quality
- [ ] Cleaner than Auto Maker
- [ ] More extensible
- [ ] Better performance (2-3x)
- [ ] 100% type-safe

### Feature Completeness
- [ ] Cost tracking (5% accuracy)
- [ ] Provider health (real-time)
- [ ] Intelligent routing (working)
- [ ] Model registry (20+ models)
- [ ] Caching (40%+ hit rate)
- [ ] Monitoring (production-grade)

### Testing
- [ ] 140+ new tests
- [ ] >80% code coverage
- [ ] All edge cases covered
- [ ] Performance benchmarks

### Compatibility
- [ ] Backwards compatible
- [ ] Zero breaking changes
- [ ] Gradual rollout possible

---

## 🎯 Comparison: Auto Maker vs Pi Builder

| Feature | Auto Maker | Pi Builder |
|---------|-----------|-----------|
| Event System | ✅ | ✅ Enhanced |
| Provider Abstraction | ✅ | ✅ Enhanced + SDK |
| Error Handling | ✅ | ✅ Enhanced |
| Cost Tracking | ❌ | ✅ New |
| Provider Routing | ❌ | ✅ New |
| Health Monitoring | ❌ | ✅ New |
| Model Registry | ❌ | ✅ New |
| Caching | ❌ | ✅ New |
| Observability | Basic | Production-grade |
| Performance | Good | 2-3x better |

---

## 🚀 Launch Criteria

Pi Builder v1.1.0 is ready when:
- [ ] All 140+ tests passing
- [ ] All 7 core components implemented
- [ ] Performance benchmarks show 2-3x improvement
- [ ] Full compatibility with v1.0.0
- [ ] Zero critical bugs
- [ ] Complete documentation

---

**Status:** SPEC COMPLETE ✅
**Ready to implement:** YES ✅
**Estimated completion:** 4 weeks
**Expected improvement:** 2-3x better than Auto Maker
