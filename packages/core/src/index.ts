/**
 * @pi-builder/core
 * Core engine for Pi Builder
 * PRIMARY: Pi Agent SDK (@mariozechner/pi-agent-core)
 * PHASE 5: Agent Orchestration System
 */

export { Builder } from './builder'
export { CodeGenerator } from './code-generator'
export { ProjectManager } from './project-manager'
export type { BuilderConfig, BuilderOptions } from './types'

// PRIMARY SDK Integration
export {
  PiAgentSDKIntegration,
} from './integrations'
export type {
  PiAgentSDKConfig,
  AgentTask,
  AgentTaskResult,
} from './integrations'

// SECONDARY SDK Integrations
export {
  ClaudeSDKIntegration,
  PiMonoIntegration,
  OpenClawIntegration,
} from './integrations'
export type {
  ClaudeSDKConfig,
  PiMonoConfig,
  OpenClawConfig,
} from './integrations'

// PHASE 5: Agent Orchestration System
export {
  BaseAgent,
  AgentOrchestrator,
  AgentMemory,
  ProviderAdapter,
  createProviderAdapter,
  createProviderAdapters,
} from './agents'
export type {
  IAgent,
  Task,
  TaskResult,
  AgentHealth,
  AgentCapability,
  AgentConfig,
  AgentType,
  RoutingStrategy,
  RoutingDecision,
  OrchestratorConfig,
  MemoryEntry,
  Pattern,
  Optimization,
  AggregatedResult,
  AgentExecutionEvent,
} from './agents'
