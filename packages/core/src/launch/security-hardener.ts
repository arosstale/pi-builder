import { EventEmitter } from 'events'
import crypto from 'crypto'

export interface SecurityPolicy {
  apiKeyRequired: boolean
  rateLimitPerMinute: number
  corsAllowed: string[]
  helmet: boolean
  csp: boolean
  https: boolean
}

export interface AuditEntry {
  timestamp: Date
  action: string
  userId?: string
  resource: string
  status: 'success' | 'failure'
  details: Record<string, unknown>
}

export class SecurityHardener extends EventEmitter {
  private policies: SecurityPolicy
  private auditLog: AuditEntry[]
  private apiKeys: Map<string, { name: string; createdAt: Date }>

  constructor() {
    super()
    this.policies = {
      apiKeyRequired: true,
      rateLimitPerMinute: 100,
      corsAllowed: ['https://app.example.com'],
      helmet: true,
      csp: true,
      https: true,
    }
    this.auditLog = []
    this.apiKeys = new Map()
  }

  generateApiKey(name: string): string {
    const key = crypto.randomBytes(32).toString('hex')
    this.apiKeys.set(key, {
      name,
      createdAt: new Date(),
    })
    this.logAudit('API_KEY_CREATED', 'api-keys', 'success', { keyName: name })
    return key
  }

  validateApiKey(key: string): boolean {
    const exists = this.apiKeys.has(key)
    this.logAudit('API_KEY_VALIDATED', 'api-keys', exists ? 'success' : 'failure', {
      keyExists: exists,
    })
    return exists
  }

  revokeApiKey(key: string): void {
    const existed = this.apiKeys.has(key)
    this.apiKeys.delete(key)
    this.logAudit('API_KEY_REVOKED', 'api-keys', existed ? 'success' : 'failure', {
      keyExists: existed,
    })
  }

  setPolicy(key: keyof SecurityPolicy, value: unknown): void {
    ;(this.policies[key] as unknown) = value
    this.emit('policy:updated', { key, value })
    this.logAudit('POLICY_UPDATED', 'security-policies', 'success', { key, value })
  }

  getPolicy(): SecurityPolicy {
    return { ...this.policies }
  }

  logAudit(
    action: string,
    resource: string,
    status: 'success' | 'failure',
    details: Record<string, unknown>
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date(),
      action,
      resource,
      status,
      details,
    }
    this.auditLog.push(entry)
    this.emit('audit:logged', entry)

    // Keep last 10000 entries
    if (this.auditLog.length > 10000) {
      this.auditLog.shift()
    }
  }

  getAuditLog(limit = 100): AuditEntry[] {
    return this.auditLog.slice(Math.max(0, this.auditLog.length - limit))
  }

  getSecurityScore(): number {
    let score = 0

    // API key requirement: +20
    if (this.policies.apiKeyRequired) score += 20

    // CORS restricted: +15
    if (this.policies.corsAllowed.length < 5) score += 15

    // Helmet enabled: +20
    if (this.policies.helmet) score += 20

    // CSP enabled: +20
    if (this.policies.csp) score += 20

    // HTTPS enabled: +25
    if (this.policies.https) score += 25

    return Math.min(100, score)
  }

  generateSecurityReport(): Record<string, unknown> {
    return {
      score: this.getSecurityScore(),
      policies: this.policies,
      apiKeysCount: this.apiKeys.size,
      auditLogEntries: this.auditLog.length,
      recentFailures: this.auditLog
        .filter((e) => e.status === 'failure')
        .slice(-10),
    }
  }
}

export class PerformanceOptimizer extends EventEmitter {
  private cache: Map<string, { data: unknown; expiry: number }>
  private metrics: Map<string, number[]>

  constructor() {
    super()
    this.cache = new Map()
    this.metrics = new Map()
  }

  cacheSet(key: string, data: unknown, ttlSeconds = 300): void {
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { data, expiry })
    this.emit('cache:set', { key, ttl: ttlSeconds })
  }

  cacheGet(key: string): unknown {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(duration)

    // Keep last 1000 entries
    const metrics = this.metrics.get(name)!
    if (metrics.length > 1000) {
      metrics.shift()
    }

    this.emit('metric:recorded', { name, duration })
  }

  getMetricStats(name: string): Record<string, number> {
    const values = this.metrics.get(name) || []
    if (values.length === 0) return { count: 0 }

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    }
  }

  clearExpiredCache(): void {
    const now = Date.now()
    let cleared = 0

    for (const [key, entry] of this.cache) {
      if (now > entry.expiry) {
        this.cache.delete(key)
        cleared++
      }
    }

    this.emit('cache:cleared', { count: cleared })
  }

  generatePerformanceReport(): Record<string, unknown> {
    const report: Record<string, unknown> = {
      cacheSize: this.cache.size,
      cachedItems: Array.from(this.cache.keys()),
      metrics: {},
    }

    for (const [name, _] of this.metrics) {
      ;(report.metrics as Record<string, unknown>)[name] = this.getMetricStats(name)
    }

    return report
  }
}
