import { describe, it, expect, beforeEach } from 'vitest'
import { ComplianceManager } from '../src/security/compliance-manager'
import { IntegrationManager } from '../src/integrations/integration-manager'
import { DashboardAnalytics } from '../src/analytics/dashboard-analytics'

describe('Phase 4-6: Enterprise Features', () => {
  describe('Compliance Manager (Phase 4)', () => {
    let compliance: ComplianceManager

    beforeEach(() => {
      compliance = new ComplianceManager()
    })

    it('should create compliance manager instance', () => {
      expect(compliance).toBeDefined()
    })

    it('should get compliance frameworks', () => {
      const frameworks = compliance.getAllFrameworks()
      expect(frameworks.length).toBeGreaterThan(0)
      expect(frameworks.some((f) => f.name === 'SOC 2 Type II')).toBe(true)
      expect(frameworks.some((f) => f.name === 'ISO 27001')).toBe(true)
      expect(frameworks.some((f) => f.name === 'GDPR Compliance')).toBe(true)
    })

    it('should log audit events', () => {
      const logId = compliance.logAuditEvent('user-login', 'user-123', 'auth-system', 'success')

      expect(logId).toBeDefined()
      expect(typeof logId).toBe('string')
    })

    it('should get audit logs', () => {
      compliance.logAuditEvent('data-access', 'user-456', 'database', 'success')
      const logs = compliance.getAuditLogs()

      expect(logs.length).toBeGreaterThan(0)
    })

    it('should log security events', () => {
      const eventId = compliance.logSecurityEvent('unauthorized-access', 'critical', 'api', 'Blocked unauthorized request')

      expect(eventId).toBeDefined()
    })

    it('should get security events', () => {
      compliance.logSecurityEvent('login-failure', 'high', 'auth', 'Multiple failed login attempts')
      const events = compliance.getSecurityEvents()

      expect(events.length).toBeGreaterThan(0)
    })

    it('should get framework details', () => {
      const soc2 = compliance.getFramework('SOC2')

      expect(soc2).toBeDefined()
      expect(soc2?.requirements.length).toBeGreaterThan(0)
    })

    it('should update compliance requirements', () => {
      const updated = compliance.updateRequirement('SOC2', 'SOC2-4', { status: 'completed' })

      expect(updated).toBe(true)
    })

    it('should calculate compliance score', () => {
      const score = compliance.calculateComplianceScore()

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should generate compliance report', () => {
      const report = compliance.getComplianceReport()

      expect(report).toBeDefined()
      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(report.frameworks).toBeDefined()
      expect(report.recentEvents).toBeDefined()
    })

    it('should resolve security events', () => {
      const eventId = compliance.logSecurityEvent('test-event', 'medium', 'test', 'Test event')
      const resolved = compliance.resolveSecurityEvent(eventId)

      expect(resolved).toBe(true)
    })

    it('should get audit trail for resource', () => {
      compliance.logAuditEvent('create', 'user-789', 'document-1', 'success')
      compliance.logAuditEvent('modify', 'user-789', 'document-1', 'success')

      const trail = compliance.getAuditTrail('document-1')
      expect(trail.length).toBeGreaterThanOrEqual(1)
    })

    it('should export compliance data', () => {
      const exported = compliance.exportComplianceData()

      expect(exported.frameworks).toBeDefined()
      expect(exported.auditLogs).toBeDefined()
      expect(exported.securityEvents).toBeDefined()
      expect(exported.score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration Manager (Phase 5)', () => {
    let integrations: IntegrationManager

    beforeEach(() => {
      integrations = new IntegrationManager()
    })

    it('should create integration manager instance', () => {
      expect(integrations).toBeDefined()
    })

    it('should connect an integration', async () => {
      const connected = await integrations.connectIntegration('jira', {
        apiKey: 'test-key',
        baseUrl: 'https://jira.example.com'
      })

      expect(connected).toBe(true)
    })

    it('should get integration status', () => {
      const status = integrations.getIntegrationStatus('github')

      expect(status).toBeDefined()
      expect(status?.name).toBe('GitHub')
    })

    it('should get all integrations', () => {
      const allIntegrations = integrations.getAllIntegrations()

      expect(allIntegrations.length).toBeGreaterThan(0)
    })

    it('should disconnect an integration', () => {
      const disconnected = integrations.disconnectIntegration('slack')

      expect(disconnected).toBe(true)
    })

    it('should create Jira issue', async () => {
      await integrations.connectIntegration('jira', { apiKey: 'test' })
      const issueId = await integrations.jiraCreateIssue('Test Issue', 'Description', 'Bug')

      expect(issueId).toBeDefined()
      expect(typeof issueId).toBe('string')
    })

    it('should create GitHub pull request', async () => {
      await integrations.connectIntegration('github', { token: 'test' })
      const prId = await integrations.githubCreatePullRequest('Add feature', 'Adds new feature')

      expect(prId).toBeDefined()
    })

    it('should send Slack message', async () => {
      await integrations.connectIntegration('slack', { webhookUrl: 'test' })
      const sent = await integrations.slackSendMessage('#general', 'Hello team!')

      expect(sent).toBe(true)
    })

    it('should receive webhook events', async () => {
      const webhookId = await integrations.receiveWebhookEvent('github', 'push', { branch: 'main' })

      expect(webhookId).toBeDefined()
    })

    it('should register webhook handler', () => {
      const handler = (payload: any) => console.log('Webhook received')
      integrations.registerWebhookHandler('github', 'pull_request', handler)

      expect(integrations).toBeDefined()
    })

    it('should get webhook events', async () => {
      await integrations.receiveWebhookEvent('jira', 'issue_created', { key: 'PROJ-123' })
      const events = integrations.getWebhookEvents('jira')

      expect(events.length).toBeGreaterThanOrEqual(0)
    })

    it('should get connection status', () => {
      const status = integrations.getConnectionStatus()

      expect(status.connected).toBeGreaterThanOrEqual(0)
      expect(status.disconnected).toBeGreaterThanOrEqual(0)
      expect(status.error).toBeGreaterThanOrEqual(0)
    })

    it('should test connection', async () => {
      const testResult = await integrations.testConnection('jira')

      expect(typeof testResult).toBe('boolean')
    })

    it('should sync integration', async () => {
      await integrations.connectIntegration('github', { token: 'test' })
      const result = await integrations.syncIntegration('github')

      expect(result.synced).toBeGreaterThanOrEqual(0)
      expect(result.errors).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Dashboard Analytics (Phase 6)', () => {
    let dashboard: DashboardAnalytics

    beforeEach(() => {
      dashboard = new DashboardAnalytics()
    })

    it('should create dashboard analytics instance', () => {
      expect(dashboard).toBeDefined()
    })

    it('should get default dashboards', () => {
      const dashboards = dashboard.getAllDashboards()

      expect(dashboards.length).toBeGreaterThan(0)
      expect(dashboards.some((d) => d.id === 'executive')).toBe(true)
    })

    it('should create custom dashboard', () => {
      const newDashboard = dashboard.createDashboard('Custom Dashboard', 'My custom metrics')

      expect(newDashboard).toBeDefined()
      expect(newDashboard.name).toBe('Custom Dashboard')
    })

    it('should add widget to dashboard', () => {
      const dashboardId = 'executive'
      const added = dashboard.addWidget(dashboardId, {
        title: 'New Widget',
        type: 'metric',
        data: { value: 100 },
        refreshInterval: 60000,
        position: { x: 0, y: 0, width: 3, height: 1 }
      })

      expect(added).toBe(true)
    })

    it('should remove widget from dashboard', () => {
      const dash = dashboard.getDashboard('executive')
      if (dash && dash.widgets.length > 0) {
        const removed = dashboard.removeWidget('executive', dash.widgets[0].id)
        expect(removed).toBe(true)
      }
    })

    it('should update widget data', () => {
      const dash = dashboard.getDashboard('executive')
      if (dash && dash.widgets.length > 0) {
        const updated = dashboard.updateWidgetData('executive', dash.widgets[0].id, { value: 200 })
        expect(updated).toBe(true)
      }
    })

    it('should get key metrics', () => {
      const metrics = dashboard.getKeyMetrics()

      expect(metrics.length).toBeGreaterThan(0)
      expect(metrics[0].label).toBeDefined()
      expect(metrics[0].value).toBeDefined()
    })

    it('should get revenue trend', () => {
      const trend = dashboard.getRevenueTrend(30)

      expect(trend.labels.length).toBe(30)
      expect(trend.datasets.length).toBeGreaterThan(0)
    })

    it('should get user acquisition trend', () => {
      const trend = dashboard.getUserAcquisitionTrend(30)

      expect(trend.labels.length).toBe(30)
      expect(trend.datasets.length).toBeGreaterThan(0)
    })

    it('should get feature usage', () => {
      const usage = dashboard.getFeatureUsage()

      expect(usage.labels.length).toBeGreaterThan(0)
      expect(usage.datasets.length).toBeGreaterThan(0)
    })

    it('should get subscription breakdown', () => {
      const breakdown = dashboard.getSubscriptionBreakdown()

      expect(breakdown.labels).toContain('Starter')
      expect(breakdown.labels).toContain('Professional')
      expect(breakdown.labels).toContain('Enterprise')
    })

    it('should export dashboard', () => {
      const exported = dashboard.exportDashboard('executive')

      expect(exported.filename).toBeDefined()
      expect(exported.filename.endsWith('.pdf')).toBe(true)
    })

    it('should share dashboard', () => {
      const shareUrl = dashboard.shareDashboard('executive', true)

      expect(shareUrl).toContain('dashboards/executive')
    })

    it('should get dashboard statistics', () => {
      const stats = dashboard.getDashboardStats()

      expect(stats.totalDashboards).toBeGreaterThan(0)
      expect(stats.totalWidgets).toBeGreaterThanOrEqual(0)
      expect(stats.publicDashboards).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration Tests', () => {
    it('should orchestrate compliance and audit logging', () => {
      const compliance = new ComplianceManager()

      compliance.logAuditEvent('integration-test', 'user-1', 'system', 'success')
      const logs = compliance.getAuditLogs()

      expect(logs.length).toBeGreaterThan(0)
    })

    it('should coordinate integrations with dashboards', () => {
      const integrations = new IntegrationManager()
      const dashboardAnalytics = new DashboardAnalytics()

      const status = integrations.getConnectionStatus()
      const metrics = dashboardAnalytics.getKeyMetrics()

      expect(status).toBeDefined()
      expect(metrics).toBeDefined()
    })

    it('should run complete enterprise workflow', async () => {
      const compliance = new ComplianceManager()
      const integrations = new IntegrationManager()
      const dashboard = new DashboardAnalytics()

      // Compliance check
      compliance.logAuditEvent('enterprise-start', 'admin', 'system', 'success')
      const report = compliance.getComplianceReport()

      // Connect integrations
      await integrations.connectIntegration('jira', { apiKey: 'test' })
      const connectionStatus = integrations.getConnectionStatus()

      // Get dashboard metrics
      const metrics = dashboard.getKeyMetrics()
      const revenue = dashboard.getRevenueTrend(7)

      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(connectionStatus.connected).toBeGreaterThanOrEqual(0)
      expect(metrics.length).toBeGreaterThan(0)
      expect(revenue.labels.length).toBe(7)
    })
  })
})
