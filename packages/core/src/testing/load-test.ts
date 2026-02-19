/**
 * Load Testing Framework - Test system under stress
 *
 * Scenarios:
 * - Constant load (100, 500, 1000 RPS)
 * - Ramp-up load (gradual increase)
 * - Spike load (sudden spike)
 * - Soak test (sustained load over time)
 */

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  name: string
  duration: number // milliseconds
  rps: number // requests per second
  rampUp?: {
    enabled: boolean
    duration: number // milliseconds
  }
  spike?: {
    enabled: boolean
    multiplier: number // e.g., 3x normal RPS
    duration: number // milliseconds
  }
}

/**
 * Load test result
 */
export interface LoadTestResult {
  config: LoadTestConfig
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
  minLatency: number
  maxLatency: number
  avgLatency: number
  p95Latency: number
  p99Latency: number
  throughput: number // actual RPS
  errors: Map<string, number>
  peakMemory: number // MB
  startTime: Date
  endTime: Date
  totalTime: number
}

/**
 * Load Test Runner
 */
export class LoadTestRunner {
  private results: LoadTestResult[] = []

  /**
   * Run load test
   */
  async runLoadTest(
    config: LoadTestConfig,
    operation: () => Promise<any>
  ): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${config.name}`)

    const startTime = new Date()
    const latencies: number[] = []
    let successfulRequests = 0
    let failedRequests = 0
    const errors = new Map<string, number>()

    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024
    let peakMemory = startMemory

    const endTime = Date.now() + config.duration
    let requestCount = 0
    let currentRPS = config.rps

    while (Date.now() < endTime) {
      const cycleStart = Date.now()

      // Ramp-up logic
      if (config.rampUp?.enabled && config.rampUp.duration > 0) {
        const elapsed = cycleStart - startTime.getTime()
        const rampProgress = Math.min(1, elapsed / config.rampUp.duration)
        currentRPS = config.rps * rampProgress
      }

      // Spike logic
      if (config.spike?.enabled && config.spike.duration > 0) {
        const cycleElapsed = cycleStart - startTime.getTime()
        if (cycleElapsed % (config.spike.duration * 2) < config.spike.duration) {
          currentRPS = config.rps * config.spike.multiplier
        }
      }

      // Calculate requests for this cycle
      const requestsThisCycle = Math.max(2, Math.ceil(currentRPS / 10)) // min 2 per cycle

      // Execute requests
      const promises: Promise<void>[] = []

      for (let i = 0; i < requestsThisCycle; i++) {
        promises.push(
          (async () => {
            try {
              const opStart = Date.now()
              await operation()
              const opEnd = Date.now()
              latencies.push(opEnd - opStart)
              successfulRequests++
            } catch (error) {
              failedRequests++
              const errorType = error instanceof Error ? error.constructor.name : 'Unknown'
              errors.set(errorType, (errors.get(errorType) || 0) + 1)
            }
          })()
        )
      }

      await Promise.all(promises)
      requestCount += requestsThisCycle

      // Update peak memory
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024
      peakMemory = Math.max(peakMemory, currentMemory)

      // Sleep to maintain RPS (minimum 10ms sleep to avoid busy-loop)
      const cycleElapsed = Date.now() - cycleStart
      const cycleTarget = 10 // 10ms per cycle = 100 cycles/sec
      const sleepMs = Math.max(1, cycleTarget - cycleElapsed)
      await new Promise((resolve) => setTimeout(resolve, sleepMs))

      // Log progress
      const progress = Math.round(((Date.now() - startTime.getTime()) / config.duration) * 100)
      if (progress % 10 === 0) {
        console.log(`  Progress: ${progress}% (${successfulRequests} successful)`)
      }
    }

    const endDate = new Date()
    const totalTime = endDate.getTime() - startTime.getTime()

    // Sort latencies for percentile calculation
    latencies.sort((a, b) => a - b)

    const result: LoadTestResult = {
      config,
      totalRequests: requestCount,
      successfulRequests,
      failedRequests,
      successRate: requestCount > 0 ? successfulRequests / requestCount : 0,
      minLatency: latencies.length > 0 ? latencies[0] : 0,
      maxLatency: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
      avgLatency:
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p95Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0,
      p99Latency: latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0,
      throughput: (requestCount / totalTime) * 1000,
      errors,
      peakMemory,
      startTime,
      endTime: endDate,
      totalTime,
    }

    this.results.push(result)
    console.log(`✅ Load test complete: ${result.successfulRequests}/${result.totalRequests} successful`)

    return result
  }

  /**
   * Get all results
   */
  getAllResults(): LoadTestResult[] {
    return [...this.results]
  }

  /**
   * Generate load test report
   */
  generateReport(): string {
    const report = `
╔════════════════════════════════════════════════════════════════╗
║ Load Test Report                                               ║
╚════════════════════════════════════════════════════════════════╝

${this.results
  .map(
    (r) => `
Test: ${r.config.name}
├─ Duration: ${r.totalTime}ms
├─ Requests: ${r.totalRequests} (${r.successfulRequests} successful, ${r.failedRequests} failed)
├─ Success Rate: ${(r.successRate * 100).toFixed(1)}%
├─ Throughput: ${r.throughput.toFixed(2)} RPS
├─ Latency:
│  ├─ Min: ${r.minLatency}ms
│  ├─ Max: ${r.maxLatency}ms
│  ├─ Avg: ${r.avgLatency.toFixed(2)}ms
│  ├─ P95: ${r.p95Latency.toFixed(2)}ms
│  └─ P99: ${r.p99Latency.toFixed(2)}ms
├─ Peak Memory: ${r.peakMemory.toFixed(2)}MB
└─ Errors: ${Array.from(r.errors.entries())
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ') || 'None'}
`
  )
  .join('\n')}
`

    return report
  }

  /**
   * Export results as JSON
   */
  export(): Record<string, LoadTestResult> {
    const result: Record<string, LoadTestResult> = {}
    for (let i = 0; i < this.results.length; i++) {
      result[`test-${i}`] = this.results[i]
    }
    return result
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = []
  }
}

/**
 * Global load test runner
 */
export const loadTestRunner = new LoadTestRunner()
