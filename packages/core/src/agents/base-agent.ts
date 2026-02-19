import { AgentLogger as Logger } from './logger'

export interface Task {
  id: string
  type: 'generate' | 'test' | 'review' | 'deploy'
  description: string
  context?: Record<string, any>
}

export interface TaskResult {
  taskId: string
  success: boolean
  output?: string
  error?: string
  executionTime?: number
  metadata?: Record<string, any>
}

export interface ExecutionPlan {
  taskId: string
  steps: string[]
  estimatedTime: number
  priority: 'low' | 'medium' | 'high'
}

export abstract class BaseAgent {
  public id: string
  protected name: string
  protected logger: Logger
  protected model: string = 'claude-3-5-sonnet-20241022'

  constructor(idOrName: string, name?: string) {
    if (name !== undefined) {
      this.id = idOrName
      this.name = name
    } else {
      this.id = idOrName
      this.name = idOrName
    }
    this.logger = new Logger(`Agent:${this.name}`)
  }

  /**
   * Execute a task and return results
   */
  abstract execute(task: Task): Promise<TaskResult>

  /**
   * Plan execution for a task
   */
  async plan(requirement: string): Promise<ExecutionPlan> {
    this.logger.info(`Planning: ${requirement}`)

    return {
      taskId: this.generateId(),
      steps: [
        'Analyze requirement',
        'Break into subtasks',
        'Create execution plan',
        'Validate against constraints'
      ],
      estimatedTime: 5,
      priority: 'high'
    }
  }

  /**
   * Verify task completion
   */
  async verify(output: string): Promise<boolean> {
    this.logger.info('Verifying output...')

    if (!output || output.trim().length === 0) {
      this.logger.error('Empty output')
      return false
    }

    return true
  }

  /**
   * Handle errors gracefully
   */
  protected async handleError(error: Error, task: Task): Promise<TaskResult> {
    this.logger.error(`Task failed: ${error.message}`)

    return {
      taskId: task.id,
      success: false,
      error: error.message,
      metadata: {
        timestamp: new Date().toISOString(),
        taskType: task.type
      }
    }
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Log execution
   */
  protected logExecution(task: Task, result: TaskResult): void {
    this.logger.info(`Execution complete: ${result.success ? '✅' : '❌'}`)
    this.logger.debug(`Result: ${JSON.stringify(result)}`)
  }
}
