/**
 * Self-Configuration System
 * Automatic configuration discovery and optimization
 *
 * @module ai-ux/self-config
 */

import { AgentLogger } from '../agents/logger'

/**
 * Configuration candidate
 */
export interface ConfigCandidate {
  id: string
  name: string
  agentCount: number
  routingStrategy: string
  cacheEnabled: boolean
  costPrediction: number
  confidenceScore: number
  estimatedQPS: number
}

/**
 * Configuration profile
 */
export interface ConfigProfile {
  id: string
  name: string
  description: string
  agents: { name: string; type: string }[]
  routing: string
  caching: { enabled: boolean; ttl: number }
  scaling: { minAgents: number; maxAgents: number; strategy: string }
  monitoring: { metrics: string[]; alertThreshold: number }
}

/**
 * Self-Configuration System
 */
export class SelfConfigSystem {
  private profiles: Map<string, ConfigProfile> = new Map()
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('SelfConfigSystem')
    this.initializeProfiles()
  }

  /**
   * Initialize default profiles
   */
  private initializeProfiles(): void {
    const profiles: ConfigProfile[] = [
      {
        id: 'light',
        name: 'Light Weight',
        description: 'Minimal setup for single developer',
        agents: [{ name: 'claude', type: 'primary' }],
        routing: 'capability',
        caching: { enabled: true, ttl: 3600 },
        scaling: { minAgents: 1, maxAgents: 3, strategy: 'manual' },
        monitoring: {
          metrics: ['latency', 'cost'],
          alertThreshold: 100
        }
      },
      {
        id: 'medium',
        name: 'Medium',
        description: 'Production setup for teams',
        agents: [
          { name: 'claude', type: 'primary' },
          { name: 'openai', type: 'secondary' },
          { name: 'gemini', type: 'tertiary' }
        ],
        routing: 'cost-aware',
        caching: { enabled: true, ttl: 7200 },
        scaling: { minAgents: 3, maxAgents: 10, strategy: 'auto' },
        monitoring: {
          metrics: ['latency', 'cost', 'success_rate'],
          alertThreshold: 50
        }
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'High-scale distributed setup',
        agents: [
          { name: 'claude', type: 'primary' },
          { name: 'openai', type: 'secondary' },
          { name: 'gemini', type: 'secondary' },
          { name: 'generic', type: 'fallback' }
        ],
        routing: 'ml-aware',
        caching: { enabled: true, ttl: 10800 },
        scaling: { minAgents: 10, maxAgents: 100, strategy: 'predictive' },
        monitoring: {
          metrics: ['latency', 'cost', 'success_rate', 'throughput'],
          alertThreshold: 10
        }
      }
    ]

    for (const profile of profiles) {
      this.profiles.set(profile.id, profile)
    }
  }

  /**
   * Recommend configuration
   */
  async recommendConfiguration(metrics: {
    expectedQPS: number
    teamSize: number
    budget: number
    reliability: 'low' | 'medium' | 'high'
  }): Promise<ConfigCandidate[]> {
    const candidates: ConfigCandidate[] = []

    // Light profile
    if (metrics.expectedQPS <= 10 && metrics.teamSize <= 2) {
      candidates.push({
        id: 'light',
        name: 'Light Weight',
        agentCount: 1,
        routingStrategy: 'capability',
        cacheEnabled: true,
        costPrediction: metrics.budget * 0.2,
        confidenceScore: 0.95,
        estimatedQPS: 10
      })
    }

    // Medium profile
    if (metrics.expectedQPS <= 100 && metrics.teamSize <= 20) {
      candidates.push({
        id: 'medium',
        name: 'Medium',
        agentCount: 3,
        routingStrategy: 'cost-aware',
        cacheEnabled: true,
        costPrediction: metrics.budget * 0.6,
        confidenceScore: 0.9,
        estimatedQPS: 100
      })
    }

    // Enterprise profile
    if (metrics.expectedQPS > 100 || metrics.reliability === 'high') {
      candidates.push({
        id: 'enterprise',
        name: 'Enterprise',
        agentCount: 10,
        routingStrategy: 'ml-aware',
        cacheEnabled: true,
        costPrediction: metrics.budget * 0.95,
        confidenceScore: 0.92,
        estimatedQPS: 1000
      })
    }

    this.logger.info(`Generated ${candidates.length} configuration recommendations`)
    return candidates
  }

  /**
   * Apply configuration
   */
  async applyConfiguration(profileId: string): Promise<ConfigProfile> {
    const profile = this.profiles.get(profileId)
    if (!profile) {
      throw new Error(`Configuration profile not found: ${profileId}`)
    }

    this.logger.info(`Applied configuration: ${profile.name}`)
    return profile
  }

  /**
   * Get configuration profile
   */
  getProfile(id: string): ConfigProfile | undefined {
    return this.profiles.get(id)
  }

  /**
   * List all profiles
   */
  listProfiles(): ConfigProfile[] {
    return Array.from(this.profiles.values())
  }

  /**
   * Create custom profile
   */
  async createProfile(profile: ConfigProfile): Promise<void> {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Profile already exists: ${profile.id}`)
    }

    this.profiles.set(profile.id, profile)
    this.logger.info(`Custom profile created: ${profile.name}`)
  }

  /**
   * Auto-detect optimal configuration
   */
  async autoDetect(): Promise<ConfigProfile> {
    // Simulate detection of system characteristics
    const isHighLoad = Math.random() > 0.5
    const isTeam = Math.random() > 0.6

    let profileId = 'light'
    if (isTeam) profileId = 'medium'
    if (isHighLoad && isTeam) profileId = 'enterprise'

    const profile = this.profiles.get(profileId)
    if (!profile) {
      throw new Error('Failed to auto-detect configuration')
    }

    this.logger.info(`Auto-detected profile: ${profile.name}`)
    return profile
  }

  /**
   * Validate configuration
   */
  validateConfiguration(profile: ConfigProfile): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!profile.id) errors.push('Profile must have an id')
    if (!profile.name) errors.push('Profile must have a name')
    if (!profile.agents || profile.agents.length === 0) errors.push('Profile must have at least one agent')
    if (!profile.routing) errors.push('Profile must specify routing strategy')

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
