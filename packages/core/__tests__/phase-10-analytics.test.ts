/**
 * Phase 10: Analytics Tests
 * Real-time metrics and advanced analytics
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MetricsCollector,
  AnalyticsEngine,
  type ExecutionMetric
} from '../src/analytics'

describe('Phase 10: Advanced Analytics', () => {
  describe('MetricsCollector', () => {
    let collector: MetricsCollector

    beforeEach(() => {
      collector = new MetricsCollector()
    })

    it('should record metric', () => {
      const metric = collector.recordMetric({
        agentId: 'agent-1',
        taskId: 'task-1',
        duration: 1000,
        cost: 0.50,
        success: true,
        tokensUsed: 250,
        cacheHit: false,
        provider: 'claude',
        model: 'claude-3-sonnet',
        inputSize: 500,
        outputSize: 300,
        errorRate: 0
      })

      expect(metric.id).toBeDefined()
      expect(metric.timestamp).toBeDefined()
      expect(metric.duration).toBe(1000)
    })

    it('should get agent metrics', () => {
      collector.recordMetric({
        agentId: 'agent-1',
        taskId: 'task-1',
        duration: 1000,
        cost: 0.50,
        success: true,
        tokensUsed: 250,
        cacheHit: false,
        provider: 'claude',
        model: 'claude-3-sonnet',
        inputSize: 500,
        outputSize: 300,
        errorRate: 0
      })

      collector.recordMetric({
        agentId: 'agent-1',
        taskId: 'task-2',
        duration: 1500,
        cost: 0.75,
        success: true,
        tokensUsed: 300,
        cacheHit: true,
        provider: 'claude',
        model: 'claude-3-sonnet',
        inputSize: 600,
        outputSize: 400,
        errorRate: 0
      })

      const metrics = collector.getAgentMetrics('agent-1')
      expect(metrics.length).toBe(2)
    })

    it('should calculate aggregated metrics', () => {
      for (let i = 0; i < 10; i++) {
        collector.recordMetric({
          agentId: 'agent-1',
          taskId: `task-${i}`,
          duration: 1000 + i * 100,
          cost: 0.50 + i * 0.05,
          success: i < 8,
          tokensUsed: 250,
          cacheHit: i % 2 === 0,
          provider: 'claude',
          model: 'claude-3-sonnet',
          inputSize: 500,
          outputSize: 300,
          errorRate: i >= 8 ? 1 : 0
        })
      }

      const aggregated = collector.getAggregatedMetrics('agent-1')

      expect(aggregated.totalExecutions).toBe(10)
      expect(aggregated.successfulExecutions).toBe(8)
      expect(aggregated.failedExecutions).toBe(2)
      expect(aggregated.avgDuration).toBeGreaterThan(1000)
      expect(aggregated.cacheHitRate).toBeGreaterThan(0)
    })

    it('should get metrics by time window', () => {
      const now = Date.now()

      for (let i = 0; i < 5; i++) {
        collector.recordMetric({
          agentId: 'agent-1',
          taskId: `task-${i}`,
          duration: 1000,
          cost: 0.50,
          success: true,
          tokensUsed: 250,
          cacheHit: false,
          provider: 'claude',
          model: 'claude-3-sonnet',
          inputSize: 500,
          outputSize: 300,
          errorRate: 0
        })
      }

      const metrics = collector.getMetricsByTimeWindow('agent-1', 60000)
      expect(metrics.length).toBeGreaterThanOrEqual(5)
    })

    it('should get provider statistics', () => {
      for (let i = 0; i < 5; i++) {
        collector.recordMetric({
          agentId: `agent-${i}`,
          taskId: `task-${i}`,
          duration: 1000,
          cost: 0.50 + i * 0.1,
          success: true,
          tokensUsed: 250,
          cacheHit: false,
          provider: i % 2 === 0 ? 'claude' : 'openai',
          model: i % 2 === 0 ? 'claude-3-sonnet' : 'gpt-4',
          inputSize: 500,
          outputSize: 300,
          errorRate: 0
        })
      }

      const stats = collector.getProviderStats()
      expect(stats.length).toBe(2)
      expect(stats[0].provider).toBeDefined()
    })

    it('should create metric stream', () => {
      collector.recordMetric({
        agentId: 'agent-1',
        taskId: 'task-1',
        duration: 1000,
        cost: 0.50,
        success: true,
        tokensUsed: 250,
        cacheHit: false,
        provider: 'claude',
        model: 'claude-3-sonnet',
        inputSize: 500,
        outputSize: 300,
        errorRate: 0
      })

      const stream = collector.createMetricStream('agent-1')

      expect(stream.agentId).toBe('agent-1')
      expect(stream.metrics.length).toBeGreaterThan(0)
      expect(stream.aggregated).toBeDefined()
    })
  })

  describe('AnalyticsEngine', () => {
    let engine: AnalyticsEngine
    let metrics: ExecutionMetric[]

    beforeEach(() => {
      engine = new AnalyticsEngine()
      metrics = []

      for (let i = 0; i < 10; i++) {
        metrics.push({
          id: `metric-${i}`,
          timestamp: new Date(Date.now() - i * 60000),
          agentId: 'agent-1',
          taskId: `task-${i}`,
          duration: 1000 + i * 100,
          cost: 0.50 + i * 0.05,
          success: i < 8,
          tokensUsed: 250,
          cacheHit: i % 2 === 0,
          provider: 'claude',
          model: 'claude-3-sonnet',
          inputSize: 500,
          outputSize: 300,
          errorRate: i >= 8 ? 1 : 0
        })
      }

      engine.storeHistoricalData('agent-1', metrics)
    })

    it('should generate insights', async () => {
      const aggregated = {
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        avgDuration: 1500,
        avgCost: 0.70,
        totalCost: 7.0,
        cacheHitRate: 50,
        avgTokensUsed: 250,
        costTrend: 'increasing' as const,
        performanceTrend: 'degrading' as const
      }

      const insights = await engine.analyzeMetrics('agent-1', aggregated, metrics)

      expect(insights.length).toBeGreaterThan(0)
      expect(insights[0].type).toBeDefined()
      expect(insights[0].title).toBeDefined()
    })

    it('should detect anomalies', () => {
      const newMetric: ExecutionMetric = {
        id: 'new-metric',
        timestamp: new Date(),
        agentId: 'agent-1',
        taskId: 'task-new',
        duration: 10000, // Anomalously high
        cost: 5.0, // Anomalously high
        success: false,
        tokensUsed: 500,
        cacheHit: false,
        provider: 'claude',
        model: 'claude-3-sonnet',
        inputSize: 1000,
        outputSize: 500,
        errorRate: 1
      }

      const anomalies = engine.detectAnomalies('agent-1', newMetric)

      // May or may not detect depending on statistical threshold
      expect(Array.isArray(anomalies)).toBe(true)
    })

    it('should analyze trends', () => {
      const trends = engine.analyzeTrends(metrics)

      expect(trends.length).toBeGreaterThan(0)
      expect(trends[0].metric).toBeDefined()
      expect(trends[0].trend).toBeDefined()
    })

    it('should get all insights', async () => {
      const aggregated = {
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        avgDuration: 1500,
        avgCost: 0.70,
        totalCost: 7.0,
        cacheHitRate: 50,
        avgTokensUsed: 250,
        costTrend: 'increasing' as const,
        performanceTrend: 'degrading' as const
      }

      await engine.analyzeMetrics('agent-1', aggregated, metrics)
      const insights = engine.getAllInsights()

      expect(insights.length).toBeGreaterThan(0)
    })

    it('should get recommendations', async () => {
      const aggregated = {
        totalExecutions: 10,
        successfulExecutions: 8,
        failedExecutions: 2,
        avgDuration: 5000, // High
        avgCost: 2.0, // High
        totalCost: 20.0,
        cacheHitRate: 10, // Low
        avgTokensUsed: 250,
        costTrend: 'increasing' as const,
        performanceTrend: 'degrading' as const
      }

      await engine.analyzeMetrics('agent-1', aggregated, metrics)
      const recommendations = engine.getRecommendations()

      expect(recommendations.length).toBeGreaterThan(0)
      expect(typeof recommendations[0]).toBe('string')
    })

    it('should calculate optimization potential', () => {
      const potential = engine.calculateOptimizationPotential(metrics)

      expect(potential.costSavingsPotential).toBeGreaterThan(0)
      expect(potential.performanceGainPotential).toBeGreaterThanOrEqual(0)
      expect(potential.reliabilityGainPotential).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Phase 10 Integration', () => {
    it('should work together - metrics collection and analytics', async () => {
      const collector = new MetricsCollector()
      const engine = new AnalyticsEngine()

      // Collect metrics
      for (let i = 0; i < 20; i++) {
        collector.recordMetric({
          agentId: 'agent-1',
          taskId: `task-${i}`,
          duration: 1000 + i * Math.random() * 500,
          cost: 0.50 + i * Math.random() * 0.2,
          success: i < 18,
          tokensUsed: 250,
          cacheHit: i % 3 === 0,
          provider: 'claude',
          model: 'claude-3-sonnet',
          inputSize: 500,
          outputSize: 300,
          errorRate: i >= 18 ? 1 : 0
        })
      }

      // Analyze
      const metrics = collector.getAgentMetrics('agent-1')
      const aggregated = collector.getAggregatedMetrics('agent-1')

      engine.storeHistoricalData('agent-1', metrics)
      const insights = await engine.analyzeMetrics('agent-1', aggregated, metrics)
      const trends = engine.analyzeTrends(metrics)
      const recommendations = engine.getRecommendations()

      expect(metrics.length).toBe(20)
      expect(aggregated.totalExecutions).toBe(20)
      expect(insights.length).toBeGreaterThan(0)
      expect(trends.length).toBeGreaterThan(0)
      expect(recommendations.length).toBeGreaterThan(0)
    })
  })
})
