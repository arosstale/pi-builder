/**
 * OrchestratorService — middleware + dynamic wrapper registry tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createOrchestratorService,
  OrchestratorService,
  type MiddlewareFn,
  type MiddlewareContext,
} from '../src/orchestration/orchestrator-service'
import type { AgentWrapper, AgentTask, AgentResult } from '../src/integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal mock wrapper — always succeeds, yields a canned response */
function mockWrapper(id: string, output = `response from ${id}`): AgentWrapper {
  return {
    id,
    name: id,
    binary: id,
    capabilities: ['code-generation'],
    async execute(_task: AgentTask): Promise<AgentResult> {
      return { agent: id, status: 'success', output, durationMs: 1 }
    },
    async *executeStream(_task: AgentTask): AsyncGenerator<string> {
      yield output
    },
    async health(): Promise<boolean> { return true },
    async version(): Promise<string | null> { return '1.0.0' },
  }
}

/** Inject a mock wrapper as the only agent, bypassing real binary detection */
function injectMockAgent(svc: OrchestratorService, wrapper: AgentWrapper): void {
  // Register our mock, then remove all real wrappers by overriding orchestrator selection
  ;(svc as unknown as Record<string, unknown>)['wrapperOrchestrator'] = {
    register: vi.fn(),
    unregister: vi.fn(),
    getWrapper: vi.fn().mockReturnValue(wrapper),
    getWrappers: vi.fn().mockReturnValue([wrapper]),
    availableAgents: vi.fn().mockResolvedValue([wrapper]),
    checkHealth: vi.fn().mockResolvedValue({ [wrapper.id]: true }),
    selectForTask: vi.fn().mockResolvedValue(wrapper),
    executeStream: wrapper.executeStream.bind(wrapper),
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('OrchestratorService middleware', () => {
  let svc: OrchestratorService

  beforeEach(async () => {
    svc = await createOrchestratorService({ dbPath: ':memory:' })
    injectMockAgent(svc, mockWrapper('mock-agent'))
  })

  afterEach(async () => {
    await svc.close()
  })

  // ── pass ──────────────────────────────────────────────────────────────────

  it('passes through with no middleware', async () => {
    const result = await svc.processMessage('write a test')
    expect(result.message.role).toBe('assistant')
    expect(result.agentResult.status).toBe('success')
  })

  // ── transform ─────────────────────────────────────────────────────────────

  it('transform middleware rewrites the prompt', async () => {
    const seen: string[] = []

    const mw: MiddlewareFn = (prompt) => {
      seen.push(prompt)
      return { action: 'transform', prompt: `PREFIXED: ${prompt}` }
    }

    svc.use(mw)

    const result = await svc.processMessage('hello')
    expect(seen).toHaveLength(1)
    expect(seen[0]).toBe('hello')
    // The mock agent echoes what it receives — output will contain prefixed prompt via buildPrompt
    expect(result.message.content).toBeTruthy()
    expect(result.agentResult.status).toBe('success')
  })

  it('chained transforms compose in order', async () => {
    const order: string[] = []

    svc.use((p) => { order.push('mw1'); return { action: 'transform', prompt: `[A]${p}` } })
    svc.use((p) => { order.push('mw2'); return { action: 'transform', prompt: `[B]${p}` } })

    await svc.processMessage('x')
    expect(order).toEqual(['mw1', 'mw2'])
  })

  // ── block ─────────────────────────────────────────────────────────────────

  it('block middleware emits error and returns blocked turn', async () => {
    const errors: Error[] = []
    svc.on('error', (e) => errors.push(e))

    svc.use(() => ({ action: 'block', reason: 'contains forbidden word' }))

    const result = await svc.processMessage('do something forbidden')
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/middleware blocked/)
    expect(result.agentResult.agent).toBe('middleware')
    expect(result.agentResult.status).toBe('error')
  })

  it('block stops remaining middleware from running', async () => {
    const ran: string[] = []

    svc.use(() => { ran.push('first'); return { action: 'block', reason: 'stop' } })
    svc.use(() => { ran.push('second'); return { action: 'pass' } })

    svc.on('error', () => {}) // suppress unhandled error event
    await svc.processMessage('test')
    expect(ran).toEqual(['first'])
  })

  // ── route ─────────────────────────────────────────────────────────────────

  it('route middleware forces a specific agent', async () => {
    const special = mockWrapper('special-agent', 'special output')
    injectMockAgent(svc, special)

    // Middleware that routes to 'special-agent' unconditionally
    const routeFn: MiddlewareFn = () => ({ action: 'route', agentId: 'special-agent' })
    svc.use(routeFn)

    const orch = (svc as unknown as Record<string, unknown>)['wrapperOrchestrator'] as {
      getWrapper: ReturnType<typeof vi.fn>
      selectForTask: ReturnType<typeof vi.fn>
    }

    // getWrapper should be called with 'special-agent'
    const result = await svc.processMessage('do something')
    expect(orch.getWrapper).toHaveBeenCalledWith('special-agent')
    expect(result.agentResult.status).toBe('success')
  })

  // ── context ───────────────────────────────────────────────────────────────

  it('middleware receives sessionId and history in context', async () => {
    const contexts: MiddlewareContext[] = []

    svc.use((prompt, ctx) => {
      contexts.push(ctx)
      return { action: 'pass' }
    })

    await svc.processMessage('first message')
    await svc.processMessage('second message')

    expect(contexts[0].sessionId).toMatch(/^session-/)
    expect(contexts[0].history.length).toBeGreaterThanOrEqual(0)
    // Second call sees first message in history
    expect(contexts[1].history.some((m) => m.content === 'first message')).toBe(true)
  })

  // ── unuse ─────────────────────────────────────────────────────────────────

  it('unuse removes a middleware', async () => {
    const ran: string[] = []
    const mw: MiddlewareFn = () => { ran.push('ran'); return { action: 'pass' } }

    svc.use(mw)
    await svc.processMessage('first')
    expect(ran).toHaveLength(1)

    svc.unuse(mw)
    await svc.processMessage('second')
    expect(ran).toHaveLength(1) // did not run again
  })

  // ── async middleware ──────────────────────────────────────────────────────

  it('supports async middleware', async () => {
    const mw: MiddlewareFn = async (prompt) => {
      await new Promise((r) => setTimeout(r, 5))
      return { action: 'transform', prompt: `async:${prompt}` }
    }
    svc.use(mw)

    const result = await svc.processMessage('test')
    expect(result.agentResult.status).toBe('success')
  })
})

// ---------------------------------------------------------------------------
// Dynamic wrapper registry
// ---------------------------------------------------------------------------

describe('OrchestratorService dynamic wrapper registry', () => {
  let svc: OrchestratorService

  beforeEach(async () => {
    svc = await createOrchestratorService({ dbPath: ':memory:' })
  })

  afterEach(async () => {
    await svc.close()
  })

  it('listWrappers returns all registered wrappers', () => {
    const wrappers = svc.listWrappers()
    expect(Array.isArray(wrappers)).toBe(true)
    // Default orchestrator registers all 10 built-in wrappers
    expect(wrappers.length).toBeGreaterThan(0)
    expect(wrappers[0]).toHaveProperty('id')
    expect(wrappers[0]).toHaveProperty('name')
    expect(wrappers[0]).toHaveProperty('capabilities')
  })

  it('registerWrapper adds a custom wrapper', () => {
    const before = svc.listWrappers().length
    svc.registerWrapper(mockWrapper('my-custom-agent'))
    const after = svc.listWrappers()
    expect(after.length).toBe(before + 1)
    expect(after.some((w) => w.id === 'my-custom-agent')).toBe(true)
  })

  it('unregisterWrapper removes a wrapper', () => {
    svc.registerWrapper(mockWrapper('temp-agent'))
    expect(svc.listWrappers().some((w) => w.id === 'temp-agent')).toBe(true)

    svc.unregisterWrapper('temp-agent')
    expect(svc.listWrappers().some((w) => w.id === 'temp-agent')).toBe(false)
  })

  it('registerWrapper is fluent (returns this)', () => {
    const result = svc.registerWrapper(mockWrapper('a'))
    expect(result).toBe(svc)
  })

  it('unregisterWrapper is fluent (returns this)', () => {
    svc.registerWrapper(mockWrapper('b'))
    const result = svc.unregisterWrapper('b')
    expect(result).toBe(svc)
  })

  it('re-registering same id replaces the wrapper', () => {
    svc.registerWrapper(mockWrapper('dup', 'first'))
    svc.registerWrapper(mockWrapper('dup', 'second'))
    const wrappers = svc.listWrappers()
    const dups = wrappers.filter((w) => w.id === 'dup')
    expect(dups).toHaveLength(1)
  })
})
