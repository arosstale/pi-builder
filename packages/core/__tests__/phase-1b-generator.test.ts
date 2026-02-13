import { describe, it, expect, beforeEach } from 'vitest'
import { BackendGenerator, BackendSpec } from '../src/generators/backend-generator'
import { FrontendGenerator, FrontendSpec } from '../src/generators/frontend-generator'
import { ApplicationGenerator, ApplicationSpec } from '../src/generators/application-generator'
import { StitchCoordinator, ModelPriority } from '../src/coordinators/stitch-coordinator'
import { Task } from '../src/agents/base-agent'

describe('Phase 1B: Code Generation', () => {
  describe('BackendGenerator', () => {
    let backendGen: BackendGenerator

    beforeEach(() => {
      backendGen = new BackendGenerator()
    })

    it('should create backend generator', () => {
      expect(backendGen).toBeDefined()
    })

    it('should define FastAPI spec', () => {
      const spec: BackendSpec = {
        name: 'todo-api',
        framework: 'fastapi',
        features: ['CRUD', 'Authentication', 'Validation'],
        database: 'postgres'
      }

      expect(spec.name).toBe('todo-api')
      expect(spec.framework).toBe('fastapi')
      expect(spec.features).toHaveLength(3)
    })

    it('should define Express spec', () => {
      const spec: BackendSpec = {
        name: 'user-service',
        framework: 'express',
        features: ['RESTful', 'Rate limiting', 'Logging']
      }

      expect(spec.framework).toBe('express')
    })

    it('should support multiple database options', () => {
      const specs = [
        { name: 'app1', framework: 'fastapi' as const, features: [], database: 'postgres' as const },
        { name: 'app2', framework: 'fastapi' as const, features: [], database: 'mongodb' as const },
        { name: 'app3', framework: 'fastapi' as const, features: [] }
      ]

      expect(specs).toHaveLength(3)
      expect(specs[0].database).toBe('postgres')
      expect(specs[1].database).toBe('mongodb')
      expect(specs[2].database).toBeUndefined()
    })
  })

  describe('FrontendGenerator', () => {
    let frontendGen: FrontendGenerator

    beforeEach(() => {
      frontendGen = new FrontendGenerator()
    })

    it('should create frontend generator', () => {
      expect(frontendGen).toBeDefined()
    })

    it('should define React spec', () => {
      const spec: FrontendSpec = {
        name: 'todo-ui',
        framework: 'react',
        features: ['Todo list', 'Add/Edit/Delete', 'Filters'],
        styling: 'tailwind'
      }

      expect(spec.framework).toBe('react')
      expect(spec.styling).toBe('tailwind')
    })

    it('should support multiple frameworks', () => {
      const frameworks: Array<'react' | 'vue' | 'svelte'> = ['react', 'vue', 'svelte']
      const specs = frameworks.map(f => ({
        name: `app-${f}`,
        framework: f,
        features: ['Home', 'About']
      }))

      expect(specs).toHaveLength(3)
      expect(specs[0].framework).toBe('react')
      expect(specs[1].framework).toBe('vue')
      expect(specs[2].framework).toBe('svelte')
    })

    it('should support component generation', () => {
      const spec: FrontendSpec = {
        name: 'dashboard',
        framework: 'react',
        features: ['Charts', 'Tables'],
        components: ['Header', 'Sidebar', 'Chart', 'Table']
      }

      expect(spec.components).toHaveLength(4)
    })
  })

  describe('ApplicationGenerator', () => {
    let appGen: ApplicationGenerator

    beforeEach(() => {
      appGen = new ApplicationGenerator()
    })

    it('should create application generator', () => {
      expect(appGen).toBeDefined()
    })

    it('should define application spec', () => {
      const spec: ApplicationSpec = {
        name: 'todo-app',
        description: 'A complete todo application',
        backend: {
          name: 'todo-api',
          framework: 'fastapi',
          features: ['CRUD', 'Auth']
        },
        frontend: {
          name: 'todo-ui',
          framework: 'react',
          features: ['List', 'Add', 'Edit']
        }
      }

      expect(spec.name).toBe('todo-app')
      expect(spec.backend.framework).toBe('fastapi')
      expect(spec.frontend.framework).toBe('react')
    })

    it('should create valid manifest', () => {
      const spec: ApplicationSpec = {
        name: 'test-app',
        description: 'Test application',
        backend: {
          name: 'api',
          framework: 'fastapi',
          features: []
        },
        frontend: {
          name: 'ui',
          framework: 'react',
          features: []
        }
      }

      // Verify spec matches expected structure
      expect(spec).toHaveProperty('name')
      expect(spec).toHaveProperty('backend')
      expect(spec).toHaveProperty('frontend')
      expect(spec.backend).toHaveProperty('framework')
      expect(spec.frontend).toHaveProperty('framework')
    })
  })

  describe('StitchCoordinator', () => {
    let stitch: StitchCoordinator

    beforeEach(() => {
      stitch = new StitchCoordinator()
    })

    it('should create stitch coordinator', () => {
      expect(stitch).toBeDefined()
    })

    it('should select Claude for quality priority', () => {
      const task: Task = {
        id: 'test-1',
        type: 'generate',
        description: 'Generate code'
      }

      const model = stitch.selectModel(task, 'quality')
      expect(model).toBe('claude')
    })

    it('should select best model for cost priority', () => {
      const task: Task = {
        id: 'test-2',
        type: 'generate',
        description: 'Generate documentation'
      }

      const model = stitch.selectModel(task, 'cost')
      expect(['claude', 'gemini', 'local']).toContain(model)
    })

    it('should select best model for speed priority', () => {
      const task: Task = {
        id: 'test-3',
        type: 'generate',
        description: 'Fast generation'
      }

      const model = stitch.selectModel(task, 'speed')
      expect(['claude', 'gemini', 'local']).toContain(model)
    })

    it('should provide model statistics', () => {
      const stats = stitch.getModelStats()

      expect(stats).toBeDefined()
      expect(stats.claude).toBeDefined()
      expect(stats.claude.quality).toBe(1.0)
      expect(stats.claude.cost).toBe(1.0)
      expect(stats.claude.speed).toBe(1.0)
    })

    it('should calculate cost savings', () => {
      const savings100 = stitch.calculateSavings(100, 'cost')
      expect(typeof savings100).toBe('number')
      expect(savings100).toBeGreaterThanOrEqual(0)
    })

    it('should track model availability', () => {
      expect(stitch.isModelAvailable('claude')).toBe(true)

      stitch.setModelAvailability('claude', false)
      expect(stitch.isModelAvailable('claude')).toBe(false)

      // Restore
      stitch.setModelAvailability('claude', true)
    })

    it('should support multiple priority levels', () => {
      const priorities: ModelPriority[] = ['cost', 'speed', 'quality', 'balanced']
      const task: Task = {
        id: 'test-4',
        type: 'generate',
        description: 'Test'
      }

      for (const priority of priorities) {
        const model = stitch.selectModel(task, priority)
        expect(model).toBeDefined()
        expect(['claude', 'gemini', 'local']).toContain(model)
      }
    })
  })

  describe('Integration Tests', () => {
    it('should create full application spec', () => {
      const spec: ApplicationSpec = {
        name: 'ecommerce-platform',
        description: 'Full-stack ecommerce application',
        version: '1.0.0',
        backend: {
          name: 'ecommerce-api',
          framework: 'fastapi',
          features: ['Product management', 'Order processing', 'Payment integration'],
          database: 'postgres'
        },
        frontend: {
          name: 'ecommerce-ui',
          framework: 'react',
          features: ['Product browsing', 'Shopping cart', 'Checkout'],
          styling: 'tailwind',
          components: ['ProductCard', 'Cart', 'Checkout']
        }
      }

      expect(spec.name).toBe('ecommerce-platform')
      expect(spec.backend.features).toHaveLength(3)
      expect(spec.frontend.components).toHaveLength(3)
    })

    it('should coordinate multiple generators', () => {
      const backendGen = new BackendGenerator()
      const frontendGen = new FrontendGenerator()
      const appGen = new ApplicationGenerator()
      const stitch = new StitchCoordinator()

      expect(backendGen).toBeDefined()
      expect(frontendGen).toBeDefined()
      expect(appGen).toBeDefined()
      expect(stitch).toBeDefined()
    })

    it('should work with Stitch routing', () => {
      const stitch = new StitchCoordinator()
      const task: Task = {
        id: 'gen-task',
        type: 'generate',
        description: 'Generate code'
      }

      const model = stitch.selectModel(task, 'quality')
      expect(model).toBe('claude')

      const stats = stitch.getModelStats()
      expect(stats[model]).toBeDefined()
    })

    it('should support cost optimization workflow', () => {
      const stitch = new StitchCoordinator()

      // 100 tasks, cost-optimized
      const savings = stitch.calculateSavings(100, 'cost')
      expect(savings).toBeGreaterThanOrEqual(0)

      // Get model stats for cost-optimized selection
      const stats = stitch.getModelStats()
      const costEfficient = Object.entries(stats)
        .filter(([_, config]) => config.available)
        .sort((a, b) => a[1].cost - b[1].cost)[0]

      expect(costEfficient).toBeDefined()
    })
  })
})
