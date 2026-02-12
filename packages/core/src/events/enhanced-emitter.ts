/**
 * Enhanced Event Emitter - Building on Auto Maker's EventEmitter with Metrics
 *
 * Adds:
 * - Cost tracking per event
 * - Token counting
 * - Latency measurement
 * - Structured event metadata
 */

import { EventEmitter } from 'events'

/**
 * Event metadata for tracking
 */
export interface EventMetadata {
  eventId: string
  timestamp: Date
  provider: string
  model: string
  userId?: string
  sessionId?: string
  requestId?: string
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
}

/**
 * Cost information
 */
export interface CostData {
  inputCost: number
  outputCost: number
  cacheCost?: number
  totalCost: number
  currency: string
}

/**
 * Event with metrics
 */
export interface MetricsEvent {
  type: string
  timestamp: Date
  duration?: number
  provider: string
  model: string
  success: boolean
  errorType?: string
  tokens?: TokenUsage
  cost?: CostData
  cacheHit?: boolean
  metadata?: Record<string, any>
}

/**
 * Enhanced event emitter with metrics tracking
 */
export class EnhancedEventEmitter extends EventEmitter {
  private eventHistory: MetricsEvent[] = []
  private maxHistorySize: number = 10000
  private metricsRecorders: Map<string, (event: MetricsEvent) => void> = new Map()

  constructor(maxHistorySize: number = 10000) {
    super()
    this.maxHistorySize = maxHistorySize
  }

  /**
   * Emit event with automatic timestamp
   */
  emit(eventName: string, ...args: any[]): boolean {
    // Call parent emit
    return super.emit(eventName, ...args)
  }

  /**
   * Emit event with metadata
   */
  emitWithMetadata(eventName: string, data: any, metadata: EventMetadata): boolean {
    const eventWithMetadata = {
      ...data,
      _metadata: metadata,
    }
    return this.emit(eventName, eventWithMetadata)
  }

  /**
   * Emit event with cost information
   */
  emitWithCost(
    eventName: string,
    data: any,
    tokens: TokenUsage,
    cost: CostData,
    metadata?: EventMetadata
  ): boolean {
    const enrichedData = {
      ...data,
      tokens,
      cost,
      _metadata: metadata,
    }
    this.recordMetric({
      type: eventName,
      timestamp: new Date(),
      provider: metadata?.provider || 'unknown',
      model: metadata?.model || 'unknown',
      success: true,
      tokens,
      cost,
    })
    return this.emit(eventName, enrichedData)
  }

  /**
   * On with metrics recording
   */
  onWithMetrics(
    eventName: string,
    handler: (data: any) => void,
    recordMetrics: boolean = true
  ): this {
    const wrappedHandler = (data: any) => {
      const startTime = Date.now()
      try {
        handler(data)
        if (recordMetrics && data?.tokens && data?.cost) {
          this.recordMetric({
            type: eventName,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            provider: data._metadata?.provider || 'unknown',
            model: data._metadata?.model || 'unknown',
            success: true,
            tokens: data.tokens,
            cost: data.cost,
            metadata: data._metadata,
          })
        }
      } catch (error) {
        this.recordMetric({
          type: eventName,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          provider: data._metadata?.provider || 'unknown',
          model: data._metadata?.model || 'unknown',
          success: false,
          errorType: error instanceof Error ? error.name : 'Unknown',
          metadata: data._metadata,
        })
        throw error
      }
    }
    return this.on(eventName, wrappedHandler)
  }

  /**
   * Record a metric event
   */
  recordMetric(event: MetricsEvent): void {
    this.eventHistory.push(event)

    // Keep history within size limit
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize)
    }

    // Notify registered recorders
    for (const recorder of this.metricsRecorders.values()) {
      try {
        recorder(event)
      } catch (error) {
        console.error('Error in metrics recorder:', error)
      }
    }
  }

  /**
   * Register a metrics recorder (e.g., for sending to analytics)
   */
  registerMetricsRecorder(
    id: string,
    recorder: (event: MetricsEvent) => void | Promise<void>
  ): void {
    this.metricsRecorders.set(id, recorder)
  }

  /**
   * Unregister a metrics recorder
   */
  unregisterMetricsRecorder(id: string): void {
    this.metricsRecorders.delete(id)
  }

  /**
   * Get event history
   */
  getEventHistory(count?: number): MetricsEvent[] {
    if (count) {
      return this.eventHistory.slice(-count)
    }
    return [...this.eventHistory]
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(eventName?: string): {
    totalEvents: number
    successRate: number
    totalCost: number
    totalTokens: number
    averageLatency: number
    providers: Record<string, number>
  } {
    let events = this.eventHistory
    if (eventName) {
      events = events.filter((e) => e.type === eventName)
    }

    const totalEvents = events.length
    const successCount = events.filter((e) => e.success).length
    const successRate = totalEvents > 0 ? successCount / totalEvents : 0

    const totalCost = events.reduce((sum, e) => sum + (e.cost?.totalCost || 0), 0)
    const totalTokens = events.reduce((sum, e) => sum + (e.tokens?.totalTokens || 0), 0)

    const latencies = events.filter((e) => e.duration).map((e) => e.duration!)
    const averageLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b) / latencies.length : 0

    const providers: Record<string, number> = {}
    events.forEach((e) => {
      providers[e.provider] = (providers[e.provider] || 0) + 1
    })

    return {
      totalEvents,
      successRate,
      totalCost,
      totalTokens,
      averageLatency,
      providers,
    }
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = []
  }

  /**
   * Export history as JSON
   */
  exportHistory(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.eventHistory, null, 2)
    }

    // CSV format
    const headers = [
      'timestamp',
      'type',
      'provider',
      'model',
      'success',
      'duration',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'cost',
    ]
    const rows = this.eventHistory.map((e) => [
      e.timestamp.toISOString(),
      e.type,
      e.provider,
      e.model,
      e.success ? 'yes' : 'no',
      e.duration || '',
      e.tokens?.inputTokens || '',
      e.tokens?.outputTokens || '',
      e.tokens?.totalTokens || '',
      e.cost?.totalCost || '',
    ])

    return [headers, ...rows].map((row) => row.join(',')).join('\n')
  }
}

/**
 * Global event emitter instance
 */
export const eventEmitter = new EnhancedEventEmitter()

/**
 * Create a new event emitter for a session
 */
export function createSessionEmitter(sessionId: string): EnhancedEventEmitter {
  const emitter = new EnhancedEventEmitter()
  // Store sessionId for context
  ;(emitter as any).sessionId = sessionId
  return emitter
}
