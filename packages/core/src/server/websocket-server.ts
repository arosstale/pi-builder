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
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'

const execFileAsync = promisify(execFile)
import {
  OrchestratorService,
  createOrchestratorService,
  type OrchestratorConfig,
  type ChatMessage,
  type TurnResult,
} from '../orchestration/orchestrator-service'
import { PtyManager } from './pty-manager'
import { RpcSessionManager } from '../integrations/agent-wrappers'
import { AgentTeamsDriver, TEAM_PRESETS, type TeamPreset } from '../teams/agent-teams'
import { ThreadEngine, buildThreadCommand, THREAD_PRESETS, type ThreadSpec, type ThreadType } from '../threads/thread-engine'

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
  type: 'send' | 'health' | 'agents' | 'history' | 'clear' | 'diff' | 'diff_full' | 'queue'
      | 'mode' | 'preview'
      | 'pty_spawn' | 'pty_input' | 'pty_resize' | 'pty_kill' | 'pty_list'
      | 'rpc_new' | 'rpc_prompt' | 'rpc_abort' | 'rpc_kill' | 'rpc_list'
      | 'teams_list' | 'teams_create' | 'teams_spawn' | 'teams_task_update'
      | 'teams_message' | 'teams_broadcast' | 'teams_watch' | 'teams_delete'
      | 'thread_launch' | 'thread_list' | 'thread_kill' | 'thread_abort' | 'thread_steer'
      | 'thread_preset' | 'thread_agents' | 'thread_async_list'
  id?: string
  message?: string
  // Mode fields
  mode?: 'execute' | 'plan'
  // Preview fields
  url?: string
  // PTY fields
  sessionId?: string
  agentId?: string
  cmd?: string[]
  cols?: number
  rows?: number
  data?: string
  cwd?: string
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
  private ptyManager = new PtyManager()
  private rpcSessions = new RpcSessionManager()
  private teams = new AgentTeamsDriver()
  private threadEngine = new ThreadEngine(this.rpcSessions)

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

    // POST /bridge — pi-builder-bridge extension pushes events here
    if (req.method === 'POST' && url === '/bridge') {
      this.handleBridgePost(req, res)
      return
    }

    // GET /health — simple liveness check for the bridge extension
    if (req.method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, clients: this.clients.size }))
      return
    }

    // Only serve GET /
    if (req.method !== 'GET' || (url !== '/' && url !== '/index.html')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found')
      return
    }
    try {
      const html = readFileSync(resolveUiPath())
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        // Required for ghostty-web WASM SharedArrayBuffer
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      })
      res.end(html)
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain' })
      res.end('Web UI not found — open apps/web/pi-builder-ui.html directly')
    }
  }

  // ---------------------------------------------------------------------------
  // Bridge endpoint — receives events from pi-builder-bridge extension
  // ---------------------------------------------------------------------------

  private handleBridgePost(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
        // Broadcast to all WS clients — keep body fields, but always type='bridge_event'
        const { type: bridgeType, ...rest } = body
        this.broadcast({ type: 'bridge_event', event: bridgeType, ...rest })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
      }
    })
    req.on('error', () => {
      res.writeHead(500)
      res.end()
    })
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
      // Broadcast git diff after each turn so UI can show what changed
      this.broadcastGitDiff()
    })
    this.orchestrator.on('queued', (info: { message: string; queueLength: number }) => {
      this.broadcast({ type: 'queued', queueLength: info.queueLength, preview: info.message.slice(0, 80) })
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

    // Forward Thread engine events to all WS clients
    this.threadEngine.on('launched', (run) => this.broadcast({ type: 'thread_launched', run }))
    this.threadEngine.on('event',    (id, ev) => this.broadcast({ type: 'thread_event', threadId: id, event: ev }))
    this.threadEngine.on('idle',     (id) => this.broadcast({ type: 'thread_idle', threadId: id }))
    this.threadEngine.on('killed',   (id) => this.broadcast({ type: 'thread_killed', threadId: id }))

    // Forward Agent Teams events to all WS clients
    this.teams.on('team:created', (config) => this.broadcast({ type: 'teams_created', config }))
    this.teams.on('team:spawned', (teamName) => this.broadcast({ type: 'teams_spawned', teamName }))
    this.teams.on('team:output', (teamName, text) => this.broadcast({ type: 'teams_output', teamName, text }))
    this.teams.on('team:exit', (teamName, code) => this.broadcast({ type: 'teams_exit', teamName, code }))
    this.teams.on('task:created', (teamName, task) => this.broadcast({ type: 'teams_task', teamName, task }))
    this.teams.on('task:updated', (teamName, task) => this.broadcast({ type: 'teams_task', teamName, task }))
    this.teams.on('tasks:changed', (teamName, tasks) => this.broadcast({ type: 'teams_tasks', teamName, tasks }))
    this.teams.on('message:sent', (teamName, msg) => this.broadcast({ type: 'teams_message', teamName, msg }))

    // Forward RPC session events to all WS clients
    this.rpcSessions.on('event', (sessionId: string, event: Record<string, unknown>) => {
      this.broadcast({ type: 'rpc_event', sessionId, event })
    })
    this.rpcSessions.on('idle', (sessionId: string) => {
      this.broadcast({ type: 'rpc_idle', sessionId })
    })
    this.rpcSessions.on('killed', (sessionId: string) => {
      this.broadcast({ type: 'rpc_killed', sessionId })
    })

    return new Promise((resolve) => {
      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(`🚀 Pi Builder Gateway listening on ws://${this.config.host}:${this.config.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    this.teams.stopAll()
    this.ptyManager.killAll()
    await this.rpcSessions.killAll()
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
        case 'diff':
          await this.handleDiff(ws, frame)
          break
        case 'diff_full':
          await this.handleDiffFull(ws, frame)
          break
        case 'queue':
          this.handleQueue(ws, frame)
          break
        case 'mode':
          this.handleMode(ws, frame)
          break
        case 'preview':
          this.handlePreview(ws, frame)
          break
        case 'pty_spawn':
          await this.handlePtySpawn(ws, frame)
          break
        case 'pty_input':
          this.handlePtyInput(ws, frame)
          break
        case 'pty_resize':
          this.handlePtyResize(ws, frame)
          break
        case 'pty_kill':
          this.handlePtyKill(ws, frame)
          break
        case 'pty_list':
          this.handlePtyList(ws, frame)
          break
        case 'rpc_new':
          await this.handleRpcNew(ws, frame)
          break
        case 'rpc_prompt':
          await this.handleRpcPrompt(ws, frame)
          break
        case 'rpc_abort':
          await this.handleRpcAbort(ws, frame)
          break
        case 'rpc_kill':
          await this.handleRpcKill(ws, frame)
          break
        case 'rpc_list':
          this.handleRpcList(ws, frame)
          break
        case 'teams_list':
          this.handleTeamsList(ws, frame)
          break
        case 'teams_create':
          this.handleTeamsCreate(ws, frame)
          break
        case 'teams_spawn':
          this.handleTeamsSpawn(ws, frame)
          break
        case 'teams_task_update':
          this.handleTeamsTaskUpdate(ws, frame)
          break
        case 'teams_message':
          this.handleTeamsMessage(ws, frame)
          break
        case 'teams_broadcast':
          this.handleTeamsBroadcast(ws, frame)
          break
        case 'teams_watch':
          this.handleTeamsWatch(ws, frame)
          break
        case 'teams_delete':
          this.handleTeamsDelete(ws, frame)
          break
        case 'thread_launch':
          await this.handleThreadLaunch(ws, frame)
          break
        case 'thread_list':
          this.handleThreadList(ws, frame)
          break
        case 'thread_kill':
          await this.handleThreadKill(ws, frame)
          break
        case 'thread_abort':
          await this.handleThreadAbort(ws, frame)
          break
        case 'thread_steer':
          await this.handleThreadSteer(ws, frame)
          break
        case 'thread_preset':
          this.handleThreadPreset(ws, frame)
          break
        case 'thread_agents':
          await this.handleThreadAgents(ws, frame)
          break
        case 'thread_async_list':
          await this.handleThreadAsyncList(ws, frame)
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
  // PTY handlers
  // ---------------------------------------------------------------------------

  private async handlePtySpawn(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const { id, agentId, cmd, cwd, cols, rows } = frame
    if (!agentId || !cmd?.length) {
      this.send(ws, { type: 'error', id, message: 'pty_spawn requires agentId and cmd' })
      return
    }
    const sessionId = `pty-${agentId}-${Date.now()}`
    try {
      const session = await this.ptyManager.spawn({
        id: sessionId,
        agentId,
        cmd,
        cwd: cwd ?? this.config.orchestrator?.workDir ?? process.cwd(),
        cols: cols ?? 220,
        rows: rows ?? 50,
      })

      // Stream PTY output to all clients
      this.ptyManager.on('data', (sid: string, chunk: string) => {
        if (sid === sessionId) {
          this.broadcast({ type: 'pty_data', sessionId, agentId, data: chunk })
        }
      })
      this.ptyManager.on('exit', (sid: string, exitCode: number) => {
        if (sid === sessionId) {
          this.broadcast({ type: 'pty_exit', sessionId, agentId, exitCode })
        }
      })

      this.send(ws, { type: 'pty_spawned', id, sessionId, agentId, cols: session.cols, rows: session.rows })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.send(ws, { type: 'error', id, message: `PTY spawn failed: ${msg}` })
    }
  }

  private handlePtyInput(_ws: WebSocket, frame: ClientMessage): void {
    const { sessionId, data } = frame
    if (!sessionId || !data) return
    this.ptyManager.get(sessionId)?.write(data)
  }

  private handlePtyResize(_ws: WebSocket, frame: ClientMessage): void {
    const { sessionId, cols, rows } = frame
    if (!sessionId || !cols || !rows) return
    this.ptyManager.get(sessionId)?.resize(cols, rows)
  }

  private handlePtyKill(_ws: WebSocket, frame: ClientMessage): void {
    const { sessionId } = frame
    if (!sessionId) return
    this.ptyManager.get(sessionId)?.kill()
  }

  private handlePtyList(ws: WebSocket, frame: ClientMessage): void {
    const sessions = this.ptyManager.list().map(s => ({
      sessionId: s.id,
      agentId: s.agentId,
      alive: s.alive,
      cols: s.cols,
      rows: s.rows,
    }))
    this.send(ws, { type: 'pty_list', id: frame.id, sessions })
  }

  // ---------------------------------------------------------------------------
  // RPC session handlers
  // ---------------------------------------------------------------------------

  private async handleRpcNew(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const sessionId = frame.sessionId ?? `rpc-${Date.now()}`
    try {
      await this.rpcSessions.create(sessionId, {
        cwd: frame.cwd ?? this.config.orchestrator?.workDir ?? process.cwd(),
      })
      this.send(ws, { type: 'rpc_created', id: frame.id, sessionId })
    } catch (err) {
      this.send(ws, { type: 'error', id: frame.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async handleRpcPrompt(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const { sessionId, message, id } = frame
    if (!sessionId || !message) {
      this.send(ws, { type: 'error', id, message: 'rpc_prompt requires sessionId and message' })
      return
    }
    try {
      await this.rpcSessions.prompt(sessionId, message)
      this.send(ws, { type: 'ok', id, method: 'rpc_prompt' })
    } catch (err) {
      this.send(ws, { type: 'error', id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async handleRpcAbort(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const { sessionId, id } = frame
    if (!sessionId) { this.send(ws, { type: 'error', id, message: 'sessionId required' }); return }
    await this.rpcSessions.abort(sessionId)
    this.send(ws, { type: 'ok', id, method: 'rpc_abort' })
  }

  private async handleRpcKill(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const { sessionId, id } = frame
    if (!sessionId) { this.send(ws, { type: 'error', id, message: 'sessionId required' }); return }
    await this.rpcSessions.kill(sessionId)
    this.send(ws, { type: 'ok', id, method: 'rpc_kill' })
  }

  private handleRpcList(ws: WebSocket, frame: ClientMessage): void {
    this.send(ws, { type: 'rpc_sessions', id: frame.id, sessions: this.rpcSessions.list() })
  }

  // ---------------------------------------------------------------------------
  // Thread-based engineering handlers (pi-subagents)
  // ---------------------------------------------------------------------------

  private async handleThreadLaunch(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const f = frame as unknown as Record<string, unknown>
    const { id } = frame
    try {
      const spec = f.spec as ThreadSpec
      if (!spec?.type) { this.send(ws, { type: 'error', id, message: 'thread_launch requires spec.type' }); return }
      const run = await this.threadEngine.launch(spec)
      this.send(ws, { type: 'thread_launched', id, run })
    } catch (err) {
      this.send(ws, { type: 'error', id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private handleThreadList(ws: WebSocket, frame: ClientMessage): void {
    const presets = Object.keys(THREAD_PRESETS).map(k => ({ name: k }))
    this.send(ws, { type: 'thread_list', id: frame.id, threads: this.threadEngine.listThreads(), presets })
  }

  private async handleThreadKill(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const f = frame as unknown as Record<string, string>
    if (!f.threadId) { this.send(ws, { type: 'error', id: frame.id, message: 'threadId required' }); return }
    await this.threadEngine.killThread(f.threadId)
    this.send(ws, { type: 'ok', id: frame.id, method: 'thread_kill' })
  }

  private async handleThreadAbort(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const f = frame as unknown as Record<string, string>
    if (!f.threadId) { this.send(ws, { type: 'error', id: frame.id, message: 'threadId required' }); return }
    await this.threadEngine.abortThread(f.threadId)
    this.send(ws, { type: 'ok', id: frame.id, method: 'thread_abort' })
  }

  private async handleThreadSteer(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const f = frame as unknown as Record<string, string>
    if (!f.threadId || !f.message) { this.send(ws, { type: 'error', id: frame.id, message: 'threadId and message required' }); return }
    try {
      await this.threadEngine.steerThread(f.threadId, f.message)
      this.send(ws, { type: 'ok', id: frame.id, method: 'thread_steer' })
    } catch (err) {
      this.send(ws, { type: 'error', id: frame.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private handleThreadPreset(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, unknown>
    const { id } = frame
    const presetName = f.preset as string
    const arg = f.arg as string
    type PresetKey = keyof typeof THREAD_PRESETS
    if (!presetName || !(presetName in THREAD_PRESETS)) {
      const available = Object.keys(THREAD_PRESETS)
      this.send(ws, { type: 'error', id, message: `Unknown preset '${presetName}'. Available: ${available.join(', ')}` })
      return
    }
    const spec = THREAD_PRESETS[presetName as PresetKey](arg ?? '')
    const command = buildThreadCommand(spec)
    this.send(ws, { type: 'thread_preset_preview', id, preset: presetName, spec, command })
  }

  private async handleThreadAsyncList(ws: WebSocket, frame: ClientMessage): Promise<void> {
    try {
      const { readdir, readFile, stat } = await import('node:fs/promises')
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')

      const asyncDir = join(tmpdir(), 'pi-async-subagent-runs')
      const jobs: unknown[] = []

      try {
        const entries = await readdir(asyncDir)
        for (const entry of entries) {
          try {
            const statusPath = join(asyncDir, entry, 'status.json')
            const text = await readFile(statusPath, 'utf8')
            jobs.push(JSON.parse(text))
          } catch { /* skip */ }
        }
      } catch { /* dir missing = no async runs yet */ }

      this.send(ws, { type: 'thread_async_list', id: frame.id, jobs })
    } catch (err) {
      this.send(ws, { type: 'error', id: frame.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async handleThreadAgents(ws: WebSocket, frame: ClientMessage): Promise<void> {
    try {
      const agents = await this.discoverPiAgents()
      this.send(ws, { type: 'thread_agents', id: frame.id, agents })
    } catch (err) {
      this.send(ws, { type: 'error', id: frame.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private async discoverPiAgents(): Promise<Array<{ name: string; description: string; source: string; model?: string }>> {
    const { readdir, readFile } = await import('node:fs/promises')
    const { homedir } = await import('node:os')
    const { join, dirname } = await import('node:path')
    const { createRequire } = await import('node:module')

    const results: Array<{ name: string; description: string; source: string; model?: string }> = []

    const parseFrontmatter = (text: string): Record<string, string> => {
      const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
      if (!m) return {}
      return Object.fromEntries(
        m[1].split('\n').filter(l => l.includes(':')).map(l => {
          const idx = l.indexOf(':')
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
        })
      )
    }

    const loadDir = async (dir: string, source: string) => {
      try {
        const files = await readdir(dir)
        for (const f of files.filter(f => f.endsWith('.md'))) {
          try {
            const text = await readFile(join(dir, f), 'utf8')
            const fm = parseFrontmatter(text)
            if (fm.name) results.push({ name: fm.name, description: fm.description ?? '', source, model: fm.model })
          } catch { /* skip bad file */ }
        }
      } catch { /* dir missing */ }
    }

    // User agents (~/.pi/agent/agents/)
    await loadDir(join(homedir(), '.pi', 'agent', 'agents'), 'user')

    // pi-subagents builtin agents
    try {
      const req = createRequire(import.meta.url)
      const piSubagentsPkg = req.resolve('pi-subagents/package.json').replace(/package\.json$/, '')
      await loadDir(join(piSubagentsPkg, 'agents'), 'builtin')
    } catch { /* pi-subagents not installed */ }

    // Deduplicate by name (user agents override builtin)
    const seen = new Set<string>()
    return results.filter(a => { if (seen.has(a.name)) return false; seen.add(a.name); return true })
  }

  // ---------------------------------------------------------------------------
  // Agent Teams handlers
  // ---------------------------------------------------------------------------

  private handleTeamsList(ws: WebSocket, frame: ClientMessage): void {
    const states = this.teams.getAllTeamStates()
    const presets = Object.entries(TEAM_PRESETS).map(([key, p]) => ({
      preset: key,
      description: p.description,
      defaultName: p.defaultName,
      memberCount: p.members.length,
    }))
    this.send(ws, { type: 'teams_list', id: frame.id, teams: states, presets })
  }

  private handleTeamsCreate(ws: WebSocket, frame: ClientMessage): void {
    const { id } = frame
    const preset = (frame as unknown as Record<string, string>).preset as TeamPreset | undefined
    const teamName = (frame as unknown as Record<string, string>).teamName
    const members = (frame as unknown as Record<string, unknown>).members as Array<{ name: string; agentType: string }> | undefined

    try {
      let config
      if (preset && preset !== 'custom') {
        config = this.teams.createTeamFromPreset(preset, teamName)
      } else if (members?.length) {
        config = this.teams.createTeam(teamName ?? `team-${Date.now()}`, members.map(m => ({
          name: m.name,
          agentId: randomUUID(),
          agentType: m.agentType as import('../teams/agent-teams').AgentType,
        })))
      } else {
        this.send(ws, { type: 'error', id, message: 'teams_create requires preset or members' })
        return
      }
      this.teams.watch(config.teamName)
      this.send(ws, { type: 'teams_created', id, config })
    } catch (err) {
      this.send(ws, { type: 'error', id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  private handleTeamsSpawn(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, string>
    const { id, teamName } = f
    if (!teamName) { this.send(ws, { type: 'error', id, message: 'teamName required' }); return }
    const prompt = f.prompt ?? `You are team lead for ${teamName}. Coordinate your teammates.`
    const cwd = f.cwd ?? this.config.orchestrator?.workDir ?? process.cwd()
    this.teams.spawnTeam(teamName, prompt, {
      cwd,
      teammateMode: (f.teammateMode as 'in-process' | 'tmux' | 'auto') ?? 'in-process',
    })
    this.teams.watch(teamName)
    this.send(ws, { type: 'ok', id, method: 'teams_spawn' })
  }

  private handleTeamsTaskUpdate(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, unknown>
    const { id } = frame
    const teamName = f.teamName as string
    const taskId = f.taskId as string
    const updates = f.updates as Record<string, unknown>
    if (!teamName || !taskId) { this.send(ws, { type: 'error', id, message: 'teamName and taskId required' }); return }
    const task = this.teams.updateTask(teamName, taskId, updates)
    if (!task) { this.send(ws, { type: 'error', id, message: `Task ${taskId} not found in ${teamName}` }); return }
    this.send(ws, { type: 'ok', id, method: 'teams_task_update' })
  }

  private handleTeamsMessage(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, string>
    const { id, teamName } = f
    if (!teamName || !f.from || !f.to || !f.content) {
      this.send(ws, { type: 'error', id, message: 'teamName, from, to, content required' })
      return
    }
    this.teams.sendMessage(teamName, {
      type: 'message', from: f.from, to: f.to, content: f.content, summary: f.summary,
    })
    this.send(ws, { type: 'ok', id, method: 'teams_message' })
  }

  private handleTeamsBroadcast(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, string>
    const { id, teamName } = f
    if (!teamName || !f.from || !f.content) {
      this.send(ws, { type: 'error', id, message: 'teamName, from, content required' })
      return
    }
    this.teams.broadcast(teamName, f.from, f.content, f.summary)
    this.send(ws, { type: 'ok', id, method: 'teams_broadcast' })
  }

  private handleTeamsWatch(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, string>
    if (!f.teamName) { this.send(ws, { type: 'error', id: frame.id, message: 'teamName required' }); return }
    this.teams.watch(f.teamName)
    this.send(ws, { type: 'ok', id: frame.id, method: 'teams_watch' })
  }

  private handleTeamsDelete(ws: WebSocket, frame: ClientMessage): void {
    const f = frame as unknown as Record<string, string>
    if (!f.teamName) { this.send(ws, { type: 'error', id: frame.id, message: 'teamName required' }); return }
    this.teams.deleteTeam(f.teamName)
    this.send(ws, { type: 'ok', id: frame.id, method: 'teams_delete' })
  }

  // ---------------------------------------------------------------------------

  private async handleDiff(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const diff = await this.getGitDiff(false)
    this.send(ws, { type: 'diff', id: frame.id, diff })
  }

  private handleQueue(ws: WebSocket, frame: ClientMessage): void {
    const queue = this.orchestrator.getQueue()
    this.send(ws, { type: 'queue', id: frame.id, queue })
  }

  // ---------------------------------------------------------------------------
  // Mode: switch between execute (default) and plan (discuss-only)
  // ---------------------------------------------------------------------------

  private handleMode(ws: WebSocket, frame: ClientMessage): void {
    const newMode = frame.mode
    if (newMode !== 'execute' && newMode !== 'plan') {
      this.send(ws, { type: 'error', id: frame.id, message: 'mode must be "execute" or "plan"' })
      return
    }
    this.orchestrator.mode = newMode
    this.broadcast({ type: 'mode', mode: newMode })
    this.send(ws, { type: 'ok', id: frame.id, method: 'mode', mode: newMode })
  }

  // ---------------------------------------------------------------------------
  // Preview: proxy a local dev server URL for iframe embedding
  // ---------------------------------------------------------------------------

  private handlePreview(ws: WebSocket, frame: ClientMessage): void {
    const url = frame.url ?? frame.message
    if (!url) {
      this.send(ws, { type: 'error', id: frame.id, message: 'preview requires a url' })
      return
    }
    // Broadcast the preview URL to all clients — the UI renders it in an iframe
    this.broadcast({ type: 'preview', id: frame.id, url })
  }

  private async getGitDiff(full = false): Promise<string | null> {
    const cwd = this.config.orchestrator?.workDir ?? process.cwd()
    const args = full
      ? ['diff', 'HEAD', '--no-color', '--unified=3']
      : ['diff', 'HEAD', '--stat', '--no-color']
    try {
      const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10_000 })
      return stdout.trim() || null
    } catch {
      return null
    }
  }

  private async handleDiffFull(ws: WebSocket, frame: ClientMessage): Promise<void> {
    const patch = await this.getGitDiff(true)
    const stat  = await this.getGitDiff(false)
    this.send(ws, { type: 'diff_full', id: frame.id, patch, stat })
  }

  private broadcastGitDiff(): void {
    this.getGitDiff().then((diff) => {
      if (diff !== null) {
        this.broadcast({ type: 'diff', diff })
      }
    }).catch(() => { /* ignore */ })
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
