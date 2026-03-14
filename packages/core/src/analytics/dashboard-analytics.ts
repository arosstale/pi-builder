export interface DashboardWidget {
  id: string
  title: string
  type: 'chart' | 'metric' | 'table' | 'gauge'
  data: any
  refreshInterval: number // milliseconds
  position: { x: number; y: number; width: number; height: number }
}

export interface Dashboard {
  id: string
  name: string
  description: string
  widgets: DashboardWidget[]
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
}

export interface MetricCard {
  label: string
  value: number | string
  unit: string
  change: number // percentage
  trend: 'up' | 'down' | 'stable'
  color: 'green' | 'red' | 'blue' | 'yellow'
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color: string
  }[]
}

export class DashboardAnalytics {
  private dashboards: Map<string, Dashboard> = new Map()
  private analyticsData: Map<string, any> = new Map()

  constructor() {
    this.initializeDefaultDashboards()
  }

  private initializeDefaultDashboards(): void {
    // Executive Dashboard
    this.dashboards.set('executive', {
      id: 'executive',
      name: 'Executive Dashboard',
      description: 'High-level business metrics',
      widgets: [
        {
          id: 'mrr-card',
          title: 'Monthly Recurring Revenue',
          type: 'metric',
          data: { value: 125000, unit: 'USD' },
          refreshInterval: 3600000,
          position: { x: 0, y: 0, width: 3, height: 1 }
        },
        {
          id: 'active-users-card',
          title: 'Active Users',
          type: 'metric',
          data: { value: 2543, unit: 'users' },
          refreshInterval: 300000,
          position: { x: 3, y: 0, width: 3, height: 1 }
        },
        {
          id: 'conversion-chart',
          title: 'Conversion Rate Trend',
          type: 'chart',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{ label: 'Conversion %', data: [3.2, 3.5, 3.8, 4.1], color: 'green' }]
          },
          refreshInterval: 3600000,
          position: { x: 0, y: 1, width: 6, height: 2 }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false
    })

    // Operations Dashboard
    this.dashboards.set('operations', {
      id: 'operations',
      name: 'Operations Dashboard',
      description: 'System health and performance',
      widgets: [
        {
          id: 'uptime-gauge',
          title: 'System Uptime',
          type: 'gauge',
          data: { value: 99.95, max: 100 },
          refreshInterval: 60000,
          position: { x: 0, y: 0, width: 2, height: 2 }
        },
        {
          id: 'response-time-chart',
          title: 'API Response Time',
          type: 'chart',
          data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [
              {
                label: 'Avg Response (ms)',
                data: [120, 115, 140, 125, 130, 118],
                color: 'blue'
              }
            ]
          },
          refreshInterval: 300000,
          position: { x: 2, y: 0, width: 4, height: 2 }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false
    })

    // Sales Dashboard
    this.dashboards.set('sales', {
      id: 'sales',
      name: 'Sales Dashboard',
      description: 'Sales metrics and pipeline',
      widgets: [
        {
          id: 'monthly-sales-card',
          title: 'Monthly Sales',
          type: 'metric',
          data: { value: 450000, unit: 'USD' },
          refreshInterval: 3600000,
          position: { x: 0, y: 0, width: 3, height: 1 }
        },
        {
          id: 'pipeline-card',
          title: 'Sales Pipeline',
          type: 'metric',
          data: { value: 1200000, unit: 'USD' },
          refreshInterval: 3600000,
          position: { x: 3, y: 0, width: 3, height: 1 }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false
    })
  }

  /**
   * Get dashboard
   */
  getDashboard(dashboardId: string): Dashboard | null {
    return this.dashboards.get(dashboardId) || null
  }

  /**
   * Get all dashboards
   */
  getAllDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values())
  }

  /**
   * Create custom dashboard
   */
  createDashboard(name: string, description: string): Dashboard {
    const dashboardId = `dashboard-${Date.now()}`
    const dashboard: Dashboard = {
      id: dashboardId,
      name,
      description,
      widgets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: false
    }

    this.dashboards.set(dashboardId, dashboard)
    console.log(`📊 Created dashboard: ${dashboardId}`)

    return dashboard
  }

  /**
   * Add widget to dashboard
   */
  addWidget(dashboardId: string, widget: Omit<DashboardWidget, 'id'>): boolean {
    const dashboard = this.dashboards.get(dashboardId)
    if (!dashboard) return false

    const widgetId = `widget-${Date.now()}`
    const newWidget: DashboardWidget = { id: widgetId, ...widget }

    dashboard.widgets.push(newWidget)
    dashboard.updatedAt = new Date()

    console.log(`📌 Added widget ${widgetId} to dashboard ${dashboardId}`)
    return true
  }

  /**
   * Remove widget from dashboard
   */
  removeWidget(dashboardId: string, widgetId: string): boolean {
    const dashboard = this.dashboards.get(dashboardId)
    if (!dashboard) return false

    dashboard.widgets = dashboard.widgets.filter((w) => w.id !== widgetId)
    dashboard.updatedAt = new Date()

    return true
  }

  /**
   * Update widget data
   */
  updateWidgetData(dashboardId: string, widgetId: string, data: any): boolean {
    const dashboard = this.dashboards.get(dashboardId)
    if (!dashboard) return false

    const widget = dashboard.widgets.find((w) => w.id === widgetId)
    if (!widget) return false

    widget.data = data
    dashboard.updatedAt = new Date()

    return true
  }

  /**
   * Get key metrics
   */
  getKeyMetrics(): MetricCard[] {
    return [
      {
        label: 'Revenue',
        value: 575000,
        unit: 'USD',
        change: 12.5,
        trend: 'up',
        color: 'green'
      },
      {
        label: 'Active Users',
        value: 2543,
        unit: 'users',
        change: 8.3,
        trend: 'up',
        color: 'green'
      },
      {
        label: 'Churn Rate',
        value: 2.1,
        unit: '%',
        change: -0.5,
        trend: 'down',
        color: 'green'
      },
      {
        label: 'System Uptime',
        value: 99.95,
        unit: '%',
        change: 0.02,
        trend: 'stable',
        color: 'blue'
      }
    ]
  }

  /**
   * Get revenue trend
   */
  getRevenueTrend(days: number = 30): ChartData {
    const labels: string[] = []
    const data: number[] = []

    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - i))
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`)

      // Simulate revenue data
      const baseRevenue = 15000
      const variance = Math.random() * 5000 - 2500
      data.push(baseRevenue + variance)
    }

    return {
      labels,
      datasets: [{ label: 'Daily Revenue', data, color: 'green' }]
    }
  }

  /**
   * Get user acquisition trend
   */
  getUserAcquisitionTrend(days: number = 30): ChartData {
    const labels: string[] = []
    const signups: number[] = []
    const deletions: number[] = []

    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (days - i))
      labels.push(`${date.getMonth() + 1}/${date.getDate()}`)

      signups.push(Math.floor(Math.random() * 50 + 30))
      deletions.push(Math.floor(Math.random() * 10 + 2))
    }

    return {
      labels,
      datasets: [
        { label: 'Signups', data: signups, color: 'green' },
        { label: 'Deletions', data: deletions, color: 'red' }
      ]
    }
  }

  /**
   * Get feature usage
   */
  getFeatureUsage(): ChartData {
    return {
      labels: ['Code Generation', 'Code Review', 'Testing', 'Deployment', 'Analytics'],
      datasets: [
        {
          label: 'Usage %',
          data: [35, 25, 20, 12, 8],
          color: 'blue'
        }
      ]
    }
  }

  /**
   * Get subscription breakdown
   */
  getSubscriptionBreakdown(): ChartData {
    return {
      labels: ['Starter', 'Professional', 'Enterprise'],
      datasets: [
        {
          label: 'Subscribers',
          data: [1200, 800, 150],
          color: 'blue'
        }
      ]
    }
  }

  /**
   * Export dashboard as PDF (mock)
   */
  exportDashboard(dashboardId: string): { filename: string; data: string } {
    const dashboard = this.dashboards.get(dashboardId)
    if (!dashboard) {
      return { filename: '', data: '' }
    }

    const filename = `${dashboard.name}-${new Date().toISOString().split('T')[0]}.pdf`
    const data = `Dashboard: ${dashboard.name}\nWidgets: ${dashboard.widgets.length}\nGenerated: ${new Date()}`

    console.log(`📄 Exported dashboard: ${filename}`)
    return { filename, data }
  }

  /**
   * Share dashboard
   */
  shareDashboard(dashboardId: string, makePublic: boolean = true): string {
    const dashboard = this.dashboards.get(dashboardId)
    if (!dashboard) return ''

    dashboard.isPublic = makePublic
    const shareUrl = `https://example.com/dashboards/${dashboardId}`

    console.log(`🔗 Dashboard shared: ${shareUrl}`)
    return shareUrl
  }

  /**
   * Get dashboard statistics
   */
  getDashboardStats(): { totalDashboards: number; totalWidgets: number; publicDashboards: number } {
    const dashboards = Array.from(this.dashboards.values())
    const totalDashboards = dashboards.length
    const totalWidgets = dashboards.reduce((sum, d) => sum + d.widgets.length, 0)
    const publicDashboards = dashboards.filter((d) => d.isPublic).length

    return { totalDashboards, totalWidgets, publicDashboards }
  }
}
