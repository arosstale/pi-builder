/**
 * RBAC Manager
 * Role-Based Access Control system
 *
 * @module enterprise/rbac-manager
 */

import { AgentLogger } from '../agents/logger'

export type Role = 'owner' | 'admin' | 'engineer' | 'viewer' | 'bot'
export type Action = 'create_agent' | 'execute_task' | 'view_costs' | 'manage_users' | 'manage_billing'

/**
 * Role definition
 */
export interface RoleDefinition {
  name: Role
  permissions: Action[]
  description: string
}

/**
 * User role assignment
 */
export interface UserRole {
  userId: string
  tenantId: string
  role: Role
  assignedAt: Date
}

/**
 * RBAC Manager
 */
export class RBACManager {
  private roleDefinitions: Map<Role, RoleDefinition> = new Map()
  private userRoles: Map<string, UserRole[]> = new Map()
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('RBACManager')
    this.initializeRoles()
  }

  /**
   * Initialize default roles
   */
  private initializeRoles(): void {
    const roles: RoleDefinition[] = [
      {
        name: 'owner',
        permissions: ['create_agent', 'execute_task', 'view_costs', 'manage_users', 'manage_billing'],
        description: 'Full access'
      },
      {
        name: 'admin',
        permissions: ['create_agent', 'execute_task', 'view_costs', 'manage_users'],
        description: 'Administrative access'
      },
      {
        name: 'engineer',
        permissions: ['create_agent', 'execute_task', 'view_costs'],
        description: 'Development access'
      },
      {
        name: 'viewer',
        permissions: ['view_costs'],
        description: 'Read-only access'
      },
      {
        name: 'bot',
        permissions: ['execute_task'],
        description: 'Automated access'
      }
    ]

    for (const role of roles) {
      this.roleDefinitions.set(role.name, role)
    }
  }

  /**
   * Grant role to user
   */
  async grantRole(tenantId: string, userId: string, role: Role): Promise<void> {
    if (!this.roleDefinitions.has(role)) {
      throw new Error(`Unknown role: ${role}`)
    }

    const key = `${tenantId}:${userId}`
    const existingRoles = this.userRoles.get(key) || []

    // Remove old role for this tenant
    const index = existingRoles.findIndex(r => r.tenantId === tenantId)
    if (index > -1) {
      existingRoles.splice(index, 1)
    }

    existingRoles.push({
      userId,
      tenantId,
      role,
      assignedAt: new Date()
    })

    this.userRoles.set(key, existingRoles)
    this.logger.info(`Granted role ${role} to user ${userId} in tenant ${tenantId}`)
  }

  /**
   * Check permission
   */
  async checkPermission(tenantId: string, userId: string, action: Action): Promise<boolean> {
    const key = `${tenantId}:${userId}`
    const roles = this.userRoles.get(key) || []

    const tenantRole = roles.find(r => r.tenantId === tenantId)
    if (!tenantRole) return false

    const roleDef = this.roleDefinitions.get(tenantRole.role)
    return roleDef?.permissions.includes(action) || false
  }

  /**
   * Get user role
   */
  getUserRole(tenantId: string, userId: string): Role | undefined {
    const key = `${tenantId}:${userId}`
    const roles = this.userRoles.get(key) || []
    const tenantRole = roles.find(r => r.tenantId === tenantId)
    return tenantRole?.role
  }

  /**
   * List permissions
   */
  async listPermissions(tenantId: string, userId: string): Promise<Action[]> {
    const role = this.getUserRole(tenantId, userId)
    if (!role) return []

    const roleDef = this.roleDefinitions.get(role)
    return roleDef?.permissions || []
  }

  /**
   * Get role definition
   */
  getRoleDefinition(role: Role): RoleDefinition | undefined {
    return this.roleDefinitions.get(role)
  }

  /**
   * List all roles
   */
  listAllRoles(): RoleDefinition[] {
    return Array.from(this.roleDefinitions.values())
  }

  /**
   * Revoke role
   */
  async revokeRole(tenantId: string, userId: string): Promise<void> {
    const key = `${tenantId}:${userId}`
    const roles = this.userRoles.get(key) || []

    const index = roles.findIndex(r => r.tenantId === tenantId)
    if (index > -1) {
      roles.splice(index, 1)
    }

    if (roles.length === 0) {
      this.userRoles.delete(key)
    }

    this.logger.info(`Revoked role from user ${userId} in tenant ${tenantId}`)
  }
}
