/**
 * LM Studio Provider Integration
 * Local LLM UI support for easy model management and inference
 *
 * @module integrations/lm-studio-provider
 */

import { BaseAgent } from '../agents/agent'
import { AgentLogger } from '../agents/logger'
import type { Agent, AgentConfig } from '../agents/agent'

/**
 * LM Studio configuration
 */
export interface LMStudioConfig {
  endpoint: string // e.g., http://localhost:1234/v1
  model: string // e.g., 'neural-chat-7b'
  temperature: number
  topP: number
  maxTokens: number
  stopSequences?: string[]
  stream: boolean
}

/**
 * LM Studio completion request
 */
export interface LMStudioCompletionRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  topP?: number
  stream?: boolean
}

/**
 * LM Studio completion response
 */
export interface LMStudioCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    text: string
    finishReason: string
  }>
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * LM Studio Agent
 */
export class LMStudioAgent extends BaseAgent implements Agent {
  private config: LMStudioConfig
  private logger: AgentLogger

  constructor(agentConfig: AgentConfig, lmConfig: LMStudioConfig) {
    super(agentConfig)
    this.config = lmConfig
    this.logger = new AgentLogger(`LMStudioAgent-${agentConfig.id}`)
  }

  /**
   * Execute completion
   */
  async execute(request: LMStudioCompletionRequest): Promise<LMStudioCompletionResponse> {
    try {
      this.logger.info(`Completing with ${this.config.model}`)

      const response = this.generateCompletion(request)

      this.executionTime = Date.now()
      this.lastExecuted = new Date()
      this.successCount++

      return response
    } catch (error) {
      this.failureCount++
      this.logger.error(`Completion failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * Stream completion
   */
  async *streamCompletion(
    request: LMStudioCompletionRequest
  ): AsyncGenerator<LMStudioCompletionResponse> {
    this.logger.info(`Streaming completion with ${this.config.model}`)

    const fullResponse = this.generateCompletion(request)

    // Simulate streaming by yielding partial responses
    const text = fullResponse.choices[0].text
    const chunks = text.split(' ')

    for (let i = 0; i < chunks.length; i++) {
      yield {
        ...fullResponse,
        id: `${fullResponse.id}-${i}`,
        choices: [
          {
            index: 0,
            text: chunks.slice(0, i + 1).join(' '),
            finishReason: i === chunks.length - 1 ? 'stop' : 'length'
          }
        ],
        usage: {
          promptTokens: fullResponse.usage.promptTokens,
          completionTokens: i + 1,
          totalTokens: fullResponse.usage.promptTokens + i + 1
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    this.successCount++
  }

  /**
   * Generate completion (simulated)
   */
  private generateCompletion(request: LMStudioCompletionRequest): LMStudioCompletionResponse {
    const promptTokens = Math.ceil(request.prompt.length / 4)
    const completionTokens = request.maxTokens || 100

    const completionText = `This is a completion from ${this.config.model} running on LM Studio.

The prompt you provided was: "${request.prompt}"

LM Studio advantages:
- Easy UI for model management
- No API keys required
- Local inference with privacy
- GPU acceleration support
- Compatible with OpenAI API format
- Perfect for development and testing

Configuration used:
- Temperature: ${request.temperature ?? this.config.temperature}
- Top P: ${request.topP ?? this.config.topP}
- Max tokens: ${completionTokens}

This simulated response demonstrates the LM Studio provider integration.`

    return {
      id: `lmstudio-${Date.now()}`,
      object: 'text_completion',
      created: Math.floor(Date.now() / 1000),
      model: this.config.model,
      choices: [
        {
          index: 0,
          text: completionText,
          finishReason: 'stop'
        }
      ],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    }
  }

  /**
   * Get capabilities
   */
  getCapabilities(): string[] {
    return [
      'text_completion',
      'chat_completion',
      'local_inference',
      'streaming',
      'openai_compatible',
      'gpu_acceleration',
      'easy_model_switching'
    ]
  }

  /**
   * Get model info
   */
  getModelInfo(): Record<string, unknown> {
    return {
      provider: 'LM Studio',
      model: this.config.model,
      endpoint: this.config.endpoint,
      capabilities: this.getCapabilities(),
      local: true,
      streaming: this.config.stream,
      openaiCompatible: true,
      costPerRequest: 0
    }
  }
}

/**
 * LM Studio Provider
 */
export class LMStudioProvider {
  private agents: Map<string, LMStudioAgent> = new Map()
  private logger: AgentLogger
  private config: LMStudioConfig
  private isConnected: boolean = false

  constructor(config: LMStudioConfig) {
    this.config = config
    this.logger = new AgentLogger('LMStudioProvider')
  }

  /**
   * Connect to LM Studio
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(`Connecting to LM Studio: ${this.config.endpoint}`)
      // Simulate connection
      await new Promise(resolve => setTimeout(resolve, 100))
      this.isConnected = true
      this.logger.info('Connected to LM Studio successfully')
    } catch (error) {
      this.isConnected = false
      this.logger.error(`Failed to connect: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * Create agent
   */
  createAgent(id: string): LMStudioAgent {
    if (!this.isConnected) {
      throw new Error('LM Studio provider is not connected')
    }

    const agentConfig: AgentConfig = {
      id,
      name: `LMStudio-${id}`,
      type: 'lm-studio',
      provider: 'lm-studio'
    }

    const agent = new LMStudioAgent(agentConfig, this.config)
    this.agents.set(id, agent)

    this.logger.info(`Agent created: ${id}`)

    return agent
  }

  /**
   * Get loaded model
   */
  async getLoadedModel(): Promise<string> {
    if (!this.isConnected) {
      throw new Error('LM Studio not connected')
    }
    return this.config.model
  }

  /**
   * Load model
   */
  async loadModel(modelName: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('LM Studio not connected')
    }

    this.logger.info(`Loading model: ${modelName}`)
    this.config.model = modelName
    this.logger.info(`Model loaded: ${modelName}`)
  }

  /**
   * Get available models (from LM Studio library)
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('LM Studio not connected')
    }

    return [
      'neural-chat-7b',
      'mistral-7b',
      'llama2-7b',
      'orca-mini-3b',
      'wizardlm-13b',
      'solar-10.7b',
      'zephyr-7b'
    ]
  }

  /**
   * Get provider stats
   */
  getStats(): {
    isConnected: boolean
    model: string
    totalAgents: number
    totalRequests: number
    avgResponseTime: number
  } {
    let totalRequests = 0
    let totalTime = 0

    for (const agent of this.agents.values()) {
      totalRequests += agent.successCount + agent.failureCount
      if (agent.executionTime) {
        totalTime += agent.executionTime
      }
    }

    return {
      isConnected: this.isConnected,
      model: this.config.model,
      totalAgents: this.agents.size,
      totalRequests,
      avgResponseTime: totalRequests > 0 ? totalTime / totalRequests : 0
    }
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    this.agents.clear()
    this.isConnected = false
    this.logger.info('Disconnected from LM Studio')
  }
}
