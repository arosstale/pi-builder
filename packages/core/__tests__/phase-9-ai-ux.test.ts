/**
 * Phase 9: AI-Powered UX Tests
 * Tests for self-configuration, NLP, and predictive assistance
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  SelfConfigSystem,
  NLPController,
  PredictiveAssistant,
  type ConfigProfile
} from '../src/ai-ux'

describe('Phase 9: AI-Powered UX', () => {
  describe('SelfConfigSystem', () => {
    let self: SelfConfigSystem

    beforeEach(() => {
      self = new SelfConfigSystem()
    })

    it('should list default profiles', () => {
      const profiles = self.listProfiles()

      expect(profiles.length).toBe(3)
      expect(profiles.map(p => p.id)).toContain('light')
      expect(profiles.map(p => p.id)).toContain('medium')
      expect(profiles.map(p => p.id)).toContain('enterprise')
    })

    it('should get profile', () => {
      const profile = self.getProfile('light')

      expect(profile).toBeDefined()
      expect(profile?.name).toBe('Light Weight')
    })

    it('should recommend configurations', async () => {
      const candidates = await self.recommendConfiguration({
        expectedQPS: 50,
        teamSize: 10,
        budget: 1000,
        reliability: 'medium'
      })

      expect(candidates.length).toBeGreaterThan(0)
      expect(candidates[0].agentCount).toBeDefined()
    })

    it('should apply configuration', async () => {
      const profile = await self.applyConfiguration('medium')

      expect(profile.id).toBe('medium')
      expect(profile.agents.length).toBe(3)
    })

    it('should create custom profile', async () => {
      const customProfile: ConfigProfile = {
        id: 'custom',
        name: 'Custom',
        description: 'Custom setup',
        agents: [{ name: 'custom', type: 'primary' }],
        routing: 'custom',
        caching: { enabled: true, ttl: 5000 },
        scaling: { minAgents: 1, maxAgents: 5, strategy: 'manual' },
        monitoring: {
          metrics: ['latency'],
          alertThreshold: 50
        }
      }

      await self.createProfile(customProfile)
      const retrieved = self.getProfile('custom')

      expect(retrieved?.name).toBe('Custom')
    })

    it('should auto-detect configuration', async () => {
      const profile = await self.autoDetect()

      expect(profile).toBeDefined()
      expect(['light', 'medium', 'enterprise']).toContain(profile.id)
    })

    it('should validate configuration', () => {
      const validProfile: ConfigProfile = {
        id: 'test',
        name: 'Test',
        description: 'Test profile',
        agents: [{ name: 'test', type: 'primary' }],
        routing: 'test',
        caching: { enabled: false, ttl: 0 },
        scaling: { minAgents: 1, maxAgents: 1, strategy: 'manual' },
        monitoring: {
          metrics: [],
          alertThreshold: 0
        }
      }

      const result = self.validateConfiguration(validProfile)
      expect(result.valid).toBe(true)
    })
  })

  describe('NLPController', () => {
    let nlp: NLPController

    beforeEach(() => {
      nlp = new NLPController()
    })

    it('should parse scale command', async () => {
      const parsed = await nlp.parseCommand('scale up agents by 5')

      expect(parsed.intent).toBe('scale')
      expect(parsed.entities.direction).toBe('up')
      expect(parsed.entities.amount).toBe(5)
    })

    it('should parse create agent command', async () => {
      const parsed = await nlp.parseCommand('create a new claude agent')

      expect(parsed.intent).toBe('create_agent')
      expect(parsed.entities.name).toBeDefined()
    })

    it('should parse delete agent command', async () => {
      const parsed = await nlp.parseCommand('delete agent worker-1')

      expect(parsed.intent).toBe('delete_agent')
    })

    it('should parse list agents command', async () => {
      const parsed = await nlp.parseCommand('list all agents')

      expect(parsed.intent).toBe('list_agents')
    })

    it('should process end-to-end', async () => {
      const result = await nlp.process('list all agents')

      expect(result.success).toBe(true)
      expect(result.message).toContain('agent')
    })

    it('should register custom intent', async () => {
      nlp.registerIntent('custom', async () => ({
        success: true,
        message: 'Custom intent executed'
      }))

      const intents = nlp.listIntents()
      expect(intents).toContain('custom')
    })

    it('should handle unknown intent gracefully', async () => {
      const result = await nlp.process('xyz unknown command')

      expect(result.success).toBe(false)
    })
  })

  describe('PredictiveAssistant', () => {
    let predictor: PredictiveAssistant

    beforeEach(() => {
      predictor = new PredictiveAssistant()
    })

    it('should predict next action', async () => {
      const history = [
        { action: 'scale_up', timestamp: new Date(Date.now() - 3000) },
        { action: 'scale_up', timestamp: new Date(Date.now() - 2000) },
        { action: 'scale_down', timestamp: new Date(Date.now() - 1000) }
      ]

      const prediction = await predictor.predictNextAction(history)

      expect(prediction.type).toBe('next_action')
      expect(prediction.confidence).toBeGreaterThan(0)
    })

    it('should predict resource needs', async () => {
      const usage = [
        { cpu: 1, memory: 1024, timestamp: new Date(Date.now() - 3000) },
        { cpu: 2, memory: 2048, timestamp: new Date(Date.now() - 2000) },
        { cpu: 1.5, memory: 1500, timestamp: new Date(Date.now() - 1000) }
      ]

      const prediction = await predictor.predictResourceNeeds(usage)

      expect(prediction.type).toBe('resource_needs')
      expect(prediction.confidence).toBeGreaterThan(0.8)
    })

    it('should predict cost trends', async () => {
      const costs = [
        { date: new Date(Date.now() - 6000), amount: 100 },
        { date: new Date(Date.now() - 3000), amount: 110 },
        { date: new Date(Date.now() - 1000), amount: 120 }
      ]

      const prediction = await predictor.predictCostTrends(costs)

      expect(prediction.type).toBe('cost_trend')
      expect(prediction.value).toHaveProperty('trend')
    })

    it('should generate recommendations', async () => {
      const recs = await predictor.generateRecommendations({
        errorRate: 0.1,
        latency: 300,
        costEfficiency: 0.5,
        uptime: 0.95
      })

      expect(recs.length).toBeGreaterThan(0)
      expect(recs[0].impact).toBeDefined()
    })

    it('should get urgent recommendations', async () => {
      await predictor.generateRecommendations({
        errorRate: 0.1,
        latency: 300,
        costEfficiency: 0.5,
        uptime: 0.95
      })

      const urgent = predictor.getUrgentRecommendations()
      expect(urgent.length).toBeGreaterThan(0)
    })

    it('should store and retrieve predictions', async () => {
      const pred = await predictor.predictNextAction([
        { action: 'test', timestamp: new Date() }
      ])

      await predictor.storePrediction('test-pred', pred)
      const retrieved = predictor.getPrediction('test-pred')

      expect(retrieved).toBeDefined()
      expect(retrieved?.type).toBe('next_action')
    })

    it('should list predictions', async () => {
      const pred = await predictor.predictNextAction([
        { action: 'test', timestamp: new Date() }
      ])

      await predictor.storePrediction('pred-1', pred)
      const all = predictor.listPredictions()

      expect(all.length).toBeGreaterThan(0)
    })
  })

  describe('Phase 9 Integration', () => {
    it('should work together - self-config, NLP, and predictions', async () => {
      const config = new SelfConfigSystem()
      const nlp = new NLPController()
      const predictor = new PredictiveAssistant()

      // Self-config
      const candidates = await config.recommendConfiguration({
        expectedQPS: 100,
        teamSize: 20,
        budget: 5000,
        reliability: 'high'
      })
      expect(candidates.length).toBeGreaterThan(0)

      // NLP command
      const cmd = await nlp.parseCommand('scale up agents by 10')
      expect(cmd.intent).toBe('scale')

      // Predictions
      const recs = await predictor.generateRecommendations({
        errorRate: 0.1,
        latency: 250,
        costEfficiency: 0.5,
        uptime: 0.95
      })
      expect(recs.length).toBeGreaterThan(0)

      // Full flow
      const result = await nlp.process('scale up agents by 3')
      expect(result.success).toBe(true)
    })
  })
})
