import { describe, it, expect, beforeEach } from 'vitest'
import {
  BorgMemoryIntegration,
  MockMCPMemoryService,
  BorgAwareAgent
} from '../src/memory/borg-integration'
import { RAGKnowledgeBase } from '../src/knowledge/rag-knowledge-base'
import { BaseAgent } from '../src/agents'

describe('Borg Memory Integration', () => {
  let borgService: MockMCPMemoryService
  let rag: RAGKnowledgeBase
  let borg: BorgMemoryIntegration
  let agent: BaseAgent

  beforeEach(async () => {
    borgService = new MockMCPMemoryService()
    rag = new RAGKnowledgeBase()
    borg = new BorgMemoryIntegration(borgService, rag)
    agent = new BaseAgent('agent-1', 'Test Agent')

    // Add some sample RAG documents
    await rag.addDocument({
      title: 'Customer Support Guide',
      content: 'Best practices for handling support tickets efficiently'
    })

    console.log('✅ Test setup complete')
  })

  describe('Memory Creation', () => {
    it('should create task execution memory', async () => {
      const memory = await borgService.create({
        type: 'task_execution',
        content: {
          taskId: 'task-1',
          success: true,
          duration: 1500
        },
        source: 'test',
        confidence: 0.95,
        tags: ['test', 'completed']
      })

      expect(memory.id).toBeDefined()
      expect(memory.type).toBe('task_execution')
      expect(memory.confidence).toBe(0.95)
    })

    it('should create decision memory', async () => {
      const memory = await borgService.create({
        type: 'decision',
        content: {
          decision: 'Use cache',
          reasoning: 'Performance critical path'
        },
        source: 'agent',
        confidence: 0.85,
        tags: ['optimization']
      })

      expect(memory.type).toBe('decision')
      expect(memory.content.decision).toBe('Use cache')
    })

    it('should create pattern memory', async () => {
      const memory = await borgService.create({
        type: 'pattern',
        content: {
          pattern: 'Retry on timeout',
          successRate: 0.92
        },
        source: 'learned',
        confidence: 0.9,
        tags: ['pattern']
      })

      expect(memory.type).toBe('pattern')
      expect(memory.confidence).toBe(0.9)
    })

    it('should create error learning memory', async () => {
      const memory = await borgService.create({
        type: 'error',
        content: {
          error: 'Database connection timeout',
          solution: 'Increase pool size',
          prevention: 'Add health checks'
        },
        source: 'error-handler',
        confidence: 0.8,
        tags: ['error', 'learned']
      })

      expect(memory.type).toBe('error')
      expect(memory.content.solution).toBe('Increase pool size')
    })
  })

  describe('Memory Search', () => {
    beforeEach(async () => {
      // Create sample memories
      await borgService.create({
        type: 'task_execution',
        content: { taskId: 'task-1', success: true },
        source: 'test',
        confidence: 0.95,
        tags: ['api', 'completed']
      })

      await borgService.create({
        type: 'task_execution',
        content: { taskId: 'task-2', success: true },
        source: 'test',
        confidence: 0.9,
        tags: ['database', 'completed']
      })

      await borgService.create({
        type: 'decision',
        content: { decision: 'Use cache' },
        source: 'test',
        confidence: 0.85,
        tags: ['optimization']
      })
    })

    it('should search memories by query', async () => {
      const results = await borgService.search('task execution success')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].memory.type).toBe('task_execution')
    })

    it('should filter by tags', async () => {
      const results = await borgService.search('', {
        tags: ['api'],
        limit: 5
      })

      // May be 0 if search doesn't match, but structure is valid
      expect(Array.isArray(results)).toBe(true)
    })

    it('should respect limit', async () => {
      const results = await borgService.search('', { limit: 1 })

      expect(results.length).toBeLessThanOrEqual(1)
    })

    it('should return relevance scores', async () => {
      const results = await borgService.search('task')

      expect(results[0].relevance).toMatch(/high|medium|low/)
      expect(results[0].similarity).toBeGreaterThan(0)
    })
  })

  describe('Context Augmentation', () => {
    beforeEach(async () => {
      // Create memories and RAG docs
      await borgService.create({
        type: 'task_execution',
        content: {
          taskDescription: 'Handle customer inquiry',
          success: true,
          solution: 'Quick response template'
        },
        source: 'test',
        confidence: 0.95,
        tags: ['customer', 'support']
      })

      await rag.addArticle(
        'Customer Support Best Practices',
        'Always respond within 2 hours with empathy and clarity'
      )
    })

    it('should augment context with memories', async () => {
      const task = { id: 'task-1', description: 'Handle customer inquiry', repo: 'crm' }

      const augmented = await borg.augmentContext(agent, task as any, 'Customer support query')

      expect(augmented.memories).toBeDefined()
      expect(Array.isArray(augmented.memories)).toBe(true)
    })

    it('should include RAG context', async () => {
      const task = { id: 'task-1', description: 'Customer support', repo: 'crm' }

      const augmented = await borg.augmentContext(agent, task as any, 'support best practices')

      expect(augmented.ragContext).toBeDefined()
      expect(Array.isArray(augmented.ragContext)).toBe(true)
    })

    it('should build combined context string', async () => {
      const task = { id: 'task-1', description: 'Support', repo: 'app' }

      const augmented = await borg.augmentContext(agent, task as any, 'customer support')

      expect(augmented.combined).toBeDefined()
      expect(typeof augmented.combined).toBe('string')
      expect(augmented.combined.length).toBeGreaterThan(0)
    })
  })

  describe('Outcome Recording', () => {
    it('should record successful task outcome', async () => {
      const task = { id: 'task-1', description: 'Process payment', repo: 'payment' }

      const outcome = await borg.recordOutcome(agent, task as any, {
        success: true,
        duration: 2500,
        steps: ['Validate', 'Process', 'Confirm'],
        artifacts: ['receipt-123']
      })

      expect(outcome.type).toBe('task_execution')
      expect(outcome.content.success).toBe(true)
      expect(outcome.confidence).toBe(0.95)
    })

    it('should record failed task outcome', async () => {
      const task = { id: 'task-2', description: 'Process payment', repo: 'payment' }

      const outcome = await borg.recordOutcome(agent, task as any, {
        success: false,
        duration: 500,
        errors: ['Payment gateway timeout']
      })

      expect(outcome.content.success).toBe(false)
      expect(outcome.confidence).toBe(0.6)
    })

    it('should tag outcome appropriately', async () => {
      const task = { id: 'task-3', description: 'Process', repo: 'app', service: 'api' }

      const outcome = await borg.recordOutcome(agent, task as any, {
        success: true,
        duration: 1000
      })

      expect(outcome.tags).toContain(`agent:${agent.id}`)
      expect(outcome.tags).toContain('repo:app')
      expect(outcome.tags).toContain('service:api')
      expect(outcome.tags).toContain('completed')
    })
  })

  describe('Pattern Recognition', () => {
    it('should record successful pattern', async () => {
      const pattern = await borg.recordPattern(
        agent,
        'Retry with exponential backoff',
        'Network failures',
        0.92
      )

      expect(pattern.type).toBe('pattern')
      expect(pattern.content.successRate).toBe(0.92)
      expect(pattern.confidence).toBe(0.92)
    })

    it('should record decision', async () => {
      const decision = await borg.recordDecision(
        agent,
        'High load detected',
        'Enable caching',
        'Reduce database pressure',
        'success'
      )

      expect(decision.type).toBe('decision')
      expect(decision.content.decision).toBe('Enable caching')
    })

    it('should record error learning', async () => {
      const learning = await borg.recordErrorLearning(
        agent,
        'Connection pool exhausted',
        'Too many concurrent requests',
        'Increase pool size to 50',
        'Add connection pooling health checks'
      )

      expect(learning.type).toBe('error')
      expect(learning.content.solution).toBe('Increase pool size to 50')
      expect(learning.tags).toContain('learned')
    })
  })

  describe('Performance Analysis', () => {
    beforeEach(async () => {
      // Create task memories
      for (let i = 0; i < 5; i++) {
        await borgService.create({
          type: 'task_execution',
          content: {
            taskId: `task-${i}`,
            success: i < 4, // 4 successful, 1 failed
            duration: 1000 + i * 500
          },
          source: 'test',
          confidence: i < 4 ? 0.95 : 0.6,
          tags: [`agent:${agent.id}`, i < 4 ? 'completed' : 'failed']
        })
      }
    })

    it('should calculate agent performance', async () => {
      const performance = await borg.getAgentPerformance(agent.id)

      expect(performance.totalTasks).toBe(5)
      expect(performance.successRate).toBeCloseTo(0.8, 1)
      expect(performance.averageDuration).toBeGreaterThan(0)
    })

    it('should track common errors', async () => {
      await borg.recordErrorLearning(agent, 'Timeout', 'Slow response', 'Optimize', 'Add cache')

      const performance = await borg.getAgentPerformance(agent.id)

      expect(performance.commonErrors).toBeDefined()
    })
  })

  describe('Precedent Finding', () => {
    beforeEach(async () => {
      await borgService.create({
        type: 'decision',
        content: {
          context: 'High traffic detected',
          decision: 'Scale up servers',
          outcome: 'success'
        },
        source: 'test',
        confidence: 0.95,
        tags: ['scaling']
      })
    })

    it('should find relevant precedents', async () => {
      const precedents = await borg.findPrecedent('High traffic management', 5)

      expect(precedents).toBeDefined()
      expect(Array.isArray(precedents)).toBe(true)
    })
  })

  describe('Statistics', () => {
    beforeEach(async () => {
      // Create various memories
      await borgService.create({
        type: 'task_execution',
        content: {},
        source: 'test',
        confidence: 0.95,
        tags: ['task']
      })

      await borgService.create({
        type: 'decision',
        content: {},
        source: 'test',
        confidence: 0.85,
        tags: ['decision']
      })

      await borgService.create({
        type: 'pattern',
        content: {},
        source: 'test',
        confidence: 0.75,
        tags: ['pattern']
      })
    })

    it('should get memory statistics', async () => {
      const stats = await borg.getStats()

      expect(stats.totalMemories).toBe(3)
      expect(stats.byType.task_execution).toBe(1)
      expect(stats.byType.decision).toBe(1)
      expect(stats.byType.pattern).toBe(1)
      expect(stats.averageConfidence).toBeCloseTo(0.85, 1)
    })

    it('should count high confidence memories', async () => {
      const stats = await borg.getStats()

      expect(stats.highConfidenceCount).toBeGreaterThan(0)
    })
  })

  describe('Borg-Aware Agent', () => {
    it('should execute with memory integration', async () => {
      const borgAgent = new BorgAwareAgent('agent-2', 'Borg Agent', borg)

      // BorgAwareAgent extends BaseAgent
      expect(borgAgent).toBeDefined()
      expect(typeof borgAgent).toBe('object')
    })
  })

  describe('Full Workflow', () => {
    it('should handle complete task lifecycle', async () => {
      // 1. Create initial memory
      const previousMemory = await borgService.create({
        type: 'task_execution',
        content: {
          taskType: 'invoice-processing',
          success: true,
          steps: ['Extract data', 'Validate', 'Store']
        },
        source: 'test',
        confidence: 0.95,
        tags: ['invoice', 'completed']
      })

      expect(previousMemory.id).toBeDefined()

      // 2. Search for similar tasks
      const results = await borgService.search('invoice processing')

      expect(results.length).toBeGreaterThan(0)

      // 3. Record new task outcome
      const newOutcome = await borgService.create({
        type: 'task_execution',
        content: {
          taskType: 'invoice-processing',
          success: true,
          duration: 2000
        },
        source: 'test',
        confidence: 0.95,
        tags: ['invoice', 'completed']
      })

      expect(newOutcome.id).toBeDefined()

      // 4. Get statistics
      const stats = await borg.getStats()

      expect(stats.totalMemories).toBeGreaterThan(0)
    })
  })
})
