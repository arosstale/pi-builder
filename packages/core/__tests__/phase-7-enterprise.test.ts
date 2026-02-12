/**
 * Phase 7: Enterprise Features Tests
 * Tests for multi-tenancy, RBAC, and audit trail
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TenantManager,
  RBACManager,
  AuditTrail,
  type TenantConfig
} from '../src/enterprise'

describe('Phase 7: Enterprise Features', () => {
  describe('TenantManager', () => {
    let manager: TenantManager

    beforeEach(() => {
      manager = new TenantManager()
    })

    it('should create tenant', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test Tenant',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: ['agents', 'optimization', 'budgets'],
        dataResidency: 'us'
      }

      const tenant = await manager.createTenant(config)

      expect(tenant.id).toBe('tenant-1')
      expect(tenant.apiKey).toBeDefined()
      expect(tenant.isActive).toBe(true)
    })

    it('should retrieve tenant', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test Tenant',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: ['agents'],
        dataResidency: 'us'
      }

      await manager.createTenant(config)
      const tenant = manager.getTenant('tenant-1')

      expect(tenant).toBeDefined()
      expect(tenant?.name).toBe('Test Tenant')
    })

    it('should add user to tenant', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: [],
        dataResidency: 'us'
      }

      await manager.createTenant(config)
      await manager.addUserToTenant('tenant-1', 'user-1')

      const tenants = manager.listUserTenants('user-1')
      expect(tenants.length).toBe(1)
      expect(tenants[0].id).toBe('tenant-1')
    })

    it('should get isolated context', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: ['agents'],
        dataResidency: 'us'
      }

      await manager.createTenant(config)
      const context = await manager.getIsolatedContext('tenant-1', 'user-1')

      expect(context.tenantId).toBe('tenant-1')
      expect(context.quotaUsage).toBeDefined()
    })

    it('should enforce quotas', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: [],
        dataResidency: 'us'
      }

      await manager.createTenant(config)
      const result = await manager.enforceQuotas('tenant-1')

      expect(['ok', 'warning', 'exceeded']).toContain(result.status)
    })

    it('should validate tenant access', async () => {
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Test',
        plan: 'pro',
        maxAgents: 10,
        maxTasksPerMonth: 10000,
        monthlyBudget: 1000,
        enabledFeatures: [],
        dataResidency: 'us'
      }

      await manager.createTenant(config)
      await manager.addUserToTenant('tenant-1', 'user-1')

      const hasAccess = await manager.validateTenantAccess('tenant-1', 'user-1')
      expect(hasAccess).toBe(true)
    })
  })

  describe('RBACManager', () => {
    let rbac: RBACManager

    beforeEach(() => {
      rbac = new RBACManager()
    })

    it('should grant role', async () => {
      await rbac.grantRole('tenant-1', 'user-1', 'engineer')

      const role = rbac.getUserRole('tenant-1', 'user-1')
      expect(role).toBe('engineer')
    })

    it('should check permissions', async () => {
      await rbac.grantRole('tenant-1', 'user-1', 'engineer')

      const canExecute = await rbac.checkPermission(
        'tenant-1',
        'user-1',
        'execute_task'
      )
      expect(canExecute).toBe(true)

      const canManage = await rbac.checkPermission(
        'tenant-1',
        'user-1',
        'manage_billing'
      )
      expect(canManage).toBe(false)
    })

    it('should list permissions', async () => {
      await rbac.grantRole('tenant-1', 'user-1', 'admin')

      const permissions = await rbac.listPermissions('tenant-1', 'user-1')
      expect(permissions.length).toBeGreaterThan(0)
      expect(permissions).toContain('manage_users')
    })

    it('should revoke role', async () => {
      await rbac.grantRole('tenant-1', 'user-1', 'viewer')
      await rbac.revokeRole('tenant-1', 'user-1')

      const role = rbac.getUserRole('tenant-1', 'user-1')
      expect(role).toBeUndefined()
    })

    it('should list all roles', () => {
      const roles = rbac.listAllRoles()

      expect(roles.length).toBe(5)
      expect(roles.map(r => r.name)).toContain('owner')
      expect(roles.map(r => r.name)).toContain('admin')
    })
  })

  describe('AuditTrail', () => {
    let audit: AuditTrail

    beforeEach(() => {
      audit = new AuditTrail()
    })

    it('should record event', async () => {
      const event = await audit.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'create_agent',
        resource: 'agents',
        result: 'success'
      })

      expect(event.id).toBeDefined()
      expect(event.timestamp).toBeDefined()
    })

    it('should query events', async () => {
      await audit.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'create_agent',
        resource: 'agents',
        result: 'success'
      })

      const events = await audit.query({ tenantId: 'tenant-1' })
      expect(events.length).toBe(1)
    })

    it('should get security events', async () => {
      await audit.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'manage_users',
        resource: 'users',
        result: 'failure'
      })

      const securityEvents = await audit.getSecurityEvents()
      expect(securityEvents.length).toBeGreaterThan(0)
    })

    it('should generate compliance report', async () => {
      for (let i = 0; i < 5; i++) {
        await audit.record({
          tenantId: 'tenant-1',
          userId: 'user-1',
          action: 'execute_task',
          resource: 'tasks',
          result: i < 4 ? 'success' : 'failure'
        })
      }

      const report = await audit.generateComplianceReport()

      expect(report.totalEvents).toBe(5)
      expect(report.failureRate).toBeGreaterThan(0)
    })

    it('should get statistics', async () => {
      await audit.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'execute_task',
        resource: 'tasks',
        result: 'success'
      })

      const stats = audit.getStatistics()

      expect(stats.totalEvents).toBe(1)
      expect(stats.successRate).toBe(100)
    })
  })

  describe('Phase 7 Integration', () => {
    it('should work together - multi-tenant with RBAC and audit', async () => {
      const tenants = new TenantManager()
      const rbac = new RBACManager()
      const audit = new AuditTrail()

      // Create tenant
      const config: TenantConfig = {
        id: 'tenant-1',
        name: 'Enterprise',
        plan: 'enterprise',
        maxAgents: 100,
        maxTasksPerMonth: 100000,
        monthlyBudget: 10000,
        enabledFeatures: ['agents', 'optimization', 'budgets'],
        dataResidency: 'us'
      }

      const tenant = await tenants.createTenant(config)
      expect(tenant).toBeDefined()

      // Add user and grant role
      await tenants.addUserToTenant('tenant-1', 'user-1')
      await rbac.grantRole('tenant-1', 'user-1', 'engineer')

      // Check permissions
      const canExecute = await rbac.checkPermission('tenant-1', 'user-1', 'execute_task')
      expect(canExecute).toBe(true)

      // Audit the operation
      await audit.record({
        tenantId: 'tenant-1',
        userId: 'user-1',
        action: 'create_agent',
        resource: 'agents',
        result: 'success'
      })

      // Query audit
      const events = await audit.query({ tenantId: 'tenant-1' })
      expect(events.length).toBe(1)
    })
  })
})
