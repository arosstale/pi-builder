/**
 * SDK Integrations
 * Export all integration modules
 * 
 * PRIMARY: Pi Agent SDK (@mariozechner/pi-agent-core)
 * SECONDARY: Claude SDK, Pi-Mono, OpenCode, OpenClaw
 */

// PRIMARY INTEGRATION
export { PiAgentSDKIntegration } from './pi-agent-sdk'
export type {
  PiAgentSDKConfig,
  AgentTask,
  AgentTaskResult,
} from './pi-agent-sdk'

// SECONDARY INTEGRATIONS
export { ClaudeSDKIntegration } from './claude-sdk'
export type { ClaudeSDKConfig } from './claude-sdk'

export { PiMonoIntegration } from './pi-mono'
export type { PiMonoConfig } from './pi-mono'

export { OpenCodeSDKIntegration } from './opencode-sdk'
export type { OpenCodeConfig } from './opencode-sdk'

export { OpenClawIntegration } from './openclaw'
export type { OpenClawConfig, ScrapingTask, ScrapingResult } from './openclaw'

// LOCAL LLM PROVIDERS
export { CodexAgent, CodexProvider } from './codex-provider'
export type { CodexConfig, CodeCompletionRequest, CodeCompletionResponse } from './codex-provider'

export { OllamaAgent, OllamaProvider } from './ollama-provider'
export type { OllamaConfig, OllamaGenerationRequest, OllamaGenerationResponse } from './ollama-provider'

export { LMStudioAgent, LMStudioProvider } from './lm-studio-provider'
export type { LMStudioConfig, LMStudioCompletionRequest, LMStudioCompletionResponse } from './lm-studio-provider'

// NEW PROVIDERS (V2.0)
export { OpenClawProvider } from './openclaw-provider'
export type { OpenClawRequest, OpenClawResponse, Tool } from './openclaw-provider'

export { PiMonoProvider } from './pi-mono-provider'
export type { PiMonoTask, PiMonoResult, PiMonoConfig } from './pi-mono-provider'

export { OpenHandsProvider } from './openhands-provider'
export type { OpenHandsAction, OpenHandsState, OpenHandsTask } from './openhands-provider'

export { OpenCodeSDK } from './opencode-sdk'
export type { OpenCodeRequest, GeneratedCode, CodeAnalysis, Issue } from './opencode-sdk'

// Phase 12: Multi-Channel Router
export { MultiChannelRouter, TelegramProvider, SlackProvider, EmailProvider, WhatsAppProvider, SMSProvider, PhoneProvider } from './multi-channel-router'
export type { Channel, ChannelMessage, ChannelResponse, IChannelProvider } from './multi-channel-router'
