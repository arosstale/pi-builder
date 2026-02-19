/**
 * Pi Agent SDK Integration (PRIMARY)
 *
 * Real integration with @mariozechner/pi-coding-agent SDK.
 * Uses createAgentSession() — the same engine that powers the `pi` CLI.
 *
 * Docs: https://github.com/badlogic/pi-mono
 * SDK:  @mariozechner/pi-coding-agent
 */

import {
  createAgentSession,
  SessionManager,
  AuthStorage,
  ModelRegistry,
  createCodingTools,
  type AgentSession,
} from '@mariozechner/pi-coding-agent'
import type { CodeGenerationRequest } from '../types'

export interface PiAgentSDKConfig {
  /** Working directory for the agent (default: process.cwd()) */
  cwd?: string
  /** Global pi config directory (default: ~/.pi/agent) */
  agentDir?: string
  /** Provider name, e.g. 'anthropic', 'google', 'openai' */
  provider?: string
  /** Model ID, e.g. 'claude-haiku-4-20250514' */
  model?: string
  /** API key — if omitted, reads from env vars (ANTHROPIC_API_KEY etc.) */
  apiKey?: string
  /** Thinking level (default: 'off' for speed) */
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  /** Whether to persist session to disk (default: false) */
  persistSession?: boolean
}

export interface AgentTask {
  id: string
  prompt: string
  context?: Record<string, unknown>
  language?: string
  framework?: string
}

export interface AgentTaskResult {
  taskId: string
  output: string
  language: string
  metadata: {
    tokensUsed: number
    completedAt: Date
    model: string
    sessionId: string
  }
}

/**
 * Pi Agent SDK Integration
 *
 * Wraps the pi SDK's createAgentSession() to provide code generation
 * via the full pi agent loop (read/bash/edit/write tools available).
 */
export class PiAgentSDKIntegration {
  private config: PiAgentSDKConfig
  private session: AgentSession | null = null

  constructor(config: PiAgentSDKConfig = {}) {
    this.config = {
      cwd: process.cwd(),
      thinkingLevel: 'off',
      persistSession: false,
      ...config,
    }
  }

  /**
   * Initialize the pi agent session.
   * Call once before executeTask(). Safe to call multiple times.
   */
  async init(): Promise<void> {
    if (this.session) return

    const authStorage = AuthStorage.create()

    if (this.config.apiKey && this.config.provider) {
      authStorage.setRuntimeApiKey(this.config.provider, this.config.apiKey)
    }

    const modelRegistry = new ModelRegistry(authStorage)

    let model
    if (this.config.provider && this.config.model) {
      model = modelRegistry.find(this.config.provider, this.config.model)
    }

    const cwd = this.config.cwd ?? process.cwd()

    const { session } = await createAgentSession({
      cwd,
      agentDir: this.config.agentDir,
      model,
      thinkingLevel: this.config.thinkingLevel ?? 'off',
      authStorage,
      modelRegistry,
      tools: createCodingTools(cwd),
      sessionManager: this.config.persistSession
        ? SessionManager.create(cwd)
        : SessionManager.inMemory(cwd),
    })

    this.session = session
    console.log('✅ Pi agent session ready')
  }

  /**
   * Execute a code generation task via the pi agent loop.
   */
  async executeTask(request: CodeGenerationRequest): Promise<AgentTaskResult> {
    await this.init()

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const session = this.session!

    const chunks: string[] = []
    let totalTokens = 0

    const unsub = session.subscribe((event) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        chunks.push(event.assistantMessageEvent.delta)
      }
      if (event.type === 'agent_end') {
        for (const m of event.messages) {
          if ('usage' in m && m.usage) {
            const u = m.usage as { inputTokens?: number; outputTokens?: number }
            totalTokens += (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
          }
        }
      }
    })

    console.log(`🤖 Pi agent executing task: ${taskId}`)
    await session.prompt(buildPrompt(request))
    unsub()

    console.log(`✅ Pi agent task complete: ${taskId}`)

    return {
      taskId,
      output: chunks.join(''),
      language: request.language ?? 'typescript',
      metadata: {
        tokensUsed: totalTokens,
        completedAt: new Date(),
        model: session.model?.id ?? 'unknown',
        sessionId: session.sessionId,
      },
    }
  }

  /**
   * Stream a task — yields text deltas as they arrive.
   */
  async *streamTask(request: CodeGenerationRequest): AsyncGenerator<string> {
    await this.init()
    const session = this.session!

    const queue: string[] = []
    let done = false

    const unsub = session.subscribe((event) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        queue.push(event.assistantMessageEvent.delta)
      }
      if (event.type === 'agent_end') {
        done = true
      }
    })

    const promptPromise = session.prompt(buildPrompt(request))

    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!
      } else {
        await new Promise((r) => setTimeout(r, 10))
      }
    }

    await promptPromise
    unsub()
  }

  /**
   * Send a raw prompt and get the full text response.
   */
  async prompt(text: string): Promise<string> {
    await this.init()
    const session = this.session!
    const chunks: string[] = []
    const unsub = session.subscribe((event) => {
      if (
        event.type === 'message_update' &&
        event.assistantMessageEvent.type === 'text_delta'
      ) {
        chunks.push(event.assistantMessageEvent.delta)
      }
    })
    await session.prompt(text)
    unsub()
    return chunks.join('')
  }

  /**
   * Dispose the session — call when done.
   */
  dispose(): void {
    this.session?.dispose()
    this.session = null
  }
}

function buildPrompt(req: CodeGenerationRequest): string {
  const parts = [`Generate ${req.language ?? 'TypeScript'} code for the following:`]
  if (req.framework) parts.push(`Framework: ${req.framework}`)
  if (req.context && Object.keys(req.context).length > 0) {
    parts.push(`Context: ${JSON.stringify(req.context, null, 2)}`)
  }
  parts.push(`\nTask:\n${req.prompt}`)
  parts.push(`\nReturn only the code with brief inline comments. No markdown fences.`)
  return parts.join('\n')
}
