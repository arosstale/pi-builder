/**
 * Agent Orchestration System
 * @module agents
 */

export * from './agent'
export * from './orchestrator'
export * from './agent-memory'
export * from './provider-adapter'
export * from './provider-agents'
export * from './agent-registry'
export * from './advanced-routing'
export { AgentLogger } from './logger'

// Phase 1A: New agent system
export { BaseAgent, Task, TaskResult, ExecutionPlan } from './base-agent'
export { ClaudeAgent } from './claude-agent'
export { agentRegistry } from './agent-registry'

// Phase 12: Specialist Routing
export { SpecialistRouter, TaskClassifier } from './specialist-router'
export type { SpecialistType, SpecialistResult, SpecialistClassification } from './specialist-router'
