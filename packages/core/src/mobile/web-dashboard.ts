import { EventEmitter } from 'events'

export interface DashboardWidget {
  id: string
  title: string
  type: 'chart' | 'metric' | 'table' | 'log' | 'status'
  data: unknown
  refreshRate: number
}

export interface DashboardLayout {
  id: string
  name: string
  widgets: DashboardWidget[]
  theme: 'light' | 'dark'
  autoRefresh: boolean
}

export class WebDashboard extends EventEmitter {
  private layouts: Map<string, DashboardLayout>
  private activeLayout: DashboardLayout | null
  private metrics: Map<string, unknown>

  constructor() {
    super()
    this.layouts = new Map()
    this.activeLayout = null
    this.metrics = new Map()
  }

  createLayout(name: string, theme: 'light' | 'dark' = 'dark'): DashboardLayout {
    const layout: DashboardLayout = {
      id: `layout-${Date.now()}`,
      name,
      widgets: [],
      theme,
      autoRefresh: true,
    }
    this.layouts.set(layout.id, layout)
    this.emit('layout:created', layout.id)
    return layout
  }

  addWidget(layoutId: string, widget: DashboardWidget): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    layout.widgets.push(widget)
    this.emit('widget:added', { layoutId, widgetId: widget.id })
  }

  removeWidget(layoutId: string, widgetId: string): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    layout.widgets = layout.widgets.filter((w) => w.id !== widgetId)
    this.emit('widget:removed', { layoutId, widgetId })
  }

  updateWidgetData(layoutId: string, widgetId: string, data: unknown): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    const widget = layout.widgets.find((w) => w.id === widgetId)
    if (!widget) throw new Error(`Widget not found: ${widgetId}`)

    widget.data = data
    this.emit('widget:updated', { layoutId, widgetId })
  }

  activateLayout(layoutId: string): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    this.activeLayout = layout
    this.emit('layout:activated', layoutId)
  }

  getActiveLayout(): DashboardLayout | null {
    return this.activeLayout
  }

  setTheme(layoutId: string, theme: 'light' | 'dark'): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    layout.theme = theme
    this.emit('theme:changed', { layoutId, theme })
  }

  toggleAutoRefresh(layoutId: string): void {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    layout.autoRefresh = !layout.autoRefresh
    this.emit('autorefresh:toggled', { layoutId, enabled: layout.autoRefresh })
  }

  recordMetric(key: string, value: unknown): void {
    this.metrics.set(key, value)
    this.emit('metric:recorded', { key, value })
  }

  getMetric(key: string): unknown {
    return this.metrics.get(key)
  }

  getAllMetrics(): Record<string, unknown> {
    const result: Record<string, unknown> = {}
    for (const [key, value] of this.metrics) {
      result[key] = value
    }
    return result
  }

  exportLayout(layoutId: string): string {
    const layout = this.layouts.get(layoutId)
    if (!layout) throw new Error(`Layout not found: ${layoutId}`)

    return JSON.stringify(layout, null, 2)
  }

  importLayout(json: string): DashboardLayout {
    const layout = JSON.parse(json) as DashboardLayout
    layout.id = `layout-${Date.now()}`
    this.layouts.set(layout.id, layout)
    this.emit('layout:imported', layout.id)
    return layout
  }
}

export class MetricsCollector extends EventEmitter {
  private dashboard: WebDashboard
  private history: Map<string, unknown[]>

  constructor(dashboard: WebDashboard) {
    super()
    this.dashboard = dashboard
    this.history = new Map()
  }

  recordMetric(key: string, value: number): void {
    this.dashboard.recordMetric(key, value)

    if (!this.history.has(key)) {
      this.history.set(key, [])
    }
    this.history.get(key)!.push(value)

    // Keep last 1000 entries
    const hist = this.history.get(key)!
    if (hist.length > 1000) {
      hist.shift()
    }

    this.emit('metric:recorded', { key, value })
  }

  getHistory(key: string, limit = 100): unknown[] {
    const hist = this.history.get(key) || []
    return hist.slice(Math.max(0, hist.length - limit))
  }

  getStatistics(key: string): Record<string, number> {
    const hist = (this.history.get(key) || []) as number[]
    if (hist.length === 0) return { count: 0 }

    const sorted = [...hist].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    return {
      count: hist.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / hist.length,
      median: sorted[Math.floor(sorted.length / 2)],
    }
  }

  clearHistory(key: string): void {
    this.history.delete(key)
    this.emit('history:cleared', key)
  }
}
