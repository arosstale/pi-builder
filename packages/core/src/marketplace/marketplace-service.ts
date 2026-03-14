import { EventEmitter } from 'events'

export interface MarketplaceAgent {
  id: string
  name: string
  description: string
  capabilities: string[]
  pricing: 'free' | 'paid' | 'enterprise'
  rating: number
  downloads: number
  latency: number
  successRate: number
}

export interface RecommendationResult {
  agentId: string
  score: number
  reasoning: string
}

export class MarketplaceService extends EventEmitter {
  private agents: Map<string, MarketplaceAgent>
  private searchCache: Map<string, MarketplaceAgent[]>

  constructor() {
    super()
    this.agents = new Map()
    this.searchCache = new Map()
  }

  registerAgent(agent: MarketplaceAgent): void {
    this.agents.set(agent.id, agent)
    this.searchCache.clear()
    this.emit('agent:registered', agent.id)
  }

  listAgents(): MarketplaceAgent[] {
    return Array.from(this.agents.values())
  }

  searchAgents(query: string): MarketplaceAgent[] {
    if (this.searchCache.has(query)) {
      return this.searchCache.get(query)!
    }

    const results = Array.from(this.agents.values()).filter((agent) => {
      return (
        agent.name.toLowerCase().includes(query.toLowerCase()) ||
        agent.description.toLowerCase().includes(query.toLowerCase()) ||
        agent.capabilities.some((c) =>
          c.toLowerCase().includes(query.toLowerCase())
        )
      )
    })

    this.searchCache.set(query, results)
    return results
  }

  filterByCapability(capability: string): MarketplaceAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.capabilities.includes(capability)
    )
  }

  filterByPricing(pricing: 'free' | 'paid' | 'enterprise'): MarketplaceAgent[] {
    return Array.from(this.agents.values()).filter((agent) =>
      agent.pricing === pricing
    )
  }

  getAgentStats(agentId: string): Record<string, unknown> {
    const agent = this.agents.get(agentId)
    if (!agent) throw new Error(`Agent not found: ${agentId}`)

    return {
      id: agent.id,
      name: agent.name,
      downloads: agent.downloads,
      rating: agent.rating,
      successRate: agent.successRate,
      latency: agent.latency,
      capabilities: agent.capabilities.length,
    }
  }

  compareAgents(agentIds: string[]): Record<string, unknown> {
    const agents = agentIds
      .map((id) => this.agents.get(id))
      .filter((a) => a !== undefined)

    return {
      count: agents.length,
      avgRating: agents.reduce((sum, a) => sum + a!.rating, 0) / agents.length,
      avgLatency: agents.reduce((sum, a) => sum + a!.latency, 0) / agents.length,
      avgSuccessRate: agents.reduce((sum, a) => sum + a!.successRate, 0) / agents.length,
      agents: agents.map((a) => ({
        id: a!.id,
        rating: a!.rating,
        latency: a!.latency,
        successRate: a!.successRate,
      })),
    }
  }

  getSortedByRating(): MarketplaceAgent[] {
    return Array.from(this.agents.values()).sort((a, b) => b.rating - a.rating)
  }

  getSortedByLatency(): MarketplaceAgent[] {
    return Array.from(this.agents.values()).sort((a, b) => a.latency - b.latency)
  }

  getSortedBySuccessRate(): MarketplaceAgent[] {
    return Array.from(this.agents.values()).sort(
      (a, b) => b.successRate - a.successRate
    )
  }
}

export class RecommendationEngine extends EventEmitter {
  private marketplace: MarketplaceService

  constructor(marketplace: MarketplaceService) {
    super()
    this.marketplace = marketplace
  }

  recommendForTask(task: Record<string, unknown>): RecommendationResult[] {
    const requiredCapabilities = task.capabilities as string[]
    const agents = this.marketplace.listAgents()

    const scored = agents
      .map((agent) => {
        const matchingCapabilities = agent.capabilities.filter((c) =>
          requiredCapabilities.includes(c)
        )

        let score = 0
        score += (matchingCapabilities.length / requiredCapabilities.length) * 50
        score += agent.rating * 10
        score += agent.successRate * 30
        score -= agent.latency / 100

        return {
          agentId: agent.id,
          score: Math.max(0, score),
          reasoning: `Matches ${matchingCapabilities.length}/${requiredCapabilities.length} capabilities`,
        }
      })
      .sort((a, b) => b.score - a.score)

    this.emit('recommendations:generated', { count: scored.length, topScore: scored[0]?.score })
    return scored
  }

  recommendFastestAgents(limit = 5): RecommendationResult[] {
    return this.marketplace
      .getSortedByLatency()
      .slice(0, limit)
      .map((agent, index) => ({
        agentId: agent.id,
        score: 100 - index * 10,
        reasoning: `Fastest option #${index + 1} (${agent.latency}ms latency)`,
      }))
  }

  recommendMostReliable(limit = 5): RecommendationResult[] {
    return this.marketplace
      .getSortedBySuccessRate()
      .slice(0, limit)
      .map((agent, index) => ({
        agentId: agent.id,
        score: 100 - index * 10,
        reasoning: `Most reliable #${index + 1} (${(agent.successRate * 100).toFixed(1)}% success)`,
      }))
  }

  recommendCheapest(limit = 5): RecommendationResult[] {
    const freeAgents = this.marketplace
      .filterByPricing('free')
      .slice(0, limit)

    return freeAgents.map((agent, index) => ({
      agentId: agent.id,
      score: 100 - index * 5,
      reasoning: 'Free option',
    }))
  }
}

export class PricingEngine extends EventEmitter {
  private marketplace: MarketplaceService
  private costPerExecution: Map<string, number>

  constructor(marketplace: MarketplaceService) {
    super()
    this.marketplace = marketplace
    this.costPerExecution = new Map()
  }

  setPricing(agentId: string, cost: number): void {
    this.costPerExecution.set(agentId, cost)
    this.emit('pricing:updated', { agentId, cost })
  }

  estimateCost(agentId: string, executionCount: number): number {
    const costPer = this.costPerExecution.get(agentId) || 0
    return costPer * executionCount
  }

  calculateBudgetUtilization(
    agents: string[],
    budget: number
  ): Record<string, number> {
    const utilization: Record<string, number> = {}

    for (const agentId of agents) {
      const costPer = this.costPerExecution.get(agentId) || 0
      utilization[agentId] = budget > 0 ? (costPer / budget) * 100 : 0
    }

    return utilization
  }

  recommendCostOptimal(task: Record<string, unknown>, budget: number): string | null {
    const engine = new RecommendationEngine(this.marketplace)
    const recommendations = engine.recommendForTask(task)

    for (const rec of recommendations) {
      const cost = this.costPerExecution.get(rec.agentId) || 0
      if (cost <= budget) {
        return rec.agentId
      }
    }

    return null
  }
}
