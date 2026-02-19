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
import { request as httpRequest } from 'node:http'
import { PiBuilderGateway } from '../src/server/websocket-server'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Connect and collect all frames into a queue so we never miss early ones */
function connectWithQueue(port: number, path = ''): Promise<{
  ws: WebSocket
  next: (timeoutMs?: number) => Promise<Record<string, unknown>>
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`)
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

/** Make a GET request and resolve with the HTTP status code */
function httpGetStatus(url: string, bearerToken?: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const opts = {
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname,
      method: 'GET',
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
    }
    const req = httpRequest(opts, (res) => resolve(res.statusCode ?? 0))
    req.on('error', reject)
    req.end()
  })
}

/** Open a WS and return the close code (or -1 on error before open) */
function wsCloseCode(port: number, path = ''): Promise<number> {
  return new Promise<number>(resolve => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`)
    ws.on('close', code => resolve(code))
    ws.on('error', () => resolve(-1))
  })
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

// ---------------------------------------------------------------------------
// Auth — rejection tests (_trustLocalhost: false so 127.0.0.1 is not bypassed)
// ---------------------------------------------------------------------------

describe('PiBuilderGateway auth (token required)', () => {
  let gateway: PiBuilderGateway
  let port: number
  const token = 'super-secret-token'

  beforeAll(async () => {
    port = 19020 + Math.floor(Math.random() * 30)
    gateway = new PiBuilderGateway({
      port,
      host: '127.0.0.1',
      orchestrator: { dbPath: ':memory:' },
      authToken: token,
      _trustLocalhost: false,
    })
    await gateway.start()
  }, 30_000)

  afterAll(async () => {
    await gateway.stop()
  }, 10_000)

  it('rejects HTTP request without token → 401', async () => {
    const status = await httpGetStatus(`http://127.0.0.1:${port}/`)
    expect(status).toBe(401)
  })

  it('rejects HTTP request with wrong token → 401', async () => {
    const status = await httpGetStatus(`http://127.0.0.1:${port}/`, 'wrong-token')
    expect(status).toBe(401)
  })

  it('accepts HTTP request with correct token → 200', async () => {
    const status = await httpGetStatus(`http://127.0.0.1:${port}/`, token)
    expect(status).toBe(200)
  })

  it('accepts WS upgrade with ?token= query param', async () => {
    const { ws, next } = await connectWithQueue(port, `?token=${token}`)
    const frame = await next()
    expect(frame.type).toBe('hello')
    ws.close()
  })

  it('rejects WS upgrade without token → close code 4001', async () => {
    const code = await wsCloseCode(port)
    expect(code).toBe(4001)
  })
})

// ---------------------------------------------------------------------------
// Auth — localhost bypass (127.0.0.1 trusted even when authToken is set)
// ---------------------------------------------------------------------------

describe('PiBuilderGateway auth localhost bypass', () => {
  let gateway: PiBuilderGateway
  let port: number

  beforeAll(async () => {
    port = 19060 + Math.floor(Math.random() * 30)
    gateway = new PiBuilderGateway({
      port,
      host: '127.0.0.1',
      orchestrator: { dbPath: ':memory:' },
      authToken: 'any-token',
      // _trustLocalhost defaults to true
    })
    await gateway.start()
  }, 30_000)

  afterAll(async () => {
    await gateway.stop()
  }, 10_000)

  it('allows HTTP request from 127.0.0.1 without token → 200', async () => {
    const status = await httpGetStatus(`http://127.0.0.1:${port}/`)
    expect(status).toBe(200)
  })

  it('allows WS connection from 127.0.0.1 without token', async () => {
    const { ws, next } = await connectWithQueue(port)
    const frame = await next()
    expect(frame.type).toBe('hello')
    ws.close()
  })
})
