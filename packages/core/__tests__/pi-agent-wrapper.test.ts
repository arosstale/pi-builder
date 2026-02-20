/**
 * PiAgentWrapper tests
 *
 * PiAgentWrapper now uses pi's RPC mode (pi --mode rpc) via RpcClient.
 * Tests run in VITEST=true mode — the wrapper returns mock output
 * without spawning a subprocess. We verify: output shape, cwd passthrough,
 * health (delegates to execFile pi --version), version().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PiAgentWrapper } from '../src/integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Mock execFile so health() / version() work without pi installed
// ---------------------------------------------------------------------------

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return {
    ...actual,
    execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: null, res: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout: 'pi/0.54.0', stderr: '' })
    }),
    spawn: actual.spawn,
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PiAgentWrapper (RPC mode)', () => {
  let wrapper: PiAgentWrapper

  beforeEach(() => {
    wrapper = new PiAgentWrapper({ cwd: '/config/cwd' })
  })

  it('has expected id and capabilities', () => {
    expect(wrapper.id).toBe('pi')
    expect(wrapper.capabilities).toContain('code-generation')
    expect(wrapper.capabilities).toContain('tool-use')
    expect(wrapper.capabilities).toContain('session-memory')
  })

  it('health() returns true when pi --version succeeds', async () => {
    const ok = await wrapper.health()
    expect(ok).toBe(true)
  })

  it('version() returns version string', async () => {
    const v = await wrapper.version()
    expect(typeof v).toBe('string')
    expect(v).toBeTruthy()
  })

  it('executeStream yields mock output in VITEST mode', async () => {
    const chunks: string[] = []
    for await (const chunk of wrapper.executeStream({ prompt: 'hello world' })) {
      chunks.push(chunk)
    }
    const output = chunks.join('')
    expect(output).toContain('[pi]')
    expect(output).toContain('hello')
  })

  it('execute() collects chunks into output string', async () => {
    const result = await wrapper.execute({ prompt: 'generate code', workDir: '/tmp' })
    expect(result.agent).toBe('pi')
    expect(result.status).toBe('success')
    expect(typeof result.output).toBe('string')
    expect(result.output.length).toBeGreaterThan(0)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('execute() returns error status on throw', async () => {
    // Force an error by making the mock yield an error
    const badWrapper = new PiAgentWrapper({ cwd: '/nonexistent' })
    // In VITEST mode the stream always succeeds; patch executeStream manually
    vi.spyOn(badWrapper, 'executeStream').mockImplementation(async function* () {
      throw new Error('mock failure')
    })
    const result = await badWrapper.execute({ prompt: 'fail' })
    expect(result.status).toBe('error')
    expect(result.stderr).toContain('mock failure')
  })

  it('respects cwd from config', async () => {
    // In VITEST mode, the mock output just includes the prompt — cwd is passed
    // to RpcClient at runtime (no subprocess in test mode). We verify the config
    // is stored correctly.
    const w = new PiAgentWrapper({ cwd: '/specific/dir' })
    expect((w as unknown as { config: { cwd: string } }).config.cwd).toBe('/specific/dir')
  })

  it('respects provider and model config', () => {
    const w = new PiAgentWrapper({ provider: 'anthropic', model: 'claude-haiku-4-20250514' })
    const cfg = (w as unknown as { config: { provider?: string; model?: string } }).config
    expect(cfg.provider).toBe('anthropic')
    expect(cfg.model).toBe('claude-haiku-4-20250514')
  })

  it('executeStream handles empty prompt gracefully', async () => {
    const chunks: string[] = []
    for await (const chunk of wrapper.executeStream({ prompt: '' })) {
      chunks.push(chunk)
    }
    // Should not throw; may yield empty or minimal output
    expect(Array.isArray(chunks)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RpcSessionManager tests
// ---------------------------------------------------------------------------

import { RpcSessionManager } from '../src/integrations/agent-wrappers'

describe('RpcSessionManager', () => {
  it('list() returns empty initially', () => {
    const mgr = new RpcSessionManager()
    expect(mgr.list()).toEqual([])
  })

  it('throws when creating duplicate session id', async () => {
    // In VITEST mode we can't actually start RpcClient (no pi binary mock here)
    // so we just test the guard logic by pre-populating the sessions map
    const mgr = new RpcSessionManager()
    const sessions = (mgr as unknown as { sessions: Map<string, unknown> }).sessions
    sessions.set('my-session', { id: 'my-session', alive: true })
    await expect(mgr.create('my-session', {})).rejects.toThrow("RPC session 'my-session' already exists")
  })

  it('kill() on unknown session is a no-op', async () => {
    const mgr = new RpcSessionManager()
    await expect(mgr.kill('nonexistent')).resolves.toBeUndefined()
  })

  it('abort() on unknown session is a no-op', async () => {
    const mgr = new RpcSessionManager()
    await expect(mgr.abort('nonexistent')).resolves.toBeUndefined()
  })

  it('prompt() throws on unknown session', async () => {
    const mgr = new RpcSessionManager()
    await expect(mgr.prompt('ghost', 'hello')).rejects.toThrow("RPC session 'ghost' not found or dead")
  })

  it('list() includes sessions by id', () => {
    const mgr = new RpcSessionManager()
    const sessions = (mgr as unknown as { sessions: Map<string, unknown> }).sessions
    sessions.set('s1', { id: 's1', cwd: '/tmp', alive: true, createdAt: 0,
      client: { stop: async () => {} } })
    const list = mgr.list()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('s1')
  })
})
