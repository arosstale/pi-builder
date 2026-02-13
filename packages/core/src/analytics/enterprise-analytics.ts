export interface AnalyticsEvent {
  id: string
  type: string
  userId?: string
  metadata: Record<string, any>
  timestamp: Date
}

export interface MetricSnapshot {
  name: string
  value: number
  unit: string
  timestamp: Date
}

export interface AnalyticsReport {
  period: string
  startDate: Date
  endDate: Date
  metrics: {
    userCount: number
    activeUsers: number
    totalTransactions: number
    totalRevenue: number
    conversionRate: number
    churnRate: number
    nps: number
  }
  trends: Record<string, number[]>
  topFeatures: string[]
}

export class EnterpriseAnalytics {
  private events: Map<string, AnalyticsEvent> = new Map()
  private metrics: Map<string, MetricSnapshot[]> = new Map()
  private customDimensions: Map<string, any> = new Map()

  constructor() {}

  /**
   * Track an event
   */
  trackEvent(type: string, userId?: string, metadata: Record<string, any> = {}): string {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const event: AnalyticsEvent = {
      id: eventId,
      type,
      userId,
      metadata,
      timestamp: new Date()
    }

    this.events.set(eventId, event)
    console.log(`📊 Analytics: Event ${type} tracked`)

    return eventId
  }

  /**
   * Track metric
   */
  trackMetric(name: string, value: number, unit: string = ''): void {
    const snapshot: MetricSnapshot = {
      name,
      value,
      unit,
      timestamp: new Date()
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    this.metrics.get(name)!.push(snapshot)
    console.log(`📈 Analytics: Metric ${name} = ${value}${unit}`)
  }

  /**
   * Set custom dimension
   */
  setDimension(key: string, value: any): void {
    this.customDimensions.set(key, value)
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string): AnalyticsEvent[] {
    return Array.from(this.events.values()).filter((e) => e.type === type)
  }

  /**
   * Get user events
   */
  getUserEvents(userId: string): AnalyticsEvent[] {
    return Array.from(this.events.values()).filter((e) => e.userId === userId)
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit: number = 100): MetricSnapshot[] {
    const snapshots = this.metrics.get(name) || []
    return snapshots.slice(-limit)
  }

  /**
   * Calculate conversion rate
   */
  calculateConversionRate(startEvent: string, endEvent: string): number {
    const starts = this.getEventsByType(startEvent).length
    const ends = this.getEventsByType(endEvent).length

    if (starts === 0) return 0
    return (ends / starts) * 100
  }

  /**
   * Calculate churn rate (users not active in last period)
   */
  calculateChurnRate(daysInactive: number = 30): number {
    const now = Date.now()
    const threshold = now - daysInactive * 24 * 60 * 60 * 1000

    const uniqueUsers = new Set(
      Array.from(this.events.values())
        .filter((e) => e.userId)
        .map((e) => e.userId)
    )

    const activeUsers = new Set(
      Array.from(this.events.values())
        .filter((e) => e.timestamp.getTime() > threshold && e.userId)
        .map((e) => e.userId)
    )

    if (uniqueUsers.size === 0) return 0
    return ((uniqueUsers.size - activeUsers.size) / uniqueUsers.size) * 100
  }

  /**
   * Calculate NPS (Net Promoter Score) from feedback events
   */
  calculateNPS(): number {
    const feedbackEvents = this.getEventsByType('feedback')
    if (feedbackEvents.length === 0) return 0

    const scores = feedbackEvents
      .map((e) => e.metadata.score)
      .filter((s) => typeof s === 'number')

    const promoters = scores.filter((s) => s >= 9).length
    const detractors = scores.filter((s) => s < 7).length

    return ((promoters - detractors) / scores.length) * 100
  }

  /**
   * Get active users count
   */
  getActiveUsersCount(timeWindowMinutes: number = 60): number {
    const now = Date.now()
    const threshold = now - timeWindowMinutes * 60 * 1000

    const activeUsers = new Set(
      Array.from(this.events.values())
        .filter((e) => e.timestamp.getTime() > threshold && e.userId)
        .map((e) => e.userId)
    )

    return activeUsers.size
  }

  /**
   * Get unique users count
   */
  getUniqueUsersCount(): number {
    const uniqueUsers = new Set(
      Array.from(this.events.values())
        .filter((e) => e.userId)
        .map((e) => e.userId)
    )

    return uniqueUsers.size
  }

  /**
   * Get top features by usage
   */
  getTopFeatures(limit: number = 10): string[] {
    const featureUsage = new Map<string, number>()

    for (const event of this.events.values()) {
      if (event.metadata.feature) {
        const count = featureUsage.get(event.metadata.feature) || 0
        featureUsage.set(event.metadata.feature, count + 1)
      }
    }

    return Array.from(featureUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map((e) => e[0])
  }

  /**
   * Generate comprehensive report
   */
  generateReport(startDate: Date, endDate: Date): AnalyticsReport {
    const periodEvents = Array.from(this.events.values()).filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate
    )

    const totalTransactions = this.getEventsByType('purchase').length
    const totalRevenue = this.metrics.get('revenue')?.[this.metrics.get('revenue')!.length - 1]?.value || 0

    return {
      period: `${startDate.toISOString()} to ${endDate.toISOString()}`,
      startDate,
      endDate,
      metrics: {
        userCount: this.getUniqueUsersCount(),
        activeUsers: this.getActiveUsersCount(),
        totalTransactions,
        totalRevenue,
        conversionRate: this.calculateConversionRate('page_view', 'purchase'),
        churnRate: this.calculateChurnRate(),
        nps: this.calculateNPS()
      },
      trends: {
        daily_revenue: this.getMetricHistory('daily_revenue', 30).map((m) => m.value),
        daily_users: this.getMetricHistory('daily_users', 30).map((m) => m.value),
        daily_transactions: this.getMetricHistory('daily_transactions', 30).map((m) => m.value)
      },
      topFeatures: this.getTopFeatures()
    }
  }

  /**
   * Get cohort analysis
   */
  getCohortAnalysis(cohortSize: number = 100): Map<string, number> {
    const cohorts = new Map<string, number>()
    let currentCohort = 0
    let count = 0

    const sortedUsers = Array.from(
      new Set(
        Array.from(this.events.values())
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          .filter((e) => e.userId)
          .map((e) => e.userId)
      )
    )

    for (const userId of sortedUsers) {
      const cohortId = `cohort-${currentCohort}`
      cohorts.set(cohortId, (cohorts.get(cohortId) || 0) + 1)

      count++
      if (count >= cohortSize) {
        count = 0
        currentCohort++
      }
    }

    return cohorts
  }

  /**
   * Clear old data
   */
  clearOldData(daysOld: number): number {
    const threshold = Date.now() - daysOld * 24 * 60 * 60 * 1000
    let cleared = 0

    for (const [key, event] of this.events.entries()) {
      if (event.timestamp.getTime() < threshold) {
        this.events.delete(key)
        cleared++
      }
    }

    return cleared
  }
}
