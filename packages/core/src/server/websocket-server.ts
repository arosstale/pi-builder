/**
 * Pi Builder WebSocket Server
 *
 * Thin WebSocket layer over OrchestratorService.
 * Inspired by OpenClaw's Gateway protocol (simplified for a single-user dev tool).
 *
 * Protocol (JSON frames over WebSocket):
 *
 *   Client → Server:
 *     { type: "send", id: string, message: string }
 *     { type: "health" }
 *     { type: "agents" }
 *     { type: "history" }
 *     { type: "clear" }
 *
 *   Server → Client:
 *     { type: "chunk",         id, agent, text }
 *     { type: "turn_complete", id, message, agentResult }
 *     { type: "user_message",  id, message }
 *     { type: "agent_start",   agent, task }
 *     { type: "agent_end",     agent, status, durationMs }
 *     { type: "health",        agents: Record<string,boolean> }
 *     { type: "agents",        list: AgentInfo[] }
 *     { type: "history",       messages: ChatMessage[] }
 *     { type: "error",         id?, message }
 *     { type: "ok",            id, method }
 */

import { createServer, type Server as HttpServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import {
  OrchestratorService,
  createOrchestratorService,
  type OrchestratorConfig,
  type ChatMessage,
  type TurnResult,
} from '../orchestration/orchestrator-service'

// Resolve the web UI HTML file — look relative to this module, then relative to CWD
function resolveUiPath(): string {
  // Prefer v2 (Jules-built), fall back to v1, then CWD
  const base = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(base, '../../../../apps/web/pi-builder-ui-v2.html'),
    resolve(base, '../../../../../apps/web/pi-builder-ui-v2.html'),
    resolve(base, '../../../../apps/web/pi-builder-ui.html'),
    resolve(base, '../../../../../apps/web/pi-builder-ui.html'),
    resolve(process.cwd(), 'apps/web/pi-builder-ui-v2.html'),
    resolve(process.cwd(), 'apps/web/pi-builder-ui.html'),
  ]
  for (const p of candidates) {
    try { readFileSync(p); return p } catch { /* try next */ }
  }
  return candidates[0]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  port?: number
  host?: string
  orchestrator?: OrchestratorConfig
  authToken?: string
  /** @internal Disable 127.0.0.1/::1 bypass — used only in tests */
  _trustLocalhost?: boolean
}

export interface ClientMessage {
  type: 'send' | 'health' | 'agents' | 'history' | 'clear'
  id?: string
  message?: string
}

export interface ServerFrame {
  type: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// PiBuilderGateway
// ---------------------------------------------------------------------------

export class PiBuilderGateway {
  private config: GatewayConfig
  private httpServer: HttpServer
  private wss: WebSocketServer
  private orchestrator!: OrchestratorService
  private clients = new Set<WebSocket>()

  constructor(config: GatewayConfig = {}) {
    this.config = {
      port: 18900,   // distinct from OpenClaw's 18789
      host: '127.0.0.1',
      ...config,
    }
    this.httpServer = createServer((req, res) => this.handleHttp(req, res))
    this.wss = new WebSocketServer({ server: this.httpServer })
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req))
  }

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  private isLocalhost(req: IncomingMessage): boolean {
    if (this.config._trustLocalhost === false) return false
    const ip = req.socket?.remoteAddress ?? ''
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  }

  private isAuthorizedHttp(req: IncomingMessage): boolean {
    if (!this.config.authToken) return true
    if (this.isLocalhost(req)) return true
    const auth = req.headers['authorization'] ?? ''
    return auth === `Bearer ${this.config.authToken}`
  }

  private isAuthorizedWs(req: IncomingMessage): boolean {
    if (!this.config.authToken) return true
    if (this.isLocalhost(req)) return true
    const auth = req.headers['authorization'] ?? ''
    if (auth === `Bearer ${this.config.authToken}`) return true
    const url = req.url ?? ''
    const qi = url.indexOf('?')
    if (qi !== -1) {
      const params = new URLSearchParams(url.slice(qi + 1))
      if (params.get('token') === this.config.authToken) return true
    }
    return false
  }

  // ---------------------------------------------------------------------------
  // HTTP handler
  // ---------------------------------------------------------------------------

  private handleHttp(req: IncomingMessage, res: ServerResponse): void {
    if (!this.isAuthorizedHttp(req)) {
      res.writeHead(401, { 'Content-Type': 'text/plain' })
      res.end('Unauthorized')
      return
    }
    const url = req.url ?? '/'
    // Only serve GET /
    if (req.method !== 'GET' || (url !== '/' && url !== '/index.html')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    try {
      const html = readFileSync(resolveUiPath())
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Web UI not found — open apps/web/pi-builder-ui.html directly')
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    this.orchestrator = await createOrchestratorService(this.config.orchestrator)

    // Forward orchestrator events to all connected clients
    this.orchestrator.on('user_message', (msg: ChatMessage) => {
      this.broadcast({ type: 'user_message', id: msg.id, message: msg })
    })
    this.orchestrator.on('chunk', ({ text, agent }: { text: string; agent: string }) => {
      this.broadcast({ type: 'chunk', agent, text })
    })
    this.orchestrator.on('turn_complete', (result: TurnResult) => {
      this.broadcast({ type: 'turn_complete', id: result.message.id, message: result.message, agentResult: result.agentResult })
    })
    this.orchestrator.on('agent_start', (info: { agent: string; task: string }) => {
      this.broadcast({ type: 'agent_start', ...info })
    })
    this.orchestrator.on('agent_end', (info: { agent: string; status: string; durationMs: number }) => {
      this.broadcast({ type: 'agent_end', ...info })
    })
    this.orchestrator.on('error', (err: Error) => {
      this.broadcast({ type: 'error', message: err.message })
    })

    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 Pi Builder Gateway listening on ws://${this.config.host}:${this.config.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    await this.orchestrator.close()
    await new Promise<void>((resolve, reject) => {
      this.wss.close((err) => (err ? reject(err) : resolve()))
    })
    await new Promise<void>((resolve, reject) => {
      this.httpServer.close((err) => (err ? reject(err) : resolve()))
    })
  }

  // ---------------------------------------------------------------------------
  // Connection handler
  // ---------------------------------------------------------------------------

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    if (!this.isAuthorizedWs(req)) {
      ws.close(4001, 'Unauthorized')
      return
    }
    this.clients.add(ws)
    console.log(`📡 Client connected (${this.clients.size} total)`)

    // Send welcome frame immediately (no blocking health check on connect)
    this.send(ws, { type: 'hello', sessionId: this.orchestrator.getSessionId() })

    ws.on('message', (raw) => this.onMessage(ws, raw.toString()))
    ws.on('close', () => {
      this.clients.delete(ws)
      console.log(`📡 Client disconnected (${this.clients.size} remaining)`)
    })
    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message)
      this.clients.delete(ws)
    })
  }

  // ---------------------------------------------------------------------------
  // Message dispatch
  // ---------------------------------------------------------------------------

  private async onMessage(ws: WebSocket, raw: string): Promise<void> {
    let frame: ClientMessage
    try {
      frame = JSON.parse(raw)
    } catch {
      this.send(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    try {
      switch (frame.type) {
        case 'send':
          await this.handleSend(ws, frame)
          break
        case 'health':
          await this.handleHealth(ws, frame)
          break
        case 'agents':
          await this.handleAgents(ws, frame)
          break
        case 'history':
          await this.handleHistory(ws, frame)
          break
        case 'clear':
          this.handleClear(ws, frame)
          break
        default:
          this.send(ws, { type: 'error', id: frame.id, message: `Unknown method: ${frame.type}` })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.send(ws, { type: 'error', id: frame.id, message: msg })
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  private async handleSend(ws: WebSocket, frame: ClientMessage): Promise<void> {
    if (!frame.message?.trim()) {
      this.send(ws, { type: 'error', id: frame.id, message: 'message is required' })
      return
    }
    // processMessage emits events to all clients via orchestrator event listeners
    // Result is also returned directly but we rely on events for streaming
    await this.orchestrator.processMessage(frame.message)
    // turn_complete event handles final broadcast — no need to respond here
  }

  private async handleHealth(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const agents = await this.orchestrator.agentHealth()
    this.send(ws, { type: 'health', id: frame.id, agents })
  }

  private async handleAgents(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const list = await this.orchestrator.availableAgents()
    this.send(ws, { type: 'agents', id: frame.id, list })
  }

  private handleHistory(ws: WebSocket, frame: ClientMessage): void {
    const messages = this.orchestrator.getHistory()
    this.send(ws, { type: 'history', id: frame.id, messages })
  }

  private handleClear(ws: WebSocket, frame: ClientMessage): void {
    this.orchestrator.clearHistory()
    this.send(ws, { type: 'ok', id: frame.id, method: 'clear' })
  }

  // ---------------------------------------------------------------------------
  // Send helpers
  // ---------------------------------------------------------------------------

  private send(ws: WebSocket, frame: ServerFrame): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(frame))
    }
  }

  private broadcast(frame: ServerFrame): void {
    const serialized = JSON.stringify(frame)
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Info
  // ---------------------------------------------------------------------------

  get port(): number {
    return this.config.port!
  }

  get host(): string {
    return this.config.host!
  }

  get url(): string {
    return `ws://${this.config.host}:${this.config.port}`
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function startGateway(config?: GatewayConfig): Promise<PiBuilderGateway> {
  const gw = new PiBuilderGateway(config)
  await gw.start()
  return gw
}
