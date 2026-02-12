/**
 * Phase 4 Tests: Production Hardening
 *
 * Tests for:
 * - Performance Benchmarking
 * - Load Testing
 * - Security Audit
 *
 * Total: 15 tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceBenchmark } from '../src/benchmarking/performance-benchmark'
import { LoadTestRunner } from '../src/testing/load-test'
import { SecurityAuditor } from '../src/security/security-audit'

// ============================================================================
// PERFORMANCE BENCHMARK TESTS (5 tests)
// ============================================================================

describe('PerformanceBenchmark', () => {
  let benchmark: PerformanceBenchmark

  beforeEach(() => {
    benchmark = new PerformanceBenchmark()
  })

  it('should run simple benchmark', async () => {
    const result = await benchmark.runBenchmark('simple-operation', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1))
    }, 100)

    expect(result.iterations).toBe(100)
    expect(result.successRate).toBeGreaterThan(0.9)
    expect(result.avgTime).toBeGreaterThan(0)
    expect(result.throughput).toBeGreaterThan(0)
  })

  it('should track latency percentiles', async () => {
    await benchmark.runBenchmark(
      'latency-test',
      async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
      },
      100
    )

    const result = benchmark.getResult('latency-test')
    expect(result).toBeDefined()
    expect(result!.p50Time).toBeLessThanOrEqual(result!.p95Time)
    expect(result!.p95Time).toBeLessThanOrEqual(result!.p99Time)
  })

  it('should calculate throughput', async () => {
    const result = await benchmark.runBenchmark('throughput-test', async () => {
      // Quick operation
    }, 1000)

    expect(result.throughput).toBeGreaterThan(0)
    expect(result.throughput).toBeLessThan(100000) // Sanity check
  })

  it('should track memory usage', async () => {
    const result = await benchmark.runBenchmark(
      'memory-test',
      async () => {
        const arr: number[] = []
        for (let i = 0; i < 1000; i++) {
          arr.push(i)
        }
      },
      10
    )

    expect(result.memoryUsed).toBeGreaterThanOrEqual(0)
  })

  it('should generate benchmark report', async () => {
    await benchmark.runBenchmark('report-test', async () => {}, 50)

    const report = benchmark.generateReport('Test Report')
    expect(report).toContain('Performance Benchmark Report')
    expect(report).toContain('report-test')
    expect(report).toContain('Average')
  })
})

// ============================================================================
// LOAD TEST RUNNER TESTS (5 tests)
// ============================================================================

describe('LoadTestRunner', () => {
  let loadTester: LoadTestRunner

  beforeEach(() => {
    loadTester = new LoadTestRunner()
  })

  it('should run constant load test', async () => {
    const result = await loadTester.runLoadTest(
      {
        name: 'Constant Load Test',
        duration: 1000,
        rps: 10,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    )

    expect(result.totalRequests).toBeGreaterThan(0)
    expect(result.successfulRequests).toBeGreaterThan(0)
    expect(result.successRate).toBeGreaterThan(0.8)
  })

  it('should handle ramp-up load', async () => {
    const result = await loadTester.runLoadTest(
      {
        name: 'Ramp-up Load Test',
        duration: 500,
        rps: 10,
        rampUp: {
          enabled: true,
          duration: 250,
        },
      },
      async () => {}
    )

    expect(result.config.rampUp?.enabled).toBe(true)
    expect(result.successRate).toBeGreaterThan(0.5)
  })

  it('should calculate latency percentiles', async () => {
    const result = await loadTester.runLoadTest(
      {
        name: 'Latency Test',
        duration: 500,
        rps: 20,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10))
      }
    )

    expect(result.p95Latency).toBeGreaterThanOrEqual(result.avgLatency)
    expect(result.p99Latency).toBeGreaterThanOrEqual(result.p95Latency)
  })

  it('should track errors during load test', async () => {
    let failCount = 0

    const result = await loadTester.runLoadTest(
      {
        name: 'Error Tracking Test',
        duration: 200,
        rps: 20,
      },
      async () => {
        if (Math.random() < 0.2) {
          failCount++
          throw new Error('Random failure')
        }
      }
    )

    expect(result.failedRequests).toBeGreaterThan(0)
    expect(result.errors.size).toBeGreaterThan(0)
  })

  it('should generate load test report', async () => {
    await loadTester.runLoadTest(
      {
        name: 'Report Test',
        duration: 200,
        rps: 10,
      },
      async () => {}
    )

    const report = loadTester.generateReport()
    expect(report).toContain('Load Test Report')
    expect(report).toContain('Report Test')
    expect(report).toContain('Throughput')
  })
})

// ============================================================================
// SECURITY AUDIT TESTS (5 tests)
// ============================================================================

describe('SecurityAuditor', () => {
  let auditor: SecurityAuditor

  beforeEach(() => {
    auditor = new SecurityAuditor()
  })

  it('should check input validation', () => {
    const result = auditor.checkInputValidation()

    expect(result.checkName).toBe('Input Validation')
    expect(result.category).toBe('critical')
    expect(result.passed).toBe(true)
  })

  it('should check token limit enforcement', () => {
    const result = auditor.checkTokenLimitEnforcement()

    expect(result.checkName).toBe('Token Limit Enforcement')
    expect(result.category).toBe('high')
    expect(result.passed).toBe(true)
  })

  it('should verify request ID uniqueness', () => {
    const result = auditor.checkRequestIDUniqueness()

    expect(result.checkName).toBe('Request ID Uniqueness')
    expect(result.category).toBe('critical')
    expect(result.passed).toBe(true)
  })

  it('should check trace data sensitivity', () => {
    const result = auditor.checkTraceDataSensitivity()

    expect(result.checkName).toBe('Trace Data Sensitivity')
    expect(result.category).toBe('high')
  })

  it('should run comprehensive security audit', async () => {
    const report = await auditor.runAudit()

    expect(report.totalChecks).toBeGreaterThan(0)
    expect(report.passedChecks).toBeGreaterThan(0)
    expect(report.overallStatus).toBeDefined()
    expect(['SECURE', 'WARNINGS', 'CRITICAL']).toContain(report.overallStatus)
  })

  it('should generate security audit report', async () => {
    const report = await auditor.runAudit()
    const reportText = auditor.generateReport(report)

    expect(reportText).toContain('Security Audit Report')
    expect(reportText).toContain('SUMMARY')
    expect(reportText).toContain('DETAILED RESULTS')
  })
})

// ============================================================================
// INTEGRATION TESTS (5 tests - Optional bonus)
// ============================================================================

describe('Phase 4 Integration', () => {
  it('should benchmark and load test together', async () => {
    const benchmark = new PerformanceBenchmark()
    const loadTester = new LoadTestRunner()

    // Run benchmark
    const benchResult = await benchmark.runBenchmark('integration-test', async () => {}, 100)

    // Run load test with similar config
    const loadResult = await loadTester.runLoadTest(
      {
        name: 'integration-load-test',
        duration: 500,
        rps: 10,
      },
      async () => {}
    )

    expect(benchResult.successRate).toBeGreaterThan(0)
    expect(loadResult.successRate).toBeGreaterThan(0)
  })

  it('should run security audit and load test', async () => {
    const auditor = new SecurityAuditor()
    const loadTester = new LoadTestRunner()

    // Run audit
    const auditReport = await auditor.runAudit()

    // Run load test
    const loadResult = await loadTester.runLoadTest(
      {
        name: 'security-load-test',
        duration: 200,
        rps: 15,
      },
      async () => {}
    )

    expect(auditReport.overallStatus).toBeDefined()
    expect(loadResult.successRate).toBeGreaterThan(0)
  })

  it('should validate performance under load', async () => {
    const loadTester = new LoadTestRunner()

    const result = await loadTester.runLoadTest(
      {
        name: 'performance-validation',
        duration: 500,
        rps: 50,
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
    )

    // Under 50 RPS load, should maintain >90% success
    expect(result.successRate).toBeGreaterThan(0.9)
  })

  it('should complete full production checklist', async () => {
    const benchmark = new PerformanceBenchmark()
    const loadTester = new LoadTestRunner()
    const auditor = new SecurityAuditor()

    // 1. Benchmark
    const benchResult = await benchmark.runBenchmark('checklist-test', async () => {}, 50)
    expect(benchResult.successRate).toBeGreaterThan(0)

    // 2. Load test
    const loadResult = await loadTester.runLoadTest(
      {
        name: 'checklist-load',
        duration: 300,
        rps: 20,
      },
      async () => {}
    )
    expect(loadResult.successRate).toBeGreaterThan(0)

    // 3. Security audit
    const auditReport = await auditor.runAudit()
    expect(auditReport.overallStatus).toBe('SECURE')

    // All checks passed
    expect(benchResult.successRate).toBeGreaterThan(0)
    expect(loadResult.successRate).toBeGreaterThan(0)
  })

  it('should produce production-ready artifacts', () => {
    const benchmark = new PerformanceBenchmark()
    const loadTester = new LoadTestRunner()
    const auditor = new SecurityAuditor()

    // These should not throw
    expect(() => benchmark.generateReport()).not.toThrow()
    expect(() => loadTester.generateReport()).not.toThrow()
    expect(auditor).toBeDefined()
  })
})
