import { describe, it, expect, beforeEach } from 'vitest'
import { RestAPI, APIConfig, GenerateRequest } from '../src/api/rest-api'
import { GraphQLAPI } from '../src/api/graphql-api'
import { Database, DatabaseConfig, ApplicationRecord } from '../src/db/database'
import { AuthManager, AuthConfig } from '../src/auth/auth-manager'

describe('Phase 1C-1E: API, Database, and Authentication', () => {
  describe('REST API', () => {
    let api: RestAPI
    let config: APIConfig

    beforeEach(() => {
      config = {
        port: 3000,
        host: 'localhost',
        environment: 'test'
      }
      api = new RestAPI(config)
    })

    it('should create REST API instance', () => {
      expect(api).toBeDefined()
      expect(api.getApp()).toBeDefined()
    })

    it('should have health endpoint', () => {
      const app = api.getApp()
      expect(app).toBeDefined()
    })

    it('should accept generation requests', () => {
      const request: GenerateRequest = {
        spec: {
          name: 'test-app',
          description: 'Test application',
          backend: {
            name: 'api',
            framework: 'fastapi',
            features: ['CRUD']
          },
          frontend: {
            name: 'ui',
            framework: 'react',
            features: ['Dashboard']
          }
        },
        priority: 'quality'
      }

      expect(request.spec).toBeDefined()
      expect(request.spec.name).toBe('test-app')
    })
  })

  describe('GraphQL API', () => {
    let gql: GraphQLAPI

    beforeEach(() => {
      gql = new GraphQLAPI()
    })

    it('should create GraphQL API instance', () => {
      expect(gql).toBeDefined()
    })

    it('should have schema', () => {
      const schema = gql.getSchema()
      expect(schema).toBeDefined()
    })

    it('should have resolvers', () => {
      const resolvers = gql.getResolvers()
      expect(resolvers).toBeDefined()
      expect(resolvers.Query).toBeDefined()
      expect(resolvers.Mutation).toBeDefined()
    })

    it('should provide health check query', () => {
      const resolvers = gql.getResolvers()
      const health = resolvers.Query.health()

      expect(health).toBeDefined()
      expect(health.status).toBe('healthy')
    })

    it('should provide model stats query', () => {
      const resolvers = gql.getResolvers()
      const stats = resolvers.Query.getModelStats()

      expect(stats).toBeDefined()
      expect(stats.models).toBeDefined()
    })
  })

  describe('Database Layer', () => {
    let db: Database
    let config: DatabaseConfig

    beforeEach(async () => {
      config = {
        provider: 'sqlite',
        host: 'localhost',
        port: 5432,
        database: ':memory:'
      }
      db = new Database(config)
      await db.connect()
    })

    afterEach(async () => {
      await db.disconnect()
    })

    it('should create database instance', () => {
      expect(db).toBeDefined()
    })

    it('should connect to database', () => {
      expect(db.isHealthy()).toBe(true)
    })

    it('should create application record', async () => {
      const app = await db.createApplication({
        name: 'test-app',
        description: 'Test application',
        spec: {},
        generatedCode: { backend: '', frontend: '' },
        status: 'generated'
      })

      expect(app).toBeDefined()
      expect(app.id).toBeDefined()
      expect(app.name).toBe('test-app')
    })

    it('should list applications', async () => {
      const apps = await db.listApplications(100, 0)
      expect(apps).toBeDefined()
      expect(Array.isArray(apps)).toBe(true)
    })

    it('should create user record', async () => {
      const user = await db.createUser({
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        role: 'user'
      })

      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.email).toBe('test@example.com')
    })

    it('should create task record', async () => {
      const task = await db.createTask({
        userId: 'user-123',
        type: 'generate',
        status: 'pending',
        input: { spec: {} }
      })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.status).toBe('pending')
    })

    it('should update task status', async () => {
      const task = await db.createTask({
        userId: 'user-123',
        type: 'generate',
        status: 'pending',
        input: { spec: {} }
      })

      const updated = await db.updateTaskStatus(task.id, 'completed', { result: 'ok' })
      expect(updated.status).toBe('completed')
    })
  })

  describe('Authentication Manager', () => {
    let auth: AuthManager
    let config: AuthConfig

    beforeEach(() => {
      config = {
        jwtSecret: 'super-secret-key-that-is-long-enough-for-testing',
        jwtExpiresIn: 3600, // 1 hour
        saltRounds: 12
      }
      auth = new AuthManager(config)
    })

    it('should create auth manager instance', () => {
      expect(auth).toBeDefined()
    })

    it('should hash passwords', () => {
      const password = 'mypassword123'
      const hash = auth.hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).toContain(':')
    })

    it('should verify correct password', () => {
      const password = 'mypassword123'
      const hash = auth.hashPassword(password)
      const isValid = auth.verifyPassword(password, hash)

      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', () => {
      const password = 'mypassword123'
      const hash = auth.hashPassword(password)
      const isValid = auth.verifyPassword('wrongpassword', hash)

      expect(isValid).toBe(false)
    })

    it('should create JWT token', () => {
      const token = auth.createToken({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user'
      })

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should verify JWT token', () => {
      const token = auth.createToken({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user'
      })

      const payload = auth.verifyToken(token)
      expect(payload).toBeDefined()
      expect(payload?.userId).toBe('user-123')
      expect(payload?.email).toBe('test@example.com')
      expect(payload?.role).toBe('user')
    })

    it('should reject invalid token', () => {
      const payload = auth.verifyToken('invalid.token.here')
      expect(payload).toBeNull()
    })

    it('should create refresh token', () => {
      const token = auth.createRefreshToken('user-123')
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should verify refresh token', () => {
      const token = auth.createRefreshToken('user-123')
      const payload = auth.verifyRefreshToken(token)

      expect(payload).toBeDefined()
      expect(payload?.userId).toBe('user-123')
    })

    it('should generate secure tokens', () => {
      const token1 = auth.generateSecureToken(32)
      const token2 = auth.generateSecureToken(32)

      expect(token1).toBeDefined()
      expect(token2).toBeDefined()
      expect(token1).not.toBe(token2)
    })

    it('should check user roles', () => {
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin' as const,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }

      expect(auth.hasRole(payload, 'admin')).toBe(true)
      expect(auth.hasRole(payload, 'user')).toBe(false)
      expect(auth.hasRole(payload, ['admin', 'user'])).toBe(true)
    })

    it('should detect expiring tokens', () => {
      const now = Math.floor(Date.now() / 1000)
      const payload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user' as const,
        iat: now,
        exp: now + 100 // Expires in 100 seconds
      }

      expect(auth.isTokenExpiringSoon(payload, 300)).toBe(true)
      expect(auth.isTokenExpiringSoon(payload, 50)).toBe(false)
    })
  })

  describe('Integration Tests', () => {
    it('should orchestrate REST API with Database', async () => {
      const apiConfig: APIConfig = {
        port: 3001,
        host: 'localhost',
        environment: 'test'
      }

      const api = new RestAPI(apiConfig)
      expect(api).toBeDefined()
      expect(api.getApp()).toBeDefined()
    })

    it('should orchestrate GraphQL with Authentication', () => {
      const authConfig: AuthConfig = {
        jwtSecret: 'super-secret-key-that-is-long-enough-for-testing',
        jwtExpiresIn: 3600,
        saltRounds: 12
      }

      const auth = new AuthManager(authConfig)
      const gql = new GraphQLAPI()

      expect(auth).toBeDefined()
      expect(gql).toBeDefined()

      const token = auth.createToken({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user'
      })

      const payload = auth.verifyToken(token)
      expect(payload).toBeDefined()
    })

    it('should orchestrate all three systems', async () => {
      const apiConfig: APIConfig = {
        port: 3002,
        host: 'localhost',
        environment: 'test'
      }

      const dbConfig: DatabaseConfig = {
        provider: 'sqlite',
        host: 'localhost',
        port: 5432,
        database: ':memory:'
      }

      const authConfig: AuthConfig = {
        jwtSecret: 'super-secret-key-that-is-long-enough-for-testing',
        jwtExpiresIn: 3600,
        saltRounds: 12
      }

      const api = new RestAPI(apiConfig)
      const db = new Database(dbConfig)
      const auth = new AuthManager(authConfig)

      await db.connect()

      expect(api).toBeDefined()
      expect(db.isHealthy()).toBe(true)
      expect(auth).toBeDefined()

      await db.disconnect()
    })
  })
})
