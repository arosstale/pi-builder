/**
 * WebSocket server tests
 *
 * Tests the PiBuilderGateway protocol for stateless frames that don't
 * require real CLI agent binaries (hello, history, clear, error handling).
 *
 * Health / agents tests are skipped here since they spawn binary --version
 * calls that may be slow or unavailable in CI; they are covered by
 * agent-wrappers.test.ts at the orchestrator layer.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { WebSocket } from 'ws'
import { PiBuilderGateway } from '../src/server/websocket-server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Connect and collect all frames into a queue so we never miss early ones */
function connectWithQueue(port: number): Promise<{
  ws: WebSocket
  next: (timeoutMs?: number) => Promise<Record<string, unknown>>
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    const queue: Record<string, unknown>[] = []
    const waiters: Array<(f: Record<string, unknown>) => void> = []

    ws.on('message', (raw) => {
      try {
        const frame = JSON.parse(raw.toString())
        if (waiters.length > 0) {
          waiters.shift()!(frame)
        } else {
          queue.push(frame)
        }
      } catch {
        // bad frame — ignore in queue
      }
    })

    const next = (timeoutMs = 3000): Promise<Record<string, unknown>> =>
      new Promise((res, rej) => {
        if (queue.length > 0) { res(queue.shift()!); return }
        const timer = setTimeout(() => rej(new Error('frame timeout')), timeoutMs)
        waiters.push((f) => { clearTimeout(timer); res(f) })
      })

    ws.on('open', () => resolve({ ws, next }))
    ws.on('error', reject)
  })
}

function sendRaw(ws: WebSocket, frame: Record<string, unknown>): void {
  ws.send(JSON.stringify(frame))
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PiBuilderGateway WebSocket protocol', () => {
  let gateway: PiBuilderGateway
  let port: number

  beforeAll(async () => {
    port = 18960 + Math.floor(Math.random() * 30)
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

  // ── fast protocol tests (no binary calls) ──────────────────────────────

  it('sends hello frame on connection', async () => {
    const { ws, next } = await connectWithQueue(port)
    const frame = await next()
    expect(frame.type).toBe('hello')
    expect(typeof frame.sessionId).toBe('string')
    ws.close()
  })

  it('responds to history request (empty initially)', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello
    sendRaw(ws, { type: 'history', id: 'hist1' })
    const frame = await next()
    expect(frame.type).toBe('history')
    expect(frame.id).toBe('hist1')
    expect(Array.isArray(frame.messages)).toBe(true)
    expect((frame.messages as unknown[]).length).toBe(0)
    ws.close()
  })

  it('responds to clear request with ok', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello
    sendRaw(ws, { type: 'clear', id: 'c1' })
    const frame = await next()
    expect(frame.type).toBe('ok')
    expect(frame.id).toBe('c1')
    expect(frame.method).toBe('clear')
    ws.close()
  })

  it('returns error for unknown method', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello
    sendRaw(ws, { type: 'unknown_xyz', id: 'u1' })
    const frame = await next()
    expect(frame.type).toBe('error')
    expect(frame.id).toBe('u1')
    expect(typeof frame.message).toBe('string')
    expect((frame.message as string).toLowerCase()).toMatch(/unknown/)
    ws.close()
  })

  it('returns error for invalid JSON', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello
    ws.send('{ not valid json ~~~')
    const frame = await next()
    expect(frame.type).toBe('error')
    expect((frame.message as string).toLowerCase()).toMatch(/invalid json/)
    ws.close()
  })

  it('returns error for send with empty message', async () => {
    const { ws, next } = await connectWithQueue(port)
    await next() // hello
    sendRaw(ws, { type: 'send', id: 's1', message: '   ' })
    const frame = await next()
    expect(frame.type).toBe('error')
    expect(frame.id).toBe('s1')
    expect(typeof frame.message).toBe('string')
    ws.close()
  })

  it('supports multiple concurrent clients independently', async () => {
    const [c1, c2] = await Promise.all([
      connectWithQueue(port),
      connectWithQueue(port),
    ])
    await Promise.all([c1.next(), c2.next()]) // consume hellos

    sendRaw(c1.ws, { type: 'history', id: 'multi1' })
    sendRaw(c2.ws, { type: 'history', id: 'multi2' })

    const [f1, f2] = await Promise.all([c1.next(), c2.next()])
    expect(f1.type).toBe('history')
    expect(f1.id).toBe('multi1')
    expect(f2.type).toBe('history')
    expect(f2.id).toBe('multi2')
    c1.ws.close()
    c2.ws.close()
  })

  it('exposes gateway url, port, host', () => {
    expect(gateway.port).toBe(port)
    expect(gateway.host).toBe('127.0.0.1')
    expect(gateway.url).toBe(`ws://127.0.0.1:${port}`)
  })
})
