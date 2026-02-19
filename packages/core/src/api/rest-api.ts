import express, { Express, Request, Response, NextFunction } from 'express'
import { ApplicationGenerator, ApplicationSpec } from '../generators/application-generator'
import { StitchCoordinator } from '../coordinators/stitch-coordinator'
import { agentRegistry } from '../agents/agent-registry'

export interface APIConfig {
  port: number
  host: string
  environment: 'development' | 'production' | 'test'
}

export interface GenerateRequest {
  spec: ApplicationSpec
  priority?: 'cost' | 'speed' | 'quality' | 'balanced'
}

export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export class RestAPI {
  private app: Express
  private appGen: ApplicationGenerator
  private stitch: StitchCoordinator
  private config: APIConfig

  constructor(config: APIConfig) {
    this.config = config
    this.app = express()
    this.appGen = new ApplicationGenerator()
    this.stitch = new StitchCoordinator()

    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ limit: '10mb', extended: true }))

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
      next()
    })

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', err.message)
      res.status(500).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString()
      })
    })
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: { status: 'healthy', timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      })
    })

    // Generate application
    this.app.post('/api/v1/generate', async (req: Request, res: Response) => {
      try {
        const { spec, priority = 'quality' } = req.body as GenerateRequest

        // Validate spec
        if (!spec || !spec.name) {
          res.status(400).json({
            success: false,
            error: 'Missing required field: spec.name',
            timestamp: new Date().toISOString()
          })
          return
        }

        // Select model via Stitch
        const task = {
          id: `gen-${Date.now()}`,
          type: 'generate' as const,
          description: `Generate application: ${spec.name}`
        }
        const selectedModel = this.stitch.selectModel(task, priority)

        // Generate application
        const app = await this.appGen.generate(spec)

        res.json({
          success: true,
          data: {
            ...app,
            metadata: { model: selectedModel, priority }
          },
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        const err = error as Error
        res.status(500).json({
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Get model stats
    this.app.get('/api/v1/models/stats', (req: Request, res: Response) => {
      const stats = this.stitch.getModelStats()
      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      })
    })

    // Calculate savings
    this.app.post('/api/v1/models/savings', (req: Request, res: Response) => {
      try {
        const { taskCount = 100, priority = 'cost' } = req.body

        const savings = this.stitch.calculateSavings(
          taskCount,
          priority as 'cost' | 'speed' | 'quality' | 'balanced'
        )

        res.json({
          success: true,
          data: {
            taskCount,
            priority,
            savings,
            averageSavingsPerTask: savings / taskCount
          },
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        const err = error as Error
        res.status(500).json({
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        })
      }
    })

    // List agents
    this.app.get('/api/v1/agents', (req: Request, res: Response) => {
      const agents = agentRegistry.listAgents()
      res.json({
        success: true,
        data: { agents, count: agents.length },
        timestamp: new Date().toISOString()
      })
    })

    // Get agent info
    this.app.get('/api/v1/agents/:name', (req: Request, res: Response) => {
      try {
        const agent = agentRegistry.getAgent(String(req.params.name))
        res.json({
          success: true,
          data: {
            name: req.params.name,
            type: agent.constructor.name
          },
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        const err = error as Error
        res.status(404).json({
          success: false,
          error: err.message,
          timestamp: new Date().toISOString()
        })
      }
    })
  }

  public start(): void {
    this.app.listen(this.config.port, this.config.host, () => {
      console.log(
        `🚀 REST API running on http://${this.config.host}:${this.config.port}`
      )
      console.log(`Environment: ${this.config.environment}`)
    })
  }

  public getApp(): Express {
    return this.app
  }
}
