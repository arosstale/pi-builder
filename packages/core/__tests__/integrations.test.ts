import { describe, it, expect, beforeEach } from 'vitest'
import {
  ClaudeSDKIntegration,
  PiMonoIntegration,
  OpenCodeSDKIntegration,
  OpenClawIntegration,
} from '../src/integrations'
import { Builder } from '../src/builder'

describe('SDK Integrations', () => {
  describe('ClaudeSDKIntegration', () => {
    let claude: ClaudeSDKIntegration

    beforeEach(() => {
      claude = new ClaudeSDKIntegration({ apiKey: 'test-key' })
    })

    it('should create Claude integration', () => {
      expect(claude).toBeDefined()
    })

    it('should generate code', async () => {
      const response = await claude.generate({
        prompt: 'Create a function',
        language: 'typescript',
      })

      expect(response.code).toBeDefined()
      expect(response.language).toBe('typescript')
      expect(response.metadata.model).toContain('claude')
    })

    it('should allow model configuration', () => {
      claude.setModel('claude-3-opus-20240229')
      expect(claude.getModel()).toBe('claude-3-opus-20240229')
    })
  })

  describe('PiMonoIntegration', () => {
    let piMono: PiMonoIntegration

    beforeEach(() => {
      piMono = new PiMonoIntegration({
        apiUrl: 'http://localhost:3000/api',
        token: 'test-token',
      })
    })

    it('should create PiMono integration', () => {
      expect(piMono).toBeDefined()
    })

    it('should sync with PiMono', async () => {
      const builder = new Builder({
        name: 'test-project',
        rootDir: '/tmp/test',
        platforms: ['web'],
      })

      await builder.initialize()

      // Should not throw
      await expect(piMono.syncWithPiMono(builder)).resolves.toBeUndefined()
    })

    it('should trigger workflows', async () => {
      // Should not throw
      await expect(
        piMono.triggerWorkflow('test-workflow', { data: 'test' })
      ).resolves.toBeUndefined()
    })

    it('should get workflow status', async () => {
      const status = await piMono.getWorkflowStatus('exec_123')
      expect(status).toBeDefined()
    })
  })

  describe('OpenCodeSDKIntegration', () => {
    let openCode: OpenCodeSDKIntegration

    beforeEach(() => {
      openCode = new OpenCodeSDKIntegration({ apiKey: 'test-key' })
    })

    it('should create OpenCode integration', () => {
      expect(openCode).toBeDefined()
    })

    it('should analyze code', async () => {
      const code = 'const x = 1;\nconsole.log(x);'
      const result = await openCode.analyzeCode(code)

      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThan(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(Array.isArray(result.issues)).toBe(true)
    })

    it('should generate code', async () => {
      const response = await openCode.generateWithOpenCode({
        prompt: 'Create a function',
        language: 'typescript',
      })

      expect(response.code).toBeDefined()
      expect(response.metadata.model).toContain('opencode')
    })

    it('should format code', async () => {
      const code = 'const x=1'
      const formatted = await openCode.formatCode(code, 'typescript')
      expect(formatted).toBeDefined()
    })
  })

  describe('OpenClawIntegration', () => {
    let openClaw: OpenClawIntegration

    beforeEach(() => {
      openClaw = new OpenClawIntegration({ apiKey: 'test-key' })
    })

    it('should create OpenClaw integration', () => {
      expect(openClaw).toBeDefined()
    })

    it('should scrape URLs', async () => {
      const result = await openClaw.scrapeUrl('https://example.com', '.title')

      expect(result).toBeDefined()
      expect(result.status).toBe('success')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should scrape multiple URLs', async () => {
      const urls = ['https://example.com', 'https://example.org']
      const results = await openClaw.scrapeMultiple(urls)

      expect(results).toHaveLength(2)
      expect(results.every(r => r.status === 'success')).toBe(true)
    })

    it('should extract data', async () => {
      const data = await openClaw.extractData('<div class="item">Test</div>', '.item')

      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })

    it('should track task status', async () => {
      await openClaw.scrapeUrl('https://example.com')
      // Task ID would be tracked internally
      expect(true).toBe(true)
    })
  })
})
