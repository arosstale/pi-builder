/**
 * OrchestratorService
 *
 * Routes user messages to CLI agents with:
 *   - Input transform middleware (intercept / rewrite prompts before dispatch)
 *   - Dynamic wrapper registry (register agents at runtime)
 *   - Streaming chunks via EventEmitter
 *   - SQLite session persistence
 *
 * Architecture:
 *   User → middleware chain → OrchestratorService → WrapperOrchestrator → agent
 */

import { EventEmitter } from 'events'
import { Database } from '../db/database'
import {
  WrapperOrchestrator,
  createOrchestrator,
  type AgentWrapper,
  type AgentTask,
  type AgentResult,
} from '../integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export type MiddlewareAction =
  | { action: 'pass' }                                            // continue as-is
  | { action: 'transform'; prompt: string }                       // rewrite the prompt
  | { action: 'block'; reason: string }                           // stop — emit error frame
  | { action: 'route'; agentId: string; prompt?: string }         // force agent, optionally rewrite prompt too

export interface MiddlewareContext {
  sessionId: string
  history: Readonly<ChatMessage[]>
  inferred: { capability?: string }
}

export type MiddlewareFn = (
  prompt: string,
  ctx: MiddlewareContext,
) => MiddlewareAction | Promise<MiddlewareAction>

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  workDir?: string
  /** Ordered list of preferred agents (e.g. ['claude', 'aider']) */
  preferredAgents?: string[]
  /** SQLite path — defaults to :memory: */
  dbPath?: string
  /** System prompt prepended to every task */
  systemPrompt?: string
  /** Task timeout in ms (default 120_000) */
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
// Events:
//   'user_message'  → ChatMessage
//   'chunk'         → { text: string, agent: string }
//   'turn_complete' → TurnResult
//   'agent_start'   → { agent: string, task: string }
//   'agent_end'     → { agent: string, status: string, durationMs: number }
//   'error'         → Error
// ---------------------------------------------------------------------------

export class OrchestratorService extends EventEmitter {
  private config: OrchestratorConfig
  private wrapperOrchestrator: WrapperOrchestrator
  private db: Database
  private history: ChatMessage[] = []
  private sessionId: string
  private isExecuting = false
  private middleware: MiddlewareFn[] = []

  // Message queue — holds messages received while agent is executing
  private messageQueue: Array<{ message: string; resolve: (r: TurnResult) => void; reject: (e: Error) => void }> = []

  constructor(config: OrchestratorConfig = {}) {
    super()
    this.config = { timeout: 120_000, ...config }
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.wrapperOrchestrator = createOrchestrator({
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
    await this.loadPersistedHistory()
    // Built-in middleware: @agent prefix routes to a specific agent
    // e.g. "@claude fix auth.ts" → strips @claude prefix, routes to claude wrapper
    this.use((prompt): MiddlewareAction => {
      const match = prompt.match(/^@(\S+)\s+([\s\S]+)$/)
      if (match) return { action: 'route', agentId: match[1], prompt: match[2] }
      return { action: 'pass' }
    })
  }

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  private async loadPersistedHistory(): Promise<void> {
    // Only load from file-backed SQLite (not :memory:)
    if (!this.config.dbPath || this.config.dbPath === ':memory:') return
    try {
      const raw = await (this.db as any).db?.all?.(
        `SELECT role, content, agent_used, duration_ms, timestamp, message_id
         FROM pi_chat_history ORDER BY rowid ASC LIMIT 200`
      )
      if (!Array.isArray(raw)) return
      this.history = raw.map((r: any) => ({
        id: r.message_id ?? `msg-${Math.random().toString(36).slice(2)}`,
        role: r.role as 'user' | 'assistant',
        content: r.content,
        agentUsed: r.agent_used ?? undefined,
        durationMs: r.duration_ms ?? undefined,
        timestamp: new Date(r.timestamp),
      }))
    } catch { /* table may not exist yet — ignore */ }
  }

  private async persistMessage(msg: ChatMessage): Promise<void> {
    if (!this.config.dbPath || this.config.dbPath === ':memory:') return
    try {
      await (this.db as any).db?.run?.(
        `CREATE TABLE IF NOT EXISTS pi_chat_history (
          message_id TEXT PRIMARY KEY,
          role       TEXT NOT NULL,
          content    TEXT NOT NULL,
          agent_used TEXT,
          duration_ms INTEGER,
          timestamp  TEXT NOT NULL
        )`
      )
      await (this.db as any).db?.run?.(
        `INSERT OR REPLACE INTO pi_chat_history
         (message_id, role, content, agent_used, duration_ms, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [msg.id, msg.role, msg.content, msg.agentUsed ?? null, msg.durationMs ?? null, msg.timestamp.toISOString()]
      )
    } catch { /* best-effort */ }
  }

  async close(): Promise<void> {
    await this.db.disconnect()
  }

  // ---------------------------------------------------------------------------
  // Middleware registration
  // ---------------------------------------------------------------------------

  /** Add a transform/block/route handler that runs before every agent dispatch. */
  use(fn: MiddlewareFn): this {
    this.middleware.push(fn)
    return this
  }

  /** Remove a previously registered middleware function. */
  unuse(fn: MiddlewareFn): this {
    const i = this.middleware.indexOf(fn)
    if (i !== -1) this.middleware.splice(i, 1)
    return this
  }

  /** Run the full middleware chain. Returns final prompt + optional forced agentId. */
  private async runMiddleware(
    rawPrompt: string,
    ctx: MiddlewareContext,
  ): Promise<{ prompt: string; forceAgent?: string } | null> {
    let prompt = rawPrompt

    for (const fn of this.middleware) {
      const result = await fn(prompt, ctx)

      if (result.action === 'block') {
        this.emit('error', new Error(`[middleware blocked] ${result.reason}`))
        return null
      }

      if (result.action === 'transform') {
        prompt = result.prompt
      }

      if (result.action === 'route') {
        // Force agent; use rewritten prompt if provided
        return { prompt: result.prompt ?? prompt, forceAgent: result.agentId }
      }
      // 'pass' → continue
    }

    return { prompt }
  }

  // ---------------------------------------------------------------------------
  // Dynamic wrapper registry
  // ---------------------------------------------------------------------------

  /** Register a custom agent wrapper at runtime. */
  registerWrapper(wrapper: AgentWrapper): this {
    this.wrapperOrchestrator.register(wrapper)
    return this
  }

  /** Unregister a wrapper by id. */
  unregisterWrapper(id: string): this {
    this.wrapperOrchestrator.unregister(id)
    return this
  }

  /** List all registered wrappers (id + name + capabilities). */
  listWrappers(): Array<{ id: string; name: string; capabilities: string[] }> {
    return this.wrapperOrchestrator.getWrappers().map((w) => ({
      id: w.id,
      name: w.name,
      capabilities: w.capabilities,
    }))
  }

  // ---------------------------------------------------------------------------
  // Core: process a user turn
  // ---------------------------------------------------------------------------

  async processMessage(userMessage: string): Promise<TurnResult> {
    // Queue the message if agent is busy, drain sequentially
    if (this.isExecuting) {
      return new Promise((resolve, reject) => {
        this.messageQueue.push({ message: userMessage, resolve, reject })
        this.emit('queued', { message: userMessage, queueLength: this.messageQueue.length })
      })
    }
    return this._processMessageNow(userMessage)
  }

  private async _drainQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift()!
      try {
        const result = await this._processMessageNow(next.message)
        next.resolve(result)
      } catch (e) {
        next.reject(e as Error)
      }
    }
  }

  private async _processMessageNow(userMessage: string): Promise<TurnResult> {
    this.isExecuting = true

    try {
      // ── Phase 1: record user message ─────────────────────────────────────
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      }
      this.history.push(userMsg)
      this.emit('user_message', userMsg)
      await this.persistMessage(userMsg)

      await this.db.createTask({
        userId: this.sessionId,
        type: 'user_message',
        status: 'completed',
        input: { message: userMessage, messageId: userMsg.id },
      })

      // ── Phase 2: middleware ───────────────────────────────────────────────
      const capability = this.inferCapability(userMessage)
      const ctx: MiddlewareContext = {
        sessionId: this.sessionId,
        history: this.history,
        inferred: { capability },
      }

      const mwResult = await this.runMiddleware(userMessage, ctx)
      if (!mwResult) {
        // Blocked by middleware — emit synthetic turn_complete with error
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: '[blocked by middleware]',
          timestamp: new Date(),
        }
        this.history.push(errMsg)
        const agentResult: AgentResult = {
          agent: 'middleware',
          status: 'error',
          output: '[blocked by middleware]',
          durationMs: 0,
        }
        const result: TurnResult = { message: errMsg, agentResult }
        this.emit('turn_complete', result)
        return result
      }

      const { prompt: finalPrompt, forceAgent } = mwResult

      // ── Phase 3: select agent ─────────────────────────────────────────────
      const task: AgentTask = {
        prompt: this.buildPrompt(finalPrompt),
        workDir: this.config.workDir,
        timeout: this.config.timeout,
        capability,
      }

      let selectedWrapper: AgentWrapper | null = null

      if (forceAgent) {
        selectedWrapper = this.wrapperOrchestrator.getWrapper(forceAgent) ?? null
        if (!selectedWrapper) {
          throw new Error(`Middleware routed to unknown agent: ${forceAgent}`)
        }
      } else {
        selectedWrapper = await this.wrapperOrchestrator.selectForTask(task)
      }

      if (!selectedWrapper) {
        throw new Error(
          'No available CLI agent found. Install claude, aider, opencode, or another supported agent.',
        )
      }

      // ── Phase 4: stream ───────────────────────────────────────────────────
      this.emit('agent_start', { agent: selectedWrapper.id, task: finalPrompt.slice(0, 80) })

      const t0 = Date.now()
      let streamedOutput = ''

      for await (const chunk of selectedWrapper.executeStream(task)) {
        streamedOutput += chunk
        this.emit('chunk', { text: chunk, agent: selectedWrapper.id })
      }

      const durationMs = Date.now() - t0
      const agentResult: AgentResult = {
        agent: selectedWrapper.id,
        status: 'success',
        output: streamedOutput,
        durationMs,
      }

      this.emit('agent_end', {
        agent: selectedWrapper.id,
        status: agentResult.status,
        durationMs,
      })

      // ── Phase 5: persist + return ─────────────────────────────────────────
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: agentResult.output,
        agentUsed: agentResult.agent,
        durationMs,
        timestamp: new Date(),
      }
      this.history.push(assistantMsg)
      await this.persistMessage(assistantMsg)

      await this.db.createTask({
        userId: this.sessionId,
        type: 'assistant_response',
        status: 'completed',
        input: { messageId: userMsg.id },
        output: {
          message: agentResult.output,
          agent: agentResult.agent,
          durationMs,
        },
      })

      const turnResult: TurnResult = { message: assistantMsg, agentResult }
      this.emit('turn_complete', turnResult)
      return turnResult

    } finally {
      this.isExecuting = false
      // Drain queued messages
      setImmediate(() => this._drainQueue())
    }
  }

  // ---------------------------------------------------------------------------
  // Streaming interface (yields raw chunks)
  // ---------------------------------------------------------------------------

  async *stream(userMessage: string): AsyncGenerator<string> {
    if (this.isExecuting) {
      throw new Error('Already processing — wait for current turn to complete')
    }
    this.isExecuting = true

    try {
      const capability = this.inferCapability(userMessage)
      const ctx: MiddlewareContext = {
        sessionId: this.sessionId,
        history: this.history,
        inferred: { capability },
      }
      const mwResult = await this.runMiddleware(userMessage, ctx)
      if (!mwResult) return

      const { prompt: finalPrompt } = mwResult
      const task: AgentTask = {
        prompt: this.buildPrompt(finalPrompt),
        workDir: this.config.workDir,
        timeout: this.config.timeout,
        capability,
      }

      for await (const chunk of this.wrapperOrchestrator.executeStream(task)) {
        yield chunk
      }
    } finally {
      this.isExecuting = false
    }
  }

  // ---------------------------------------------------------------------------
  // Agent info
  // ---------------------------------------------------------------------------

  async availableAgents(): Promise<Array<{ id: string; name: string; binary: string; capabilities: string[] }>> {
    return (await this.wrapperOrchestrator.availableAgents()).map((a) => ({
      id: a.id,
      name: a.name,
      binary: a.binary,
      capabilities: a.capabilities,
    }))
  }

  async agentHealth(): Promise<Record<string, boolean>> {
    return this.wrapperOrchestrator.checkHealth()
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

  getQueue(): string[] {
    return this.messageQueue.map((q) => q.message)
  }

  clearQueue(): void {
    const drained = this.messageQueue.splice(0)
    for (const item of drained) {
      item.reject(new Error('Queue cleared'))
    }
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

    // Last 3 turns for context
    const recent = this.history.slice(-6)
    if (recent.length > 0) {
      parts.push('Recent conversation:')
      for (const msg of recent) {
        parts.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content.slice(0, 500)}`)
      }
      parts.push('')
    }

    parts.push(`User: ${userMessage}`)
    return parts.join('\n')
  }

  private inferCapability(message: string): string | undefined {
    const lower = message.toLowerCase()
    if (/\b(bug|fix|error|issue|broken|crash|fail)\b/.test(lower))          return 'bug-fixing'
    if (/\b(refactor|clean|improve|simplify|restructure)\b/.test(lower))    return 'refactoring'
    if (/\b(test|spec|coverage|unit|integration)\b/.test(lower))            return 'testing'
    if (/\b(document|readme|comment|explain|describe)\b/.test(lower))       return 'explanation'
    if (/\b(generate|create|build|implement|write|add)\b/.test(lower))      return 'code-generation'
    if (/\b(git|commit|branch|merge|pr|pull request)\b/.test(lower))        return 'git-aware'
    if (/\b(multi.?file|across|whole|project.?wide)\b/.test(lower))         return 'multi-file'
    return 'code-generation'
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createOrchestratorService(
  config?: OrchestratorConfig,
): Promise<OrchestratorService> {
  const svc = new OrchestratorService(config)
  await svc.init()
  return svc
}
