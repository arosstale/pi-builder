import { ClaudeAgent } from '../agents/claude-agent'
import { Task, TaskResult } from '../agents/base-agent'

export interface ModelConfig {
  name: 'claude' | 'gemini' | 'local' | 'custom'
  cost: number // relative cost (1.0 = baseline)
  speed: number // relative speed (1.0 = baseline)
  quality: number // relative quality (1.0 = baseline)
  available: boolean
}

export type ModelPriority = 'cost' | 'speed' | 'quality' | 'balanced'

export class StitchCoordinator {
  private models: Map<string, ModelConfig> = new Map()
  private taskHistory: Map<string, string> = new Map() // Track model usage

  constructor() {
    this.registerModel('claude', {
      name: 'claude',
      cost: 1.0,
      speed: 1.0,
      quality: 1.0,
      available: true
    })

    this.registerModel('gemini', {
      name: 'gemini',
      cost: 0.7,
      speed: 1.2,
      quality: 0.9,
      available: true
    })

    this.registerModel('local', {
      name: 'local',
      cost: 0.1,
      speed: 0.8,
      quality: 0.7,
      available: false // Not implemented yet
    })
  }

  private registerModel(name: string, config: ModelConfig): void {
    this.models.set(name, config)
  }

  /**
   * Select best model for a task based on priority
   */
  selectModel(
    task: Task,
    priority: ModelPriority = 'quality'
  ): string {
    const scores: Record<string, number> = {}
    const weights = {
      cost: 0.3,
      speed: 0.3,
      quality: 0.4
    }

    for (const [name, config] of this.models) {
      if (!config.available) continue

      let score = 0

      switch (priority) {
        case 'cost':
          // Lower cost = higher score
          score = (1 / config.cost) * 0.7 +
                  config.speed * 0.2 +
                  config.quality * 0.1
          break

        case 'speed':
          // Higher speed = higher score
          score = config.speed * 0.7 +
                  (1 / config.cost) * 0.2 +
                  config.quality * 0.1
          break

        case 'quality':
          // Higher quality = higher score (default)
          // Claude has perfect scores, so it should win on quality
          score = config.quality * 0.6 +
                  config.speed * 0.2 +
                  (1 / config.cost) * 0.2
          break

        case 'balanced':
          // Equal weighting
          score = (1 / config.cost) * weights.cost +
                  config.speed * weights.speed +
                  config.quality * weights.quality
          break
      }

      scores[name] = score
    }

    // Select best model
    let bestModel = 'claude'
    let bestScore = scores['claude'] ?? 0

    for (const [name, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestModel = name
        bestScore = score
      }
    }

    // For quality priority, always prefer Claude if available
    if (priority === 'quality' && this.models.get('claude')?.available) {
      return 'claude'
    }

    return bestModel
  }

  /**
   * Route task to appropriate model
   */
  async routeTask(
    task: Task,
    priority: ModelPriority = 'quality'
  ): Promise<TaskResult> {
    const selectedModel = this.selectModel(task, priority)

    console.log(`🔀 Routing task ${task.id} to: ${selectedModel}`)
    this.taskHistory.set(task.id, selectedModel)

    // Route to appropriate agent
    if (selectedModel === 'claude') {
      const agent = new ClaudeAgent()
      return agent.execute(task)
    } else if (selectedModel === 'gemini') {
      // TODO: Implement GeminiAgent
      console.warn('Gemini agent not yet implemented, falling back to Claude')
      const agent = new ClaudeAgent()
      return agent.execute(task)
    } else if (selectedModel === 'local') {
      // TODO: Implement LocalAgent
      console.warn('Local agent not yet implemented, falling back to Claude')
      const agent = new ClaudeAgent()
      return agent.execute(task)
    }

    throw new Error(`Unknown model: ${selectedModel}`)
  }

  /**
   * Get model statistics
   */
  getModelStats(): Record<string, ModelConfig> {
    const stats: Record<string, ModelConfig> = {}

    for (const [name, config] of this.models) {
      stats[name] = { ...config }
    }

    return stats
  }

  /**
   * Get task routing history
   */
  getTaskHistory(): Record<string, string> {
    return new Map(this.taskHistory)
  }

  /**
   * Calculate cost savings for a set of tasks
   */
  calculateSavings(taskCount: number, priority: ModelPriority = 'cost'): number {
    const claudeConfig = this.models.get('claude')
    const selectedModel = this.selectModel({ id: 'test', type: 'generate', description: 'test' }, priority)
    const selectedConfig = this.models.get(selectedModel)

    if (!claudeConfig || !selectedConfig) {
      return 0
    }

    const claudeCost = taskCount * claudeConfig.cost
    const optimizedCost = taskCount * selectedConfig.cost

    return claudeCost - optimizedCost
  }

  /**
   * Get model availability
   */
  isModelAvailable(modelName: string): boolean {
    const config = this.models.get(modelName)
    return config?.available || false
  }

  /**
   * Enable/disable a model
   */
  setModelAvailability(modelName: string, available: boolean): void {
    const config = this.models.get(modelName)
    if (config) {
      config.available = available
    }
  }
}

// Singleton instance
export const stitch = new StitchCoordinator()
