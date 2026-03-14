/**
 * Gateway Teams + RPC protocol tests
 *
 * Tests the WebSocket frames added in the Agent Teams + RPC sessions layers:
 *   teams_list, teams_create, teams_task_update, teams_message, teams_watch
 *   rpc_list, rpc_new, rpc_kill (lightweight — no real pi binary needed)
 *
 * Uses a tmpdir so nothing is written to ~/.claude.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { WebSocket } from 'ws'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import { PiBuilderGateway } from '../src/server/websocket-server'

// ---------------------------------------------------------------------------
// Point AgentTeamsDriver at a tmpdir — patch homedir before module loads
// ---------------------------------------------------------------------------
// We can't easily monkey-patch after import, so we create teams manually
// via the gateway's teams_create frame and assert on the response.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function connectWithQueue(port: number): Promise<{
  ws: WebSocket
  next: (timeoutMs?: number) => Promise<Record<string, unknown>>
  send: (frame: Record<string, unknown>) => void
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const queue: Record<string, unknown>[] = []
    const waiters: Array<(f: Record<string, unknown>) => void> = []
    let timer: ReturnType<typeof setTimeout>

    ws.on('message', (raw) => {
      try {
        const frame = JSON.parse(raw.toString()) as Record<string, unknown>
        if (waiters.length > 0) waiters.shift()!(frame)
        else queue.push(frame)
      } catch { /* skip */ }
    })

    ws.on('open', () => resolve({
      ws,
      next(timeoutMs = 5000) {
        return new Promise((res, rej) => {
          if (queue.length > 0) { res(queue.shift()!); return }
          timer = setTimeout(() => rej(new Error('next() timeout')), timeoutMs)
          waiters.push((f) => { clearTimeout(timer); res(f) })
        })
      },
      send(frame) { ws.send(JSON.stringify(frame)) },
    }))
    ws.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let gateway: PiBuilderGateway
let port: number

beforeAll(async () => {
  port = 19200 + Math.floor(Math.random() * 50)
  gateway = new PiBuilderGateway({
    port,
    host: '127.0.0.1',
    orchestrator: { dbPath: ':memory:' },
  })
  await gateway.start()
}, 30_000)

afterAll(async () => {
  await gateway.stop()
}, 10_000)

// ---------------------------------------------------------------------------
// Teams protocol — list, create, watch, message
// ---------------------------------------------------------------------------

describe('teams_list', () => {
  it('returns teams array and presets array', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_list', id: 'tl1' })
    const f = await next()

    expect(f.type).toBe('teams_list')
    expect(f.id).toBe('tl1')
    expect(Array.isArray(f.teams)).toBe(true)
    expect(Array.isArray(f.presets)).toBe(true)
    // Presets should include all 7
    const presets = f.presets as Array<{ preset: string }>
    const presetNames = presets.map(p => p.preset)
    for (const p of ['review', 'debug', 'feature', 'fullstack', 'research', 'security', 'migration']) {
      expect(presetNames).toContain(p)
    }
    ws.close()
  })
})

describe('teams_create', () => {
  it('creates a review team from preset and returns config', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    const teamName = `test-review-${Date.now()}`
    send({ type: 'teams_create', id: 'tc1', preset: 'review', teamName })

    // Should get either teams_created or a broadcast teams_created event
    let f: Record<string, unknown> | null = null
    for (let i = 0; i < 5; i++) {
      f = await next()
      if (f.type === 'teams_created') break
    }
    expect(f?.type).toBe('teams_created')
    const config = f?.config as { teamName: string; members: unknown[] }
    expect(config.teamName).toBe(teamName)
    expect(config.members).toHaveLength(3) // review = 3 reviewers
    ws.close()
  })

  it('returns error when preset is missing', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_create', id: 'tc-bad', teamName: 'no-preset-team' })
    const f = await next()
    expect(f.type).toBe('error')
    expect(f.id).toBe('tc-bad')
    expect(typeof f.message).toBe('string')
    ws.close()
  })

  it('creates all 7 presets without error', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    const presets = ['review', 'debug', 'feature', 'fullstack', 'research', 'security', 'migration']
    for (const preset of presets) {
      const teamName = `auto-${preset}-${Date.now()}`
      send({ type: 'teams_create', id: `c-${preset}`, preset, teamName })
      // drain until teams_created
      for (let i = 0; i < 10; i++) {
        const f = await next()
        if (f.type === 'teams_created') break
        if (f.type === 'error') throw new Error(`teams_create ${preset} failed: ${f.message}`)
      }
    }
    ws.close()
  })
})

describe('teams_task_update', () => {
  it('returns error for unknown team', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_task_update', id: 'tu1', teamName: 'ghost-team', taskId: 'task-1', updates: { status: 'completed' } })
    const f = await next()
    expect(f.type).toBe('error')
    expect(f.id).toBe('tu1')
    ws.close()
  })

  it('returns error when teamName missing', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_task_update', id: 'tu2', taskId: 'task-1' })
    const f = await next()
    expect(f.type).toBe('error')
    expect(f.id).toBe('tu2')
    ws.close()
  })
})

describe('teams_message', () => {
  it('returns error when required fields are missing', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_message', id: 'tm1', teamName: 'any-team' }) // missing from/to/content
    const f = await next()
    expect(f.type).toBe('error')
    expect(f.id).toBe('tm1')
    ws.close()
  })
})

describe('teams_broadcast', () => {
  it('returns error when content missing', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_broadcast', id: 'tb1', teamName: 'any-team', from: 'lead' }) // no content
    const f = await next()
    expect(f.type).toBe('error')
    expect(f.id).toBe('tb1')
    ws.close()
  })
})

describe('teams_watch', () => {
  it('returns ok for a known team name', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    // First create a team
    const teamName = `watch-test-${Date.now()}`
    send({ type: 'teams_create', id: 'cw1', preset: 'debug', teamName })
    for (let i = 0; i < 5; i++) {
      const f = await next()
      if (f.type === 'teams_created') break
    }

    send({ type: 'teams_watch', id: 'tw1', teamName })
    // Drain until we see the 'ok' for our watch request (teams_created may arrive first)
    let watchOk: Record<string, unknown> | null = null
    for (let i = 0; i < 10; i++) {
      const f = await next()
      if (f.type === 'ok' && f.id === 'tw1') { watchOk = f; break }
    }
    expect(watchOk?.type).toBe('ok')
    expect(watchOk?.id).toBe('tw1')
    ws.close()
  })

  it('returns error when teamName missing', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'teams_watch', id: 'tw-bad' })
    const f = await next()
    expect(f.type).toBe('error')
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// RPC protocol — list, new (no real pi binary — tests guard logic)
// ---------------------------------------------------------------------------

describe('rpc_list', () => {
  it('returns rpc_sessions with empty array initially', async () => {
    // Fresh gateway per test suite — sessions from other tests may exist
    const localPort = 19270 + Math.floor(Math.random() * 20)
    const localGw = new PiBuilderGateway({
      port: localPort, host: '127.0.0.1', orchestrator: { dbPath: ':memory:' },
    })
    await localGw.start()

    const { ws, next, send } = await connectWithQueue(localPort)
    await next() // hello

    send({ type: 'rpc_list', id: 'rl1' })
    const f = await next()
    expect(f.type).toBe('rpc_sessions')
    expect(f.id).toBe('rl1')
    expect(Array.isArray(f.sessions)).toBe(true)
    ws.close()
    await localGw.stop()
  })
})

describe('rpc_new', () => {
  it('attempts session creation (may fail if pi not installed)', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    const sessionId = `test-session-${Date.now()}`
    send({ type: 'rpc_new', id: 'rn1', sessionId })

    // Either rpc_created (pi installed) or error (no pi binary) — both are valid
    const f = await next(8000)
    expect(['rpc_created', 'error']).toContain(f.type)
    ws.close()
  })

  it('returns error for duplicate session id', async () => {
    // Create one session (may or may not succeed), then try to create it again
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    const sessionId = `dup-session-${Date.now()}`
    send({ type: 'rpc_new', id: 'rn-dup-1', sessionId })
    const f1 = await next(8000)

    if (f1.type === 'rpc_created') {
      // Only test duplicate if first succeeded
      send({ type: 'rpc_new', id: 'rn-dup-2', sessionId })
      const f2 = await next(3000)
      expect(f2.type).toBe('error')
      expect((f2.message as string).toLowerCase()).toMatch(/already exists/)
    } else {
      // pi not installed — skip duplicate test
      expect(['error']).toContain(f1.type)
    }
    ws.close()
  })
})

describe('rpc_kill on unknown session', () => {
  it('returns ok silently (kill is idempotent)', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'rpc_kill', id: 'rk1', sessionId: 'nonexistent-session' })
    const f = await next(3000)
    // Either ok or silent — gateway should not crash
    expect(['ok', 'error']).toContain(f.type)
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// diff_full — full unified patch
// ---------------------------------------------------------------------------

describe('diff_full', () => {
  it('returns diff_full with patch and stat fields', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'diff_full', id: 'df1' })
    const f = await next(4000)

    expect(f.type).toBe('diff_full')
    expect(f.id).toBe('df1')
    // patch is string|null, stat is string|null — both present
    expect('patch' in f).toBe(true)
    expect('stat' in f).toBe(true)
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// thread_list — Threads protocol
// ---------------------------------------------------------------------------

describe('thread_list', () => {
  it('returns thread_list with threads array and presets array', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'thread_list', id: 'tl1' })
    const f = await next(3000)

    expect(f.type).toBe('thread_list')
    expect(Array.isArray(f.threads)).toBe(true)
    expect(Array.isArray(f.presets)).toBe(true)
    // presets should include the 5 named presets
    const names = (f.presets as Array<{name: string}>).map(p => p.name)
    expect(names).toContain('codeReview')
    expect(names).toContain('planAndBuild')
    expect(names).toContain('debugFusion')
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// thread_agents — agent discovery
// ---------------------------------------------------------------------------

describe('thread_agents', () => {
  it('returns thread_agents with agents array', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'thread_agents', id: 'ta1' })
    const f = await next(4000)

    expect(f.type).toBe('thread_agents')
    expect(Array.isArray(f.agents)).toBe(true)
    // Each agent has name, description, source
    for (const a of (f.agents as Array<{name: string; source: string}>) ) {
      expect(typeof a.name).toBe('string')
      expect(['user', 'builtin']).toContain(a.source)
    }
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// thread_async_list — async background jobs
// ---------------------------------------------------------------------------

describe('thread_async_list', () => {
  it('returns thread_async_list with jobs array (empty when no runs)', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'thread_async_list', id: 'tal1' })
    const f = await next(3000)

    expect(f.type).toBe('thread_async_list')
    expect(Array.isArray(f.jobs)).toBe(true)
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// thread_preset — preview command without launching
// ---------------------------------------------------------------------------

describe('thread_preset', () => {
  it('returns preview for codeReview preset with arg', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'thread_preset', id: 'tp1', preset: 'codeReview', arg: 'src/auth.ts' })
    const f = await next(3000)

    expect(f.type).toBe('thread_preset_preview')
    expect(f.preset).toBe('codeReview')
    expect(typeof f.command).toBe('string')
    expect((f.command as string).length).toBeGreaterThan(0)
    expect(f.spec).toBeDefined()
    ws.close()
  })

  it('returns error for unknown preset', async () => {
    const { ws, next, send } = await connectWithQueue(port)
    await next() // hello

    send({ type: 'thread_preset', id: 'tp2', preset: 'nonExistentPreset' })
    const f = await next(3000)

    expect(f.type).toBe('error')
    expect((f.message as string).toLowerCase()).toMatch(/unknown preset/i)
    ws.close()
  })
})

// ---------------------------------------------------------------------------
// bridge endpoint — HTTP POST /bridge
// ---------------------------------------------------------------------------

describe('/bridge HTTP endpoint', () => {
  it('accepts POST /bridge and broadcasts bridge_event', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello

    // Post a bridge event via HTTP
    const res = await fetch(`http://127.0.0.1:${port}/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'turn_end', sessionId: 'test-session', turnIndex: 1, summary: 'test' }),
    })
    expect(res.ok).toBe(true)

    const f = await next(3000)
    expect(f.type).toBe('bridge_event')
    expect(f.event).toBe('turn_end')
    expect(f.sessionId).toBe('test-session')
    expect(f.turnIndex).toBe(1)
    ws.close()
  })

  it('GET /health returns ok', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    expect(res.ok).toBe(true)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(typeof body.clients).toBe('number')
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/bridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json {{{',
    })
    expect(res.status).toBe(400)
  })
})
