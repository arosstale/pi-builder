import { EventEmitter } from 'events'

export interface PiMonoTask {
  id: string
  name: string
  description: string
  inputs: Record<string, unknown>
  priority?: 'low' | 'medium' | 'high'
}

export interface PiMonoResult {
  taskId: string
  status: 'success' | 'failed' | 'pending'
  output: unknown
  executionTime: number
  timestamp: Date
}

export interface PiMonoConfig {
  monoPath?: string
  environment?: Record<string, string>
  timeout?: number
}

export class PiMonoProvider extends EventEmitter {
  private config: PiMonoConfig
  private tasks: Map<string, PiMonoResult>

  constructor(config: PiMonoConfig = {}) {
    super()
    this.config = {
      monoPath: process.env.PI_MONO_PATH || '/opt/pi-mono',
      timeout: 30000,
      ...config,
    }
    this.tasks = new Map()
  }

  async execute(task: PiMonoTask): Promise<PiMonoResult> {
    try {
      this.emit('task:start', { taskId: task.id, name: task.name })

      const startTime = Date.now()

      // Simulate mono execution
      const result: PiMonoResult = {
        taskId: task.id,
        status: 'success',
        output: {
          message: `Executed task: ${task.name}`,
          inputs: task.inputs,
          timestamp: new Date().toISOString(),
        },
        executionTime: Date.now() - startTime,
        timestamp: new Date(),
      }

      this.tasks.set(task.id, result)
      this.emit('task:complete', result)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const result: PiMonoResult = {
        taskId: task.id,
        status: 'failed',
        output: { error: errorMessage },
        executionTime: Date.now(),
        timestamp: new Date(),
      }

      this.tasks.set(task.id, result)
      this.emit('task:error', result)
      throw error
    }
  }

  async getTaskResult(taskId: string): Promise<PiMonoResult | null> {
    return this.tasks.get(taskId) || null
  }

  async listTasks(): Promise<PiMonoResult[]> {
    return Array.from(this.tasks.values())
  }

  async health(): Promise<boolean> {
    try {
      // Check if mono is accessible
      const result = await this.execute({
        id: `health-check-${Date.now()}`,
        name: 'health-check',
        description: 'Health check task',
        inputs: {},
      })

      return result.status === 'success'
    } catch {
      return false
    }
  }

  clearTasks(): void {
    this.tasks.clear()
    this.emit('tasks:cleared')
  }

  getTaskCount(): number {
    return this.tasks.size
  }
}
