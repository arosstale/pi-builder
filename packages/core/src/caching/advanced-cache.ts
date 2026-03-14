export interface CacheEntry<T> {
  key: string
  value: T
  expiresAt: number
  createdAt: Date
  accessCount: number
  lastAccessed: Date
}

export interface CacheStats {
  hits: number
  misses: number
  size: number
  hitRate: number
  averageAccessTime: number
}

export type CacheEvictionPolicy = 'LRU' | 'LFU' | 'FIFO' | 'TTL'

export class AdvancedCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private stats = { hits: 0, misses: 0, totalAccessTime: 0, accessCount: 0 }
  private maxSize: number
  private defaultTTL: number
  private evictionPolicy: CacheEvictionPolicy
  private accessTimes: number[] = []
  private accessCounter = 0

  constructor(maxSize: number = 1000, defaultTTL: number = 3600000, evictionPolicy: CacheEvictionPolicy = 'LRU') {
    this.maxSize = maxSize
    this.defaultTTL = defaultTTL
    this.evictionPolicy = evictionPolicy
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const now = Date.now()
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if expired
    if (entry.expiresAt < now) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Update access info
    const startTime = now
    entry.accessCount++
    entry.lastAccessed = new Date(Date.now() + ++this.accessCounter)
    this.stats.hits++
    this.stats.totalAccessTime += Date.now() - startTime
    this.stats.accessCount++

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl: number = this.defaultTTL): void {
    // Check if eviction needed
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evict()
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      expiresAt: Date.now() + ttl,
      createdAt: new Date(),
      accessCount: 0,
      lastAccessed: new Date()
    }

    this.cache.set(key, entry)
    console.log(`💾 Cache: Set ${key} (size: ${this.cache.size}/${this.maxSize})`)
  }

  /**
   * Evict entry based on policy
   */
  private evict(): void {
    if (this.cache.size === 0) return

    let keyToEvict: string | null = null

    switch (this.evictionPolicy) {
      case 'LRU': // Least Recently Used
        keyToEvict = this.findLRUKey()
        break
      case 'LFU': // Least Frequently Used
        keyToEvict = this.findLFUKey()
        break
      case 'FIFO': // First In First Out
        keyToEvict = this.findFIFOKey()
        break
      case 'TTL': // Oldest TTL
        keyToEvict = this.findOldestTTLKey()
        break
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict)
      console.log(`🗑️ Evicted: ${keyToEvict} (${this.evictionPolicy})`)
    }
  }

  /**
   * Find LRU key
   */
  private findLRUKey(): string | null {
    let lruKey: string | null = null
    let lruTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed.getTime() < lruTime) {
        lruTime = entry.lastAccessed.getTime()
        lruKey = key
      }
    }

    return lruKey
  }

  /**
   * Find LFU key
   */
  private findLFUKey(): string | null {
    let lfuKey: string | null = null
    let lfuCount = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lfuCount) {
        lfuCount = entry.accessCount
        lfuKey = key
      }
    }

    return lfuKey
  }

  /**
   * Find FIFO key
   */
  private findFIFOKey(): string | null {
    let fifoKey: string | null = null
    let fifoTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt.getTime() < fifoTime) {
        fifoTime = entry.createdAt.getTime()
        fifoKey = key
      }
    }

    return fifoKey
  }

  /**
   * Find oldest TTL key
   */
  private findOldestTTLKey(): string | null {
    let oldestKey: string | null = null
    let oldestExpiry = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < oldestExpiry) {
        oldestExpiry = entry.expiresAt
        oldestKey = key
      }
    }

    return oldestKey
  }

  /**
   * Delete entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear()
    console.log('🧹 Cache cleared')
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check expiry
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Get cache stats
   */
  getStats(): CacheStats {
    const hitRate = this.stats.accessCount > 0 ? (this.stats.hits / this.stats.accessCount) * 100 : 0
    const averageAccessTime = this.stats.accessCount > 0 ? this.stats.totalAccessTime / this.stats.accessCount : 0

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate,
      averageAccessTime
    }
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size
  }

  /**
   * Get max size
   */
  getMaxSize(): number {
    return this.maxSize
  }

  /**
   * Get hit rate
   */
  getHitRate(): number {
    if (this.stats.accessCount === 0) return 0
    return (this.stats.hits / this.stats.accessCount) * 100
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key)
        cleaned++
      }
    }

    console.log(`🧹 Cleaned up ${cleaned} expired entries`)
    return cleaned
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get cache info
   */
  getInfo(): {
    size: number
    maxSize: number
    policy: CacheEvictionPolicy
    hitRate: number
    entries: number
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      policy: this.evictionPolicy,
      hitRate: this.getHitRate(),
      entries: this.cache.size
    }
  }

  /**
   * Set max size
   */
  setMaxSize(newSize: number): void {
    this.maxSize = newSize

    // Evict if necessary
    while (this.cache.size > this.maxSize) {
      this.evict()
    }
  }

  /**
   * Change eviction policy
   */
  setEvictionPolicy(policy: CacheEvictionPolicy): void {
    this.evictionPolicy = policy
    console.log(`📋 Eviction policy changed to: ${policy}`)
  }
}
