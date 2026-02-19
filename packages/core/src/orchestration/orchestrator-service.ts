/**
 * OrchestratorService
 *
 * Inspired by the TAC agentic-horizon course OrchestratorService pattern.
 * Manages a persistent orchestrator agent that:
 *   1. Receives user messages
 *   2. Streams responses via EventEmitter
 *   3. Spawns / commands sub-agents through WrapperOrchestrator
 *   4. Persists sessions, costs, and history in SQLite
 *
 * Architecture:
 *   User → OrchestratorService → WrapperOrchestrator → [claude|aider|opencode|…]
 *
 * Three-phase execution per turn:
 *   Phase 1: pre  — persist user message, emit 'user_message'
 *   Phase 2: exec — spawn chosen agent, stream chunks via 'chunk' events
 *   Phase 3: post — persist response, costs, emit 'turn_complete'
 */

import { EventEmitter } from 'events'
import { Database } from '../db/database'
import { WrapperOrchestrator, createOrchestrator, type AgentTask, type AgentResult } from '../integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  workDir?: string
  /** Ordered list of preferred agents (e.g. ['claude', 'aider']) */
  preferredAgents?: string[]
  /** SQLite path — defaults to :memory: in test mode */
  dbPath?: string
  /** System prompt injected as context to every task */
  systemPrompt?: string
  /** Task timeout in ms, default 120_000 */
  timeout?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  agentUsed?: string
  tokensUsed?: number
  durationMs?: number
  timestamp: Date
}

export interface TurnResult {
  message: ChatMessage
  agentResult: AgentResult
}

// ---------------------------------------------------------------------------
// Events emitted by OrchestratorService
// ---------------------------------------------------------------------------
// 'user_message'  → ChatMessage
// 'chunk'         → { text: string, agent: string }
// 'turn_complete' → TurnResult
// 'agent_start'   → { agent: string, task: string }
// 'agent_end'     → { agent: string, status: string, durationMs: number }
// 'error'         → Error

// ---------------------------------------------------------------------------
// OrchestratorService
// ---------------------------------------------------------------------------

export class OrchestratorService extends EventEmitter {
  private config: OrchestratorConfig
  private orchestrator: WrapperOrchestrator
  private db: Database
  private history: ChatMessage[] = []
  private sessionId: string
  private isExecuting = false

  constructor(config: OrchestratorConfig = {}) {
    super()
    this.config = {
      timeout: 120_000,
      ...config,
    }
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.orchestrator = createOrchestrator({
      preferredAgents: config.preferredAgents,
      fallback: true,
    })
    this.db = new Database({
      provider: 'sqlite',
      database: config.dbPath ?? ':memory:',
      filePath: config.dbPath ?? ':memory:',
    })
  }

  async init(): Promise<void> {
    await this.db.connect()
  }

  async close(): Promise<void> {
    await this.db.disconnect()
  }

  // ---------------------------------------------------------------------------
  // Core: process a user turn
  // ---------------------------------------------------------------------------

  async processMessage(userMessage: string): Promise<TurnResult> {
    if (this.isExecuting) {
      throw new Error('OrchestratorService is already processing a message')
    }
    this.isExecuting = true

    try {
      // ── Phase 1: pre ──────────────────────────────────────────────────────
      const userChatMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      }

      this.history.push(userChatMsg)
      this.emit('user_message', userChatMsg)

      // Persist to SQLite
      await this.db.createTask({
        userId: this.sessionId,
        type: 'user_message',
        status: 'completed',
        input: { message: userMessage, messageId: userChatMsg.id },
      })

      // ── Phase 2: execute ──────────────────────────────────────────────────
      const task: AgentTask = {
        prompt: this.buildPrompt(userMessage),
        workDir: this.config.workDir,
        timeout: this.config.timeout,
        capability: this.inferCapability(userMessage),
      }

      const selectedWrapper = await this.orchestrator.selectForTask(task)
      if (!selectedWrapper) {
        throw new Error('No available CLI agent found. Install claude, aider, opencode, or any other supported agent.')
      }

      this.emit('agent_start', { agent: selectedWrapper.id, task: userMessage.slice(0, 80) })

      // Stream chunks in real-time
      let streamedOutput = ''
      for await (const chunk of selectedWrapper.executeStream(task)) {
        streamedOutput += chunk
        this.emit('chunk', { text: chunk, agent: selectedWrapper.id })
      }

      // Get the final result (re-execute for structured result — streaming already happened)
      // In production you'd combine these; here we use the streamed output directly
      const agentResult: AgentResult = {
        agent: selectedWrapper.id,
        status: 'success',
        output: streamedOutput,
        durationMs: 0,
      }

      this.emit('agent_end', {
        agent: selectedWrapper.id,
        status: agentResult.status,
        durationMs: agentResult.durationMs,
      })

      // ── Phase 3: post ─────────────────────────────────────────────────────
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: agentResult.output,
        agentUsed: agentResult.agent,
        durationMs: agentResult.durationMs,
        timestamp: new Date(),
      }

      this.history.push(assistantMsg)

      // Persist response
      await this.db.createTask({
        userId: this.sessionId,
        type: 'assistant_response',
        status: agentResult.status === 'success' ? 'completed' : 'failed',
        input: { messageId: userChatMsg.id },
        output: {
          message: agentResult.output,
          agent: agentResult.agent,
          durationMs: agentResult.durationMs,
          exitCode: agentResult.exitCode,
        },
        error: agentResult.status === 'error' ? agentResult.stderr : undefined,
      })

      const result: TurnResult = { message: assistantMsg, agentResult }
      this.emit('turn_complete', result)
      return result

    } finally {
      this.isExecuting = false
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming interface — yields text chunks as they arrive
  // ---------------------------------------------------------------------------

  async *stream(userMessage: string): AsyncGenerator<string> {
    if (this.isExecuting) {
      throw new Error('OrchestratorService is already processing a message')
    }
    this.isExecuting = true

    try {
      const task: AgentTask = {
        prompt: this.buildPrompt(userMessage),
        workDir: this.config.workDir,
        timeout: this.config.timeout,
        capability: this.inferCapability(userMessage),
      }

      for await (const chunk of this.orchestrator.executeStream(task)) {
        yield chunk
      }
    } finally {
      this.isExecuting = false
    }
  }

  // ---------------------------------------------------------------------------
  // Agent health — which agents are available right now
  // ---------------------------------------------------------------------------

  async availableAgents(): Promise<Array<{ id: string; name: string; binary: string; capabilities: string[] }>> {
    const agents = await this.orchestrator.availableAgents()
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      binary: a.binary,
      capabilities: a.capabilities,
    }))
  }

  async agentHealth(): Promise<Record<string, boolean>> {
    return this.orchestrator.checkHealth()
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  getHistory(): ChatMessage[] {
    return [...this.history]
  }

  clearHistory(): void {
    this.history = []
  }

  getSessionId(): string {
    return this.sessionId
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private buildPrompt(userMessage: string): string {
    const parts: string[] = []

    if (this.config.systemPrompt) {
      parts.push(`System context:\n${this.config.systemPrompt}\n`)
    }

    // Include last 3 turns for context
    const recentHistory = this.history.slice(-6)
    if (recentHistory.length > 0) {
      parts.push('Recent conversation:')
      for (const msg of recentHistory) {
        parts.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.slice(0, 500)}`)
      }
      parts.push('')
    }

    parts.push(`User: ${userMessage}`)
    return parts.join('\n')
  }

  private inferCapability(message: string): string | undefined {
    const lower = message.toLowerCase()

    if (/\b(bug|fix|error|issue|broken|crash|fail)\b/.test(lower)) return 'bug-fixing'
    if (/\b(refactor|clean|improve|simplify|restructure)\b/.test(lower)) return 'refactoring'
    if (/\b(test|spec|coverage|unit|integration)\b/.test(lower)) return 'testing'
    if (/\b(document|readme|comment|explain|describe)\b/.test(lower)) return 'explanation'
    if (/\b(generate|create|build|implement|write|add)\b/.test(lower)) return 'code-generation'
    if (/\b(git|commit|branch|merge|pr|pull request)\b/.test(lower)) return 'git-aware'
    if (/\b(multi.?file|across|whole|project.?wide)\b/.test(lower)) return 'multi-file'

    return 'code-generation' // default
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createOrchestratorService(
  config?: OrchestratorConfig
): Promise<OrchestratorService> {
  const svc = new OrchestratorService(config)
  await svc.init()
  return svc
}
