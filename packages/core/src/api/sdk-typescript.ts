import fetch from 'node-fetch'
import { EventEmitter } from 'events'

export interface SDKConfig {
  apiUrl: string
  apiKey?: string
  timeout: number
  retries: number
}

export interface Agent {
  id: string
  name: string
  type: 'provider' | 'custom'
  status: 'active' | 'inactive'
  capabilities: string[]
}

export interface Task {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high'
  createdAt: Date
  completedAt?: Date
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

export class PiBuilderSDK extends EventEmitter {
  private config: SDKConfig
  private baseUrl: string

  constructor(config: SDKConfig) {
    super()
    this.config = config
    this.baseUrl = config.apiUrl.replace(/\/$/, '')
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          timeout: this.config.timeout,
        } as Parameters<typeof fetch>[1])

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as ApiResponse<T>
        if (!data.success) {
          throw new Error(data.error || 'Request failed')
        }

        this.emit('request:success', { method, path, data })
        return data.data as T
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < this.config.retries - 1) {
          const delay = Math.pow(2, attempt) * 100
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    this.emit('request:error', { method, path, error: lastError })
    throw lastError || new Error('Request failed')
  }

  // Agent methods
  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('GET', '/api/agents')
  }

  async getAgent(id: string): Promise<Agent> {
    return this.request<Agent>('GET', `/api/agents/${id}`)
  }

  async createAgent(name: string, type: string, capabilities: string[]): Promise<Agent> {
    return this.request<Agent>('POST', '/api/agents', {
      name,
      type,
      capabilities,
    })
  }

  // Task methods
  async listTasks(filters?: { status?: string; priority?: string }): Promise<Task[]> {
    const query = new URLSearchParams(filters as Record<string, string>).toString()
    const path = query ? `/api/tasks?${query}` : '/api/tasks'
    return this.request<Task[]>('GET', path)
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>('GET', `/api/tasks/${id}`)
  }

  async createTask(name: string, priority?: string): Promise<Task> {
    return this.request<Task>('POST', '/api/tasks', {
      name,
      priority,
    })
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    return this.request<Task>('PUT', `/api/tasks/${id}`, updates as Record<string, unknown>)
  }

  // Provider methods
  async listProviders(): Promise<string[]> {
    const data = await this.request<Record<string, unknown>>('GET', '/api/providers')
    return (data.providers as string[]) || []
  }

  // Metrics methods
  async getMetrics(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/api/metrics')
  }

  // Health check
  async health(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('GET', '/health')
  }
}

export default PiBuilderSDK
