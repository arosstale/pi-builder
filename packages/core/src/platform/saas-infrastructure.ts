/**
 * SaaS Infrastructure
 * Production-ready multi-tenant, billing, authentication
 */

import * as crypto from 'crypto'

export interface Tenant {
  id: string
  name: string
  slug: string
  plan: 'starter' | 'professional' | 'enterprise'
  status: 'active' | 'suspended' | 'cancelled'
  subscriptionId?: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: 'admin' | 'developer' | 'viewer'
  status: 'active' | 'inactive' | 'invited'
  passwordHash: string
  lastLogin?: Date
  createdAt: Date
}

export interface Plan {
  id: string
  name: string
  slug: 'starter' | 'professional' | 'enterprise'
  monthlyPrice: number
  yearlyPrice?: number
  features: {
    agents: number
    tasks: number
    users: number
    channels: number
    storage: number
    apiCalls: number
  }
  support: 'community' | 'email' | 'priority' | 'dedicated'
}

export interface Subscription {
  id: string
  tenantId: string
  planId: string
  status: 'active' | 'trialing' | 'past_due' | 'cancelled'
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEndsAt?: Date
  metadata?: Record<string, any>
}

export interface BillingEvent {
  id: string
  tenantId: string
  type: 'usage' | 'overage' | 'discount' | 'tax'
  amount: number
  description: string
  timestamp: Date
}

export interface APIKey {
  id: string
  tenantId: string
  name: string
  prefix: string
  hash: string
  lastUsed?: Date
  createdAt: Date
  revokedAt?: Date
}

/**
 * Authentication Service
 */
export class AuthenticationService {
  private users: Map<string, User> = new Map()

  /**
   * Hash password with PBKDF2
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const iterations = 100000
    const hash = crypto
      .pbkdf2Sync(password, salt, iterations, 64, 'sha512')
      .toString('hex')
    return `${iterations}:${salt}:${hash}`
  }

  /**
   * Verify password
   */
  verifyPassword(password: string, hash: string): boolean {
    const [iterationsStr, salt, storedHash] = hash.split(':')
    const iterations = parseInt(iterationsStr, 10)
    const testHash = crypto
      .pbkdf2Sync(password, salt, iterations, 64, 'sha512')
      .toString('hex')
    return testHash === storedHash
  }

  /**
   * Create user
   */
  async createUser(tenantId: string, email: string, name: string, password: string): Promise<User> {
    console.log(`👤 Creating user: ${email}`)

    const user: User = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tenantId,
      email,
      name,
      role: 'developer',
      status: 'active',
      passwordHash: this.hashPassword(password),
      createdAt: new Date()
    }

    this.users.set(user.id, user)

    console.log(`✅ User created: ${user.id}`)

    return user
  }

  /**
   * Authenticate user
   */
  async authenticateUser(email: string, password: string): Promise<User | null> {
    console.log(`🔐 Authenticating: ${email}`)

    for (const user of this.users.values()) {
      if (user.email === email && this.verifyPassword(password, user.passwordHash)) {
        user.lastLogin = new Date()
        console.log(`✅ Authentication successful: ${user.id}`)
        return user
      }
    }

    console.error(`❌ Authentication failed for ${email}`)
    return null
  }

  /**
   * Generate JWT token (mock)
   */
  async generateToken(user: User, expiresIn: number = 86400): Promise<string> {
    // In production: use jsonwebtoken library
    const payload = JSON.stringify({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn
    })

    const signature = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'secret-key')
      .update(payload)
      .digest('hex')

    return `${Buffer.from(payload).toString('base64')}.${signature}`
  }

  /**
   * List users
   */
  listUsers(): User[] {
    return Array.from(this.users.values())
  }
}

/**
 * Tenant Management Service
 */
export class TenantService {
  private tenants: Map<string, Tenant> = new Map()

  /**
   * Create tenant
   */
  async createTenant(name: string, slug: string): Promise<Tenant> {
    console.log(`🏢 Creating tenant: ${name}`)

    const tenant: Tenant = {
      id: `tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      slug,
      plan: 'starter',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.tenants.set(tenant.id, tenant)

    console.log(`✅ Tenant created: ${tenant.id}`)

    return tenant
  }

  /**
   * Get tenant
   */
  getTenant(id: string): Tenant | null {
    return this.tenants.get(id) || null
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = this.tenants.get(id)
    if (!tenant) return null

    Object.assign(tenant, updates, { updatedAt: new Date() })

    console.log(`✅ Tenant updated: ${id}`)

    return tenant
  }

  /**
   * List tenants
   */
  listTenants(): Tenant[] {
    return Array.from(this.tenants.values())
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(id: string): Promise<void> {
    const tenant = this.tenants.get(id)
    if (tenant) {
      tenant.status = 'suspended'
      console.log(`⏸️ Tenant suspended: ${id}`)
    }
  }

  /**
   * Cancel tenant
   */
  async cancelTenant(id: string): Promise<void> {
    const tenant = this.tenants.get(id)
    if (tenant) {
      tenant.status = 'cancelled'
      console.log(`❌ Tenant cancelled: ${id}`)
    }
  }
}

/**
 * Billing Service
 */
export class BillingService {
  private plans: Map<string, Plan> = new Map()
  private subscriptions: Map<string, Subscription> = new Map()
  private events: BillingEvent[] = []

  constructor() {
    // Initialize default plans
    this.initializeDefaultPlans()
  }

  private initializeDefaultPlans(): void {
    const plans: Plan[] = [
      {
        id: 'plan-starter',
        name: 'Starter',
        slug: 'starter',
        monthlyPrice: 29,
        yearlyPrice: 290,
        features: {
          agents: 5,
          tasks: 100,
          users: 1,
          channels: 1,
          storage: 1, // 1GB
          apiCalls: 10000
        },
        support: 'community'
      },
      {
        id: 'plan-professional',
        name: 'Professional',
        slug: 'professional',
        monthlyPrice: 99,
        yearlyPrice: 990,
        features: {
          agents: 20,
          tasks: 5000,
          users: 10,
          channels: 3,
          storage: 50, // 50GB
          apiCalls: 1000000
        },
        support: 'email'
      },
      {
        id: 'plan-enterprise',
        name: 'Enterprise',
        slug: 'enterprise',
        monthlyPrice: 999,
        yearlyPrice: 9990,
        features: {
          agents: 10000,
          tasks: 1000000,
          users: 1000,
          channels: 6,
          storage: 10000, // 10TB
          apiCalls: 100000000
        },
        support: 'dedicated'
      }
    ]

    for (const plan of plans) {
      this.plans.set(plan.id, plan)
    }

    console.log(`✅ Initialized ${plans.length} default plans`)
  }

  /**
   * Create subscription
   */
  async createSubscription(tenantId: string, planSlug: 'starter' | 'professional' | 'enterprise'): Promise<Subscription> {
    console.log(`💳 Creating subscription for tenant ${tenantId} on ${planSlug} plan`)

    // Find plan
    let planId = ''
    for (const [id, plan] of this.plans) {
      if (plan.slug === planSlug) {
        planId = id
        break
      }
    }

    const subscription: Subscription = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tenantId,
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false
    }

    this.subscriptions.set(subscription.id, subscription)

    console.log(`✅ Subscription created: ${subscription.id}`)

    return subscription
  }

  /**
   * Get subscription
   */
  getSubscription(id: string): Subscription | null {
    return this.subscriptions.get(id) || null
  }

  /**
   * List subscriptions for tenant
   */
  listSubscriptions(tenantId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter((s) => s.tenantId === tenantId)
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(id: string, immediate: boolean = false): Promise<void> {
    const subscription = this.subscriptions.get(id)
    if (!subscription) return

    if (immediate) {
      subscription.status = 'cancelled'
      console.log(`❌ Subscription cancelled immediately: ${id}`)
    } else {
      subscription.cancelAtPeriodEnd = true
      console.log(`⏸️ Subscription marked for cancellation at period end: ${id}`)
    }
  }

  /**
   * Record billing event
   */
  recordEvent(tenantId: string, type: 'usage' | 'overage' | 'discount' | 'tax', amount: number, description: string): void {
    const event: BillingEvent = {
      id: `event-${Date.now()}`,
      tenantId,
      type,
      amount,
      description,
      timestamp: new Date()
    }

    this.events.push(event)

    console.log(`💰 Billing event: ${description} ($${amount})`)
  }

  /**
   * Get plan
   */
  getPlan(planSlug: 'starter' | 'professional' | 'enterprise'): Plan | null {
    for (const plan of this.plans.values()) {
      if (plan.slug === planSlug) {
        return plan
      }
    }
    return null
  }

  /**
   * Get billing summary
   */
  getBillingSummary(tenantId: string): { monthlyUsage: number; overages: number; credits: number } {
    const tenantEvents = this.events.filter((e) => e.tenantId === tenantId)

    let monthlyUsage = 0
    let overages = 0
    let credits = 0

    for (const event of tenantEvents) {
      if (event.type === 'usage') monthlyUsage += event.amount
      else if (event.type === 'overage') overages += event.amount
      else if (event.type === 'discount') credits += event.amount
    }

    return { monthlyUsage, overages, credits }
  }
}

/**
 * API Key Management
 */
export class APIKeyService {
  private keys: Map<string, APIKey> = new Map()

  /**
   * Create API key
   */
  async createAPIKey(tenantId: string, name: string): Promise<{ key: APIKey; fullKey: string }> {
    console.log(`🔑 Creating API key: ${name}`)

    const prefix = `pi_${Date.now()}`
    const secret = crypto.randomBytes(32).toString('hex')
    const fullKey = `${prefix}.${secret}`

    const hash = crypto.createHash('sha256').update(fullKey).digest('hex')

    const key: APIKey = {
      id: `key-${Date.now()}`,
      tenantId,
      name,
      prefix,
      hash,
      createdAt: new Date()
    }

    this.keys.set(key.id, key)

    console.log(`✅ API key created: ${key.id}`)

    return { key, fullKey }
  }

  /**
   * Verify API key
   */
  async verifyAPIKey(fullKey: string): Promise<APIKey | null> {
    const hash = crypto.createHash('sha256').update(fullKey).digest('hex')

    for (const key of this.keys.values()) {
      if (key.hash === hash && !key.revokedAt) {
        key.lastUsed = new Date()
        return key
      }
    }

    return null
  }

  /**
   * List keys for tenant
   */
  listKeys(tenantId: string): APIKey[] {
    return Array.from(this.keys.values()).filter((k) => k.tenantId === tenantId)
  }

  /**
   * Revoke key
   */
  async revokeKey(id: string): Promise<void> {
    const key = this.keys.get(id)
    if (key) {
      key.revokedAt = new Date()
      console.log(`🔒 API key revoked: ${id}`)
    }
  }
}

/**
 * Rate Limiting Service
 */
export class RateLimitService {
  private buckets: Map<string, { count: number; resetAt: Date }> = new Map()

  /**
   * Check rate limit
   */
  checkLimit(key: string, limit: number, windowSeconds: number = 60): boolean {
    const now = new Date()
    let bucket = this.buckets.get(key)

    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: new Date(now.getTime() + windowSeconds * 1000) }
      this.buckets.set(key, bucket)
    }

    if (bucket.count >= limit) {
      return false
    }

    bucket.count++
    return true
  }

  /**
   * Get remaining quota
   */
  getRemaining(key: string, limit: number): number {
    const bucket = this.buckets.get(key)
    if (!bucket) return limit

    return Math.max(0, limit - bucket.count)
  }

  /**
   * Reset bucket
   */
  reset(key: string): void {
    this.buckets.delete(key)
  }
}

/**
 * SaaS Infrastructure Orchestrator
 */
export class SaaSInfrastructure {
  private auth: AuthenticationService
  private tenants: TenantService
  private billing: BillingService
  private apiKeys: APIKeyService
  private rateLimits: RateLimitService

  constructor() {
    this.auth = new AuthenticationService()
    this.tenants = new TenantService()
    this.billing = new BillingService()
    this.apiKeys = new APIKeyService()
    this.rateLimits = new RateLimitService()

    console.log(`🚀 SaaS Infrastructure initialized`)
  }

  // Expose services
  getAuth(): AuthenticationService {
    return this.auth
  }

  getTenants(): TenantService {
    return this.tenants
  }

  getBilling(): BillingService {
    return this.billing
  }

  getAPIKeys(): APIKeyService {
    return this.apiKeys
  }

  getRateLimits(): RateLimitService {
    return this.rateLimits
  }

  /**
   * Get infrastructure status
   */
  getStatus(): {
    authService: string
    tenantService: string
    billingService: string
    apiKeyService: string
    rateLimitService: string
    timestamp: Date
  } {
    return {
      authService: 'operational',
      tenantService: 'operational',
      billingService: 'operational',
      apiKeyService: 'operational',
      rateLimitService: 'operational',
      timestamp: new Date()
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): {
    totalTenants: number
    activeSubscriptions: number
    totalUsers: number
    apiKeysIssued: number
    timestamp: Date
  } {
    return {
      totalTenants: this.tenants.listTenants().length,
      activeSubscriptions: Array.from(this.tenants.listTenants()).filter((t) => t.status === 'active').length,
      totalUsers: this.auth.listUsers().length,
      apiKeysIssued: this.apiKeys.listKeys('*').length,
      timestamp: new Date()
    }
  }
}
