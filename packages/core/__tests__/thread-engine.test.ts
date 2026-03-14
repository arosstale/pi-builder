/**
 * ThreadEngine + buildThreadCommand tests
 *
 * Tests command generation for all 7 thread types and the preset library.
 * No real pi binary required — we mock RpcSessionManager.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildThreadCommand, ThreadEngine, THREAD_PRESETS, type ThreadSpec } from '../src/threads/thread-engine'
import { RpcSessionManager } from '../src/integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// buildThreadCommand
// ---------------------------------------------------------------------------

describe('buildThreadCommand', () => {
  describe('base / l threads', () => {
    it('base: returns task directly', () => {
      const cmd = buildThreadCommand({ type: 'base', task: 'explain auth.ts' })
      expect(cmd).toBe('explain auth.ts')
    })

    it('l: same as base — no slash command', () => {
      const cmd = buildThreadCommand({ type: 'l', task: 'refactor entire codebase overnight' })
      expect(cmd).toBe('refactor entire codebase overnight')
    })
  })

  describe('b thread (/run)', () => {
    it('produces /run <agent> <task>', () => {
      const cmd = buildThreadCommand({ type: 'b', agent: 'scout', task: 'scan the codebase' })
      expect(cmd).toBe('/run scout "scan the codebase"')
    })

    it('defaults to worker agent', () => {
      const cmd = buildThreadCommand({ type: 'b', task: 'fix the bug' })
      expect(cmd).toBe('/run worker "fix the bug"')
    })

    it('quotes task with special chars', () => {
      const cmd = buildThreadCommand({ type: 'b', agent: 'planner', task: 'plan feat -> review' })
      expect(cmd).toContain('/run planner')
      expect(cmd).toContain('"plan feat -> review"')
    })
  })

  describe('c thread (/chain)', () => {
    it('produces /chain with -> separators', () => {
      const cmd = buildThreadCommand({
        type: 'c',
        skipClarify: true,
        steps: [
          { agent: 'scout', task: 'scan the repo' },
          { agent: 'planner', task: 'create a plan' },
          { agent: 'worker', task: 'implement it' },
        ],
      })
      expect(cmd).toContain('/chain')
      expect(cmd).toContain('scout "scan the repo"')
      expect(cmd).toContain('-> planner "create a plan"')
      expect(cmd).toContain('-> worker "implement it"')
    })

    it('appends output/reads as inline config', () => {
      const cmd = buildThreadCommand({
        type: 'c',
        skipClarify: true,
        steps: [
          { agent: 'scout', task: 'analyze', output: 'context.md' },
          { agent: 'worker', task: 'build it', reads: ['context.md'] },
        ],
      })
      expect(cmd).toContain('scout[output=context.md]')
      expect(cmd).toContain('worker[reads=context.md]')
    })

    it('appends model override', () => {
      const cmd = buildThreadCommand({
        type: 'c',
        skipClarify: true,
        steps: [{ agent: 'planner', task: 'plan', model: 'anthropic/claude-sonnet-4' }],
      })
      expect(cmd).toContain('planner[model=anthropic/claude-sonnet-4]')
    })

    it('throws if no steps', () => {
      expect(() => buildThreadCommand({ type: 'c', steps: [] })).toThrow('requires steps')
    })
  })

  describe('p thread (/parallel)', () => {
    it('produces /parallel with -> separators', () => {
      const cmd = buildThreadCommand({
        type: 'p',
        tasks: [
          { agent: 'reviewer', task: 'security review' },
          { agent: 'reviewer', task: 'performance review' },
        ],
      })
      expect(cmd).toContain('/parallel')
      expect(cmd).toContain('reviewer "security review"')
      expect(cmd).toContain('-> reviewer "performance review"')
    })

    it('throws if no tasks', () => {
      expect(() => buildThreadCommand({ type: 'p', tasks: [] })).toThrow('requires tasks')
    })
  })

  describe('f thread (fusion)', () => {
    it('produces /parallel with same task repeated', () => {
      const cmd = buildThreadCommand({
        type: 'f',
        task: 'fix the login bug',
        tasks: [
          { agent: 'worker', task: 'fix the login bug' },
          { agent: 'worker', task: 'fix the login bug' },
          { agent: 'worker', task: 'fix the login bug' },
        ],
      })
      expect(cmd).toContain('/parallel')
      // Three instances of the same task
      const matches = cmd.match(/worker "fix the login bug"/g)
      expect(matches).toHaveLength(3)
    })
  })

  describe('z thread (zero-touch)', () => {
    it('returns task as plain prompt', () => {
      const cmd = buildThreadCommand({ type: 'z', task: 'ship the feature autonomously' })
      expect(cmd).toBe('ship the feature autonomously')
    })
  })
})

// ---------------------------------------------------------------------------
// THREAD_PRESETS
// ---------------------------------------------------------------------------

describe('THREAD_PRESETS', () => {
  it('codeReview produces a c-thread', () => {
    const spec = THREAD_PRESETS.codeReview('src/auth.ts')
    expect(spec.type).toBe('c')
    expect(spec.steps).toHaveLength(2)
    expect(spec.steps![0].agent).toBe('scout')
    expect(spec.steps![1].agent).toBe('reviewer')
    const cmd = buildThreadCommand(spec)
    expect(cmd).toContain('/chain')
  })

  it('parallelReview produces a p-thread with 3 reviewers', () => {
    const spec = THREAD_PRESETS.parallelReview('src/')
    expect(spec.type).toBe('p')
    expect(spec.tasks).toHaveLength(3)
    const cmd = buildThreadCommand(spec)
    expect(cmd).toContain('/parallel')
  })

  it('planAndBuild produces scout→planner→worker chain', () => {
    const spec = THREAD_PRESETS.planAndBuild('add OAuth login')
    expect(spec.steps?.map(s => s.agent)).toEqual(['scout', 'planner', 'worker'])
    const cmd = buildThreadCommand(spec)
    expect(cmd).toContain('scout')
    expect(cmd).toContain('planner')
    expect(cmd).toContain('worker')
  })

  it('debugFusion produces 3 parallel workers with same task', () => {
    const spec = THREAD_PRESETS.debugFusion('500 on POST /users')
    expect(spec.type).toBe('f')
    expect(spec.tasks).toHaveLength(3)
    const cmd = buildThreadCommand(spec)
    expect(cmd).toContain('/parallel')
  })

  it('parallelResearch produces scout + researcher', () => {
    const spec = THREAD_PRESETS.parallelResearch('rate limiting patterns')
    expect(spec.tasks!.map(t => t.agent)).toContain('scout')
    expect(spec.tasks!.map(t => t.agent)).toContain('researcher')
  })

  it('all presets produce non-empty commands', () => {
    const targets: Record<string, string> = {
      codeReview: 'src/',
      parallelReview: 'src/',
      planAndBuild: 'add auth',
      debugFusion: 'login broken',
      parallelResearch: 'caching',
    }
    for (const [name, arg] of Object.entries(targets)) {
      const spec = THREAD_PRESETS[name as keyof typeof THREAD_PRESETS](arg)
      const cmd = buildThreadCommand(spec)
      expect(cmd.length).toBeGreaterThan(5)
    }
  })
})

// ---------------------------------------------------------------------------
// ThreadEngine (mocked RpcSessionManager)
// ---------------------------------------------------------------------------

function makeMockRpc() {
  const rpc = new RpcSessionManager()
  // Prevent real pi subprocess from spawning
  vi.spyOn(rpc, 'create').mockResolvedValue({} as never)
  vi.spyOn(rpc, 'prompt').mockResolvedValue(undefined)
  vi.spyOn(rpc, 'kill').mockResolvedValue(undefined)
  vi.spyOn(rpc, 'abort').mockResolvedValue(undefined)
  vi.spyOn(rpc, 'list').mockReturnValue([])
  return rpc
}

describe('ThreadEngine', () => {
  let engine: ThreadEngine
  let rpc: RpcSessionManager

  beforeEach(() => {
    rpc = makeMockRpc()
    engine = new ThreadEngine(rpc)
  })

  it('launch() creates RPC session and sends command', async () => {
    const run = await engine.launch({ type: 'b', agent: 'scout', task: 'find todos' })
    expect(rpc.create).toHaveBeenCalledWith(run.sessionId, expect.objectContaining({}))
    expect(rpc.prompt).toHaveBeenCalledWith(run.sessionId, '/run scout "find todos"')
    expect(run.type).toBe('b')
    expect(run.status).toBe('running')
  })

  it('b() convenience method works', async () => {
    const run = await engine.b('planner', 'plan the feature')
    expect(rpc.prompt).toHaveBeenCalledWith(run.sessionId, '/run planner "plan the feature"')
  })

  it('p() sends /parallel command', async () => {
    const run = await engine.p([
      { agent: 'reviewer', task: 'security' },
      { agent: 'reviewer', task: 'perf' },
    ])
    expect(rpc.prompt).toHaveBeenCalledWith(run.sessionId, expect.stringContaining('/parallel'))
  })

  it('c() sends /chain command', async () => {
    const run = await engine.c([
      { agent: 'scout', task: 'scan' },
      { agent: 'worker', task: 'build' },
    ])
    expect(rpc.prompt).toHaveBeenCalledWith(run.sessionId, expect.stringContaining('/chain'))
  })

  it('f() sends /parallel with same task N times', async () => {
    const run = await engine.f(['worker', 'worker', 'worker'], 'fix the bug')
    const call = (rpc.prompt as ReturnType<typeof vi.fn>).mock.calls[0][1] as string
    expect(call).toContain('/parallel')
    const matches = call.match(/worker "fix the bug"/g)
    expect(matches).toHaveLength(3)
  })

  it('listThreads() returns launched threads', async () => {
    await engine.b('scout', 'task A')
    await engine.b('scout', 'task B')
    expect(engine.listThreads()).toHaveLength(2)
  })

  it('getThread() returns thread by id', async () => {
    const run = await engine.b('scout', 'task')
    expect(engine.getThread(run.id)).toBe(run)
  })

  it('killThread() calls rpc.kill with session id', async () => {
    const run = await engine.b('scout', 'task')
    await engine.killThread(run.id)
    expect(rpc.kill).toHaveBeenCalledWith(run.sessionId)
    expect(run.status).toBe('killed')
  })

  it('killThread() on unknown id is a no-op', async () => {
    await expect(engine.killThread('nonexistent')).resolves.toBeUndefined()
  })

  it('launch() emits launched event', async () => {
    const events: unknown[] = []
    engine.on('launched', (r) => events.push(r))
    await engine.b('scout', 'task')
    expect(events).toHaveLength(1)
  })

  it('launch() throws on empty task', async () => {
    await expect(engine.launch({ type: 'base', task: '' })).rejects.toThrow('Empty thread command')
  })

  it('cleanDead() removes killed threads', async () => {
    const r1 = await engine.b('scout', 'task A')
    const r2 = await engine.b('scout', 'task B')
    await engine.killThread(r1.id)
    engine.cleanDead()
    expect(engine.listThreads()).toHaveLength(1)
    expect(engine.getThread(r2.id)).toBeDefined()
    expect(engine.getThread(r1.id)).toBeUndefined()
  })
})
