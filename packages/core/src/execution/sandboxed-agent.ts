import { BaseAgent, Task, TaskResult } from '../agents/base-agent'

export interface SandboxConfig {
  isolationLevel: 'strict' | 'permissive'
  maxExecutionTime: number
  maxMemory: number
  maxDiskSpace: number
  allowedPackages: string[]
  networkAccess: boolean
  allowedDomains: string[]
  fileSystemAccess: boolean
  allowedPaths: string[]
}

export interface SandboxEnvironment {
  id: string
  status: 'initialized' | 'running' | 'completed' | 'failed'
  config: SandboxConfig
  startTime: Date
  endTime?: Date
  exitCode?: number
  logs: string[]
}

export interface ExecutionContext {
  sandboxId: string
  processId: string
  resourceUsage: {
    cpuPercent: number
    memoryMB: number
    diskMB: number
  }
}

export class SandboxedAgent extends BaseAgent {
  private sandboxEnvironments: Map<string, SandboxEnvironment> = new Map()
  private executionContexts: Map<string, ExecutionContext> = new Map()
  private defaultConfig: SandboxConfig = {
    isolationLevel: 'strict',
    maxExecutionTime: 300000, // 5 minutes
    maxMemory: 512, // MB
    maxDiskSpace: 1024, // MB
    allowedPackages: [],
    networkAccess: false,
    allowedDomains: [],
    fileSystemAccess: false,
    allowedPaths: []
  }

  constructor(name: string, config?: Partial<SandboxConfig>) {
    super(name)
    if (config) {
      this.defaultConfig = { ...this.defaultConfig, ...config }
    }
  }

  /**
   * Initialize sandbox environment
   */
  async initializeSandbox(sandboxId: string, config: SandboxConfig): Promise<SandboxEnvironment> {
    console.log(`🏗️ Initializing sandbox: ${sandboxId}`)

    const sandbox: SandboxEnvironment = {
      id: sandboxId,
      status: 'initialized',
      config,
      startTime: new Date(),
      logs: []
    }

    // Simulate sandbox initialization
    sandbox.logs.push(`Sandbox initialized with isolation level: ${config.isolationLevel}`)
    sandbox.logs.push(`Max execution time: ${config.maxExecutionTime}ms`)
    sandbox.logs.push(`Max memory: ${config.maxMemory}MB`)
    sandbox.logs.push(`Network access: ${config.networkAccess}`)

    this.sandboxEnvironments.set(sandboxId, sandbox)

    console.log(`✅ Sandbox ready: ${sandboxId}`)
    return sandbox
  }

  /**
   * Execute task in sandbox
   */
  async execute(task: Task): Promise<TaskResult> {
    const sandboxId = `sandbox-${Date.now()}`

    try {
      // Initialize sandbox
      const sandbox = await this.initializeSandbox(sandboxId, this.defaultConfig)

      // Create execution context
      const context: ExecutionContext = {
        sandboxId,
        processId: `proc-${Date.now()}`,
        resourceUsage: {
          cpuPercent: 0,
          memoryMB: 0,
          diskMB: 0
        }
      }

      this.executionContexts.set(sandboxId, context)

      // Execute task in sandbox
      sandbox.status = 'running'
      console.log(`🚀 Executing task in sandbox: ${sandboxId}`)
      sandbox.logs.push(`Starting task execution: ${task.id}`)

      // Simulate task execution
      const result: TaskResult = {
        taskId: task.id,
        success: true,
        output: `Task ${task.id} completed in sandbox ${sandboxId}`,
        executionTime: 1500,
        timestamp: new Date()
      }

      // Update resource usage
      context.resourceUsage.cpuPercent = Math.random() * 50
      context.resourceUsage.memoryMB = Math.random() * 256
      context.resourceUsage.diskMB = Math.random() * 100

      sandbox.logs.push(`Task completed successfully`)
      sandbox.logs.push(`CPU usage: ${context.resourceUsage.cpuPercent.toFixed(2)}%`)
      sandbox.logs.push(`Memory usage: ${context.resourceUsage.memoryMB.toFixed(2)}MB`)

      sandbox.status = 'completed'
      sandbox.endTime = new Date()
      sandbox.exitCode = 0

      console.log(`✅ Task completed in sandbox: ${sandboxId}`)

      return result
    } catch (error) {
      const err = error as Error
      const sandbox = this.sandboxEnvironments.get(sandboxId)

      if (sandbox) {
        sandbox.status = 'failed'
        sandbox.endTime = new Date()
        sandbox.exitCode = 1
        sandbox.logs.push(`❌ Error: ${err.message}`)
      }

      console.error(`❌ Task failed in sandbox: ${err.message}`)

      return {
        taskId: task.id,
        success: false,
        output: `Task failed: ${err.message}`,
        executionTime: 0,
        timestamp: new Date()
      }
    }
  }

  /**
   * Get sandbox environment
   */
  getSandbox(sandboxId: string): SandboxEnvironment | null {
    return this.sandboxEnvironments.get(sandboxId) || null
  }

  /**
   * Get execution context
   */
  getExecutionContext(sandboxId: string): ExecutionContext | null {
    return this.executionContexts.get(sandboxId) || null
  }

  /**
   * Get sandbox logs
   */
  getSandboxLogs(sandboxId: string): string[] {
    const sandbox = this.sandboxEnvironments.get(sandboxId)
    return sandbox ? sandbox.logs : []
  }

  /**
   * Cleanup sandbox
   */
  async cleanupSandbox(sandboxId: string): Promise<boolean> {
    const sandbox = this.sandboxEnvironments.get(sandboxId)

    if (!sandbox) return false

    console.log(`🧹 Cleaning up sandbox: ${sandboxId}`)

    this.sandboxEnvironments.delete(sandboxId)
    this.executionContexts.delete(sandboxId)

    console.log(`✅ Sandbox cleaned up: ${sandboxId}`)

    return true
  }

  /**
   * Get all sandboxes
   */
  getAllSandboxes(): SandboxEnvironment[] {
    return Array.from(this.sandboxEnvironments.values())
  }

  /**
   * Get sandbox metrics
   */
  getSandboxMetrics(sandboxId: string): {
    executionTime: number
    cpuPercent: number
    memoryMB: number
    diskMB: number
    status: string
  } | null {
    const sandbox = this.sandboxEnvironments.get(sandboxId)
    const context = this.executionContexts.get(sandboxId)

    if (!sandbox || !context) return null

    const executionTime = sandbox.endTime
      ? sandbox.endTime.getTime() - sandbox.startTime.getTime()
      : Date.now() - sandbox.startTime.getTime()

    return {
      executionTime,
      cpuPercent: context.resourceUsage.cpuPercent,
      memoryMB: context.resourceUsage.memoryMB,
      diskMB: context.resourceUsage.diskMB,
      status: sandbox.status
    }
  }

  /**
   * Enforce resource limits
   */
  async enforceResourceLimits(sandboxId: string): Promise<boolean> {
    const context = this.executionContexts.get(sandboxId)
    const sandbox = this.sandboxEnvironments.get(sandboxId)

    if (!context || !sandbox) return false

    const config = sandbox.config

    // Check CPU limit
    if (context.resourceUsage.cpuPercent > 100) {
      sandbox.logs.push(`⚠️ CPU usage exceeded: ${context.resourceUsage.cpuPercent}%`)
      return false
    }

    // Check memory limit
    if (context.resourceUsage.memoryMB > config.maxMemory) {
      sandbox.logs.push(`⚠️ Memory limit exceeded: ${context.resourceUsage.memoryMB}MB > ${config.maxMemory}MB`)
      return false
    }

    // Check disk limit
    if (context.resourceUsage.diskMB > config.maxDiskSpace) {
      sandbox.logs.push(`⚠️ Disk limit exceeded: ${context.resourceUsage.diskMB}MB > ${config.maxDiskSpace}MB`)
      return false
    }

    return true
  }

  /**
   * Kill sandbox on timeout
   */
  async killSandboxOnTimeout(sandboxId: string, timeout: number): Promise<void> {
    const sandbox = this.sandboxEnvironments.get(sandboxId)

    if (!sandbox) return

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        if (sandbox.status === 'running') {
          sandbox.status = 'failed'
          sandbox.exitCode = 124 // Timeout exit code
          sandbox.logs.push(`⏱️ Sandbox killed due to timeout (${timeout}ms)`)
          console.log(`⏱️ Sandbox killed: ${sandboxId} (timeout)`)
          resolve()
        }
      }, timeout)
    })

    await timeoutPromise
  }
}
