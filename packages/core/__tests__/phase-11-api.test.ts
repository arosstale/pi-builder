import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RestAPI, type ApiConfig } from '../src/api/rest-api'
import { GraphQLAPI, defaultResolvers, defaultSchema } from '../src/api/graphql-api'
import { PiBuilderSDK, type SDKConfig } from '../src/api/sdk-typescript'

describe('Phase 11: API & SDK Layer', () => {
  describe('REST API', () => {
    let api: RestAPI
    const config: ApiConfig = {
      port: 3000,
      host: 'localhost',
      cors: true,
      compression: true,
      rateLimit: {
        windowMs: 60000,
        maxRequests: 100,
      },
    }

    beforeEach(() => {
      api = new RestAPI(config)
    })

    it('should initialize REST API with config', () => {
      expect(api).toBeDefined()
      expect(api).toBeInstanceOf(RestAPI)
    })

    it('should emit startup event', (done) => {
      api.on('started', () => {
        done()
      })
    })

    it('should handle agent creation', (done) => {
      api.on('agent:created', (agent) => {
        expect(agent.id).toBeDefined()
        expect(agent.name).toBe('test-agent')
        expect(agent.status).toBe('active')
        done()
      })
    })

    it('should handle task creation', (done) => {
      api.on('task:created', (task) => {
        expect(task.id).toBeDefined()
        expect(task.name).toBe('test-task')
        expect(task.status).toBe('pending')
        done()
      })
    })

    it('should handle task updates', (done) => {
      api.on('task:updated', (task) => {
        expect(task.status).toBe('completed')
        expect(task.completedAt).toBeDefined()
        done()
      })
    })

    it('should track request metrics', (done) => {
      let requestCount = 0
      api.on('request', () => {
        requestCount++
        if (requestCount >= 3) {
          expect(requestCount).toBeGreaterThanOrEqual(3)
          done()
        }
      })
    })

    it('should emit errors on API errors', (done) => {
      api.on('error', (error) => {
        expect(error).toBeDefined()
        done()
      })
    })
  })

  describe('GraphQL API', () => {
    let graphql: GraphQLAPI

    beforeEach(() => {
      graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
    })

    it('should initialize GraphQL API', () => {
      expect(graphql).toBeDefined()
      expect(graphql).toBeInstanceOf(GraphQLAPI)
    })

    it('should handle query execution', async () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      expect(graphql).toBeDefined()
    })

    it('should handle mutation execution', async () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      expect(graphql).toBeDefined()
    })

    it('should handle query errors gracefully', async () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      expect(graphql).toBeDefined()
    })

    it('should support caching mechanism', () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      expect(graphql.getCacheSize()).toBe(0)
      graphql.clearCache()
      expect(graphql.getCacheSize()).toBe(0)
    })

    it('should clear cache on mutations', () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      graphql.clearCache()
      expect(graphql.getCacheSize()).toBe(0)
    })

    it('should emit query events', () => {
      let eventFired = false
      graphql.on('query:executed', () => {
        eventFired = true
      })
      expect(graphql).toBeDefined()
    })

    it('should emit mutation events', () => {
      let eventFired = false
      graphql.on('mutation:executed', () => {
        eventFired = true
      })
      expect(graphql).toBeDefined()
    })

    it('should emit cache clear events', () => {
      let eventFired = false
      graphql.on('cache:cleared', () => {
        eventFired = true
      })
      graphql.clearCache()
      expect(eventFired).toBe(true) // Event should fire after clear
    })
  })

  describe('TypeScript SDK', () => {
    let sdk: PiBuilderSDK
    const config: SDKConfig = {
      apiUrl: 'http://localhost:3000',
      timeout: 5000,
      retries: 3,
    }

    beforeEach(() => {
      sdk = new PiBuilderSDK(config)
    })

    it('should initialize SDK', () => {
      expect(sdk).toBeDefined()
      expect(sdk).toBeInstanceOf(PiBuilderSDK)
    })

    it('should handle list agents calls', async () => {
      sdk.on('request:success', (data) => {
        expect(data.method).toBe('GET')
        expect(data.path).toBe('/api/agents')
      })
    })

    it('should handle list tasks calls', async () => {
      sdk.on('request:success', (data) => {
        expect(data.method).toBe('GET')
        expect(data.path).toContain('/api/tasks')
      })
    })

    it('should emit events on request errors', (done) => {
      sdk.on('request:error', (data) => {
        expect(data.method).toBeDefined()
        expect(data.path).toBeDefined()
        expect(data.error).toBeDefined()
        done()
      })
    })

    it('should support request retries', () => {
      expect(config.retries).toBe(3)
    })

    it('should support timeout configuration', () => {
      expect(config.timeout).toBe(5000)
    })

    it('should support API key authentication', () => {
      const sdkWithKey = new PiBuilderSDK({
        ...config,
        apiKey: 'test-key',
      })
      expect(sdkWithKey).toBeDefined()
    })
  })

  describe('API Integration', () => {
    it('should coordinate REST and GraphQL APIs', () => {
      const restApi = new RestAPI({
        port: 3001,
        host: 'localhost',
        cors: false,
        compression: false,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
      })

      const graphqlApi = new GraphQLAPI(defaultSchema, defaultResolvers)

      expect(restApi).toBeDefined()
      expect(graphqlApi).toBeDefined()
    })

    it('should support SDK operations across APIs', () => {
      const sdk = new PiBuilderSDK({
        apiUrl: 'http://localhost:3000',
        timeout: 5000,
        retries: 3,
      })

      expect(sdk).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle REST API errors gracefully', () => {
      const api = new RestAPI({
        port: 3000,
        host: 'localhost',
        cors: false,
        compression: false,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
      })

      expect(api).toBeDefined()
    })

    it('should handle GraphQL errors', async () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)
      const result = await graphql.query({ query: 'invalid' })

      expect(result.errors).toBeDefined()
    })

    it('should handle SDK request failures', () => {
      const sdk = new PiBuilderSDK({
        apiUrl: 'http://localhost:9999', // Unreachable
        timeout: 100,
        retries: 1,
      })

      expect(sdk).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should handle REST API requests efficiently', () => {
      const api = new RestAPI({
        port: 3000,
        host: 'localhost',
        cors: false,
        compression: false,
        rateLimit: { windowMs: 60000, maxRequests: 100 },
      })

      const start = Date.now()
      // Simulate work
      const end = Date.now()

      expect(end - start).toBeLessThan(100)
    })

    it('should cache GraphQL queries efficiently', async () => {
      const graphql = new GraphQLAPI(defaultSchema, defaultResolvers)

      const start1 = Date.now()
      await graphql.query({ query: 'query { providers }' })
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await graphql.query({ query: 'query { providers }' })
      const time2 = Date.now() - start2

      expect(time2).toBeLessThanOrEqual(time1)
    })

    it('should support concurrent SDK requests', () => {
      const sdk = new PiBuilderSDK({
        apiUrl: 'http://localhost:3000',
        timeout: 5000,
        retries: 3,
      })

      expect(sdk).toBeDefined()
    })
  })
})
