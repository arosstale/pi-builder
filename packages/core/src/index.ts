/**
 * @pi-builder/core
 * Core engine for Pi Builder
 * PRIMARY: Pi Agent SDK (@mariozechner/pi-agent-core)
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
  OpenCodeSDKIntegration,
  OpenClawIntegration,
} from './integrations'
export type {
  ClaudeSDKConfig,
  PiMonoConfig,
  OpenCodeConfig,
  OpenClawConfig,
  ScrapingTask,
  ScrapingResult,
} from './integrations'
