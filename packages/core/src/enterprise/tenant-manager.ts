/**
 * Tenant Manager
 * Multi-tenancy support with isolation and resource management
 *
 * @module enterprise/tenant-manager
 */

import { AgentLogger } from '../agents/logger'

/**
 * Tenant configuration
 */
export interface TenantConfig {
  id: string
  name: string
  plan: 'free' | 'starter' | 'pro' | 'enterprise'
  maxAgents: number
  maxTasksPerMonth: number
  monthlyBudget: number
  enabledFeatures: string[]
  dataResidency: 'us' | 'eu' | 'asia'
  customDomain?: string
  metadata?: Record<string, unknown>
}

/**
 * Tenant context
 */
export interface TenantContext {
  tenantId: string
  userId: string
  permissions: string[]
  quotaUsage: {
    agentsUsed: number
    tasksUsed: number
    spendUsed: number
  }
  metadata?: Record<string, unknown>
}

/**
 * Tenant
 */
export interface Tenant extends TenantConfig {
  createdAt: Date
  updatedAt: Date
  isActive: boolean
  apiKey: string
}

/**
 * Tenant Manager
 */
export class TenantManager {
  private tenants: Map<string, Tenant> = new Map()
  private userTenants: Map<string, string[]> = new Map() // user -> tenant IDs
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('TenantManager')
  }

  /**
   * Create a new tenant
   */
  async createTenant(config: TenantConfig): Promise<Tenant> {
    const apiKey = this.generateApiKey()
    const tenant: Tenant = {
      ...config,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      apiKey
    }

    this.tenants.set(config.id, tenant)
    this.logger.info(`Tenant created: ${config.id} (${config.name})`)

    return tenant
  }

  /**
   * Get tenant by ID
   */
  getTenant(tenantId: string): Tenant | undefined {
    return this.tenants.get(tenantId)
  }

  /**
   * Get tenant for user
   */
  getTenantForUser(userId: string): Tenant | undefined {
    const tenantIds = this.userTenants.get(userId)
    if (!tenantIds || tenantIds.length === 0) return undefined

    return this.tenants.get(tenantIds[0])
  }

  /**
   * List all user tenants
   */
  listUserTenants(userId: string): Tenant[] {
    const tenantIds = this.userTenants.get(userId) || []
    return tenantIds
      .map(id => this.tenants.get(id))
      .filter((t): t is Tenant => t !== undefined)
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(tenantId: string, userId: string): Promise<void> {
    if (!this.tenants.has(tenantId)) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    if (!this.userTenants.has(userId)) {
      this.userTenants.set(userId, [])
    }

    const tenantIds = this.userTenants.get(userId)!
    if (!tenantIds.includes(tenantId)) {
      tenantIds.push(tenantId)
    }

    this.logger.info(`User ${userId} added to tenant ${tenantId}`)
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    const tenantIds = this.userTenants.get(userId)
    if (tenantIds) {
      const index = tenantIds.indexOf(tenantId)
      if (index > -1) {
        tenantIds.splice(index, 1)
      }
    }

    this.logger.info(`User ${userId} removed from tenant ${tenantId}`)
  }

  /**
   * Get isolated context for tenant
   */
  async getIsolatedContext(
    tenantId: string,
    userId: string
  ): Promise<TenantContext> {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    return {
      tenantId,
      userId,
      permissions: tenant.enabledFeatures,
      quotaUsage: {
        agentsUsed: Math.floor(Math.random() * tenant.maxAgents),
        tasksUsed: Math.floor(Math.random() * tenant.maxTasksPerMonth * 0.1),
        spendUsed: Math.random() * tenant.monthlyBudget * 0.5
      }
    }
  }

  /**
   * Enforce quotas
   */
  async enforceQuotas(tenantId: string): Promise<{
    status: 'ok' | 'warning' | 'exceeded'
    details: string
  }> {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    const context = await this.getIsolatedContext(tenantId, 'system')

    if (context.quotaUsage.agentsUsed >= tenant.maxAgents) {
      return {
        status: 'exceeded',
        details: 'Agent quota exceeded'
      }
    }

    if (context.quotaUsage.spendUsed >= tenant.monthlyBudget) {
      return {
        status: 'exceeded',
        details: 'Budget quota exceeded'
      }
    }

    const usagePercentage =
      (context.quotaUsage.spendUsed / tenant.monthlyBudget) * 100
    if (usagePercentage > 80) {
      return {
        status: 'warning',
        details: `Budget usage at ${usagePercentage.toFixed(0)}%`
      }
    }

    return {
      status: 'ok',
      details: 'All quotas within limits'
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<TenantConfig>): Promise<Tenant> {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    const updated: Tenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date()
    }

    this.tenants.set(tenantId, updated)
    this.logger.info(`Tenant updated: ${tenantId}`)

    return updated
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    this.tenants.delete(tenantId)

    // Remove from user mappings
    for (const [userId, tenantIds] of this.userTenants.entries()) {
      const index = tenantIds.indexOf(tenantId)
      if (index > -1) {
        tenantIds.splice(index, 1)
      }
      if (tenantIds.length === 0) {
        this.userTenants.delete(userId)
      }
    }

    this.logger.info(`Tenant deleted: ${tenantId}`)
  }

  /**
   * Validate tenant access
   */
  async validateTenantAccess(
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) return false

    const tenantIds = this.userTenants.get(userId) || []
    return tenantIds.includes(tenantId)
  }

  /**
   * Generate API key
   */
  private generateApiKey(): string {
    return `pk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * List all tenants
   */
  listAllTenants(): Tenant[] {
    return Array.from(this.tenants.values())
  }

  /**
   * Get tenant statistics
   */
  getTenantStats(tenantId: string): {
    tenantId: string
    users: number
    isActive: boolean
    plan: string
  } {
    const tenant = this.tenants.get(tenantId)
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`)
    }

    let users = 0
    for (const tenantIds of this.userTenants.values()) {
      if (tenantIds.includes(tenantId)) users++
    }

    return {
      tenantId,
      users,
      isActive: tenant.isActive,
      plan: tenant.plan
    }
  }
}
