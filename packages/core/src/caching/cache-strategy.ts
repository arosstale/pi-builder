/**
 * Cache Strategy - Multi-Strategy Intelligent Caching
 *
 * Strategies:
 * 1. Content-based: Cache by prompt hash (same prompt = same result)
 * 2. Model-based: Cache by model output (specific model results)
 * 3. User-based: Cache per session/user
 * 4. Global: Shared cache across all users
 */

import * as crypto from 'crypto'

/**
 * Cache entry
 */
export interface CacheEntry<T = any> {
  id: string
  key: string
  value: T
  timestamp: Date
  ttl: number // milliseconds
  hits: number
  lastHit: Date
  strategy: CacheStrategy
  metadata?: Record<string, any>
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number
  hitCount: number
  missCount: number
  hitRate: number
  avgHitTime: number
  totalMemoryUsage: number
  entriesByStrategy: Record<string, number>
}

/**
 * Cache strategies
 */
export type CacheStrategy = 'content' | 'model' | 'user' | 'global'

/**
 * Cache Strategy Manager - Multi-strategy caching
 */
export class CacheStrategyManager {
  private caches: Map<CacheStrategy, Map<string, CacheEntry>> = new Map([
    ['content', new Map()],
    ['model', new Map()],
    ['user', new Map()],
    ['global', new Map()],
  ])

  private stats = {
    hits: 0,
    misses: 0,
    hitTimes: [] as number[],
  }

  private maxEntriesPerStrategy: number = 10000
  private cleanupInterval: ReturnType<typeof setInterval>

  constructor(maxEntriesPerStrategy: number = 10000) {
    this.maxEntriesPerStrategy = maxEntriesPerStrategy

    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired()
    }, 60000)
  }

  /**
   * Generate cache key from content
   */
  private generateContentKey(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Content-based cache (same prompt = same result)
   */
  getByContent(prompt: string): any | null {
    const startTime = Date.now()
    const key = this.generateContentKey(prompt)
    const cache = this.caches.get('content')!

    const entry = cache.get(key)
    if (entry && !this.isExpired(entry)) {
      entry.hits++
      entry.lastHit = new Date()
      this.stats.hits++
      this.stats.hitTimes.push(Date.now() - startTime)
      return entry.value
    }

    this.stats.misses++
    return null
  }

  /**
   * Store in content cache
   */
  setByContent(prompt: string, value: any, ttl: number = 3600000): void {
    const key = this.generateContentKey(prompt)
    const cache = this.caches.get('content')!

    const entry: CacheEntry = {
      id: `content-${Date.now()}-${Math.random()}`,
      key,
      value,
      timestamp: new Date(),
      ttl,
      hits: 0,
      lastHit: new Date(),
      strategy: 'content',
      metadata: { promptHash: key },
    }

    cache.set(key, entry)
    this.enforceMaxSize('content')
  }

  /**
   * Model-based cache (model-specific caching)
   */
  getByModel(modelId: string, inputHash: string): any | null {
    const startTime = Date.now()
    const key = `${modelId}:${inputHash}`
    const cache = this.caches.get('model')!

    const entry = cache.get(key)
    if (entry && !this.isExpired(entry)) {
      entry.hits++
      entry.lastHit = new Date()
      this.stats.hits++
      this.stats.hitTimes.push(Date.now() - startTime)
      return entry.value
    }

    this.stats.misses++
    return null
  }

  /**
   * Store in model cache
   */
  setByModel(modelId: string, inputHash: string, value: any, ttl: number = 3600000): void {
    const key = `${modelId}:${inputHash}`
    const cache = this.caches.get('model')!

    const entry: CacheEntry = {
      id: `model-${Date.now()}-${Math.random()}`,
      key,
      value,
      timestamp: new Date(),
      ttl,
      hits: 0,
      lastHit: new Date(),
      strategy: 'model',
      metadata: { modelId, inputHash },
    }

    cache.set(key, entry)
    this.enforceMaxSize('model')
  }

  /**
   * User-based cache (per session/user)
   */
  getByUser(userId: string, key: string): any | null {
    const startTime = Date.now()
    const cacheKey = `${userId}:${key}`
    const cache = this.caches.get('user')!

    const entry = cache.get(cacheKey)
    if (entry && !this.isExpired(entry)) {
      entry.hits++
      entry.lastHit = new Date()
      this.stats.hits++
      this.stats.hitTimes.push(Date.now() - startTime)
      return entry.value
    }

    this.stats.misses++
    return null
  }

  /**
   * Store in user cache
   */
  setByUser(userId: string, key: string, value: any, ttl: number = 1800000): void {
    const cacheKey = `${userId}:${key}`
    const cache = this.caches.get('user')!

    const entry: CacheEntry = {
      id: `user-${Date.now()}-${Math.random()}`,
      key: cacheKey,
      value,
      timestamp: new Date(),
      ttl,
      hits: 0,
      lastHit: new Date(),
      strategy: 'user',
      metadata: { userId },
    }

    cache.set(cacheKey, entry)
    this.enforceMaxSize('user')
  }

  /**
   * Global cache (shared across users)
   */
  getGlobal(key: string): any | null {
    const startTime = Date.now()
    const cache = this.caches.get('global')!

    const entry = cache.get(key)
    if (entry && !this.isExpired(entry)) {
      entry.hits++
      entry.lastHit = new Date()
      this.stats.hits++
      this.stats.hitTimes.push(Date.now() - startTime)
      return entry.value
    }

    this.stats.misses++
    return null
  }

  /**
   * Store in global cache
   */
  setGlobal(key: string, value: any, ttl: number = 7200000): void {
    const cache = this.caches.get('global')!

    const entry: CacheEntry = {
      id: `global-${Date.now()}-${Math.random()}`,
      key,
      value,
      timestamp: new Date(),
      ttl,
      hits: 0,
      lastHit: new Date(),
      strategy: 'global',
    }

    cache.set(key, entry)
    this.enforceMaxSize('global')
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateByPattern(pattern: string, strategy?: CacheStrategy): void {
    const regex = new RegExp(pattern)
    const strategies = strategy ? [strategy] : (['content', 'model', 'user', 'global'] as CacheStrategy[])

    for (const strat of strategies) {
      const cache = this.caches.get(strat)!
      const keysToDelete: string[] = []

      for (const [key] of cache) {
        if (regex.test(key)) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        cache.delete(key)
      }
    }
  }

  /**
   * Clear specific cache strategy
   */
  clear(strategy: CacheStrategy): void {
    const cache = this.caches.get(strategy)
    if (cache) {
      cache.clear()
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    for (const [strategy] of this.caches) {
      this.clear(strategy)
    }
    this.stats = { hits: 0, misses: 0, hitTimes: [] }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime()
    return age > entry.ttl
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    for (const [strategy, cache] of this.caches) {
      const keysToDelete: string[] = []

      for (const [key, entry] of cache) {
        if (this.isExpired(entry)) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        cache.delete(key)
      }
    }
  }

  /**
   * Enforce max size per strategy (LRU eviction)
   */
  private enforceMaxSize(strategy: CacheStrategy): void {
    const cache = this.caches.get(strategy)!

    if (cache.size > this.maxEntriesPerStrategy) {
      // Sort by last hit time (ascending) and evict oldest
      const entries = Array.from(cache.values()).sort((a, b) => a.lastHit.getTime() - b.lastHit.getTime())

      const toEvict = entries.slice(0, Math.ceil(this.maxEntriesPerStrategy * 0.1)) // Evict 10%
      for (const entry of toEvict) {
        cache.delete(entry.key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entriesByStrategy: Record<string, number> = {}
    let totalMemoryUsage = 0

    for (const [strategy, cache] of this.caches) {
      entriesByStrategy[strategy] = cache.size
      for (const entry of cache.values()) {
        totalMemoryUsage += JSON.stringify(entry.value).length
      }
    }

    const totalHits = this.stats.hits
    const totalMisses = this.stats.misses
    const totalRequests = totalHits + totalMisses
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0
    const avgHitTime = this.stats.hitTimes.length > 0
      ? this.stats.hitTimes.reduce((a, b) => a + b, 0) / this.stats.hitTimes.length
      : 0

    return {
      totalEntries: Array.from(this.caches.values()).reduce((sum, c) => sum + c.size, 0),
      hitCount: totalHits,
      missCount: totalMisses,
      hitRate,
      avgHitTime,
      totalMemoryUsage,
      entriesByStrategy,
    }
  }

  /**
   * Get cost savings from cache hits
   */
  getCostSavings(costPerRequest: number = 0.001): number {
    return this.stats.hits * costPerRequest
  }

  /**
   * Get token savings from cache hits
   */
  getTokenSavings(tokensPerRequest: number = 1000): number {
    return this.stats.hits * tokensPerRequest
  }

  /**
   * Export cache contents
   */
  export(strategy?: CacheStrategy): Record<string, any> {
    const result: Record<string, any> = {}

    if (strategy) {
      const cache = this.caches.get(strategy)
      if (cache) {
        for (const [key, entry] of cache) {
          result[key] = entry
        }
      }
    } else {
      for (const [strat, cache] of this.caches) {
        result[strat] = {}
        for (const [key, entry] of cache) {
          result[strat][key] = entry
        }
      }
    }

    return result
  }

  /**
   * Shutdown cleanup timer
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

/**
 * Global cache instance
 */
export const cacheStrategy = new CacheStrategyManager()
