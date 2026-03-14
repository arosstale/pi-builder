/**
 * Phase 3 Tests: Caching & Optimization
 *
 * Tests for:
 * - CacheStrategy
 * - PromptOptimizer
 *
 * Total: 44 tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheStrategyManager, CacheStrategy } from '../src/caching/cache-strategy'
import { PromptOptimizer, OptimizationStrategy } from '../src/optimization/prompt-optimizer'

// ============================================================================
// CACHE STRATEGY TESTS (24 tests)
// ============================================================================

describe('CacheStrategy', () => {
  let cache: CacheStrategyManager

  beforeEach(() => {
    cache = new CacheStrategyManager(10000)
  })

  afterEach(() => {
    cache.shutdown()
  })

  // Content-based cache tests (6 tests)
  describe('Content-based caching', () => {
    it('should cache by content hash', () => {
      const prompt = 'What is the capital of France?'
      const response = 'The capital of France is Paris.'

      cache.setByContent(prompt, response)
      const cached = cache.getByContent(prompt)

      expect(cached).toBe(response)
    })

    it('should miss on different content', () => {
      const prompt1 = 'What is the capital of France?'
      const prompt2 = 'What is the capital of Germany?'
      const response = 'Paris'

      cache.setByContent(prompt1, response)
      const cached = cache.getByContent(prompt2)

      expect(cached).toBeNull()
    })

    it('should track hit count', () => {
      const prompt = 'test'
      cache.setByContent(prompt, 'response')

      cache.getByContent(prompt)
      cache.getByContent(prompt)
      cache.getByContent(prompt)

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(3)
    })

    it('should respect TTL expiration', async () => {
      const prompt = 'test'
      cache.setByContent(prompt, 'response', 100) // 100ms TTL

      await new Promise(resolve => setTimeout(resolve, 150))

      const cached = cache.getByContent(prompt)
      expect(cached).toBeNull()
    })

    it('should calculate hit rate', () => {
      const prompt1 = 'test1'
      const prompt2 = 'test2'

      cache.setByContent(prompt1, 'response1')
      cache.setByContent(prompt2, 'response2')

      cache.getByContent(prompt1) // Hit
      cache.getByContent(prompt2) // Hit
      cache.getByContent('test3') // Miss
      cache.getByContent('test4') // Miss

      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0.5) // 2 hits / 4 total
    })

    it('should enforce max size with LRU eviction', () => {
      const smallCache = new CacheStrategyManager(5)

      // Add 6 entries (should evict oldest)
      for (let i = 0; i < 6; i++) {
        smallCache.setByContent(`prompt${i}`, `response${i}`)
      }

      const stats = smallCache.getStats()
      expect(stats.entriesByStrategy.content).toBeLessThanOrEqual(5)
      smallCache.shutdown()
    })
  })

  // Model-based cache tests (6 tests)
  describe('Model-based caching', () => {
    it('should cache by model and input', () => {
      const modelId = 'claude-opus'
      const inputHash = 'abc123'
      const response = { content: 'test' }

      cache.setByModel(modelId, inputHash, response)
      const cached = cache.getByModel(modelId, inputHash)

      expect(cached).toEqual(response)
    })

    it('should not match different models', () => {
      const inputHash = 'abc123'
      const response = { content: 'test' }

      cache.setByModel('claude-opus', inputHash, response)
      const cached = cache.getByModel('gpt-4o', inputHash)

      expect(cached).toBeNull()
    })

    it('should not match different input hashes', () => {
      const modelId = 'claude-opus'
      const response = { content: 'test' }

      cache.setByModel(modelId, 'hash1', response)
      const cached = cache.getByModel(modelId, 'hash2')

      expect(cached).toBeNull()
    })

    it('should track model cache hits', () => {
      cache.setByModel('claude-opus', 'hash1', 'response1')
      cache.setByModel('gpt-4o', 'hash1', 'response2')

      cache.getByModel('claude-opus', 'hash1')
      cache.getByModel('claude-opus', 'hash1')
      cache.getByModel('gpt-4o', 'hash1')

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(3)
    })

    it('should store different responses per model', () => {
      const inputHash = 'test-input'

      cache.setByModel('claude-opus', inputHash, { response: 'claude' })
      cache.setByModel('gpt-4o', inputHash, { response: 'gpt' })

      const claude = cache.getByModel('claude-opus', inputHash)
      const gpt = cache.getByModel('gpt-4o', inputHash)

      expect(claude.response).toBe('claude')
      expect(gpt.response).toBe('gpt')
    })

    it('should handle rapid consecutive gets', () => {
      cache.setByModel('test-model', 'test-hash', 'response')

      for (let i = 0; i < 100; i++) {
        const result = cache.getByModel('test-model', 'test-hash')
        expect(result).toBe('response')
      }

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(100)
    })
  })

  // User-based cache tests (6 tests)
  describe('User-based caching', () => {
    it('should cache by user and key', () => {
      const userId = 'user123'
      const key = 'preference:theme'
      const value = 'dark'

      cache.setByUser(userId, key, value)
      const cached = cache.getByUser(userId, key)

      expect(cached).toBe(value)
    })

    it('should isolate by user', () => {
      cache.setByUser('user1', 'key1', 'value1')
      cache.setByUser('user2', 'key1', 'value2')

      const result1 = cache.getByUser('user1', 'key1')
      const result2 = cache.getByUser('user2', 'key1')

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
    })

    it('should isolate by key within user', () => {
      const userId = 'user1'

      cache.setByUser(userId, 'key1', 'value1')
      cache.setByUser(userId, 'key2', 'value2')

      const result1 = cache.getByUser(userId, 'key1')
      const result2 = cache.getByUser(userId, 'key2')

      expect(result1).toBe('value1')
      expect(result2).toBe('value2')
    })

    it('should handle multiple users', () => {
      for (let i = 0; i < 10; i++) {
        cache.setByUser(`user${i}`, 'key', `value${i}`)
      }

      const stats = cache.getStats()
      expect(stats.entriesByStrategy.user).toBeGreaterThan(0)
    })

    it('should respect user cache TTL', async () => {
      const userId = 'user1'
      cache.setByUser(userId, 'key', 'value', 100)

      await new Promise(resolve => setTimeout(resolve, 150))

      const cached = cache.getByUser(userId, 'key')
      expect(cached).toBeNull()
    })

    it('should track user cache stats separately', () => {
      cache.setByContent('content-key', 'content-value')
      cache.setByUser('user1', 'user-key', 'user-value')

      cache.getByContent('content-key')
      cache.getByUser('user1', 'user-key')
      cache.getByUser('user1', 'user-key')

      const stats = cache.getStats()
      expect(stats.entriesByStrategy.content).toBeGreaterThan(0)
      expect(stats.entriesByStrategy.user).toBeGreaterThan(0)
    })
  })

  // Global cache tests (6 tests)
  describe('Global caching', () => {
    it('should cache globally', () => {
      cache.setGlobal('common-key', 'common-value')
      const cached = cache.getGlobal('common-key')

      expect(cached).toBe('common-value')
    })

    it('should share across all users', () => {
      cache.setGlobal('key', 'shared')

      const result1 = cache.getGlobal('key')
      const result2 = cache.getGlobal('key')

      expect(result1).toBe('shared')
      expect(result2).toBe('shared')
    })

    it('should track hit count', () => {
      cache.setGlobal('key', 'value')

      for (let i = 0; i < 5; i++) {
        cache.getGlobal('key')
      }

      const stats = cache.getStats()
      expect(stats.hitCount).toBe(5)
    })

    it('should support pattern invalidation', () => {
      cache.setGlobal('key1', 'value1')
      cache.setGlobal('key2', 'value2')
      cache.setGlobal('other', 'value3')

      cache.invalidateByPattern('^key')

      expect(cache.getGlobal('key1')).toBeNull()
      expect(cache.getGlobal('key2')).toBeNull()
      expect(cache.getGlobal('other')).toBe('value3')
    })

    it('should support clearing specific strategy', () => {
      cache.setGlobal('global1', 'value')
      cache.setByUser('user1', 'user1', 'value')

      cache.clear('global')

      expect(cache.getGlobal('global1')).toBeNull()
      expect(cache.getByUser('user1', 'user1')).toBe('value')
    })

    it('should calculate cost savings', () => {
      cache.setGlobal('key', 'value')

      cache.getGlobal('key')
      cache.getGlobal('key')
      cache.getGlobal('key')

      const savings = cache.getCostSavings(0.01) // $0.01 per request
      expect(savings).toBe(0.03) // 3 hits * $0.01
    })
  })
})

// ============================================================================
// PROMPT OPTIMIZER TESTS (20 tests)
// ============================================================================

describe('PromptOptimizer', () => {
  let optimizer: PromptOptimizer

  beforeEach(() => {
    optimizer = new PromptOptimizer()
  })

  // Cost optimization tests (5 tests)
  describe('Cost optimization', () => {
    it('should reduce tokens', () => {
      const prompt = 'Please tell me, if you would be so kind, what is the capital of France?'
      const result = optimizer.optimizeForCost(prompt)

      expect(result.optimizedTokens).toBeLessThan(result.originalTokens)
      expect(result.reductionPercent).toBeGreaterThan(0)
    })

    it('should mark strategy as cost', () => {
      const prompt = 'test prompt'
      const result = optimizer.optimizeForCost(prompt)

      expect(result.strategy).toBe('cost')
    })

    it('should have high confidence', () => {
      const prompt = 'very, quite, really, rather, just very long unnecessary prompt'
      const result = optimizer.optimizeForCost(prompt)

      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('should remove redundancy', () => {
      const prompt = `Do this task.
Do this task.
Do this task.`
      const result = optimizer.optimizeForCost(prompt)

      expect(result.optimized).not.toContain('Do this task.\nDo this task.\nDo this task.')
    })

    it('should abbreviate common phrases', () => {
      const prompt = 'For example, you should do this. For instance, you should also do that.'
      const result = optimizer.optimizeForCost(prompt)

      expect(result.optimized.length).toBeLessThan(prompt.length)
    })
  })

  // Latency optimization tests (5 tests)
  describe('Latency optimization', () => {
    it('should simplify prompt', () => {
      const prompt = 'Please provide a comprehensive and detailed explanation'
      const result = optimizer.optimizeForLatency(prompt)

      expect(result.optimizedTokens).toBeLessThanOrEqual(result.originalTokens)
      expect(result.strategy).toBe('latency')
    })

    it('should reduce examples', () => {
      const prompt = `Example: test1
Example: test2
Example: test3
Example: test4
Example: test5`
      const result = optimizer.optimizeForLatency(prompt)

      const exampleCount = (result.optimized.match(/Example:/g) || []).length
      expect(exampleCount).toBeLessThanOrEqual(2)
    })

    it('should simplify vocabulary', () => {
      const prompt = 'Utilize this to facilitate comprehension'
      const result = optimizer.optimizeForLatency(prompt)

      expect(result.optimized).not.toContain('utilize')
      expect(result.optimized).not.toContain('facilitate')
    })

    it('should maintain meaning', () => {
      const prompt = 'What is the capital of France?'
      const result = optimizer.optimizeForLatency(prompt)

      expect(result.optimized).toContain('capital')
      expect(result.optimized).toContain('France')
    })

    it('should have good confidence', () => {
      const prompt = 'test prompt'
      const result = optimizer.optimizeForLatency(prompt)

      expect(result.confidence).toBeGreaterThan(0.7)
    })
  })

  // Quality optimization tests (5 tests)
  describe('Quality optimization', () => {
    it('should enhance clarity', () => {
      const prompt = 'Tell me about coding'
      const result = optimizer.optimizeForQuality(prompt)

      expect(result.optimized.length).toBeGreaterThan(prompt.length)
    })

    it('should add structure', () => {
      const prompt = 'Do this and do that and do something else'
      const result = optimizer.optimizeForQuality(prompt)

      expect(result.optimized).toContain('\n')
    })

    it('should mark strategy as quality', () => {
      const prompt = 'test'
      const result = optimizer.optimizeForQuality(prompt)

      expect(result.strategy).toBe('quality')
    })

    it('should have high confidence', () => {
      const prompt = 'test prompt'
      const result = optimizer.optimizeForQuality(prompt)

      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should add context if missing', () => {
      const prompt = 'What is X?'
      const result = optimizer.optimizeForQuality(prompt)

      expect(result.optimized).toContain('Context')
    })
  })

  // Model-specific optimization tests (5 tests)
  describe('Model-specific optimization', () => {
    it('should detect Claude model', () => {
      const prompt = 'test'
      const result = optimizer.optimizeForModel(prompt, 'claude-opus-4-5-20251101')

      expect(result.strategy).toBe('model-specific')
    })

    it('should handle unknown models', () => {
      const prompt = 'test'
      const result = optimizer.optimizeForModel(prompt, 'unknown-model')

      expect(result.strategy).toBe('cost') // Fallback
    })

    it('should optimize for GPT models', () => {
      const prompt = 'test'
      const result = optimizer.optimizeForModel(prompt, 'gpt-4o')

      expect(result.metadata?.modelProfile).toBeDefined()
    })

    it('should optimize for Gemini models', () => {
      const prompt = 'This is a very long and detailed prompt that should be shortened'
      const result = optimizer.optimizeForModel(prompt, 'gemini-2.0-flash')

      expect(result.strategy).toBe('model-specific')
    })

    it('should have high confidence', () => {
      const prompt = 'test'
      const result = optimizer.optimizeForModel(prompt, 'claude-opus-4-5-20251101')

      expect(result.confidence).toBeGreaterThan(0.8)
    })
  })

  // Recommendation tests (2 tests)
  describe('Recommendations', () => {
    it('should provide recommendations for long prompts', () => {
      const longPrompt = 'word '.repeat(300) // Long prompt
      const recommendations = optimizer.getRecommendations(longPrompt)

      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.toLowerCase().includes('long'))).toBe(true)
    })

    it('should compare strategies', () => {
      const prompt = 'This is a test prompt about coding'
      const comparison = optimizer.compareStrategies(prompt)

      expect(comparison.strategies).toHaveLength(4)
      expect(comparison.bestStrategy).toBeDefined()
      expect(comparison.recommendation).toBeDefined()
    })
  })
})

// ============================================================================
// INTEGRATION TESTS (5 tests)
// ============================================================================

describe('Cache & Optimization Integration', () => {
  let cache: CacheStrategyManager
  let optimizer: PromptOptimizer

  beforeEach(() => {
    cache = new CacheStrategyManager()
    optimizer = new PromptOptimizer()
  })

  afterEach(() => {
    cache.shutdown()
  })

  it('should cache optimized prompts', () => {
    const originalPrompt = 'Please tell me what is the capital of France?'
    const optimized = optimizer.optimizeForCost(originalPrompt)

    cache.setByContent(originalPrompt, optimized)
    const cached = cache.getByContent(originalPrompt)

    expect(cached).toBeDefined()
    expect(cached.reductionPercent).toBeGreaterThan(0)
  })

  it('should track savings across cache and optimization', () => {
    const prompt = 'test prompt'

    // Set in cache
    cache.setGlobal('key', 'cached-response')

    // Optimize prompt
    const optimized = optimizer.optimizeForCost(prompt)

    // Cache hits save cost
    const cacheSavings = cache.getCostSavings(0.01)
    const optimizationSavings = optimized.tokenReduction

    expect(cacheSavings + optimizationSavings).toBeGreaterThan(0)
  })

  it('should work together for maximum efficiency', () => {
    const prompt = 'Very long and very unnecessary and very redundant prompt text'

    // Step 1: Optimize
    const optimized = optimizer.optimizeForCost(prompt)

    // Step 2: Cache optimized version
    cache.setByContent(prompt, optimized.optimized)

    // Step 3: Retrieve from cache
    const cached = cache.getByContent(prompt)

    expect(cached).toBe(optimized.optimized)
  })

  it('should calculate total token savings', () => {
    const prompt = 'test'

    // Get optimization
    const optimized = optimizer.optimizeForCost(prompt)
    const tokenReduction = optimized.tokenReduction

    // Get cache hit savings
    cache.setGlobal('key', 'value')
    for (let i = 0; i < 5; i++) {
      cache.getGlobal('key')
    }

    const tokenSavings = cache.getTokenSavings(100)

    expect(tokenReduction + tokenSavings).toBeGreaterThan(0)
  })

  it('should export all statistics', () => {
    cache.setGlobal('key1', 'value1')
    cache.setByUser('user1', 'key2', 'value2')

    cache.getGlobal('key1')
    cache.getByUser('user1', 'key2')

    const stats = cache.getStats()

    expect(stats.totalEntries).toBeGreaterThan(0)
    expect(stats.hitRate).toBeGreaterThan(0)
    expect(stats.hitCount).toBeGreaterThan(0)
  })
})
