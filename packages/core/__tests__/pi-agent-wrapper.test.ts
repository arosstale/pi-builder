/**
 * PiAgentWrapper tests
 *
 * Tests the SDK-based pi wrapper without making real LLM calls.
 * The session.prompt() is mocked so we verify the streaming + event plumbing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PiAgentWrapper } from '../src/integrations/agent-wrappers'

// ---------------------------------------------------------------------------
// Mock @mariozechner/pi-coding-agent
// ---------------------------------------------------------------------------

let subscriberFn: ((event: Record<string, unknown>) => void) | null = null

const mockSession = {
  subscribe: vi.fn((fn: (event: Record<string, unknown>) => void) => {
    subscriberFn = fn
  }),
  prompt: vi.fn(async (_prompt: string) => {
    // Simulate streaming three text deltas then complete
    for (const delta of ['Hello', ' from', ' pi!']) {
      subscriberFn?.({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', delta },
      })
      await new Promise((r) => setTimeout(r, 1))
    }
  }),
}

vi.mock('@mariozechner/pi-coding-agent', () => ({
  createAgentSession: vi.fn(async () => ({ session: mockSession })),
  AuthStorage: {
    create: vi.fn(() => ({})),
  },
  ModelRegistry: vi.fn(() => ({})),
  SessionManager: {
    inMemory: vi.fn(() => ({})),
  },
  VERSION: '0.53.0',
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PiAgentWrapper', () => {
  let wrapper: PiAgentWrapper

  beforeEach(() => {
    wrapper = new PiAgentWrapper({ cwd: '/tmp' })
    subscriberFn = null
    vi.clearAllMocks()
    // Re-attach mock subscriber capture after clearAllMocks
    mockSession.subscribe.mockImplementation((fn) => { subscriberFn = fn })
    mockSession.prompt.mockImplementation(async () => {
      for (const delta of ['Hello', ' from', ' pi!']) {
        subscriberFn?.({
          type: 'message_update',
          assistantMessageEvent: { type: 'text_delta', delta },
        })
        await new Promise((r) => setTimeout(r, 1))
      }
    })
  })

  it('has correct id, name, binary', () => {
    expect(wrapper.id).toBe('pi')
    expect(wrapper.name).toBe('pi')
    expect(wrapper.binary).toBe('pi')
  })

  it('has expected capabilities', () => {
    expect(wrapper.capabilities).toContain('code-generation')
    expect(wrapper.capabilities).toContain('multi-file')
    expect(wrapper.capabilities).toContain('extensions')
    expect(wrapper.capabilities).toContain('session-memory')
  })

  it('health() returns true when SDK is available', async () => {
    const ok = await wrapper.health()
    expect(ok).toBe(true)
  })

  it('version() returns SDK version string', async () => {
    const v = await wrapper.version()
    expect(v).toBe('0.53.0')
  })

  it('executeStream() yields text deltas from session events', async () => {
    const chunks: string[] = []
    for await (const chunk of wrapper.executeStream({ prompt: 'hello pi' })) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hello', ' from', ' pi!'])
    expect(chunks.join('')).toBe('Hello from pi!')
  })

  it('executeStream() calls session.prompt with the task prompt', async () => {
    const { createAgentSession } = await import('@mariozechner/pi-coding-agent')
    for await (const _ of wrapper.executeStream({ prompt: 'fix auth.ts' })) { /* drain */ }
    expect(createAgentSession).toHaveBeenCalledOnce()
    expect(mockSession.prompt).toHaveBeenCalledWith('fix auth.ts')
  })

  it('execute() collects all chunks into output', async () => {
    const result = await wrapper.execute({ prompt: 'generate a function' })
    expect(result.status).toBe('success')
    expect(result.output).toBe('Hello from pi!')
    expect(result.agent).toBe('pi')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('execute() returns error status on SDK failure', async () => {
    mockSession.prompt.mockRejectedValueOnce(new Error('API key missing'))
    const result = await wrapper.execute({ prompt: 'will fail' })
    expect(result.status).toBe('error')
    expect(result.stderr).toMatch(/API key missing/)
  })

  it('executeStream() passes workDir to createAgentSession', async () => {
    const { createAgentSession } = await import('@mariozechner/pi-coding-agent')
    const w = new PiAgentWrapper({ cwd: '/my/project' })
    for await (const _ of w.executeStream({ prompt: 'test', workDir: '/override' })) { /* drain */ }
    expect(createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/override' })
    )
  })

  it('executeStream() uses config.cwd when task.workDir is absent', async () => {
    const { createAgentSession } = await import('@mariozechner/pi-coding-agent')
    const w = new PiAgentWrapper({ cwd: '/config/cwd' })
    for await (const _ of w.executeStream({ prompt: 'test' })) { /* drain */ }
    expect(createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/config/cwd' })
    )
  })
})
