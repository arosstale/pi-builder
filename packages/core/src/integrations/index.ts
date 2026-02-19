/**
 * SDK Integrations
 *
 * CORE VISION: Pi Builder as a unified interface over any CLI coding agent.
 * The WrapperOrchestrator routes tasks to whichever agent is installed and
 * best suited — Claude Code, Aider, OpenCode, Codex, Gemini CLI, Goose, etc.
 *
 * PRIMARY: Pi Agent SDK — real @mariozechner/pi-coding-agent integration
 * SECONDARY: Pi-Mono CLI wrapper, OpenClaw gateway client
 * LOCAL LLM: Codex, Ollama, LM Studio
 * ROUTING: Multi-channel router, CLI agent wrappers
 */

// ─── CLI AGENT WRAPPERS (core vision) ─────────────────────────────────────────
export {
  // individual wrappers
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
  // orchestrator
  WrapperOrchestrator,
  createOrchestrator,
} from './agent-wrappers'
export type {
  AgentWrapper,
  AgentTask as CLIAgentTask,
  AgentResult as CLIAgentResult,
  OrchestratorConfig,
} from './agent-wrappers'

// ─── PRIMARY: pi SDK (createAgentSession) ────────────────────────────────────
export { PiAgentSDKIntegration } from './pi-agent-sdk'
export type { PiAgentSDKConfig, AgentTask, AgentTaskResult } from './pi-agent-sdk'

// ─── SECONDARY ────────────────────────────────────────────────────────────────
export { ClaudeSDKIntegration } from './claude-sdk'
export type { ClaudeSDKConfig } from './claude-sdk'

// Pi CLI subprocess wrapper (pi --print)
export { PiMonoIntegration } from './pi-mono'
export type { PiMonoConfig, PiMonoResult } from './pi-mono'

// OpenClaw gateway client (personal assistant gateway)
export { OpenClawIntegration } from './openclaw'
export type { OpenClawConfig, GatewayMessage, GatewayResponse } from './openclaw'

export { OpenCodeSDK } from './opencode-sdk'
export type { OpenCodeRequest, GeneratedCode, CodeAnalysis, Issue } from './opencode-sdk'

// ─── LOCAL LLM PROVIDERS ──────────────────────────────────────────────────────
export { CodexProvider } from './codex-provider'
export type { CodexConfig, CodeCompletionRequest, CodeCompletionResponse } from './codex-provider'

export { OllamaProvider } from './ollama-provider'
export type { OllamaConfig, OllamaGenerationRequest, OllamaGenerationResponse } from './ollama-provider'

export { LMStudioProvider } from './lm-studio-provider'
export type { LMStudioConfig, LMStudioCompletionRequest, LMStudioCompletionResponse } from './lm-studio-provider'

export { OpenHandsProvider } from './openhands-provider'
export type { OpenHandsAction, OpenHandsState, OpenHandsTask } from './openhands-provider'

// ─── ROUTING ──────────────────────────────────────────────────────────────────
export {
  MultiChannelRouter,
  TelegramProvider,
  SlackProvider,
  EmailProvider,
  WhatsAppProvider,
  SMSProvider,
  PhoneProvider,
} from './multi-channel-router'
export type { Channel, ChannelMessage, ChannelResponse, IChannelProvider } from './multi-channel-router'
export { OpenCodeSDKIntegration, type OpenCodeSDKConfig, type CodeAnalysisResult, type OpenCodeGenerateResult } from './openclaw'
