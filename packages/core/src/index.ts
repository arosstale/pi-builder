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


// Gateway + Orchestration (new unified layer)
export {
  PiBuilderGateway,
  startGateway,
} from './server'
export type {
  GatewayConfig,
  ClientMessage,
  ServerFrame,
} from './server'

export {
  OrchestratorService,
  createOrchestratorService,
  SubagentRegistry,
} from './orchestration'
export type {
  OrchestratorConfig as ServiceConfig,
  ChatMessage,
  TurnResult,
  SubagentTemplate,
  SubagentFrontmatter,
} from './orchestration'

// CLI Agent wrappers + orchestrator
export {
  WrapperOrchestrator,
  createOrchestrator,
  ClaudeCodeWrapper,
  AiderWrapper,
  OpenCodeWrapper,
  CodexCLIWrapper,
  GeminiCLIWrapper,
  GooseWrapper,
  PlandexWrapper,
  SWEAgentWrapper,
  CrushWrapper,
  GptmeWrapper,
} from './integrations'
export type {
  CLIAgentTask,
  CLIAgentResult,
} from './integrations'
