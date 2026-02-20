/**
 * PTY Manager
 *
 * Gives each agent session a real pseudo-terminal via node-pty.
 * Raw VT100 bytes stream to the browser where ghostty-web renders them.
 *
 * One PtySession per agent pane. Multiple browser clients can subscribe
 * to the same pane (all see the same bytes). Only one client can write
 * (the one marked as "active").
 */

import { EventEmitter } from 'node:events'
import { resolve } from 'node:path'

// Lazy-load node-pty so the module can be imported in test environments
// where the native addon isn't available.
let pty: typeof import('node-pty') | null = null
async function getPty() {
  if (!pty) {
    try {
      pty = await import('node-pty')
    } catch {
      pty = null
    }
  }
  return pty
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PtySessionConfig {
  id: string
  agentId: string
  /** Command to run (e.g. ['pi', '-p', 'prompt text']) */
  cmd: string[]
  cwd?: string
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PtySession {
  id: string
  agentId: string
  cols: number
  rows: number
  alive: boolean
  /** Scrollback buffer — last N bytes for late-joining clients */
  scrollback: string
  /** Write input to the PTY */
  write(data: string): void
  /** Resize the PTY */
  resize(cols: number, rows: number): void
  /** Kill the PTY process */
  kill(): void
}

// ---------------------------------------------------------------------------
// PtyManager
// ---------------------------------------------------------------------------

const MAX_SCROLLBACK = 100_000 // chars

export class PtyManager extends EventEmitter {
  private sessions = new Map<string, PtySessionImpl>()

  /**
   * Spawn a new PTY session for an agent.
   * Emits:
   *   'data'  (sessionId: string, chunk: string)
   *   'exit'  (sessionId: string, exitCode: number)
   */
  async spawn(config: PtySessionConfig): Promise<PtySession> {
    const lib = await getPty()
    if (!lib) throw new Error('node-pty is not available in this environment')

    const { id, agentId, cmd, cwd, env, cols = 220, rows = 50 } = config

    // On Windows, wrap in cmd.exe if the command isn't already a shell
    const [file, ...args] = resolveShell(cmd)

    const proc = lib.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, ...env, TERM: 'xterm-256color' },
    })

    const session = new PtySessionImpl(id, agentId, proc, cols, rows)
    this.sessions.set(id, session)

    proc.onData((chunk: string) => {
      session.appendScrollback(chunk)
      this.emit('data', id, chunk)
    })

    proc.onExit(({ exitCode }: { exitCode: number }) => {
      session.alive = false
      this.emit('exit', id, exitCode)
      // Clean up after a delay so late subscribers can still read scrollback
      setTimeout(() => this.sessions.delete(id), 30_000)
    })

    return session
  }

  get(id: string): PtySession | undefined {
    return this.sessions.get(id)
  }

  list(): PtySession[] {
    return [...this.sessions.values()]
  }

  killAll(): void {
    for (const s of this.sessions.values()) s.kill()
  }
}

// ---------------------------------------------------------------------------
// PtySessionImpl (internal)
// ---------------------------------------------------------------------------

class PtySessionImpl implements PtySession {
  alive = true
  scrollback = ''

  constructor(
    readonly id: string,
    readonly agentId: string,
    private proc: import('node-pty').IPty,
    public cols: number,
    public rows: number,
  ) {}

  appendScrollback(chunk: string): void {
    this.scrollback += chunk
    if (this.scrollback.length > MAX_SCROLLBACK) {
      this.scrollback = this.scrollback.slice(-MAX_SCROLLBACK)
    }
  }

  write(data: string): void {
    if (this.alive) this.proc.write(data)
  }

  resize(cols: number, rows: number): void {
    if (!this.alive) return
    this.cols = cols
    this.rows = rows
    this.proc.resize(cols, rows)
  }

  kill(): void {
    if (!this.alive) return
    this.alive = false
    try { this.proc.kill() } catch { /* already dead */ }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveShell(cmd: string[]): string[] {
  if (process.platform === 'win32') {
    // On Windows, always shell through cmd.exe for PATH resolution
    return ['cmd.exe', '/c', ...cmd]
  }
  // On Unix, use sh -c so PATH is resolved and shell features work
  return ['/bin/sh', '-c', cmd.join(' ')]
}
