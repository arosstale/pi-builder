import express, { Express, Request, Response, NextFunction } from 'express'
import { EventEmitter } from 'events'

export interface ApiConfig {
  port: number
  host: string
  cors: boolean
  compression: boolean
  rateLimit: {
    windowMs: number
    maxRequests: number
  }
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

export class RestAPI extends EventEmitter {
  private app: Express
  private config: ApiConfig
  private agents: Map<string, Agent>
  private tasks: Map<string, Task>

  constructor(config: ApiConfig) {
    super()
    this.config = config
    this.app = express()
    this.agents = new Map()
    this.tasks = new Map()
    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    // JSON parser
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // CORS
    if (this.config.cors) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*')
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        next()
      })
    }

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now()
      res.on('finish', () => {
        const duration = Date.now() - start
        this.emit('request', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration,
        })
      })
      next()
    })

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err.message)
      res.status(500).json({
        success: false,
        error: err.message,
        timestamp: new Date(),
      } as ApiResponse<null>)
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          agents: this.agents.size,
          tasks: this.tasks.size,
        },
        timestamp: new Date(),
      } as ApiResponse<Record<string, unknown>>)
    })

    // Agents endpoints
    this.app.get('/api/agents', (req: Request, res: Response) => {
      const agents = Array.from(this.agents.values())
      res.json({
        success: true,
        data: agents,
        timestamp: new Date(),
      } as ApiResponse<Agent[]>)
    })

    this.app.post('/api/agents', (req: Request, res: Response) => {
      const agent: Agent = {
        id: `agent-${Date.now()}`,
        name: req.body.name,
        type: req.body.type || 'custom',
        status: 'active',
        capabilities: req.body.capabilities || [],
      }
      this.agents.set(agent.id, agent)
      this.emit('agent:created', agent)
      res.status(201).json({
        success: true,
        data: agent,
        timestamp: new Date(),
      } as ApiResponse<Agent>)
    })

    this.app.get('/api/agents/:id', (req: Request, res: Response) => {
      const agent = this.agents.get(req.params.id)
      if (!agent) {
        return res.status(404).json({
          success: false,
          error: 'Agent not found',
          timestamp: new Date(),
        } as ApiResponse<null>)
      }
      res.json({
        success: true,
        data: agent,
        timestamp: new Date(),
      } as ApiResponse<Agent>)
    })

    // Tasks endpoints
    this.app.get('/api/tasks', (req: Request, res: Response) => {
      const tasks = Array.from(this.tasks.values())
      const filtered = tasks.filter((t) => {
        if (req.query.status && t.status !== req.query.status) return false
        if (req.query.priority && t.priority !== req.query.priority) return false
        return true
      })
      res.json({
        success: true,
        data: filtered,
        timestamp: new Date(),
      } as ApiResponse<Task[]>)
    })

    this.app.post('/api/tasks', (req: Request, res: Response) => {
      const task: Task = {
        id: `task-${Date.now()}`,
        name: req.body.name,
        status: 'pending',
        priority: req.body.priority || 'medium',
        createdAt: new Date(),
      }
      this.tasks.set(task.id, task)
      this.emit('task:created', task)
      res.status(201).json({
        success: true,
        data: task,
        timestamp: new Date(),
      } as ApiResponse<Task>)
    })

    this.app.get('/api/tasks/:id', (req: Request, res: Response) => {
      const task = this.tasks.get(req.params.id)
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          timestamp: new Date(),
        } as ApiResponse<null>)
      }
      res.json({
        success: true,
        data: task,
        timestamp: new Date(),
      } as ApiResponse<Task>)
    })

    this.app.put('/api/tasks/:id', (req: Request, res: Response) => {
      const task = this.tasks.get(req.params.id)
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found',
          timestamp: new Date(),
        } as ApiResponse<null>)
      }
      if (req.body.status) {
        task.status = req.body.status
        if (req.body.status === 'completed') {
          task.completedAt = new Date()
        }
      }
      if (req.body.priority) task.priority = req.body.priority
      this.emit('task:updated', task)
      res.json({
        success: true,
        data: task,
        timestamp: new Date(),
      } as ApiResponse<Task>)
    })

    // Providers endpoints
    this.app.get('/api/providers', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          providers: [
            'claude',
            'openai',
            'codex',
            'gemini',
            'ollama',
            'lm-studio',
            'opencode',
            'openclaw',
          ],
          total: 8,
        },
        timestamp: new Date(),
      } as ApiResponse<Record<string, unknown>>)
    })

    // Metrics endpoints
    this.app.get('/api/metrics', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          agents: this.agents.size,
          tasks: this.tasks.size,
          completedTasks: Array.from(this.tasks.values()).filter(
            (t) => t.status === 'completed'
          ).length,
          failedTasks: Array.from(this.tasks.values()).filter(
            (t) => t.status === 'failed'
          ).length,
          uptime: process.uptime(),
        },
        timestamp: new Date(),
      } as ApiResponse<Record<string, unknown>>)
    })
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, this.config.host, () => {
        console.log(`✅ REST API listening on ${this.config.host}:${this.config.port}`)
        this.emit('started')
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.emit('stopped')
      resolve()
    })
  }
}
