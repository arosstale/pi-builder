/**
 * Audit Trail
 * Complete activity logging for compliance and security
 *
 * @module enterprise/audit-trail
 */

import { AgentLogger } from '../agents/logger'

/**
 * Audit event
 */
export interface AuditEvent {
  id: string
  timestamp: Date
  tenantId: string
  userId: string
  action: string
  resource: string
  resourceId?: string
  result: 'success' | 'failure'
  details?: unknown
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit filter
 */
export interface AuditFilter {
  tenantId?: string
  userId?: string
  action?: string
  resource?: string
  result?: 'success' | 'failure'
  startDate?: Date
  endDate?: Date
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  period: string
  totalEvents: number
  byAction: Map<string, number>
  byResource: Map<string, number>
  failureRate: number
  criticalEvents: AuditEvent[]
  recommendations: string[]
}

/**
 * Audit Trail
 */
export class AuditTrail {
  private events: AuditEvent[] = []
  private logger: AgentLogger
  private maxEvents: number = 100000

  constructor(maxEvents: number = 100000) {
    this.maxEvents = maxEvents
    this.logger = new AgentLogger('AuditTrail')
  }

  /**
   * Record an event
   */
  async record(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const auditEvent: AuditEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date()
    }

    this.events.push(auditEvent)

    // Keep memory bounded
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }

    this.logger.info(`Audit event recorded: ${event.action} ${event.resource}`)
    return auditEvent
  }

  /**
   * Query events
   */
  async query(filter: AuditFilter): Promise<AuditEvent[]> {
    return this.events.filter(event => {
      if (filter.tenantId && event.tenantId !== filter.tenantId) return false
      if (filter.userId && event.userId !== filter.userId) return false
      if (filter.action && event.action !== filter.action) return false
      if (filter.resource && event.resource !== filter.resource) return false
      if (filter.result && event.result !== filter.result) return false
      if (filter.startDate && event.timestamp < filter.startDate) return false
      if (filter.endDate && event.timestamp > filter.endDate) return false
      return true
    })
  }

  /**
   * Get events by tenant
   */
  async getByTenant(tenantId: string): Promise<AuditEvent[]> {
    return this.query({ tenantId })
  }

  /**
   * Get events by user
   */
  async getByUser(userId: string): Promise<AuditEvent[]> {
    return this.query({ userId })
  }

  /**
   * Get security events
   */
  async getSecurityEvents(): Promise<AuditEvent[]> {
    return this.events.filter(
      e =>
        e.action.includes('manage') ||
        e.action.includes('access') ||
        e.result === 'failure'
    )
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(filter?: AuditFilter): Promise<ComplianceReport> {
    const events = filter ? await this.query(filter) : this.events

    const byAction = new Map<string, number>()
    const byResource = new Map<string, number>()
    let failures = 0

    for (const event of events) {
      byAction.set(event.action, (byAction.get(event.action) || 0) + 1)
      byResource.set(event.resource, (byResource.get(event.resource) || 0) + 1)
      if (event.result === 'failure') failures++
    }

    const failureRate = events.length > 0 ? (failures / events.length) * 100 : 0
    const criticalEvents = this.events.filter(
      e => e.result === 'failure' && e.action.includes('manage')
    )

    const recommendations: string[] = []
    if (failureRate > 5) {
      recommendations.push('Investigate high failure rate')
    }
    if (criticalEvents.length > 0) {
      recommendations.push(`Found ${criticalEvents.length} critical failures`)
    }

    return {
      period: 'Current',
      totalEvents: events.length,
      byAction,
      byResource,
      failureRate,
      criticalEvents,
      recommendations
    }
  }

  /**
   * Export audit log
   */
  async export(): Promise<AuditEvent[]> {
    return JSON.parse(JSON.stringify(this.events))
  }

  /**
   * Clear old events
   */
  async clearOldEvents(beforeDate: Date): Promise<number> {
    const initialLength = this.events.length
    this.events = this.events.filter(e => e.timestamp >= beforeDate)
    const removed = initialLength - this.events.length

    this.logger.info(`Cleared ${removed} old audit events`)
    return removed
  }

  /**
   * Get event statistics
   */
  getStatistics(): {
    totalEvents: number
    successRate: number
    uniqueActions: number
    uniqueResources: number
    dateRange: { start: Date; end: Date } | null
  } {
    if (this.events.length === 0) {
      return {
        totalEvents: 0,
        successRate: 0,
        uniqueActions: 0,
        uniqueResources: 0,
        dateRange: null
      }
    }

    const successCount = this.events.filter(e => e.result === 'success').length
    const uniqueActions = new Set(this.events.map(e => e.action)).size
    const uniqueResources = new Set(this.events.map(e => e.resource)).size

    const sortedByTime = [...this.events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return {
      totalEvents: this.events.length,
      successRate: (successCount / this.events.length) * 100,
      uniqueActions,
      uniqueResources,
      dateRange: {
        start: sortedByTime[0].timestamp,
        end: sortedByTime[this.events.length - 1].timestamp
      }
    }
  }
}
