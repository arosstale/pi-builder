import { describe, it, expect, beforeEach } from 'vitest'
import { OpenClawIntegration } from '../src/integrations/openclaw-integration'
import { AntfarmOrchestrator, AntfarmConfig } from '../src/orchestration/antfarm-orchestrator'
import { KubernetesManager, KubernetesConfig } from '../src/deployment/kubernetes-manager'
import { SecurityHardener, SecurityConfig } from '../src/security/security-hardener'

describe('Phase 2: Advanced Features', () => {
  describe('OpenClaw Integration', () => {
    let openclaw: OpenClawIntegration

    beforeEach(() => {
      const config = {
        apiKey: 'test-key',
        baseUrl: 'https://api.openclaw.com',
        timeout: 5000
      }
      openclaw = new OpenClawIntegration(config)
    })

    it('should create OpenClaw instance', () => {
      expect(openclaw).toBeDefined()
    })

    it('should review code', async () => {
      const code = 'function test() { var x = 1; }'
      const result = await openclaw.reviewCode(code)

      expect(result.success).toBe(true)
      expect(result.data?.review).toBeDefined()
      expect(result.data!.review!.length).toBeGreaterThan(0)
    })

    it('should generate tests', async () => {
      const code = 'function add(a, b) { return a + b; }'
      const result = await openclaw.generateTests(code)

      expect(result.success).toBe(true)
      expect(result.data?.tests).toBeDefined()
      expect(result.data!.tests!.length).toBeGreaterThan(0)
    })

    it('should generate documentation', async () => {
      const code = 'function multiply(a, b) { return a * b; }'
      const result = await openclaw.generateDocumentation(code)

      expect(result.success).toBe(true)
      expect(result.data?.documentation).toBeDefined()
      expect(result.data!.documentation!).toContain('Example')
    })

    it('should refactor code', async () => {
      const code = 'for (let i = 0; i < 10; i++) { console.log(i) }'
      const result = await openclaw.refactorCode(code)

      expect(result.success).toBe(true)
      expect(result.data?.refactored).toBeDefined()
    })

    it('should optimize code', async () => {
      const code = 'function slow() { for(let i=0; i<1000; i++) {} }'
      const result = await openclaw.optimizeCode(code)

      expect(result.success).toBe(true)
      expect(result.data?.optimizations).toBeDefined()
      expect(result.data!.optimizations!.length).toBeGreaterThan(0)
    })

    it('should process tasks', async () => {
      const task = {
        id: 'task-1',
        type: 'code-review' as const,
        content: 'const x = 1',
        metadata: {}
      }

      const result = await openclaw.processTask(task)
      expect(result.success).toBe(true)
    })

    it('should cache results', async () => {
      const code = 'function test() { return true; }'
      const result1 = await openclaw.reviewCode(code)
      const result2 = await openclaw.reviewCode(code)

      expect(result1).toEqual(result2)
    })

    it('should manage cache', () => {
      const stats = openclaw.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(0)
      expect(stats.keys).toBeDefined()

      openclaw.clearCache()
      const statsAfter = openclaw.getCacheStats()
      expect(statsAfter.size).toBe(0)
    })
  })

  describe('Antfarm Orchestrator', () => {
    let orchestrator: AntfarmOrchestrator
    let config: AntfarmConfig

    beforeEach(() => {
      config = {
        maxConcurrentTasks: 3,
        taskTimeout: 5000,
        retryPolicy: { maxRetries: 2, backoffMultiplier: 2 }
      }
      orchestrator = new AntfarmOrchestrator(config)
    })

    it('should create orchestrator instance', () => {
      expect(orchestrator).toBeDefined()
    })

    it('should submit a task', async () => {
      const task = {
        id: 'test-1',
        type: 'generate' as const,
        description: 'Test task'
      }

      const taskId = await orchestrator.submitTask('default', task)
      expect(taskId).toBeDefined()
      expect(typeof taskId).toBe('string')
    })

    it('should get task status', async () => {
      const task = {
        id: 'test-2',
        type: 'generate' as const,
        description: 'Test task'
      }

      const taskId = await orchestrator.submitTask('default', task)
      const status = orchestrator.getTaskStatus(taskId)

      expect(status).toBeDefined()
      expect(status?.id).toBe(taskId)
    })

    it('should batch submit tasks', async () => {
      const tasks = [
        {
          agentName: 'default',
          task: { id: 'batch-1', type: 'generate' as const, description: 'Task 1' }
        },
        {
          agentName: 'default',
          task: { id: 'batch-2', type: 'generate' as const, description: 'Task 2' }
        }
      ]

      const taskIds = await orchestrator.submitBatch(tasks)
      expect(taskIds).toHaveLength(2)
      expect(taskIds[0]).toBeDefined()
      expect(taskIds[1]).toBeDefined()
    })

    it('should get orchestrator stats', () => {
      const stats = orchestrator.getStats()

      expect(stats).toBeDefined()
      expect(stats.totalTasks).toBeGreaterThanOrEqual(0)
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0)
      expect(stats.failedTasks).toBeGreaterThanOrEqual(0)
      expect(stats.successRate).toBeGreaterThanOrEqual(0)
    })

    it('should cancel a task', async () => {
      const task = {
        id: 'cancel-1',
        type: 'generate' as const,
        description: 'Test task'
      }

      const taskId = await orchestrator.submitTask('default', task)
      const cancelled = orchestrator.cancelTask(taskId)

      expect(cancelled).toBe(true)
    })

    it('should reset orchestrator', () => {
      orchestrator.reset()
      const stats = orchestrator.getStats()

      expect(stats.totalTasks).toBe(0)
      expect(stats.completedTasks).toBe(0)
    })
  })

  describe('Kubernetes Manager', () => {
    let k8s: KubernetesManager
    let config: KubernetesConfig

    beforeEach(() => {
      config = {
        clusterName: 'test-cluster',
        namespace: 'default'
      }
      k8s = new KubernetesManager(config)
    })

    it('should create Kubernetes manager instance', () => {
      expect(k8s).toBeDefined()
    })

    it('should deploy application', async () => {
      const spec = {
        name: 'test-app',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 2,
        port: 3000,
        env: { NODE_ENV: 'production' },
        resources: { cpu: '500m', memory: '512Mi' }
      }

      const status = await k8s.deployApplication(spec)

      expect(status).toBeDefined()
      expect(status.name).toBe('test-app')
      expect(status.replicas).toBe(2)
    })

    it('should create service', async () => {
      const spec = {
        name: 'test-svc',
        namespace: 'default',
        type: 'ClusterIP' as const,
        port: 80,
        targetPort: 3000
      }

      const result = await k8s.createService(spec)

      expect(result).toBeDefined()
      expect(result.name).toBe('test-svc')
    })

    it('should get deployment status', async () => {
      const spec = {
        name: 'status-test',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 1,
        port: 3000,
        env: {},
        resources: { cpu: '100m', memory: '128Mi' }
      }

      await k8s.deployApplication(spec)
      const status = await k8s.getDeploymentStatus('status-test')

      expect(status).toBeDefined()
      expect(status?.name).toBe('status-test')
    })

    it('should scale deployment', async () => {
      const spec = {
        name: 'scale-test',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 1,
        port: 3000,
        env: {},
        resources: { cpu: '100m', memory: '128Mi' }
      }

      await k8s.deployApplication(spec)
      const scaled = await k8s.scaleDeployment('scale-test', 3)

      expect(scaled?.replicas).toBe(3)
    })

    it('should get pod status', async () => {
      const spec = {
        name: 'pods-test',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 2,
        port: 3000,
        env: {},
        resources: { cpu: '100m', memory: '128Mi' }
      }

      await k8s.deployApplication(spec)
      const pods = await k8s.getPodStatus('pods-test')

      expect(pods).toBeDefined()
      expect(pods.length).toBe(2)
    })

    it('should get cluster info', () => {
      const info = k8s.getClusterInfo()

      expect(info).toBeDefined()
      expect(info.name).toBe('test-cluster')
      expect(info.namespace).toBe('default')
    })

    it('should delete deployment', async () => {
      const spec = {
        name: 'delete-test',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 1,
        port: 3000,
        env: {},
        resources: { cpu: '100m', memory: '128Mi' }
      }

      await k8s.deployApplication(spec)
      const deleted = await k8s.deleteDeployment('delete-test')

      expect(deleted).toBe(true)
    })
  })

  describe('Security Hardener', () => {
    let security: SecurityHardener
    let config: SecurityConfig

    beforeEach(() => {
      config = {
        enableRateLimiting: true,
        maxRequestsPerMinute: 60,
        enableCSRF: true,
        enableCORS: true,
        allowedOrigins: ['http://localhost:3000'],
        enableHSTS: true,
        enableContentSecurityPolicy: true
      }
      security = new SecurityHardener(config)
    })

    it('should create security hardener instance', () => {
      expect(security).toBeDefined()
    })

    it('should generate CSRF token', () => {
      const token = security.generateCSRFToken('user-1')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
    })

    it('should verify CSRF token', () => {
      const token = security.generateCSRFToken('user-2')
      const isValid = security.verifyCSRFToken('user-2', token)

      expect(isValid).toBe(true)
    })

    it('should reject invalid CSRF token', () => {
      security.generateCSRFToken('user-3')
      const isValid = security.verifyCSRFToken('user-3', 'invalid-token')

      expect(isValid).toBe(false)
    })

    it('should check rate limit', () => {
      const clientId = 'client-1'

      for (let i = 0; i < 60; i++) {
        const allowed = security.checkRateLimit(clientId)
        expect(allowed).toBe(true)
      }

      const exceeded = security.checkRateLimit(clientId)
      expect(exceeded).toBe(false)
    })

    it('should get rate limit status', () => {
      const clientId = 'client-2'
      security.checkRateLimit(clientId)

      const status = security.getRateLimitStatus(clientId)
      expect(status.count).toBe(1)
      expect(status.limit).toBe(60)
      expect(status.remaining).toBe(59)
    })

    it('should sanitize input', () => {
      const malicious = '<script>alert("xss")</script>'
      const sanitized = security.sanitizeInput(malicious)

      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('&lt;')
    })

    it('should validate email', () => {
      expect(security.isValidEmail('test@example.com')).toBe(true)
      expect(security.isValidEmail('invalid-email')).toBe(false)
    })

    it('should validate password strength', () => {
      const weak = security.validatePasswordStrength('weak')
      expect(weak.valid).toBe(false)
      expect(weak.issues.length).toBeGreaterThan(0)

      const strong = security.validatePasswordStrength('SecurePass123!')
      expect(strong.valid).toBe(true)
      expect(strong.score).toBeGreaterThanOrEqual(50)
    })

    it('should get security headers', () => {
      const headers = security.getSecurityHeaders()

      expect(headers).toBeDefined()
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['Strict-Transport-Security']).toBeDefined()
    })

    it('should validate CORS origin', () => {
      const allowed = security.isAllowedOrigin('http://localhost:3000')
      expect(allowed).toBe(true)

      const notAllowed = security.isAllowedOrigin('http://malicious.com')
      expect(notAllowed).toBe(false)
    })

    it('should get security score', () => {
      const score = security.getSecurityScore()
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })

    it('should get security report', () => {
      const report = security.getSecurityReport()

      expect(report).toBeDefined()
      expect(report.score).toBeGreaterThanOrEqual(0)
      expect(report.enabledFeatures).toBeDefined()
      expect(report.enabledFeatures.length).toBeGreaterThan(0)
    })

    it('should clear expired tokens', () => {
      security.generateCSRFToken('user-4')
      const cleared = security.clearExpiredTokens()

      expect(cleared).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Integration Tests', () => {
    it('should orchestrate OpenClaw with Antfarm', async () => {
      const openclaw = new OpenClawIntegration({
        apiKey: 'test',
        baseUrl: 'http://localhost',
        timeout: 5000
      })

      const config: AntfarmConfig = {
        maxConcurrentTasks: 2,
        taskTimeout: 5000,
        retryPolicy: { maxRetries: 1, backoffMultiplier: 2 }
      }

      const orchestrator = new AntfarmOrchestrator(config)

      expect(openclaw).toBeDefined()
      expect(orchestrator).toBeDefined()
    })

    it('should deploy to Kubernetes with security', async () => {
      const k8s = new KubernetesManager({
        clusterName: 'prod',
        namespace: 'default'
      })

      const security = new SecurityHardener({
        enableRateLimiting: true,
        maxRequestsPerMinute: 100,
        enableCSRF: true,
        enableCORS: true,
        allowedOrigins: ['*'],
        enableHSTS: true,
        enableContentSecurityPolicy: true
      })

      const spec = {
        name: 'secure-app',
        namespace: 'default',
        image: 'app:1.0.0',
        replicas: 3,
        port: 3000,
        env: { SECURITY_ENABLED: 'true' },
        resources: { cpu: '1000m', memory: '1Gi' }
      }

      const status = await k8s.deployApplication(spec)
      const report = security.getSecurityReport()

      expect(status.name).toBe('secure-app')
      expect(report.score).toBeGreaterThan(50)
    })
  })
})
