/**
 * Request Logger - Distributed Request Tracing & Analytics
 *
 * Features:
 * - Request ID tracking (for correlation)
 * - Distributed tracing support
 * - Performance analytics
 * - Historical reporting
 * - Structured logging
 */

/**
 * Request context
 */
export interface RequestContext {
  requestId: string
  timestamp: Date
  provider: string
  model: string
  userId?: string
  sessionId?: string
  parentRequestId?: string
  metadata?: Record<string, any>
}

/**
 * Request result
 */
export interface RequestResult {
  requestId: string
  context: RequestContext
  startTime: Date
  endTime: Date
  duration: number
  success: boolean
  tokens: {
    input: number
    output: number
    total: number
  }
  cost: number
  cacheHit: boolean
  error?: string
  errorType?: string
  retries: number
  lastRetryTime?: Date
}

/**
 * Request trace (for distributed tracing)
 */
export interface RequestTrace {
  traceId: string
  spans: Array<{
    spanId: string
    parentSpanId?: string
    name: string
    startTime: Date
    endTime: Date
    duration: number
    tags: Record<string, any>
    logs: Array<{ timestamp: Date; message: string }>
  }>
}

/**
 * Analytics aggregation
 */
export interface RequestAnalytics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  averageDuration: number
  p95Duration: number
  p99Duration: number
  totalTokens: number
  totalCost: number
  averageCostPerRequest: number
  cacheHitRate: number
  averageRetries: number
  byProvider: Record<string, RequestAnalytics>
  byModel: Record<string, RequestAnalytics>
  errors: Array<{ type: string; count: number }>
}

/**
 * Request Logger - Comprehensive request logging and tracing
 */
export class RequestLogger {
  private requests: Map<string, RequestResult> = new Map()
  private traces: Map<string, RequestTrace> = new Map()
  private maxRequests: number = 100000
  private analytics: Map<string, RequestAnalytics> = new Map()

  /**
   * Create a new request context
   */
  createContext(provider: string, model: string, userId?: string, sessionId?: string): RequestContext {
    return {
      requestId: this.generateRequestId(),
      timestamp: new Date(),
      provider,
      model,
      userId,
      sessionId,
      metadata: {},
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log request start
   */
  logRequestStart(context: RequestContext): string {
    const requestId = context.requestId
    console.log(`📤 [${requestId}] Starting request to ${context.provider}/${context.model}`)
    return requestId
  }

  /**
   * Log request completion
   */
  logRequestComplete(
    context: RequestContext,
    duration: number,
    success: boolean,
    tokens: { input: number; output: number },
    cost: number,
    cacheHit: boolean,
    error?: string
  ): RequestResult {
    const result: RequestResult = {
      requestId: context.requestId,
      context,
      startTime: context.timestamp,
      endTime: new Date(),
      duration,
      success,
      tokens: {
        input: tokens.input,
        output: tokens.output,
        total: tokens.input + tokens.output,
      },
      cost,
      cacheHit,
      error,
      retries: 0,
    }

    this.requests.set(context.requestId, result)
    this.maintainMaxSize()

    if (success) {
      console.log(
        `✅ [${context.requestId}] Complete (${duration}ms, ${result.tokens.total} tokens, $${cost.toFixed(4)})${cacheHit ? ' [CACHED]' : ''}`
      )
    } else {
      console.error(`❌ [${context.requestId}] Failed: ${error}`)
    }

    return result
  }

  /**
   * Log retry attempt
   */
  logRetry(requestId: string, attempt: number, reason: string): void {
    const result = this.requests.get(requestId)
    if (result) {
      result.retries = attempt
      result.lastRetryTime = new Date()
    }
    console.warn(`🔄 [${requestId}] Retry ${attempt}: ${reason}`)
  }

  /**
   * Create a trace span
   */
  createSpan(traceId: string, spanId: string, name: string, parentSpanId?: string): {
    startTime: Date
    end: (tags?: Record<string, any>) => void
  } {
    const startTime = new Date()
    const logs: Array<{ timestamp: Date; message: string }> = []

    const trace = this.traces.get(traceId) || { traceId, spans: [] }

    const end = (tags: Record<string, any> = {}) => {
      const endTime = new Date()
      trace.spans.push({
        spanId,
        parentSpanId,
        name,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        tags,
        logs,
      })
      this.traces.set(traceId, trace)
    }

    return { startTime, end }
  }

  /**
   * Add log to span
   */
  addSpanLog(traceId: string, spanId: string, message: string): void {
    const trace = this.traces.get(traceId)
    if (trace) {
      const span = trace.spans.find((s) => s.spanId === spanId)
      if (span) {
        span.logs.push({ timestamp: new Date(), message })
      }
    }
  }

  /**
   * Get request result
   */
  getRequest(requestId: string): RequestResult | undefined {
    return this.requests.get(requestId)
  }

  /**
   * Get all requests
   */
  getAllRequests(): RequestResult[] {
    return Array.from(this.requests.values())
  }

  /**
   * Get requests for time period
   */
  getRequestsByPeriod(startTime: Date, endTime: Date): RequestResult[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.startTime >= startTime && r.endTime <= endTime
    )
  }

  /**
   * Get requests by provider
   */
  getRequestsByProvider(provider: string): RequestResult[] {
    return Array.from(this.requests.values()).filter((r) => r.context.provider === provider)
  }

  /**
   * Get requests by user
   */
  getRequestsByUser(userId: string): RequestResult[] {
    return Array.from(this.requests.values()).filter((r) => r.context.userId === userId)
  }

  /**
   * Get analytics
   */
  getAnalytics(requests: RequestResult[] = this.getAllRequests()): RequestAnalytics {
    const successful = requests.filter((r) => r.success).length
    const failed = requests.length - successful
    const durations = requests.filter((r) => r.duration > 0).map((r) => r.duration).sort((a, b) => a - b)

    const analytics: RequestAnalytics = {
      totalRequests: requests.length,
      successfulRequests: successful,
      failedRequests: failed,
      successRate: requests.length > 0 ? successful / requests.length : 0,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : 0,
      p95Duration: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
      p99Duration: durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0,
      totalTokens: requests.reduce((sum, r) => sum + r.tokens.total, 0),
      totalCost: requests.reduce((sum, r) => sum + r.cost, 0),
      averageCostPerRequest: requests.length > 0 ? requests.reduce((sum, r) => sum + r.cost, 0) / requests.length : 0,
      cacheHitRate: requests.length > 0 ? requests.filter((r) => r.cacheHit).length / requests.length : 0,
      averageRetries: requests.length > 0 ? requests.reduce((sum, r) => sum + r.retries, 0) / requests.length : 0,
      byProvider: {},
      byModel: {},
      errors: [],
    }

    // By provider
    const providers = new Set(requests.map((r) => r.context.provider))
    for (const provider of providers) {
      const providerRequests = requests.filter((r) => r.context.provider === provider)
      analytics.byProvider[provider] = this.getAnalytics(providerRequests)
    }

    // By model
    const models = new Set(requests.map((r) => r.context.model))
    for (const model of models) {
      const modelRequests = requests.filter((r) => r.context.model === model)
      analytics.byModel[model] = this.getAnalytics(modelRequests)
    }

    // Errors
    const errorMap = new Map<string, number>()
    for (const request of requests) {
      if (request.error && request.errorType) {
        errorMap.set(request.errorType, (errorMap.get(request.errorType) || 0) + 1)
      }
    }
    analytics.errors = Array.from(errorMap.entries()).map(([type, count]) => ({ type, count }))

    return analytics
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): RequestTrace | undefined {
    return this.traces.get(traceId)
  }

  /**
   * Get all traces
   */
  getAllTraces(): RequestTrace[] {
    return Array.from(this.traces.values())
  }

  /**
   * Generate performance report
   */
  generateReport(title: string = 'Request Performance Report'): string {
    const analytics = this.getAnalytics()

    const report = `
╔════════════════════════════════════════════════════════════════╗
║ ${title.padEnd(62)} ║
╚════════════════════════════════════════════════════════════════╝

OVERALL STATISTICS:
├─ Total Requests: ${analytics.totalRequests}
├─ Successful: ${analytics.successfulRequests} (${(analytics.successRate * 100).toFixed(1)}%)
├─ Failed: ${analytics.failedRequests}
└─ Total Cost: $${analytics.totalCost.toFixed(4)}

PERFORMANCE METRICS:
├─ Average Duration: ${analytics.averageDuration.toFixed(0)}ms
├─ P95 Duration: ${analytics.p95Duration.toFixed(0)}ms
├─ P99 Duration: ${analytics.p99Duration.toFixed(0)}ms
├─ Average Tokens/Request: ${(analytics.totalTokens / analytics.totalRequests).toFixed(0)}
├─ Cache Hit Rate: ${(analytics.cacheHitRate * 100).toFixed(1)}%
└─ Average Retries: ${analytics.averageRetries.toFixed(2)}

BY PROVIDER:
${Object.entries(analytics.byProvider)
  .map(
    ([provider, stats]) =>
      `├─ ${provider}: ${stats.totalRequests} requests, ${(stats.successRate * 100).toFixed(1)}% success, $${stats.totalCost.toFixed(4)}`
  )
  .join('\n')}

BY MODEL:
${Object.entries(analytics.byModel)
  .map(
    ([model, stats]) =>
      `├─ ${model}: ${stats.totalRequests} requests, ${stats.averageDuration.toFixed(0)}ms avg`
  )
  .join('\n')}

TOP ERRORS:
${analytics.errors
  .slice(0, 5)
  .map(({ type, count }) => `├─ ${type}: ${count} occurrences`)
  .join('\n')}
`

    return report
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): {
    requests: RequestResult[]
    traces: RequestTrace[]
    analytics: RequestAnalytics
  } {
    return {
      requests: this.getAllRequests(),
      traces: this.getAllTraces(),
      analytics: this.getAnalytics(),
    }
  }

  /**
   * Maintain max size
   */
  private maintainMaxSize(): void {
    if (this.requests.size > this.maxRequests) {
      const entriesToDelete = this.requests.size - this.maxRequests
      const entries = Array.from(this.requests.entries())
        .sort((a, b) => a[1].startTime.getTime() - b[1].startTime.getTime())
        .slice(0, entriesToDelete)

      for (const [key] of entries) {
        this.requests.delete(key)
      }
    }
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.requests.clear()
    this.traces.clear()
    this.analytics.clear()
  }
}

/**
 * Global request logger instance
 */
export const requestLogger = new RequestLogger()
