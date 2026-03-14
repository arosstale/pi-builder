/**
 * Model Registry - Centralized searchable database of all models
 *
 * Replaces Auto Maker's per-provider model definitions with:
 * - Searchable registry with 20+ models
 * - Token limits per model
 * - Cost tracking
 * - Capability matrix
 * - Provider independence
 */

export interface Model {
  id: string
  name: string
  provider: string // 'claude', 'openai', 'google', etc.
  displayName: string
  description?: string

  // Token limits
  contextWindow: number // e.g., 200000
  maxOutputTokens: number // e.g., 4096

  // Cost (per 1K tokens)
  costInput: number // e.g., 0.003 for $3 per 1M tokens
  costOutput: number

  // Capabilities
  supportsVision: boolean
  supportsTools: boolean
  supportsMCP: boolean
  supportsThinking: boolean
  supportsStreaming: boolean
  supportsImages: string[] // ['jpeg', 'png', 'gif', 'webp']
  supportsAudio: boolean
  supportsVideo: boolean

  // Metadata
  releaseDate: Date
  status: 'active' | 'beta' | 'deprecated'
  category?: string // 'base', 'instruct', 'specialized'

  // Additional info
  knowledgeCutoff?: Date
  trainingDataSize?: string
  averageLatency?: number // milliseconds (p95)
  tokenPer1k?: number // tokens per 1k requests (for planning)
}

/**
 * Search criteria for finding models
 */
export interface ModelSearchCriteria {
  provider?: string
  minContextWindow?: number
  maxCost?: number // per 1k tokens
  capabilities?: string[] // e.g., ['vision', 'tools']
  status?: 'active' | 'beta' | 'deprecated'
  category?: string
}

export class ModelRegistry {
  private models: Map<string, Model> = new Map()

  constructor() {
    this.initializeDefaultModels()
  }

  /**
   * Initialize with 20+ models from major providers
   */
  private initializeDefaultModels(): void {
    // Claude models
    this.registerModel({
      id: 'claude-opus-4-5-20251101',
      name: 'Claude Opus 4.5',
      provider: 'claude',
      displayName: 'Claude 3.5 Opus (Latest)',
      description: 'Most capable Claude model',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      costInput: 0.003,
      costOutput: 0.015,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-11-01'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-06-01'),
    })

    this.registerModel({
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'claude',
      displayName: 'Claude 3 Sonnet (Latest)',
      description: 'Balanced performance and cost',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      costInput: 0.0015,
      costOutput: 0.0075,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: true,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-05-14'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'claude-haiku-3-5-20241022',
      name: 'Claude Haiku 3.5',
      provider: 'claude',
      displayName: 'Claude 3 Haiku (Latest)',
      description: 'Fast and cost-effective',
      contextWindow: 200000,
      maxOutputTokens: 2048,
      costInput: 0.00008,
      costOutput: 0.0004,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-10-22'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-06-01'),
    })

    // OpenAI models
    this.registerModel({
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      provider: 'openai',
      displayName: 'GPT-4o (Latest)',
      description: 'Most capable OpenAI model',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      costInput: 0.015,
      costOutput: 0.06,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: true,
      supportsVideo: true,
      releaseDate: new Date('2024-05-13'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      displayName: 'GPT-4 Turbo',
      description: 'Fast GPT-4 variant',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      costInput: 0.01,
      costOutput: 0.03,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2023-11-06'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2023-04-01'),
    })

    this.registerModel({
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      displayName: 'GPT-3.5 Turbo',
      description: 'Fast and cost-effective',
      contextWindow: 16000,
      maxOutputTokens: 4096,
      costInput: 0.0005,
      costOutput: 0.0015,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2022-11-30'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2021-04-01'),
    })

    // Google Gemini models
    this.registerModel({
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      provider: 'google',
      displayName: 'Gemini 2.0 Flash (Experimental)',
      description: 'Fast Gemini model with expanded capabilities',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      costInput: 0.075,
      costOutput: 0.3,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: true,
      supportsVideo: true,
      releaseDate: new Date('2024-12-19'),
      status: 'beta',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      displayName: 'Gemini 1.5 Pro',
      description: 'Professional-grade Gemini model',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      costInput: 0.0075,
      costOutput: 0.03,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: true,
      supportsVideo: true,
      releaseDate: new Date('2024-05-14'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      displayName: 'Gemini 1.5 Flash',
      description: 'Fast Gemini model',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      costInput: 0.00075,
      costOutput: 0.003,
      supportsVision: true,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: ['jpeg', 'png', 'gif', 'webp'],
      supportsAudio: true,
      supportsVideo: true,
      releaseDate: new Date('2024-05-14'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    // Anthropic Pi models (Pi Agent models)
    this.registerModel({
      id: 'pi-agent-core-v1',
      name: 'Pi Agent Core v1',
      provider: 'pi-agent',
      displayName: 'Pi Agent Core v1',
      description: 'Anthropic Pi Agent framework integration',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      costInput: 0.0, // Free (local)
      costOutput: 0.0,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: true,
      supportsThinking: true,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-01-01'),
      status: 'active',
      category: 'specialized',
      knowledgeCutoff: new Date('2024-01-01'),
    })

    // Meta Llama models
    this.registerModel({
      id: 'llama-3.1-405b',
      name: 'Llama 3.1 405B',
      provider: 'meta',
      displayName: 'Llama 3.1 405B',
      description: 'Largest Llama model',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      costInput: 0.0027,
      costOutput: 0.0081,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-07-23'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'llama-3.1-70b',
      name: 'Llama 3.1 70B',
      provider: 'meta',
      displayName: 'Llama 3.1 70B',
      description: 'Fast Llama model',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      costInput: 0.00027,
      costOutput: 0.00081,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-07-23'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    this.registerModel({
      id: 'llama-3.1-8b',
      name: 'Llama 3.1 8B',
      provider: 'meta',
      displayName: 'Llama 3.1 8B',
      description: 'Compact Llama model',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      costInput: 0.00001,
      costOutput: 0.00003,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-07-23'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    // Mistral models
    this.registerModel({
      id: 'mistral-large-2407',
      name: 'Mistral Large 2407',
      provider: 'mistral',
      displayName: 'Mistral Large 2407',
      description: 'Largest Mistral model',
      contextWindow: 128000,
      maxOutputTokens: 8192,
      costInput: 0.00024,
      costOutput: 0.00072,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-07-22'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-04-01'),
    })

    // Cohere models
    this.registerModel({
      id: 'command-r-plus',
      name: 'Command R Plus',
      provider: 'cohere',
      displayName: 'Command R Plus',
      description: 'Cohere command generation model',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      costInput: 0.000003,
      costOutput: 0.000015,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-03-28'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-02-01'),
    })

    // OpenCode models (from Auto Maker)
    this.registerModel({
      id: 'opencode-latest',
      name: 'OpenCode Latest',
      provider: 'opencode',
      displayName: 'OpenCode Latest',
      description: 'OpenCode API latest model',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      costInput: 0.001,
      costOutput: 0.002,
      supportsVision: false,
      supportsTools: true,
      supportsMCP: false,
      supportsThinking: false,
      supportsStreaming: true,
      supportsImages: [],
      supportsAudio: false,
      supportsVideo: false,
      releaseDate: new Date('2024-01-01'),
      status: 'active',
      category: 'base',
      knowledgeCutoff: new Date('2024-01-01'),
    })
  }

  /**
   * Register a new model
   */
  registerModel(model: Model): void {
    this.models.set(model.id, model)
  }

  /**
   * Get a model by ID
   */
  getModel(id: string): Model | undefined {
    return this.models.get(id)
  }

  /**
   * Get all models from a specific provider
   */
  getByProvider(provider: string): Model[] {
    return Array.from(this.models.values()).filter((m) => m.provider === provider)
  }

  /**
   * Get models by capability
   */
  getByCapability(capability: string): Model[] {
    const cap = capability.toLowerCase()
    return Array.from(this.models.values()).filter((m) => {
      switch (cap) {
        case 'vision':
          return m.supportsVision
        case 'tools':
          return m.supportsTools
        case 'mcp':
          return m.supportsMCP
        case 'thinking':
          return m.supportsThinking
        case 'streaming':
          return m.supportsStreaming
        case 'audio':
          return m.supportsAudio
        case 'video':
          return m.supportsVideo
        default:
          return false
      }
    })
  }

  /**
   * Search models by criteria
   */
  search(criteria: ModelSearchCriteria): Model[] {
    let results = Array.from(this.models.values())

    if (criteria.provider) {
      results = results.filter((m) => m.provider === criteria.provider)
    }

    if (criteria.minContextWindow) {
      results = results.filter((m) => m.contextWindow >= criteria.minContextWindow!)
    }

    if (criteria.maxCost) {
      results = results.filter((m) => m.costInput + m.costOutput <= criteria.maxCost!)
    }

    if (criteria.capabilities && criteria.capabilities.length > 0) {
      results = results.filter((m) =>
        criteria.capabilities!.every((cap) => {
          switch (cap.toLowerCase()) {
            case 'vision':
              return m.supportsVision
            case 'tools':
              return m.supportsTools
            case 'mcp':
              return m.supportsMCP
            case 'thinking':
              return m.supportsThinking
            default:
              return false
          }
        })
      )
    }

    if (criteria.status) {
      results = results.filter((m) => m.status === criteria.status)
    }

    if (criteria.category) {
      results = results.filter((m) => m.category === criteria.category)
    }

    return results
  }

  /**
   * Get all models
   */
  getAllModels(): Model[] {
    return Array.from(this.models.values())
  }

  /**
   * Get models sorted by cost (cheapest first)
   */
  sortByCost(models: Model[] = this.getAllModels()): Model[] {
    return [...models].sort((a, b) => a.costInput + a.costOutput - (b.costInput + b.costOutput))
  }

  /**
   * Get models sorted by context window (largest first)
   */
  sortByContextWindow(models: Model[] = this.getAllModels()): Model[] {
    return [...models].sort((a, b) => b.contextWindow - a.contextWindow)
  }

  /**
   * Export registry as JSON
   */
  toJSON() {
    return Array.from(this.models.values())
  }
}

/**
 * Global model registry instance
 */
export const modelRegistry = new ModelRegistry()
