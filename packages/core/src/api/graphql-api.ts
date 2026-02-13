import { EventEmitter } from 'events'

export interface GraphQLSchema {
  query: Record<string, unknown>
  mutation?: Record<string, unknown>
  subscription?: Record<string, unknown>
}

export interface GraphQLResolver {
  Query: Record<string, (args: Record<string, unknown>) => unknown>
  Mutation?: Record<string, (args: Record<string, unknown>) => unknown>
}

export interface GraphQLRequest {
  query: string
  variables?: Record<string, unknown>
  operationName?: string
}

export interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
  }>
}

export class GraphQLAPI extends EventEmitter {
  private schema: GraphQLSchema
  private resolvers: GraphQLResolver
  private cache: Map<string, unknown>

  constructor(schema: GraphQLSchema, resolvers: GraphQLResolver) {
    super()
    this.schema = schema
    this.resolvers = resolvers
    this.cache = new Map()
  }

  async query<T>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    try {
      const cacheKey = this.getCacheKey(request)
      if (this.cache.has(cacheKey)) {
        return {
          data: this.cache.get(cacheKey) as T,
        }
      }

      // Parse query
      const result = await this.executeQuery(request)

      // Cache result
      this.cache.set(cacheKey, result)
      this.emit('query:executed', { request, result })

      return {
        data: result as T,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        errors: [{ message }],
      }
    }
  }

  async mutation<T>(request: GraphQLRequest): Promise<GraphQLResponse<T>> {
    try {
      // Clear cache for mutations
      this.cache.clear()

      const result = await this.executeMutation(request)
      this.emit('mutation:executed', { request, result })

      return {
        data: result as T,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        errors: [{ message }],
      }
    }
  }

  private async executeQuery(request: GraphQLRequest): Promise<unknown> {
    // Parse operation name from query
    const operationMatch = request.query.match(/query\s+(\w+)/)
    const operation = operationMatch ? operationMatch[1] : 'default'

    // Get resolver
    const resolver = this.resolvers.Query[operation]
    if (!resolver) {
      throw new Error(`Query '${operation}' not found`)
    }

    // Execute resolver
    return resolver(request.variables || {})
  }

  private async executeMutation(request: GraphQLRequest): Promise<unknown> {
    // Parse mutation name from query
    const mutationMatch = request.query.match(/mutation\s+(\w+)/)
    const mutation = mutationMatch ? mutationMatch[1] : 'default'

    // Get resolver
    const resolver = this.resolvers.Mutation?.[mutation]
    if (!resolver) {
      throw new Error(`Mutation '${mutation}' not found`)
    }

    // Execute resolver
    return resolver(request.variables || {})
  }

  private getCacheKey(request: GraphQLRequest): string {
    return `${request.query}:${JSON.stringify(request.variables || {})}`
  }

  clearCache(): void {
    this.cache.clear()
    this.emit('cache:cleared')
  }

  getCacheSize(): number {
    return this.cache.size
  }
}

// Built-in schema and resolvers
export const defaultSchema: GraphQLSchema = {
  query: {
    agents: { type: 'Agent!' },
    tasks: { type: '[Task!]!' },
    providers: { type: '[String!]!' },
    metrics: { type: 'Metrics!' },
  },
  mutation: {
    createAgent: { type: 'Agent!' },
    createTask: { type: 'Task!' },
    updateTask: { type: 'Task!' },
  },
}

export const defaultResolvers: GraphQLResolver = {
  Query: {
    agents: () => [],
    tasks: () => [],
    providers: () => [
      'claude',
      'openai',
      'codex',
      'gemini',
      'ollama',
      'lm-studio',
    ],
    metrics: () => ({
      agents: 0,
      tasks: 0,
      uptime: 0,
    }),
  },
  Mutation: {
    createAgent: (args) => ({
      id: `agent-${Date.now()}`,
      name: args.name,
      type: 'custom',
      status: 'active',
      capabilities: [],
    }),
    createTask: (args) => ({
      id: `task-${Date.now()}`,
      name: args.name,
      status: 'pending',
      priority: args.priority || 'medium',
      createdAt: new Date(),
    }),
    updateTask: (args) => ({
      id: args.id,
      status: args.status,
      completedAt: new Date(),
    }),
  },
}
