/**
 * Borg Memory Integration
 * Persistent semantic memory via pgvector
 * Integrates with Pi-Builder agents for continuous learning
 */

import { BaseAgent, TaskResult } from '../agents'
import { RAGKnowledgeBase } from '../knowledge/rag-knowledge-base'

export type Agent = BaseAgent
export interface Task {
  id: string
  type: 'generate' | 'test' | 'review' | 'deploy'
  description?: string
  repo?: string
  service?: string
  [key: string]: any
}

export interface BorgMemory {
  id: string
  type: 'task_execution' | 'decision' | 'pattern' | 'error' | 'optimization'
  content: Record<string, any>
  source: string
  confidence: number
  tags: string[]
  embedding?: number[]
  createdAt: Date
  updatedAt: Date
}

export interface MemorySearchResult {
  memory: BorgMemory
  similarity: number
  relevance: 'high' | 'medium' | 'low'
}

export interface MCPMemoryService {
  create(memory: Partial<BorgMemory>): Promise<BorgMemory>
  search(query: string, options?: { tags?: string[]; limit?: number }): Promise<MemorySearchResult[]>
  list(options?: { type?: string; tags?: string[] }): Promise<BorgMemory[]>
  get(id: string): Promise<BorgMemory | null>
  update(id: string, updates: Partial<BorgMemory>): Promise<BorgMemory>
  delete(id: string): Promise<void>
}

/**
 * Mock MCP Memory Service (production uses actual MCP client)
 */
export class MockMCPMemoryService implements MCPMemoryService {
  private memories: Map<string, BorgMemory> = new Map()

  async create(memory: Partial<BorgMemory>): Promise<BorgMemory> {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const fullMemory: BorgMemory = {
      id,
      type: memory.type || 'task_execution',
      content: memory.content || {},
      source: memory.source || 'unknown',
      confidence: memory.confidence || 0.5,
      tags: memory.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.memories.set(id, fullMemory)
    console.log(`💾 Stored memory: ${id} (${fullMemory.type})`)

    return fullMemory
  }

  async search(query: string, options?: { tags?: string[]; limit?: number }): Promise<MemorySearchResult[]> {
    const limit = options?.limit || 5
    const filterTags = options?.tags || []

    const results: MemorySearchResult[] = []

    for (const memory of this.memories.values()) {
      // Simple tag filtering
      if (filterTags.length > 0) {
        const hasAllTags = filterTags.every((tag) => memory.tags.includes(tag))
        if (!hasAllTags) continue
      }

      // Mock similarity scoring (in production: pgvector cosine similarity)
      const queryWords = query.toLowerCase().split(' ')
      const contentStr = JSON.stringify(memory.content).toLowerCase()
      const matches = queryWords.filter((word) => contentStr.includes(word)).length
      const similarity = matches / queryWords.length

      if (similarity > 0) {
        results.push({
          memory,
          similarity,
          relevance: similarity > 0.7 ? 'high' : similarity > 0.4 ? 'medium' : 'low'
        })
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity)
    return results.slice(0, limit)
  }

  async list(options?: { type?: string; tags?: string[] }): Promise<BorgMemory[]> {
    let results = Array.from(this.memories.values())

    if (options?.type) {
      results = results.filter((m) => m.type === options.type)
    }

    if (options?.tags && options.tags.length > 0) {
      results = results.filter((m) => options.tags!.every((tag) => m.tags.includes(tag)))
    }

    return results
  }

  async get(id: string): Promise<BorgMemory | null> {
    return this.memories.get(id) || null
  }

  async update(id: string, updates: Partial<BorgMemory>): Promise<BorgMemory> {
    const memory = this.memories.get(id)
    if (!memory) throw new Error(`Memory not found: ${id}`)

    const updated = { ...memory, ...updates, updatedAt: new Date() }
    this.memories.set(id, updated)

    return updated
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id)
  }
}

/**
 * Borg Memory Integration
 * Combines pgvector persistence with RAG knowledge base
 */
export class BorgMemoryIntegration {
  private borg: MCPMemoryService
  private rag: RAGKnowledgeBase
  private taskMemories: Map<string, BorgMemory> = new Map()

  constructor(borg: MCPMemoryService, rag: RAGKnowledgeBase) {
    this.borg = borg
    this.rag = rag

    console.log(`🧠 Borg Memory Integration initialized`)
  }

  /**
   * Augment agent context with memories and RAG
   */
  async augmentContext(
    agent: Agent,
    task: Task,
    description: string
  ): Promise<{
    memories: MemorySearchResult[]
    ragContext: any[]
    combined: string
  }> {
    console.log(`🔍 Augmenting context for task: ${task.id}`)

    // Search Borg memory for similar tasks
    const memories = await this.borg.search(description, {
      tags: [task.repo || 'default', task.service || 'default'],
      limit: 5
    })

    console.log(`📚 Retrieved ${memories.length} memories`)

    // Search RAG knowledge base
    const ragContext = await this.rag.getContext(description, 3)

    console.log(`📖 Retrieved ${ragContext.length} RAG documents`)

    // Combine into augmented context
    const combined = this.buildAugmentedContext(memories, ragContext, description)

    return {
      memories,
      ragContext,
      combined
    }
  }

  /**
   * Build augmented prompt with memories and RAG
   */
  private buildAugmentedContext(
    memories: MemorySearchResult[],
    ragDocs: any[],
    taskDescription: string
  ): string {
    let context = `# Task Context\n\n${taskDescription}\n\n`

    if (memories.length > 0) {
      context += `## Similar Past Tasks\n`
      for (const result of memories) {
        context += `\n### Memory (${result.relevance} relevance)\n`
        context += `- Type: ${result.memory.type}\n`
        context += `- Content: ${JSON.stringify(result.memory.content)}\n`
        context += `- Confidence: ${(result.memory.confidence * 100).toFixed(0)}%\n`
      }
    }

    if (ragDocs.length > 0) {
      context += `\n## Relevant Documentation\n`
      for (const doc of ragDocs) {
        context += `\n### ${doc.title}\n${doc.content.substring(0, 200)}...\n`
      }
    }

    return context
  }

  /**
   * Record task execution outcome in Borg memory
   */
  async recordOutcome(
    agent: Agent,
    task: Task,
    result: {
      success: boolean
      duration: number
      steps?: string[]
      errors?: string[]
      artifacts?: string[]
      output?: any
    }
  ): Promise<BorgMemory> {
    console.log(`💾 Recording outcome for task: ${task.id}`)

    const memory = await this.borg.create({
      type: 'task_execution',
      content: {
        agentId: agent.id,
        taskId: task.id,
        taskDescription: task.description,
        success: result.success,
        duration: result.duration,
        steps: result.steps || [],
        errors: result.errors || [],
        artifacts: result.artifacts || [],
        output: result.output
      },
      source: 'pi-builder-agent',
      confidence: result.success ? 0.95 : 0.6,
      tags: [
        `agent:${agent.id}`,
        `repo:${task.repo || 'default'}`,
        `service:${task.service || 'default'}`,
        result.success ? 'completed' : 'failed'
      ]
    })

    this.taskMemories.set(task.id, memory)
    return memory
  }

  /**
   * Record decision pattern for future reference
   */
  async recordDecision(
    agent: Agent,
    context: string,
    decision: string,
    reasoning: string,
    outcome: 'success' | 'failure' | 'pending'
  ): Promise<BorgMemory> {
    console.log(`🤔 Recording decision: ${decision}`)

    return this.borg.create({
      type: 'decision',
      content: {
        agentId: agent.id,
        context,
        decision,
        reasoning,
        outcome,
        timestamp: new Date()
      },
      source: 'pi-builder-agent',
      confidence: outcome === 'success' ? 0.9 : 0.5,
      tags: [`agent:${agent.id}`, `outcome:${outcome}`]
    })
  }

  /**
   * Extract and record patterns from successful tasks
   */
  async recordPattern(
    agent: Agent,
    pattern: string,
    applicability: string,
    successRate: number
  ): Promise<BorgMemory> {
    console.log(`🔄 Recording pattern: ${pattern}`)

    return this.borg.create({
      type: 'pattern',
      content: {
        agentId: agent.id,
        pattern,
        applicability,
        successRate,
        discovered: new Date()
      },
      source: 'pi-builder-agent',
      confidence: Math.min(0.99, successRate),
      tags: [`agent:${agent.id}`, 'pattern', `success-rate:${(successRate * 100).toFixed(0)}%`]
    })
  }

  /**
   * Record error and solution for learning
   */
  async recordErrorLearning(
    agent: Agent,
    error: string,
    rootCause: string,
    solution: string,
    prevention: string
  ): Promise<BorgMemory> {
    console.log(`⚠️ Recording error learning: ${error}`)

    return this.borg.create({
      type: 'error',
      content: {
        agentId: agent.id,
        error,
        rootCause,
        solution,
        prevention
      },
      source: 'pi-builder-agent',
      confidence: 0.8,
      tags: [`agent:${agent.id}`, 'error', 'learned']
    })
  }

  /**
   * Get agent performance from memory
   */
  async getAgentPerformance(agentId: string): Promise<{
    totalTasks: number
    successRate: number
    averageDuration: number
    topPatterns: string[]
    commonErrors: string[]
  }> {
    console.log(`📊 Analyzing performance for agent: ${agentId}`)

    const memories = await this.borg.list({
      type: 'task_execution',
      tags: [`agent:${agentId}`]
    })

    const successful = memories.filter((m) => m.tags.includes('completed')).length
    const avgDuration = memories.reduce((sum, m) => sum + (m.content.duration || 0), 0) / memories.length

    const patterns = await this.borg.list({
      type: 'pattern',
      tags: [`agent:${agentId}`]
    })

    const errors = await this.borg.list({
      type: 'error',
      tags: [`agent:${agentId}`]
    })

    return {
      totalTasks: memories.length,
      successRate: memories.length > 0 ? successful / memories.length : 0,
      averageDuration: avgDuration || 0,
      topPatterns: patterns.map((p) => p.content.pattern),
      commonErrors: errors.map((e) => e.content.error)
    }
  }

  /**
   * Find precedent for similar decision
   */
  async findPrecedent(context: string, limit: number = 3): Promise<MemorySearchResult[]> {
    console.log(`🔎 Searching for precedents: ${context}`)

    const precedents = await this.borg.search(context, {
      limit
    })

    return precedents.filter((r) => r.memory.type === 'decision' && r.relevance === 'high')
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<{
    totalMemories: number
    byType: Record<string, number>
    highConfidenceCount: number
    averageConfidence: number
  }> {
    const memories = await this.borg.list()

    const byType: Record<string, number> = {}
    let highConfidenceCount = 0
    let totalConfidence = 0

    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1

      if (memory.confidence > 0.8) highConfidenceCount++
      totalConfidence += memory.confidence
    }

    return {
      totalMemories: memories.length,
      byType,
      highConfidenceCount,
      averageConfidence: memories.length > 0 ? totalConfidence / memories.length : 0
    }
  }
}

/**
 * Agent with Borg Memory
 */
export class BorgAwareAgent extends BaseAgent {
  private borgMemory: BorgMemoryIntegration

  constructor(id: string, name: string, borgMemory: BorgMemoryIntegration) {
    super(id, name)
    this.borgMemory = borgMemory
  }

  async execute(task: Task): Promise<TaskResult> {
    return this.executeWithMemory(task)
  }

  async executeWithMemory(task: Task): Promise<any> {
    console.log(`🚀 Executing task with Borg memory: ${task.id}`)

    // Augment context with memories
    const startTime = Date.now()
    const contextAugmentation = await this.borgMemory.augmentContext(
      this,
      task,
      task.description || ''
    )

    console.log(`📝 Augmented context:\n${contextAugmentation.combined}`)

    // Execute task with augmented context
    const result = await this.execute(task)

    // Record outcome
    const duration = Date.now() - startTime
    const outcome = await this.borgMemory.recordOutcome(this, task, {
      success: result.success || false,
      duration,
      steps: (result.metadata?.steps as string[]) || [],
      errors: result.error ? [result.error] : [],
      artifacts: (result.metadata?.artifacts as string[]) || [],
      output: result.output
    })

    console.log(`✅ Task complete. Memory stored: ${outcome.id}`)

    return {
      ...result,
      memoryId: outcome.id,
      contextUsed: contextAugmentation
    }
  }
}
