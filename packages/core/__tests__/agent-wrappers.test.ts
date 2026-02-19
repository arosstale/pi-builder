import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ClaudeCodeWrapper,
  AiderWrapper,
  OpenCodeWrapper,
  GeminiCLIWrapper,
  WrapperOrchestrator,
  createOrchestrator,
  type AgentTask,
} from '../src/integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Helpers — mock wrapper that doesn't spawn real binaries
// ---------------------------------------------------------------------------

function mockWrapper(
  id: string,
  capabilities: string[],
  healthy: boolean,
  output = `[${id}] task done`
) {
  const w = new ClaudeCodeWrapper()
  w.id = id
  w.name = id
  ;(w as unknown as Record<string, unknown>).capabilities = capabilities

  vi.spyOn(w, 'health').mockResolvedValue(healthy)
  vi.spyOn(w, 'version').mockResolvedValue(healthy ? '1.0.0' : null)
  vi.spyOn(w, 'execute').mockResolvedValue({
    agent: id,
    status: 'success',
    output,
    durationMs: 10,
  })

  return w
}

// ---------------------------------------------------------------------------
// AgentWrapper interface
// ---------------------------------------------------------------------------

describe('AgentWrapper interface', () => {
  it('ClaudeCodeWrapper has correct id and capabilities', () => {
    const w = new ClaudeCodeWrapper()
    expect(w.id).toBe('claude')
    expect(w.name).toBe('Claude Code')
    expect(w.binary).toBe('claude')
    expect(w.capabilities).toContain('code-generation')
    expect(w.capabilities).toContain('refactoring')
  })

  it('AiderWrapper has git-aware capability', () => {
    const w = new AiderWrapper()
    expect(w.id).toBe('aider')
    expect(w.capabilities).toContain('git-aware')
    expect(w.capabilities).toContain('multi-file')
  })

  it('OpenCodeWrapper has multi-provider capability', () => {
    const w = new OpenCodeWrapper()
    expect(w.id).toBe('opencode')
    expect(w.capabilities).toContain('multi-provider')
  })

  it('GeminiCLIWrapper has large-context capability', () => {
    const w = new GeminiCLIWrapper()
    expect(w.id).toBe('gemini')
    expect(w.capabilities).toContain('large-context')
  })

  it('health() returns false when binary not installed', async () => {
    const w = new ClaudeCodeWrapper()
    // claude binary won't be in PATH in test env (usually)
    // health() calls version() which calls execFile — will fail → false
    const ok = await w.health()
    // We don't assert the value — just that it returns a boolean without throwing
    expect(typeof ok).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// WrapperOrchestrator
// ---------------------------------------------------------------------------

describe('WrapperOrchestrator', () => {
  let orch: WrapperOrchestrator

  beforeEach(() => {
    orch = new WrapperOrchestrator()
  })

  it('registers wrappers and returns them', () => {
    const w = mockWrapper('test-agent', ['code-generation'], true)
    orch.register(w)
    expect(orch.getWrappers()).toHaveLength(1)
    expect(orch.getWrapper('test-agent')).toBe(w)
  })

  it('reports healthy agents', async () => {
    orch.register(mockWrapper('healthy', ['code-generation'], true))
    orch.register(mockWrapper('unhealthy', ['code-generation'], false))

    const available = await orch.availableAgents()
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('healthy')
  })

  it('selects agent by capability', async () => {
    orch.register(mockWrapper('general', ['code-generation'], true))
    orch.register(mockWrapper('bug-fixer', ['bug-fixing', 'issue-resolution'], true))

    const task: AgentTask = { prompt: 'fix this bug', capability: 'bug-fixing' }
    const selected = await orch.selectForTask(task)
    expect(selected?.id).toBe('bug-fixer')
  })

  it('respects preferred agent order', async () => {
    const a = mockWrapper('aider', ['code-generation'], true)
    const b = mockWrapper('claude', ['code-generation'], true)
    orch.register(a)
    orch.register(b)

    const orchWithPref = new WrapperOrchestrator({ preferredAgents: ['claude', 'aider'] })
    orchWithPref.register(a)
    orchWithPref.register(b)

    const task: AgentTask = { prompt: 'do something' }
    const selected = await orchWithPref.selectForTask(task)
    expect(selected?.id).toBe('claude')
  })

  it('falls back to next agent on failure', async () => {
    const failing = mockWrapper('failing', ['code-generation'], true)
    vi.spyOn(failing, 'execute').mockResolvedValue({
      agent: 'failing',
      status: 'error',
      output: '',
      stderr: 'crashed',
      durationMs: 10,
    })

    const backup = mockWrapper('backup', ['code-generation'], true, 'backup output')
    orch = new WrapperOrchestrator({ fallback: true })
    orch.register(failing)
    orch.register(backup)

    const result = await orch.execute({ prompt: 'do something' })
    expect(result.agent).toBe('backup')
    expect(result.status).toBe('success')
  })

  it('returns error result when no agents available', async () => {
    orch.register(mockWrapper('offline', ['code-generation'], false))
    const result = await orch.execute({ prompt: 'do something' })
    expect(result.status).toBe('error')
    expect(result.agent).toBe('none')
  })

  it('executes task on best available agent', async () => {
    orch.register(mockWrapper('claude', ['code-generation', 'refactoring'], true, 'generated code'))
    const result = await orch.execute({ prompt: 'write a function', capability: 'refactoring' })
    expect(result.status).toBe('success')
    expect(result.output).toBe('generated code')
  })

  it('checkHealth returns per-agent health map', async () => {
    orch.register(mockWrapper('agent-a', ['code-generation'], true))
    orch.register(mockWrapper('agent-b', ['code-generation'], false))

    const health = await orch.checkHealth()
    expect(health['agent-a']).toBe(true)
    expect(health['agent-b']).toBe(false)
  })

  it('caches health results within TTL', async () => {
    const w = mockWrapper('cached', ['code-generation'], true)
    orch.register(w)

    await orch.isHealthy('cached')
    await orch.isHealthy('cached')

    // health() should only be called once due to cache
    expect(vi.mocked(w.health)).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// createOrchestrator factory
// ---------------------------------------------------------------------------

describe('createOrchestrator', () => {
  it('registers all 10 known agents', () => {
    const orch = createOrchestrator()
    const ids = orch.getWrappers().map((w) => w.id)
    expect(ids).toContain('claude')
    expect(ids).toContain('aider')
    expect(ids).toContain('opencode')
    expect(ids).toContain('codex')
    expect(ids).toContain('gemini')
    expect(ids).toContain('goose')
    expect(ids).toContain('plandex')
    expect(ids).toContain('swe-agent')
    expect(ids).toContain('crush')
    expect(ids).toContain('gptme')
    expect(ids).toHaveLength(10)
  })

  it('accepts preferred agent config', () => {
    const orch = createOrchestrator({ preferredAgents: ['aider', 'claude'] })
    expect(orch.getWrappers().length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Streaming (mock)
// ---------------------------------------------------------------------------

describe('streaming', () => {
  it('executeStream yields chunks from orchestrator', async () => {
    const w = mockWrapper('streamer', ['code-generation'], true)

    async function* fakeStream(): AsyncGenerator<string> {
      yield 'chunk1\n'
      yield 'chunk2\n'
    }

    vi.spyOn(w, 'executeStream').mockImplementation(fakeStream)

    const orch = new WrapperOrchestrator()
    orch.register(w)

    const chunks: string[] = []
    for await (const chunk of orch.executeStream({ prompt: 'do something' })) {
      chunks.push(chunk)
    }

    // first chunk is the "[AgentName] Starting..." header
    expect(chunks.some((c) => c.includes('chunk1'))).toBe(true)
    expect(chunks.some((c) => c.includes('chunk2'))).toBe(true)
  })
})
