/**
 * Enhanced Provider - Building on Auto Maker's BaseProvider with Metrics
 *
 * Adds:
 * - Health scoring
 * - Token tracking
 * - Cost awareness
 * - Performance metrics
 * - Capability declaration
 */

// Types defined locally (previously imported from removed types module)
export interface ProviderConfig {
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  apiKey?: string
  baseUrl?: string
  [key: string]: unknown
}

export interface ExecuteOptions {
  prompt: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  context?: Record<string, unknown>
}

export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: Record<string, unknown>
}

export interface InstallationStatus {
  installed: boolean
  version?: string
  path?: string
  error?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ModelDefinition {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  costPerInputToken: number
  costPerOutputToken: number
  capabilities: string[]
}

/**
 * Provider health metrics
 */
export interface ProviderHealthScore {
  availability: number // 0-1 (uptime percentage)
  latency: number // milliseconds (p95)
  errorRate: number // 0-1 (error percentage)
  costRatio: number // 0-1 (cost vs avg)
  recommendation: 'OPTIMAL' | 'ACCEPTABLE' | 'POOR' | 'UNKNOWN'
  lastUpdated: Date
}

/**
 * Provider execution metrics (per request)
 */
export interface ExecutionMetrics {
  startTime: number
  endTime?: number
  duration?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  cacheHit?: boolean
  provider: string
  model: string
  success: boolean
  errorType?: string
}

/**
 * Provider capability declaration
 */
export interface ProviderCapabilities {
  supportsVision: boolean
  supportsTools: boolean
  supportsMCP: boolean // Model Context Protocol
  supportsThinking: boolean
  supportsStreaming: boolean
  supportsImages: string[] // List of image formats
  supportsAudio: boolean
  supportsVideo: boolean
}

/**
 * Enhanced provider base class
 *
 * Extends Auto Maker's BaseProvider with:
 * - Health scoring
 * - Metrics collection
 * - Capability declaration
 * - Cost awareness
 */
export abstract class EnhancedProvider {
  public id: string
  public name: string
  public model: string
  protected config: ProviderConfig
  protected metrics: ExecutionMetrics[] = []
  protected healthScore: ProviderHealthScore = {
    availability: 1.0,
    latency: 0,
    errorRate: 0,
    costRatio: 1.0,
    recommendation: 'UNKNOWN',
    lastUpdated: new Date(),
  }

  constructor(config: ProviderConfig = {}) {
    this.config = config
    this.name = this.getName()
    this.id = this.name
    this.model = config.model ?? ''
  }

  /**
   * Get the provider name (e.g., "claude", "gpt-4", "gemini")
   */
  abstract getName(): string

  /**
   * Generate a completion (non-streaming).
   * Subclasses should override for real implementations.
   */
  async generate(options: {
    messages: ProviderMessage[]
    model?: string
    temperature?: number
    maxTokens?: number
  }): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
    throw new Error(`generate() not implemented for provider: ${this.name}`)
  }

  /**
   * Execute a query and stream responses
   * Enhanced to include metrics collection
   */
  abstract executeQuery(
    options: ExecuteOptions
  ): AsyncGenerator<ProviderMessage, ExecutionMetrics | undefined>

  /**
   * Detect if the provider is installed and configured
   */
  abstract detectInstallation(): Promise<InstallationStatus>

  /**
   * Get available models for this provider
   */
  abstract getAvailableModels(): ModelDefinition[]

  /**
   * Get provider capabilities (NEW in Pi Builder)
   */
  abstract getCapabilities(): ProviderCapabilities

  /**
   * Validate the provider configuration
   */
  validateConfig(): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config) {
      errors.push('Provider config is missing')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Check if the provider supports a specific feature
   */
  supportsFeature(feature: string): boolean {
    const capabilities = this.getCapabilities()

    switch (feature.toLowerCase()) {
      case 'vision':
      case 'image':
        return capabilities.supportsVision
      case 'tools':
      case 'function_calling':
        return capabilities.supportsTools
      case 'mcp':
        return capabilities.supportsMCP
      case 'thinking':
      case 'extended_thinking':
        return capabilities.supportsThinking
      case 'streaming':
        return capabilities.supportsStreaming
      case 'audio':
        return capabilities.supportsAudio
      case 'video':
        return capabilities.supportsVideo
      default:
        return false
    }
  }

  /**
   * Get token limit for a specific model
   */
  abstract getTokenLimitForModel(modelId: string): number

  /**
   * Get cost per token for input and output
   * Returns: { input: number, output: number } (cost per 1k tokens)
   */
  abstract getCostPerToken(modelId: string): { input: number; output: number }

  /**
   * Calculate cost for a request
   */
  calculateCost(inputTokens: number, outputTokens: number, modelId: string): number {
    const cost = this.getCostPerToken(modelId)
    return (inputTokens / 1000) * cost.input + (outputTokens / 1000) * cost.output
  }

  /**
   * Generate cache key for a request (for intelligent caching)
   */
  abstract getCacheKey(request: ExecuteOptions): string

  /**
   * Get current health score
   */
  getHealthScore(): ProviderHealthScore {
    return this.healthScore
  }

  /**
   * Update health score (called by ProviderMonitor)
   */
  setHealthScore(score: ProviderHealthScore): void {
    this.healthScore = score
    this.healthScore.lastUpdated = new Date()
  }

  /**
   * Record an execution metric
   */
  recordMetric(metric: ExecutionMetrics): void {
    this.metrics.push(metric)

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): ExecutionMetrics[] {
    return this.metrics.slice(-count)
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = []
  }

  /**
   * Get provider configuration
   */
  getConfig(): ProviderConfig {
    return this.config
  }

  /**
   * Update provider configuration
   */
  setConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * SDK-based provider (replaces CLI-based approach)
 *
 * Instead of spawning CLI tools, use native SDKs for:
 * - Better performance (10-100x faster)
 * - More reliable
 * - Easier error handling
 * - Built-in streaming
 */
export abstract class SdkBasedProvider extends EnhancedProvider {
  protected sdkClient: any // Subclasses provide typed client

  /**
   * Execute via SDK (not CLI)
   * Much simpler than CLI spawning
   */
  abstract executeQuery(
    options: ExecuteOptions
  ): AsyncGenerator<ProviderMessage, ExecutionMetrics | undefined>
}
