/**
 * Core Agent Interface and Types
 * Defines the contract for all agents in the orchestration system
 *
 * @module agents/agent
 */

/**
 * Represents the health status of an agent
 */
export interface AgentHealth {
  isHealthy: boolean
  uptime: number // in milliseconds
  lastCheck: Date
  errorRate: number // 0-1
  avgLatency: number // in milliseconds
  successCount: number
  errorCount: number
  metadata?: Record<string, unknown>
}

/**
 * Task result with metadata
 */
export interface TaskResult {
  success: boolean
  data?: unknown
  error?: Error | string
  latency?: number // in milliseconds
  cost?: number // in dollars
  metadata?: Record<string, unknown>
  // Extended fields used by sandboxed and other agents
  taskId?: string
  output?: unknown
  executionTime?: number
}

/**
 * Task input for agents
 */
export interface Task {
  id: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  input: unknown
  metadata?: Record<string, unknown>
  timeout?: number // in milliseconds
  retryCount?: number
  createdAt: Date
}

/**
 * Agent capability definition
 */
export interface AgentCapability {
  name: string
  description: string
  version: string
  supported: boolean
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string
  type: AgentType
  name: string
  description?: string
  version: string
  enabled: boolean
  capabilities: string[]
  timeout?: number
  retryPolicy?: {
    maxRetries: number
    backoffMultiplier: number
    initialDelayMs: number
  }
  metadata?: Record<string, unknown>
}

/**
 * Agent types supported in the system
 */
export type AgentType = 'pi' | 'claude' | 'code' | 'research' | 'custom'

/**
 * Base Agent interface - all agents must implement this
 */
export interface IAgent {
  /**
   * Unique identifier for the agent
   */
  id: string

  /**
   * Type of agent
   */
  type: AgentType

  /**
   * Human-readable name
   */
  name: string

  /**
   * List of capabilities this agent has
   */
  capabilities: string[]

  /**
   * Execute a task and return result
   * @param task - The task to execute
   * @returns Promise resolving to task result
   */
  execute(task: Task): Promise<TaskResult>

  /**
   * Get current health status
   * @returns Promise resolving to health status
   */
  getHealth(): Promise<AgentHealth>

  /**
   * Check if agent supports a specific capability
   * @param capability - The capability to check
   * @returns True if capable, false otherwise
   */
  hasCapability(capability: string): boolean

  /**
   * Learn from a task outcome - used for feedback loop
   * @param task - The task that was executed
   * @param result - The result of the task
   * @param feedback - Optional feedback from user/system
   */
  learn(task: Task, result: TaskResult, feedback?: unknown): Promise<void>

  /**
   * Initialize the agent
   */
  initialize(): Promise<void>

  /**
   * Shutdown the agent gracefully
   */
  shutdown(): Promise<void>
}

/**
 * Base Agent implementation with common functionality
 */
export abstract class BaseAgent implements IAgent {
  public id: string
  public type: AgentType
  public name: string
  public capabilities: string[]

  protected config: AgentConfig
  protected startTime: Date
  protected successCount: number = 0
  protected errorCount: number = 0
  protected totalLatency: number = 0

  constructor(configOrId: AgentConfig | string, name?: string) {
    // Support both (AgentConfig) and (id: string, name?: string) call signatures
    let config: AgentConfig
    if (typeof configOrId === 'string') {
      config = {
        id: configOrId,
        type: 'custom' as AgentType,
        name: name ?? configOrId,
        version: '1.0.0',
        enabled: true,
        capabilities: [],
      }
    } else {
      config = configOrId
    }

    if (!config.id || !config.type || !config.name) {
      throw new Error('Agent config must include id, type, and name')
    }

    this.config = config
    this.id = config.id
    this.type = config.type
    this.name = config.name
    this.capabilities = config.capabilities || []
    this.startTime = new Date()
  }

  /**
   * Check if agent supports a capability
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability)
  }

  /**
   * Get current health status
   */
  async getHealth(): Promise<AgentHealth> {
    const uptime = Date.now() - this.startTime.getTime()
    const totalCount = this.successCount + this.errorCount
    const errorRate = totalCount > 0 ? this.errorCount / totalCount : 0

    return {
      isHealthy: errorRate < 0.1 && this.successCount > 0,
      uptime,
      lastCheck: new Date(),
      errorRate,
      avgLatency: totalCount > 0 ? this.totalLatency / totalCount : 0,
      successCount: this.successCount,
      errorCount: this.errorCount,
      metadata: {
        config: this.config
      }
    }
  }

  /**
   * Record task execution metrics
   */
  protected recordExecution(success: boolean, latency: number): void {
    if (success) {
      this.successCount++
    } else {
      this.errorCount++
    }
    this.totalLatency += latency
  }

  /**
   * Default implementation of learn - can be overridden
   */
  async learn(task: Task, result: TaskResult, feedback?: unknown): Promise<void> {
    // Default: do nothing, subclasses can override
  }

  /**
   * Default initialization - can be overridden
   */
  async initialize(): Promise<void> {
    // Default: do nothing
  }

  /**
   * Default shutdown - can be overridden
   */
  async shutdown(): Promise<void> {
    // Default: do nothing
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract execute(task: Task): Promise<TaskResult>
}

/**
 * Agent execution event for event streaming
 */
export interface AgentExecutionEvent {
  agentId: string
  taskId: string
  type: 'start' | 'progress' | 'complete' | 'error'
  timestamp: Date
  data?: unknown
}

/**
 * Agent result aggregation for multi-agent scenarios
 */
export interface AggregatedResult {
  taskId: string
  results: Map<string, TaskResult>
  consensus?: unknown
  votes?: Map<string, number>
  bestResult?: TaskResult
  executionTime: number
  timestamp: Date
}
