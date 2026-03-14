/**
 * Phase 6: Advanced Optimization Tests
 * Tests for adaptive optimizer, performance predictor, cost intelligence, and budget manager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  AdaptiveOptimizer,
  PerformancePredictor,
  CostIntelligence,
  BudgetManager,
  type TaskResult,
  type BudgetConfig
} from '../src/optimization'

/**
 * Adaptive Optimizer Tests
 */
describe('Phase 6: Advanced Optimization', () => {
  describe('AdaptiveOptimizer', () => {
    let optimizer: AdaptiveOptimizer
    let history: TaskResult[]

    beforeEach(() => {
      optimizer = new AdaptiveOptimizer(5)
      history = []

      // Create sample history
      for (let i = 0; i < 15; i++) {
        history.push({
          success: i < 12,
          data: `result-${i}`,
          latency: 50 + Math.random() * 50,
          cost: 0.01 + Math.random() * 0.05,
          metadata: {
            taskType: 'test-task',
            agent: i % 2 === 0 ? 'agent-1' : 'agent-2'
          }
        })
      }
    })

    it('should analyze usage patterns', async () => {
      const patterns = await optimizer.analyzeUsagePatterns(history)

      expect(patterns.length).toBeGreaterThan(0)
      expect(patterns[0].taskType).toBeDefined()
      expect(patterns[0].frequency).toBeGreaterThan(0)
      expect(patterns[0].successRate).toBeGreaterThan(0)
    })

    it('should generate recommendations', async () => {
      const patterns = await optimizer.analyzeUsagePatterns(history)
      const recommendations = await optimizer.recommendOptimizations(patterns)

      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations[0].title).toBeDefined()
      expect(recommendations[0].priority).toBeGreaterThan(0)
    })

    it('should auto-optimize', async () => {
      const patterns = await optimizer.analyzeUsagePatterns(history)
      const recommendations = await optimizer.recommendOptimizations(patterns)
      const result = await optimizer.autoOptimize(recommendations)

      expect(result.success).toBe(true)
      expect(result.measurements.improvement.cost).toBeGreaterThan(0)
    })

    it('should identify high-cost tasks', async () => {
      const expensiveHistory = history.map(h => ({
        ...h,
        cost: 0.2, // Expensive
        metadata: { ...h.metadata, taskType: 'expensive-task' }
      }))

      const patterns = await optimizer.analyzeUsagePatterns(expensiveHistory)
      const recommendations = await optimizer.recommendOptimizations(patterns)

      const costRecs = recommendations.filter(r =>
        r.title.includes('cost')
      )
      expect(costRecs.length).toBeGreaterThan(0)
    })
  })

  /**
   * Performance Predictor Tests
   */
  describe('PerformancePredictor', () => {
    let predictor: PerformancePredictor

    beforeEach(() => {
      predictor = new PerformancePredictor(3)

      // Add some training data
      for (let i = 0; i < 10; i++) {
        predictor.recordActual('test-task', 'latency', 50 + i * 5, 50)
      }
    })

    it('should predict latency', async () => {
      const task = {
        id: 'task-1',
        type: 'test-task',
        priority: 'high' as const,
        input: 'test',
        metadata: { complexity: 1.0 },
        createdAt: new Date()
      }

      const prediction = await predictor.predictLatency(task)

      expect(prediction.predicted).toBeGreaterThan(0)
      expect(prediction.confidence).toBeGreaterThan(0)
      expect(prediction.range.min).toBeLessThanOrEqual(prediction.range.max)
    })

    it('should predict cost', async () => {
      const task = {
        id: 'task-1',
        type: 'test-task',
        priority: 'high' as const,
        input: 'test',
        createdAt: new Date()
      }

      const prediction = await predictor.predictCost(task)

      expect(prediction.predicted).toBeGreaterThan(0)
      expect(prediction.confidence).toBeGreaterThan(0)
      expect(prediction.breakdown).toBeDefined()
    })

    it('should predict success rate', async () => {
      const task = {
        id: 'task-1',
        type: 'test-task',
        priority: 'high' as const,
        input: 'test',
        metadata: { complexity: 1.0 },
        createdAt: new Date()
      }

      const rate = await predictor.predictSuccessRate(task)

      expect(rate).toBeGreaterThanOrEqual(0)
      expect(rate).toBeLessThanOrEqual(1)
    })

    it('should create comprehensive forecast', async () => {
      const task = {
        id: 'task-1',
        type: 'test-task',
        priority: 'high' as const,
        input: 'test',
        createdAt: new Date()
      }

      const forecast = await predictor.forecast(task)

      expect(forecast.latency).toBeDefined()
      expect(forecast.cost).toBeDefined()
      expect(forecast.successRate).toBeDefined()
      expect(forecast.riskLevel).toBeDefined()
    })

    it('should calculate prediction accuracy', () => {
      const accuracy = predictor.getAccuracy('test-task')

      expect(accuracy.sampleSize).toBeGreaterThan(0)
      expect(accuracy.accuracy).toBeGreaterThan(0)
    })
  })

  /**
   * Cost Intelligence Tests
   */
  describe('CostIntelligence', () => {
    let intelligence: CostIntelligence

    beforeEach(() => {
      intelligence = new CostIntelligence()

      // Record some costs
      for (let i = 0; i < 10; i++) {
        intelligence.recordCost(0.01 + Math.random() * 0.05, 'agent-1', 'task-1', 'model-1')
        intelligence.recordCost(0.02 + Math.random() * 0.03, 'agent-2', 'task-2', 'model-2')
      }
    })

    it('should analyze expenses', async () => {
      const breakdown = await intelligence.analyzeExpenses('monthly')

      expect(breakdown.total).toBeGreaterThan(0)
      expect(breakdown.byAgent.size).toBeGreaterThan(0)
      expect(breakdown.byTaskType.size).toBeGreaterThan(0)
    })

    it('should suggest cost cuts', async () => {
      const suggestions = await intelligence.suggestCuttings()

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].estimatedSavings).toBeGreaterThan(0)
    })

    it('should optimize costs', async () => {
      const suggestions = await intelligence.suggestCuttings()
      const report = await intelligence.optimizeCosts(suggestions)

      expect(report.savings).toBeGreaterThan(0)
      expect(report.appliedSuggestions.length).toBeGreaterThan(0)
    })

    it('should get cost distribution', async () => {
      const distribution = await intelligence.getCostDistribution()

      expect(distribution.byAgent.length).toBeGreaterThan(0)
      expect(distribution.byTaskType.length).toBeGreaterThan(0)
      expect(distribution.byModel.length).toBeGreaterThan(0)
    })
  })

  /**
   * Budget Manager Tests
   */
  describe('BudgetManager', () => {
    let manager: BudgetManager
    let config: BudgetConfig

    beforeEach(() => {
      config = {
        period: 'monthly',
        limit: 1000,
        alertThreshold: 80
      }
      manager = new BudgetManager(config)
    })

    it('should track spending', () => {
      manager.recordSpending(100, 'agent-1')
      manager.recordSpending(200, 'agent-2')

      const status = manager.getBudgetStatus()
      expect(status.spent).toBe(300)
      expect(status.remaining).toBe(700)
    })

    it('should calculate budget percentage', () => {
      manager.recordSpending(800, 'agent-1')

      const status = manager.getBudgetStatus()
      expect(status.percentageUsed).toBe(80)
    })

    it('should trigger warning alert', () => {
      manager.recordSpending(850, 'agent-1')

      const alerts = manager.getAlerts()
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].severity).toBe('warning')
    })

    it('should trigger critical alert', () => {
      manager.recordSpending(1000, 'agent-1')

      const alerts = manager.getCriticalAlerts()
      expect(alerts.length).toBeGreaterThan(0)
    })

    it('should forecast spending', async () => {
      manager.recordSpending(100, 'agent-1')
      manager.recordSpending(120, 'agent-1')

      const forecast = await manager.forecastSpending()

      expect(forecast.projectedSpend).toBeGreaterThanOrEqual(0)
      expect(forecast.trendDirection).toBeDefined()
      expect(['up', 'down', 'stable']).toContain(forecast.trendDirection)
    })

    it('should track ROI', async () => {
      manager.recordSpending(100, 'agent-1')

      const report = await manager.trackROI(50, 5)

      expect(report.totalSpend).toBe(100)
      expect(report.totalTasksCompleted).toBe(50)
      expect(report.costPerTask).toBe(2)
    })

    it('should update budget config', () => {
      manager.updateBudgetConfig({ limit: 2000 })

      const status = manager.getBudgetStatus()
      expect(status.limit).toBe(2000)
    })
  })

  /**
   * Phase 6 Integration Tests
   */
  describe('Phase 6 Integration', () => {
    it('should work together - optimize costs and track budget', async () => {
      // Create sample data
      const history: TaskResult[] = []
      for (let i = 0; i < 20; i++) {
        history.push({
          success: i < 18,
          data: `result-${i}`,
          latency: 50 + Math.random() * 100,
          cost: 0.01 + Math.random() * 0.1,
          metadata: {
            taskType: i % 2 === 0 ? 'task-a' : 'task-b',
            agent: i % 3 === 0 ? 'agent-1' : 'agent-2'
          }
        })
      }

      // Use optimizer
      const optimizer = new AdaptiveOptimizer(5)
      const patterns = await optimizer.analyzeUsagePatterns(history)
      expect(patterns.length).toBeGreaterThan(0)

      // Use cost intelligence
      const intelligence = new CostIntelligence()
      const totalCost = history.reduce((sum, h) => sum + (h.cost || 0), 0)
      const suggestions = await intelligence.suggestCuttings()
      expect(suggestions.length).toBeGreaterThan(0)

      // Use budget manager
      const config: BudgetConfig = {
        period: 'monthly',
        limit: totalCost * 2,
        alertThreshold: 80
      }
      const manager = new BudgetManager(config)
      manager.recordSpending(totalCost, 'source')

      const status = manager.getBudgetStatus()
      expect(status.spent).toBe(totalCost)

      // Use performance predictor
      const predictor = new PerformancePredictor(3)
      const task = {
        id: 'task-1',
        type: 'task-a',
        priority: 'high' as const,
        input: 'test',
        createdAt: new Date()
      }

      const forecast = await predictor.forecast(task)
      expect(forecast.latency).toBeDefined()
      expect(forecast.cost).toBeDefined()
    })
  })
})
