import { BaseAgent, Task, TaskResult } from '../agents/base-agent'
import { agentRegistry } from '../agents/agent-registry'

export interface AntfarmConfig {
  maxConcurrentTasks: number
  taskTimeout: number
  retryPolicy: {
    maxRetries: number
    backoffMultiplier: number
  }
}

export interface WorkerTask {
  id: string
  agentName: string
  task: Task
  priority: number
  dependencies: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: TaskResult
  error?: string
  retries: number
}

export interface OrchestratorStats {
  totalTasks: number
  completedTasks: number
  failedTasks: number
  runningTasks: number
  averageExecutionTime: number
  successRate: number
}

export class AntfarmOrchestrator {
  private config: AntfarmConfig
  private taskQueue: Map<string, WorkerTask> = new Map()
  private runningTasks: Map<string, Promise<TaskResult>> = new Map()
  private completedTasks: Map<string, TaskResult> = new Map()
  private failedTasks: Map<string, Error> = new Map()
  private executionTimes: Map<string, number> = new Map()

  constructor(config: AntfarmConfig) {
    this.config = config
    this.validateConfig()
  }

  private validateConfig(): void {
    if (this.config.maxConcurrentTasks < 1) {
      throw new Error('maxConcurrentTasks must be at least 1')
    }
    if (this.config.taskTimeout < 100) {
      throw new Error('taskTimeout must be at least 100ms')
    }
  }

  /**
   * Submit a task for execution
   */
  async submitTask(
    agentName: string,
    task: Task,
    priority: number = 0,
    dependencies: string[] = []
  ): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`

    const workerTask: WorkerTask = {
      id: taskId,
      agentName,
      task,
      priority,
      dependencies,
      status: 'pending',
      retries: 0
    }

    this.taskQueue.set(taskId, workerTask)
    console.log(`📝 Antfarm: Task ${taskId} submitted to ${agentName}`)

    // Start processing if we have capacity
    this.processNextTask()

    return taskId
  }

  /**
   * Process the next task from the queue
   */
  private async processNextTask(): Promise<void> {
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) {
      return // At capacity
    }

    // Find pending task with highest priority
    let nextTask: WorkerTask | null = null
    let maxPriority = -Infinity
    let selectedTaskId = ''

    for (const [taskId, task] of this.taskQueue.entries()) {
      if (task.status === 'pending' && this.dependenciesMet(task)) {
        if (task.priority > maxPriority) {
          maxPriority = task.priority
          nextTask = task
          selectedTaskId = taskId
        }
      }
    }

    if (!nextTask) {
      return // No pending tasks
    }

    // Mark as running
    nextTask.status = 'running'

    // Execute task
    const startTime = Date.now()
    const promise = this.executeTask(nextTask)
    this.runningTasks.set(selectedTaskId, promise)

    promise
      .then((result) => {
        nextTask!.status = 'completed'
        nextTask!.result = result
        const executionTime = Date.now() - startTime
        this.executionTimes.set(selectedTaskId, executionTime)
        this.completedTasks.set(selectedTaskId, result)
        console.log(`✅ Antfarm: Task ${selectedTaskId} completed in ${executionTime}ms`)
      })
      .catch((error) => {
        const err = error as Error
        nextTask!.error = err.message
        this.failedTasks.set(selectedTaskId, err)

        if (nextTask!.retries < this.config.retryPolicy.maxRetries) {
          nextTask!.retries++
          nextTask!.status = 'pending'
          console.log(`⚠️ Antfarm: Task ${selectedTaskId} failed, retry ${nextTask!.retries}`)
          setTimeout(() => this.processNextTask(), 100 * Math.pow(this.config.retryPolicy.backoffMultiplier, nextTask!.retries))
        } else {
          nextTask!.status = 'failed'
          console.log(`❌ Antfarm: Task ${selectedTaskId} failed permanently`)
        }
      })
      .finally(() => {
        this.runningTasks.delete(selectedTaskId)
        // Process next task
        this.processNextTask()
      })
  }

  /**
   * Execute a task with the appropriate agent
   */
  private async executeTask(workerTask: WorkerTask): Promise<TaskResult> {
    try {
      const agent = agentRegistry.findAgent(workerTask.agentName)
      if (!agent) throw new Error(`Agent not found: ${workerTask.agentName}`)
      console.log(`🚀 Antfarm: Executing task ${workerTask.id} with agent ${workerTask.agentName}`)

      const result = await Promise.race([
        (agent as unknown as { execute: (t: unknown) => Promise<TaskResult> }).execute(workerTask.task),
        new Promise<TaskResult>((_, reject) =>
          setTimeout(() => reject(new Error('Task timeout')), this.config.taskTimeout)
        )
      ])

      return result
    } catch (error) {
      throw error
    }
  }

  /**
   * Check if all dependencies are met
   */
  private dependenciesMet(task: WorkerTask): boolean {
    if (task.dependencies.length === 0) {
      return true
    }

    return task.dependencies.every((depId) => {
      const depTask = this.taskQueue.get(depId)
      return depTask && depTask.status === 'completed'
    })
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): WorkerTask | null {
    return this.taskQueue.get(taskId) || null
  }

  /**
   * Wait for task completion
   */
  async waitForTask(taskId: string): Promise<TaskResult | null> {
    const task = this.taskQueue.get(taskId)
    if (!task) return null

    // Poll until completion
    while (task.status === 'pending' || task.status === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return task.result || null
  }

  /**
   * Batch submit multiple tasks
   */
  async submitBatch(
    tasks: Array<{
      agentName: string
      task: Task
      priority?: number
      dependencies?: string[]
    }>
  ): Promise<string[]> {
    const taskIds: string[] = []

    for (const item of tasks) {
      const taskId = await this.submitTask(
        item.agentName,
        item.task,
        item.priority || 0,
        item.dependencies || []
      )
      taskIds.push(taskId)
    }

    return taskIds
  }

  /**
   * Wait for all tasks in batch
   */
  async waitForBatch(taskIds: string[]): Promise<(TaskResult | null)[]> {
    return Promise.all(taskIds.map((id) => this.waitForTask(id)))
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): OrchestratorStats {
    const totalTasks = this.taskQueue.size
    const completedTasks = this.completedTasks.size
    const failedTasks = this.failedTasks.size
    const runningTasks = this.runningTasks.size

    const executionTimes = Array.from(this.executionTimes.values())
    const averageExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0

    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      runningTasks,
      averageExecutionTime,
      successRate
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.taskQueue.get(taskId)
    if (!task) return false

    if (task.status === 'pending' || task.status === 'running') {
      task.status = 'failed'
      task.error = 'Task cancelled'
      return true
    }

    return false
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.taskQueue.clear()
    this.runningTasks.clear()
    this.completedTasks.clear()
    this.failedTasks.clear()
    this.executionTimes.clear()
    console.log('✅ Antfarm: Orchestrator reset')
  }
}
