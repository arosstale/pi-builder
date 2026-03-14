/**
 * Thread-Based Engineering — pi-builder integration
 *
 * Drives pi-subagents extension commands through RpcSessionManager:
 *   /run  <agent> <task>                   → single B-thread
 *   /chain agent1 "t1" -> agent2 "t2"     → C-thread (sequential)
 *   /parallel agent1 "t1" -> agent2 "t2"  → P-thread (parallel)
 *
 * Thread types (claudefa.st framework):
 *   Base  — single prompt → agent work → review
 *   P     — multiple agents in parallel (independent tasks)
 *   C     — sequential chain with human checkpoints
 *   F     — same prompt → multiple agents → fuse best result
 *   B     — orchestrator spawns sub-agents (meta-thread)
 *   L     — long-duration, high autonomy, many tool calls
 *   Z     — zero-touch, no review node (future)
 *
 * pi-subagents already implements all of this. We just need to:
 *   1. Create/reuse an RPC session with pi-subagents extension loaded
 *   2. Send the right slash command as the prompt
 *   3. Stream events back to the caller
 *
 * Ref: https://github.com/nicobailon/pi-async-subagents
 *      https://claudefa.st/blog/guide/mechanics/thread-based-engineering
 */

import { EventEmitter } from 'events'
import { randomUUID } from 'node:crypto'
import type { RpcSessionManager } from '../integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Thread types
// ---------------------------------------------------------------------------

export type ThreadType = 'base' | 'p' | 'c' | 'f' | 'b' | 'l' | 'z'

export interface ThreadStep {
  agent: string
  task: string
  output?: string   // filename for chain artifacts
  reads?: string[]  // files to read before this step
  model?: string    // override model
}

export interface ThreadSpec {
  type: ThreadType
  /** For base/l: single prompt */
  task?: string
  /** For b: agent name (uses /run) */
  agent?: string
  /** For c: sequential steps (uses /chain) */
  steps?: ThreadStep[]
  /** For p/f: parallel tasks (uses /parallel) */
  tasks?: ThreadStep[]
  /** Working directory */
  cwd?: string
  /** Run async (fire-and-forget, status via subagent_status) */
  async?: boolean
  /** Skip clarify TUI (required for async chains) */
  skipClarify?: boolean
}

export interface ThreadRun {
  id: string
  sessionId: string
  type: ThreadType
  command: string       // the slash command sent to pi
  startedAt: number
  status: 'running' | 'idle' | 'error' | 'killed'
  events: ThreadEvent[]
}

export interface ThreadEvent {
  t: number             // timestamp
  type: string          // AgentEventType
  text?: string         // text delta
  toolName?: string
  raw: unknown
}

// ---------------------------------------------------------------------------
// Build the slash command string from a ThreadSpec
// ---------------------------------------------------------------------------

export function buildThreadCommand(spec: ThreadSpec): string {
  switch (spec.type) {
    case 'base':
    case 'l':
      // Simple prompt — no slash command, just the task
      return spec.task ?? ''

    case 'b': {
      // /run <agent> <task>
      const agent = spec.agent ?? 'worker'
      const task = quote(spec.task ?? '')
      return `/run ${agent} ${task}`
    }

    case 'c': {
      // /chain agent1 "task1" -> agent2 "task2" -> ...
      if (!spec.steps?.length) throw new Error('C-thread requires steps')
      const parts = spec.steps.map(s => {
        let step = s.agent
        if (s.output) step += `[output=${s.output}]`
        if (s.reads?.length) step += `[reads=${s.reads.join('+')}]`
        if (s.model) step += `[model=${s.model}]`
        if (s.task) step += ` ${quote(s.task)}`
        return step
      })
      const clarifyFlag = (spec.skipClarify || spec.async) ? ' --no-clarify' : ''
      return `/chain ${parts.join(' -> ')}${clarifyFlag}`
    }

    case 'p': {
      // /parallel agent1 "task1" -> agent2 "task2" -> ...
      if (!spec.tasks?.length) throw new Error('P-thread requires tasks')
      const parts = spec.tasks.map(s => {
        let step = s.agent
        if (s.model) step += `[model=${s.model}]`
        if (s.task) step += ` ${quote(s.task)}`
        return step
      })
      return `/parallel ${parts.join(' -> ')}`
    }

    case 'f': {
      // F-thread: same task → N parallel agents, best result wins
      // Implemented as /parallel with same task on N copies
      if (!spec.tasks?.length) throw new Error('F-thread requires tasks (one per agent)')
      const parts = spec.tasks.map(s => `${s.agent} ${quote(s.task ?? spec.task ?? '')}`)
      return `/parallel ${parts.join(' -> ')}`
    }

    case 'z':
      // Z-thread: full autonomy, async L-thread with no review
      return spec.task ?? ''

    default:
      throw new Error(`Unknown thread type: ${spec.type}`)
  }
}

function quote(s: string): string {
  if (!s) return '""'
  // Already quoted
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s
  // Needs quoting if it contains spaces or ->
  if (s.includes(' ') || s.includes('->')) return `"${s.replace(/"/g, '\\"')}"`
  return s
}

// ---------------------------------------------------------------------------
// ThreadEngine — drives pi-subagents via RpcSessionManager
// ---------------------------------------------------------------------------

export class ThreadEngine extends EventEmitter {
  private runs = new Map<string, ThreadRun>()

  constructor(private rpc: RpcSessionManager) {
    super()
  }

  // ---------------------------------------------------------------------------
  // Launch a thread
  // ---------------------------------------------------------------------------

  async launch(spec: ThreadSpec): Promise<ThreadRun> {
    const command = buildThreadCommand(spec)
    if (!command) throw new Error('Empty thread command')

    // Each thread gets a dedicated RPC session so sessions don't share context
    const threadId = `thread-${Date.now()}-${randomUUID().slice(0, 6)}`
    const sessionId = threadId

    const run: ThreadRun = {
      id: threadId,
      sessionId,
      type: spec.type,
      command,
      startedAt: Date.now(),
      status: 'running',
      events: [],
    }
    this.runs.set(threadId, run)

    // Create the RPC session (pi with pi-subagents extension auto-loaded)
    await this.rpc.create(sessionId, { cwd: spec.cwd })

    // Forward all RPC events into the thread's event log
    const onEvent = (sid: string, agentEvent: Record<string, unknown>) => {
      if (sid !== sessionId) return
      const ev: ThreadEvent = {
        t: Date.now(),
        type: String(agentEvent.type ?? 'event'),
        raw: agentEvent,
      }
      // Extract text delta
      const ame = agentEvent.assistantMessageEvent as Record<string, unknown> | undefined
      if (ame?.type === 'text_delta') ev.text = String(ame.delta ?? '')
      // Extract tool name
      if (typeof agentEvent.toolName === 'string') ev.toolName = agentEvent.toolName

      run.events.push(ev)
      this.emit('event', threadId, ev)
    }

    const onIdle = (sid: string) => {
      if (sid !== sessionId) return
      run.status = 'idle'
      this.rpc.removeListener('event', onEvent)
      this.rpc.removeListener('idle', onIdle)
      this.rpc.removeListener('killed', onKilled)
      this.emit('idle', threadId)
    }

    const onKilled = (sid: string) => {
      if (sid !== sessionId) return
      run.status = 'killed'
      this.rpc.removeListener('event', onEvent)
      this.rpc.removeListener('idle', onIdle)
      this.rpc.removeListener('killed', onKilled)
      this.emit('killed', threadId)
    }

    this.rpc.on('event', onEvent)
    this.rpc.on('idle', onIdle)
    this.rpc.on('killed', onKilled)

    // Send the command
    await this.rpc.prompt(sessionId, command)

    this.emit('launched', run)
    return run
  }

  // ---------------------------------------------------------------------------
  // Convenience launchers for each thread type
  // ---------------------------------------------------------------------------

  /** Base thread — single task to a single agent */
  async base(task: string, cwd?: string): Promise<ThreadRun> {
    return this.launch({ type: 'base', task, cwd })
  }

  /** B-thread — delegate to a named agent (/run <agent> <task>) */
  async b(agent: string, task: string, cwd?: string): Promise<ThreadRun> {
    return this.launch({ type: 'b', agent, task, cwd })
  }

  /** C-thread — sequential chain with artifact handoff (/chain ...) */
  async c(steps: ThreadStep[], cwd?: string, skipClarify = true): Promise<ThreadRun> {
    return this.launch({ type: 'c', steps, cwd, skipClarify })
  }

  /** P-thread — parallel independent tasks (/parallel ...) */
  async p(tasks: ThreadStep[], cwd?: string): Promise<ThreadRun> {
    return this.launch({ type: 'p', tasks, cwd })
  }

  /** F-thread — same task to N agents, fuse results (/parallel same-task) */
  async f(agentNames: string[], task: string, cwd?: string): Promise<ThreadRun> {
    return this.launch({
      type: 'f',
      task,
      tasks: agentNames.map(agent => ({ agent, task })),
      cwd,
    })
  }

  /** L-thread — long-duration task (base prompt, no checkpoints) */
  async l(task: string, cwd?: string): Promise<ThreadRun> {
    return this.launch({ type: 'l', task, cwd })
  }

  // ---------------------------------------------------------------------------
  // Introspection
  // ---------------------------------------------------------------------------

  getThread(id: string): ThreadRun | undefined { return this.runs.get(id) }

  listThreads(): ThreadRun[] { return [...this.runs.values()] }

  async killThread(id: string): Promise<void> {
    const run = this.runs.get(id)
    if (!run) return
    await this.rpc.kill(run.sessionId)
    run.status = 'killed'
  }

  async abortThread(id: string): Promise<void> {
    const run = this.runs.get(id)
    if (!run) return
    await this.rpc.abort(run.sessionId)
  }

  async steerThread(id: string, message: string): Promise<void> {
    const run = this.runs.get(id)
    if (!run) throw new Error(`Thread ${id} not found`)
    // Steer = interrupt and redirect mid-run
    await this.rpc.prompt(run.sessionId, message)
  }

  cleanDead(): void {
    for (const [id, run] of this.runs) {
      if (run.status === 'killed' || run.status === 'error') this.runs.delete(id)
    }
  }
}

// ---------------------------------------------------------------------------
// Preset thread specs — common workflows
// ---------------------------------------------------------------------------

export const THREAD_PRESETS = {
  /** Code review: scout reads, reviewer checks */
  codeReview: (target: string): ThreadSpec => ({
    type: 'c',
    skipClarify: true,
    steps: [
      { agent: 'scout', task: `Analyze ${target} — summarize structure, patterns, concerns`, output: 'context.md' },
      { agent: 'reviewer', task: 'Review {previous} for correctness, security, and style', reads: ['context.md'] },
    ],
  }),

  /** Parallel review: security + performance + architecture simultaneously */
  parallelReview: (target: string): ThreadSpec => ({
    type: 'p',
    tasks: [
      { agent: 'reviewer', task: `Security review of ${target}: auth, injection, secrets` },
      { agent: 'reviewer', task: `Performance review of ${target}: complexity, bottlenecks, caching` },
      { agent: 'reviewer', task: `Architecture review of ${target}: patterns, coupling, maintainability` },
    ],
  }),

  /** Scout → Planner → Worker chain */
  planAndBuild: (task: string): ThreadSpec => ({
    type: 'c',
    skipClarify: true,
    steps: [
      { agent: 'scout', task: `Gather context for: ${task}`, output: 'context.md' },
      { agent: 'planner', task: 'Create implementation plan for {task} based on {previous}', reads: ['context.md'], output: 'plan.md' },
      { agent: 'worker', task: 'Implement according to {previous}', reads: ['context.md', 'plan.md'] },
    ],
  }),

  /** F-thread: same bug to 3 investigators, pick best fix */
  debugFusion: (bugDescription: string): ThreadSpec => ({
    type: 'f',
    task: `Debug and fix: ${bugDescription}`,
    tasks: [
      { agent: 'worker', task: `Debug and fix: ${bugDescription}` },
      { agent: 'worker', task: `Debug and fix: ${bugDescription}` },
      { agent: 'worker', task: `Debug and fix: ${bugDescription}` },
    ],
  }),

  /** Research in parallel: codebase + patterns + docs */
  parallelResearch: (question: string): ThreadSpec => ({
    type: 'p',
    tasks: [
      { agent: 'scout', task: `Search codebase for: ${question}` },
      { agent: 'researcher', task: `Find best practices and patterns for: ${question}` },
    ],
  }),
} as const
