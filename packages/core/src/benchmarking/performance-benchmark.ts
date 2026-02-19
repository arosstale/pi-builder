/**
 * Performance Benchmark - Compare Pi Builder vs Auto Maker
 *
 * Metrics:
 * - Latency (p50, p95, p99)
 * - Throughput (RPS)
 * - Memory usage
 * - Cost efficiency
 */

/**
 * Benchmark result for a single operation
 */
export interface BenchmarkResult {
  operationName: string
  iterations: number
  totalTime: number
  minTime: number
  maxTime: number
  avgTime: number
  p50Time: number
  p95Time: number
  p99Time: number
  throughput: number // operations per second
  memoryUsed: number // MB
  success: number
  failed: number
  successRate: number
}

/**
 * Comparison result between two implementations
 */
export interface ComparisonResult {
  operation: string
  autoMakerResult: BenchmarkResult
  piBuilderResult: BenchmarkResult
  latencyImprovement: number // percentage (positive = better)
  throughputImprovement: number // percentage (positive = better)
  memoryImprovement: number // percentage (positive = better)
  costImprovement: number // percentage (positive = better)
  winner: 'auto-maker' | 'pi-builder' | 'tie'
}

/**
 * Performance Benchmark Suite
 */
export class PerformanceBenchmark {
  private results: Map<string, BenchmarkResult> = new Map()

  /**
   * Run a benchmark operation
   */
  async runBenchmark(
    operationName: string,
    operation: () => Promise<any>,
    iterations: number = 1000
  ): Promise<BenchmarkResult> {
    const times: number[] = []
    let success = 0
    let failed = 0

    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024

    const startTime = Date.now()

    for (let i = 0; i < iterations; i++) {
      try {
        const opStart = Date.now()
        await operation()
        const opEnd = Date.now()
        times.push(opEnd - opStart)
        success++
      } catch (error) {
        failed++
      }
    }

    const endTime = Date.now()
    const endMemory = process.memoryUsage().heapUsed / 1024 / 1024
    const totalTime = endTime - startTime
    const memoryUsed = endMemory - startMemory

    // Sort times for percentile calculation
    times.sort((a, b) => a - b)

    const result: BenchmarkResult = {
      operationName,
      iterations,
      totalTime,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      p50Time: times[Math.floor(times.length * 0.5)],
      p95Time: times[Math.floor(times.length * 0.95)],
      p99Time: times[Math.floor(times.length * 0.99)],
      throughput: totalTime > 0 ? Math.min(99999, (iterations / totalTime) * 1000) : 99999, // ops/sec capped at reasonable max
      memoryUsed: Math.max(0, memoryUsed),
      success,
      failed,
      successRate: success / iterations,
    }

    this.results.set(operationName, result)
    return result
  }

  /**
   * Get benchmark result
   */
  getResult(operationName: string): BenchmarkResult | undefined {
    return this.results.get(operationName)
  }

  /**
   * Get all results
   */
  getAllResults(): BenchmarkResult[] {
    return Array.from(this.results.values())
  }

  /**
   * Compare two benchmark results
   */
  compare(
    operation: string,
    autoMakerResult: BenchmarkResult,
    piBuilderResult: BenchmarkResult
  ): ComparisonResult {
    // Latency improvement (lower is better, so negative is improvement)
    const latencyImprovement =
      ((autoMakerResult.p95Time - piBuilderResult.p95Time) / autoMakerResult.p95Time) * 100

    // Throughput improvement (higher is better)
    const throughputImprovement =
      ((piBuilderResult.throughput - autoMakerResult.throughput) / autoMakerResult.throughput) * 100

    // Memory improvement (lower is better)
    const memoryImprovement =
      ((autoMakerResult.memoryUsed - piBuilderResult.memoryUsed) / autoMakerResult.memoryUsed) * 100

    // Cost improvement (simulated: latency + throughput)
    const costImprovement = (latencyImprovement + throughputImprovement) / 2

    // Determine winner
    let winner: 'auto-maker' | 'pi-builder' | 'tie'
    if (Math.abs(latencyImprovement - throughputImprovement) < 5) {
      winner = 'tie'
    } else if (latencyImprovement > throughputImprovement) {
      winner = 'pi-builder'
    } else {
      winner = 'auto-maker'
    }

    return {
      operation,
      autoMakerResult,
      piBuilderResult,
      latencyImprovement,
      throughputImprovement,
      memoryImprovement,
      costImprovement,
      winner,
    }
  }

  /**
   * Generate benchmark report
   */
  generateReport(title: string = 'Performance Benchmark Report'): string {
    const results = this.getAllResults()

    const report = `
╔════════════════════════════════════════════════════════════════╗
║ Performance Benchmark Report${' '.repeat(33)} ║
║ ${title.padEnd(62)} ║
╚════════════════════════════════════════════════════════════════╝

BENCHMARK RESULTS:
${results
  .map(
    (r) => `
Operation: ${r.operationName}
├─ Iterations: ${r.iterations}
├─ Total Time: ${r.totalTime}ms
├─ Min/Max: ${r.minTime}ms / ${r.maxTime}ms
├─ Average: ${r.avgTime.toFixed(2)}ms
├─ P50: ${r.p50Time.toFixed(2)}ms
├─ P95: ${r.p95Time.toFixed(2)}ms
├─ P99: ${r.p99Time.toFixed(2)}ms
├─ Throughput: ${r.throughput.toFixed(2)} ops/sec
├─ Memory: ${r.memoryUsed.toFixed(2)}MB
└─ Success Rate: ${(r.successRate * 100).toFixed(1)}%
`
  )
  .join('\n')}
`

    return report
  }

  /**
   * Export results as JSON
   */
  export(): Record<string, BenchmarkResult> {
    const result: Record<string, BenchmarkResult> = {}
    for (const [name, data] of this.results) {
      result[name] = data
    }
    return result
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results.clear()
  }
}

/**
 * Global benchmark instance
 */
export const performanceBenchmark = new PerformanceBenchmark()
