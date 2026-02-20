/**
 * CLI Agent Wrappers
 *
 * Pi Builder's core value: a unified interface over any CLI coding agent.
 * Each wrapper spawns the real binary, streams output, and normalises results.
 *
 * Supported agents:
 *   - claude    (Claude Code — anthropics/claude-code)
 *   - aider     (Aider — Aider-AI/aider)
 *   - opencode  (OpenCode — anomalyco/opencode)
 *   - codex     (Codex CLI — openai/codex)
 *   - gemini    (Gemini CLI — google-gemini/gemini-cli)
 *   - goose     (Goose — block/goose)
 *   - plandex   (Plandex — plandex-ai/plandex)
 *   - swe-agent (SWE-agent — SWE-agent/SWE-agent)
 *   - crush     (Crush — charmbracelet/crush)
 *   - gptme     (gptme — gptme/gptme)
 */

import { EventEmitter } from 'events'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTask {
  prompt: string
  workDir?: string
  files?: string[]
  capability?: string
  timeout?: number        // ms, default 120_000
  env?: Record<string, string>
}

export interface AgentResult {
  agent: string
  status: 'success' | 'error' | 'timeout'
  output: string
  stderr?: string
  exitCode?: number
  durationMs: number
}

export interface AgentWrapper {
  id: string
  name: string
  binary: string          // CLI binary name
  capabilities: string[]
  execute(task: AgentTask): Promise<AgentResult>
  executeStream(task: AgentTask): AsyncGenerator<string>
  health(): Promise<boolean>
  version(): Promise<string | null>
}

// ---------------------------------------------------------------------------
// Base class — handles spawning, streaming, timeout
// ---------------------------------------------------------------------------

export abstract class BaseAgentWrapper extends EventEmitter implements AgentWrapper {
  abstract id: string
  abstract name: string
  abstract binary: string
  abstract capabilities: string[]

  /** Build the argv for this agent given a task */
  protected abstract buildArgs(task: AgentTask): string[]

  async execute(task: AgentTask): Promise<AgentResult> {
    const start = Date.now()
    const args = this.buildArgs(task)
    const timeout = task.timeout ?? 120_000

    return new Promise((resolve) => {
      const chunks: string[] = []
      const errChunks: string[] = []
      let settled = false

      const proc = spawn(this.binary, args, {
        cwd: task.workDir ?? process.cwd(),
        env: { ...process.env, ...task.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        proc.kill('SIGTERM')
        resolve({
          agent: this.id,
          status: 'timeout',
          output: chunks.join(''),
          stderr: errChunks.join(''),
          durationMs: Date.now() - start,
        })
      }, timeout)

      proc.stdout.on('data', (d: Buffer) => {
        const s = d.toString()
        chunks.push(s)
        this.emit('output', { agent: this.id, chunk: s })
      })

      proc.stderr.on('data', (d: Buffer) => {
        errChunks.push(d.toString())
      })

      proc.on('close', (code) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({
          agent: this.id,
          status: code === 0 ? 'success' : 'error',
          output: chunks.join(''),
          stderr: errChunks.join(''),
          exitCode: code ?? undefined,
          durationMs: Date.now() - start,
        })
      })

      proc.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({
          agent: this.id,
          status: 'error',
          output: '',
          stderr: err.message,
          durationMs: Date.now() - start,
        })
      })
    })
  }

  async *executeStream(task: AgentTask): AsyncGenerator<string> {
    const args = this.buildArgs(task)
    const timeout = task.timeout ?? 120_000

    const proc = spawn(this.binary, args, {
      cwd: task.workDir ?? process.cwd(),
      env: { ...process.env, ...task.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const timer = setTimeout(() => proc.kill('SIGTERM'), timeout)
    const queue: string[] = []
    let resolve: (() => void) | null = null
    let done = false

    proc.stdout.on('data', (d: Buffer) => {
      queue.push(d.toString())
      resolve?.()
    })

    proc.on('close', () => {
      clearTimeout(timer)
      done = true
      resolve?.()
    })

    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!
      } else {
        await new Promise<void>((r) => { resolve = r })
        resolve = null
      }
    }
  }

  async health(): Promise<boolean> {
    return (await this.version()) !== null
  }

  async version(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(this.binary, ['--version'], { timeout: 3000 })
      return stdout.trim()
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Claude Code  (claude --print "prompt")
// ---------------------------------------------------------------------------

export class ClaudeCodeWrapper extends BaseAgentWrapper {
  id = 'claude'
  name = 'Claude Code'
  binary = 'claude'
  capabilities = ['code-generation', 'code-analysis', 'refactoring', 'testing', 'explanation', 'debugging']

  protected buildArgs(task: AgentTask): string[] {
    const args = ['--print', task.prompt]
    if (task.files?.length) args.push(...task.files)
    return args
  }
}

// ---------------------------------------------------------------------------
// Aider  (aider --message "prompt" [files])
// ---------------------------------------------------------------------------

export class AiderWrapper extends BaseAgentWrapper {
  id = 'aider'
  name = 'Aider'
  binary = 'aider'
  capabilities = ['pair-programming', 'refactoring', 'testing', 'git-aware', 'multi-file']

  protected buildArgs(task: AgentTask): string[] {
    const args = ['--message', task.prompt, '--no-auto-commits']
    if (task.files?.length) args.push(...task.files)
    return args
  }
}

// ---------------------------------------------------------------------------
// OpenCode  (opencode run "prompt")
// ---------------------------------------------------------------------------

export class OpenCodeWrapper extends BaseAgentWrapper {
  id = 'opencode'
  name = 'OpenCode'
  binary = 'opencode'
  capabilities = ['code-generation', 'multi-provider', 'lsp-aware', 'privacy-first']

  protected buildArgs(task: AgentTask): string[] {
    return ['run', task.prompt]
  }
}

// ---------------------------------------------------------------------------
// Codex CLI  (codex "prompt")
// ---------------------------------------------------------------------------

export class CodexCLIWrapper extends BaseAgentWrapper {
  id = 'codex'
  name = 'Codex CLI'
  binary = 'codex'
  capabilities = ['code-generation', 'command-execution', 'repo-tasks']

  protected buildArgs(task: AgentTask): string[] {
    // codex exec --full-auto "<prompt>" [--cd <dir>]
    // --full-auto: sandboxed auto-execution, no confirmation prompts
    const args = ['exec', '--full-auto', task.prompt]
    if (task.workDir) args.push('--cd', task.workDir)
    return args
  }
}

// ---------------------------------------------------------------------------
// Gemini CLI  (gemini -p "prompt")
// ---------------------------------------------------------------------------

export class GeminiCLIWrapper extends BaseAgentWrapper {
  id = 'gemini'
  name = 'Gemini CLI'
  binary = 'gemini'
  capabilities = ['code-generation', 'research', 'large-context', 'multimodal']

  protected buildArgs(task: AgentTask): string[] {
    // -p: non-interactive (headless) mode
    // --yolo: auto-approve all tool calls (required for unattended use)
    return ['-p', task.prompt, '--yolo']
  }

  // gemini --version prints the version then hangs indefinitely (never exits).
  // Strategy: kill after 2s, resolve with whatever stdout we collected by then.
  async version(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(this.binary, ['--version'], { stdio: 'pipe' })
      let out = ''
      let settled = false

      const done = (result: string | null) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
      proc.on('error', () => done(null))

      // Kill after 2s — gemini hangs after printing version. After kill,
      // the close event fires and we extract the version from buffered stdout.
      const timer = setTimeout(() => proc.kill(), 2000)

      proc.on('close', () => {
        clearTimeout(timer)
        const line = out.split('\n').map((l) => l.trim()).find((l) => l.length > 0)
        done(line ?? null)
      })
    })
  }
}

// ---------------------------------------------------------------------------
// Goose  (goose run --text "prompt")
// ---------------------------------------------------------------------------

export class GooseWrapper extends BaseAgentWrapper {
  id = 'goose'
  name = 'Goose'
  binary = 'goose'
  capabilities = ['code-generation', 'execution', 'testing', 'mcp', 'local-first']

  protected buildArgs(task: AgentTask): string[] {
    return ['run', '--text', task.prompt]
  }
}

// ---------------------------------------------------------------------------
// Plandex  (plandex tell "prompt")
// ---------------------------------------------------------------------------

export class PlandexWrapper extends BaseAgentWrapper {
  id = 'plandex'
  name = 'Plandex'
  binary = 'plandex'
  capabilities = ['plan-first', 'multi-file', 'large-context', 'structured-steps']

  protected buildArgs(task: AgentTask): string[] {
    return ['tell', task.prompt, '--bg']
  }
}

// ---------------------------------------------------------------------------
// SWE-agent  (sweagent run --problem-statement "prompt")
// ---------------------------------------------------------------------------

export class SWEAgentWrapper extends BaseAgentWrapper {
  id = 'swe-agent'
  name = 'SWE-agent'
  binary = 'sweagent'
  capabilities = ['bug-fixing', 'issue-resolution', 'pr-tasks', 'repo-analysis']

  protected buildArgs(task: AgentTask): string[] {
    const args = ['run', '--problem-statement', task.prompt]
    if (task.workDir) args.push('--repo-path', task.workDir)
    return args
  }
}

// ---------------------------------------------------------------------------
// Crush  (crush run "prompt")
// ---------------------------------------------------------------------------

export class CrushWrapper extends BaseAgentWrapper {
  id = 'crush'
  name = 'Crush'
  binary = 'crush'
  capabilities = ['code-generation', 'lsp-aware', 'multi-model', 'session-based']

  protected buildArgs(task: AgentTask): string[] {
    // --quiet suppresses the interactive spinner so stdout is clean
    const args = ['run', '--quiet']
    if (task.workDir) args.push('--cwd', task.workDir)
    args.push(task.prompt)
    return args
  }
}

// ---------------------------------------------------------------------------
// gptme  (gptme "prompt")
// ---------------------------------------------------------------------------

export class GptmeWrapper extends BaseAgentWrapper {
  id = 'gptme'
  name = 'gptme'
  binary = 'gptme'
  capabilities = ['code-generation', 'web-browsing', 'file-management', 'personal-assistant']

  protected buildArgs(task: AgentTask): string[] {
    return ['--non-interactive', task.prompt]
  }
}

// ---------------------------------------------------------------------------
// PiAgentWrapper — uses @mariozechner/pi-coding-agent SDK directly
// No subprocess. No binary. pi runs inside this process via createAgentSession().
// This is pi-builder's first-class agent — always preferred when available.
// ---------------------------------------------------------------------------

export interface PiAgentWrapperConfig {
  /** Working directory the agent operates in (default: process.cwd()) */
  cwd?: string
  // Note: model selection is handled by pi's own settings (~/.pi/agent/settings.json)
  // The SDK's model field expects Model<Api> (not a string) — configure via pi directly
}

export class PiAgentWrapper implements AgentWrapper {
  readonly id = 'pi'
  readonly name = 'pi'
  readonly binary = 'pi'
  readonly capabilities = [
    'code-generation', 'code-analysis', 'refactoring', 'testing',
    'explanation', 'debugging', 'multi-file', 'git-aware',
    'tool-use', 'extensions', 'session-memory',
  ]

  private config: PiAgentWrapperConfig
  private sdkAvailable: boolean | null = null

  constructor(config: PiAgentWrapperConfig = {}) {
    this.config = config
  }

  private async checkSdk(): Promise<boolean> {
    if (this.sdkAvailable !== null) return this.sdkAvailable
    try {
      await import('@mariozechner/pi-coding-agent')
      this.sdkAvailable = true
    } catch {
      this.sdkAvailable = false
    }
    return this.sdkAvailable
  }

  async health(): Promise<boolean> {
    return this.checkSdk()
  }

  async version(): Promise<string | null> {
    try {
      const sdk = await import('@mariozechner/pi-coding-agent')
      // VERSION is exported by the package
      return (sdk as Record<string, unknown>).VERSION as string ?? 'sdk'
    } catch {
      return null
    }
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    const t0 = Date.now()
    let output = ''
    try {
      for await (const chunk of this.executeStream(task)) {
        output += chunk
      }
      return { agent: this.id, status: 'success', output, durationMs: Date.now() - t0 }
    } catch (err) {
      return {
        agent: this.id,
        status: 'error',
        output,
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      }
    }
  }

  async *executeStream(task: AgentTask): AsyncGenerator<string> {
    // Import types alongside values so we can type the options properly
    const sdk = await import('@mariozechner/pi-coding-agent')
    const { createAgentSession, AuthStorage, ModelRegistry, SessionManager } = sdk

    // AuthStorage.create(authPath?: string): AuthStorage
    // ModelRegistry constructor: (authStorage: AuthStorage, modelsJsonPath?: string)
    // SessionManager.inMemory(cwd?: string): SessionManager
    // createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>
    // model field is Model<Api> — not a string; omit and let pi use its configured default
    const authStorage = AuthStorage.create()
    const modelRegistry = new ModelRegistry(authStorage)

    const { session } = await createAgentSession({
      sessionManager: SessionManager.inMemory(task.workDir ?? this.config.cwd ?? process.cwd()),
      authStorage,
      modelRegistry,
      cwd: task.workDir ?? this.config.cwd ?? process.cwd(),
    })

    // Buffer for yielding text chunks
    const queue: string[] = []
    let done = false
    let resolveNext: (() => void) | null = null

    session.subscribe((event: Record<string, unknown>) => {
      if (
        event.type === 'message_update' &&
        (event.assistantMessageEvent as Record<string, unknown>)?.type === 'text_delta'
      ) {
        const delta = (event.assistantMessageEvent as Record<string, unknown>).delta as string
        if (delta) {
          queue.push(delta)
          resolveNext?.()
          resolveNext = null
        }
      }
    })

    // Run prompt — completes (or rejects) when agent is done
    let promptError: unknown = null
    const promptPromise = session.prompt(task.prompt).then(
      () => { done = true; resolveNext?.(); resolveNext = null },
      (err: unknown) => { promptError = err; done = true; resolveNext?.(); resolveNext = null },
    )

    // Drain queue as chunks arrive
    while (!done || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!
      } else {
        await new Promise<void>((r) => { resolveNext = r })
      }
    }

    await promptPromise
    if (promptError) throw promptError
  }
}

// ---------------------------------------------------------------------------
// WrapperOrchestrator
// Routes tasks to the best available agent
// ---------------------------------------------------------------------------

export interface OrchestratorConfig {
  preferredAgents?: string[]    // ordered preference list
  fallback?: boolean            // try next agent on failure (default true)
  parallelHealth?: boolean      // check all health in parallel on init
}

export class WrapperOrchestrator extends EventEmitter {
  private wrappers = new Map<string, AgentWrapper>()
  private config: OrchestratorConfig
  private healthCache = new Map<string, { ok: boolean; ts: number }>()
  private readonly HEALTH_TTL = 30_000

  constructor(config: OrchestratorConfig = {}) {
    super()
    this.config = { fallback: true, ...config }
  }

  register(wrapper: AgentWrapper): this {
    this.wrappers.set(wrapper.id, wrapper)
    this.healthCache.delete(wrapper.id)
    this.emit('wrapper:registered', wrapper.id)
    return this
  }

  unregister(id: string): this {
    this.wrappers.delete(id)
    this.healthCache.delete(id)
    this.emit('wrapper:unregistered', id)
    return this
  }

  /** Register all known wrappers — health check determines which are usable */
  registerAll(): this {
    return this
      .register(new PiAgentWrapper())   // pi SDK — always preferred when available
      .register(new ClaudeCodeWrapper())
      .register(new AiderWrapper())
      .register(new OpenCodeWrapper())
      .register(new CodexCLIWrapper())
      .register(new GeminiCLIWrapper())
      .register(new GooseWrapper())
      .register(new PlandexWrapper())
      .register(new SWEAgentWrapper())
      .register(new CrushWrapper())
      .register(new GptmeWrapper())
  }

  async isHealthy(id: string): Promise<boolean> {
    const cached = this.healthCache.get(id)
    if (cached && Date.now() - cached.ts < this.HEALTH_TTL) return cached.ok

    const wrapper = this.wrappers.get(id)
    if (!wrapper) return false

    const ok = await wrapper.health()
    this.healthCache.set(id, { ok, ts: Date.now() })
    return ok
  }

  async availableAgents(): Promise<AgentWrapper[]> {
    const checks = await Promise.all(
      [...this.wrappers.values()].map(async (w) => ({
        wrapper: w,
        ok: await this.isHealthy(w.id),
      }))
    )
    return checks.filter((c) => c.ok).map((c) => c.wrapper)
  }

  async selectForTask(task: AgentTask): Promise<AgentWrapper | null> {
    const available = await this.availableAgents()
    if (available.length === 0) return null

    const capability = task.capability

    // Preferred agents first
    if (this.config.preferredAgents?.length) {
      for (const pref of this.config.preferredAgents) {
        const w = available.find((a) => a.id === pref)
        if (w && (!capability || w.capabilities.includes(capability))) return w
      }
    }

    // Capability match
    if (capability) {
      const match = available.find((a) => a.capabilities.includes(capability))
      if (match) return match
    }

    // First available
    return available[0]
  }

  async execute(task: AgentTask): Promise<AgentResult> {
    const tried: string[] = []

    const attempt = async (): Promise<AgentResult> => {
      const available = (await this.availableAgents()).filter(
        (w) => !tried.includes(w.id)
      )

      if (this.config.preferredAgents?.length) {
        available.sort((a, b) => {
          const ai = this.config.preferredAgents!.indexOf(a.id)
          const bi = this.config.preferredAgents!.indexOf(b.id)
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        })
      }

      const wrapper = available[0]
      if (!wrapper) {
        return {
          agent: 'none',
          status: 'error',
          output: '',
          stderr: `No available agent found. Tried: ${tried.join(', ')}`,
          durationMs: 0,
        }
      }

      tried.push(wrapper.id)
      this.emit('task:start', { agent: wrapper.id, task })
      const result = await wrapper.execute(task)
      this.emit('task:complete', result)

      if (result.status !== 'success' && this.config.fallback && available.length > 1) {
        this.emit('task:fallback', { from: wrapper.id, result })
        return attempt()
      }

      return result
    }

    return attempt()
  }

  async *executeStream(task: AgentTask): AsyncGenerator<string> {
    const wrapper = await this.selectForTask(task)
    if (!wrapper) {
      yield `[pi-builder] No available agent for task\n`
      return
    }
    this.emit('task:start', { agent: wrapper.id, task })
    yield `[${wrapper.name}] Starting...\n`
    yield* wrapper.executeStream(task)
  }

  async checkHealth(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    await Promise.all(
      [...this.wrappers.keys()].map(async (id) => {
        results[id] = await this.isHealthy(id)
      })
    )
    return results
  }

  getWrappers(): AgentWrapper[] {
    return [...this.wrappers.values()]
  }

  getWrapper(id: string): AgentWrapper | undefined {
    return this.wrappers.get(id)
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

export function createOrchestrator(config?: OrchestratorConfig): WrapperOrchestrator {
  const cfg: OrchestratorConfig = {
    // pi is always first preference — it uses our installed SDK, no subprocess
    preferredAgents: ['pi', ...(config?.preferredAgents ?? [])],
    ...config,
  }
  return new WrapperOrchestrator(cfg).registerAll()
}
