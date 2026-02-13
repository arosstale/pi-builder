export interface HealthMetric {
  name: string
  status: 'healthy' | 'warning' | 'critical'
  value: number
  threshold: number
  unit: string
  timestamp: Date
}

export interface HealthReport {
  timestamp: Date
  overallStatus: 'healthy' | 'warning' | 'critical'
  metrics: HealthMetric[]
  recommendations: string[]
}

export interface AlertRule {
  id: string
  metric: string
  condition: 'above' | 'below' | 'equals'
  threshold: number
  action: string
}

export class AdvancedMonitor {
  private metrics: Map<string, HealthMetric[]> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()
  private alerts: Map<string, any> = new Map()
  private thresholds: Record<string, number> = {
    cpu_usage: 80,
    memory_usage: 85,
    disk_usage: 90,
    error_rate: 5,
    response_time: 1000,
    uptime: 99.5
  }

  constructor() {
    this.setupDefaultAlerts()
  }

  private setupDefaultAlerts(): void {
    this.addAlertRule({
      id: 'cpu-alert',
      metric: 'cpu_usage',
      condition: 'above',
      threshold: 80,
      action: 'Scale up resources'
    })

    this.addAlertRule({
      id: 'memory-alert',
      metric: 'memory_usage',
      condition: 'above',
      threshold: 85,
      action: 'Restart services'
    })

    this.addAlertRule({
      id: 'error-alert',
      metric: 'error_rate',
      condition: 'above',
      threshold: 5,
      action: 'Review logs'
    })

    this.addAlertRule({
      id: 'uptime-alert',
      metric: 'uptime',
      condition: 'below',
      threshold: 99,
      action: 'Investigate downtime'
    })
  }

  /**
   * Record a metric
   */
  recordMetric(name: string, value: number, unit: string = ''): void {
    const threshold = this.thresholds[name] || 100
    const status = this.calculateStatus(name, value, threshold)

    const metric: HealthMetric = {
      name,
      status,
      value,
      threshold,
      unit,
      timestamp: new Date()
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    this.metrics.get(name)!.push(metric)

    // Keep last 100 metrics per type
    const metricList = this.metrics.get(name)!
    if (metricList.length > 100) {
      metricList.shift()
    }

    // Check alert rules
    this.checkAlertRules(metric)

    console.log(`📊 Metric recorded: ${name} = ${value}${unit}`)
  }

  /**
   * Calculate metric status
   */
  private calculateStatus(name: string, value: number, threshold: number): 'healthy' | 'warning' | 'critical' {
    if (name.includes('uptime') || name.includes('success')) {
      // Higher is better
      if (value >= threshold) return 'healthy'
      if (value >= threshold * 0.95) return 'warning'
      return 'critical'
    } else {
      // Lower is better
      if (value <= threshold) return 'healthy'
      if (value <= threshold * 1.1) return 'warning'
      return 'critical'
    }
  }

  /**
   * Check alert rules
   */
  private checkAlertRules(metric: HealthMetric): void {
    for (const rule of this.alertRules.values()) {
      if (rule.metric !== metric.name) continue

      let triggered = false

      if (rule.condition === 'above' && metric.value > rule.threshold) {
        triggered = true
      } else if (rule.condition === 'below' && metric.value < rule.threshold) {
        triggered = true
      } else if (rule.condition === 'equals' && metric.value === rule.threshold) {
        triggered = true
      }

      if (triggered) {
        this.createAlert(rule, metric)
      }
    }
  }

  /**
   * Create an alert
   */
  private createAlert(rule: AlertRule, metric: HealthMetric): void {
    const alertId = `alert-${Date.now()}`
    const alert = {
      id: alertId,
      ruleId: rule.id,
      metric: metric.name,
      value: metric.value,
      threshold: rule.threshold,
      action: rule.action,
      timestamp: new Date(),
      resolved: false
    }

    this.alerts.set(alertId, alert)
    console.log(`🚨 ALERT: ${rule.metric} exceeded threshold (${metric.value} > ${rule.threshold})`)
    console.log(`   Action: ${rule.action}`)
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit: number = 50): HealthMetric[] {
    const history = this.metrics.get(name) || []
    return history.slice(-limit)
  }

  /**
   * Get current metric value
   */
  getCurrentMetric(name: string): HealthMetric | null {
    const metrics = this.metrics.get(name)
    if (!metrics || metrics.length === 0) return null
    return metrics[metrics.length - 1]
  }

  /**
   * Get all current metrics
   */
  getAllCurrentMetrics(): HealthMetric[] {
    const current: HealthMetric[] = []

    for (const [, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        current.push(metrics[metrics.length - 1])
      }
    }

    return current
  }

  /**
   * Generate health report
   */
  generateHealthReport(): HealthReport {
    const metrics = this.getAllCurrentMetrics()
    const statuses = metrics.map((m) => m.status)

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (statuses.includes('critical')) overallStatus = 'critical'
    else if (statuses.includes('warning')) overallStatus = 'warning'

    const recommendations: string[] = []

    for (const metric of metrics) {
      if (metric.status === 'critical') {
        const rule = Array.from(this.alertRules.values()).find((r) => r.metric === metric.name)
        if (rule) {
          recommendations.push(`${metric.name}: ${rule.action}`)
        }
      }
    }

    return {
      timestamp: new Date(),
      overallStatus,
      metrics,
      recommendations
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): any[] {
    return Array.from(this.alerts.values()).filter((a) => !a.resolved)
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (!alert) return false

    alert.resolved = true
    console.log(`✅ Alert ${alertId} resolved`)

    return true
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): any[] {
    return Array.from(this.alerts.values()).slice(-limit)
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(): {
    improving: string[]
    declining: string[]
    stable: string[]
  } {
    const improving: string[] = []
    const declining: string[] = []
    const stable: string[] = []

    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length < 5) continue

      const recent = metrics.slice(-5).map((m) => m.value)
      const trend = recent[4] - recent[0]
      const changePercent = Math.abs(trend / recent[0])

      if (name.includes('error') || name.includes('response')) {
        if (trend < -changePercent * 100) improving.push(name)
        else if (trend > changePercent * 100) declining.push(name)
        else stable.push(name)
      } else {
        if (trend > changePercent * 100) improving.push(name)
        else if (trend < -changePercent * 100) declining.push(name)
        else stable.push(name)
      }
    }

    return { improving, declining, stable }
  }

  /**
   * Get system health percentage
   */
  getHealthPercentage(): number {
    const metrics = this.getAllCurrentMetrics()
    if (metrics.length === 0) return 0

    const healthyCount = metrics.filter((m) => m.status === 'healthy').length
    return Math.round((healthyCount / metrics.length) * 100)
  }
}
