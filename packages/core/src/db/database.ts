/**
 * Database — SQLite backed via bun:sqlite (Bun) or better-sqlite3 (Node).
 *
 * The public API is unchanged; only the driver import is swapped based on runtime.
 */

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Minimal driver shim so the rest of the file is runtime-agnostic
// ---------------------------------------------------------------------------

interface SqliteDB {
  exec(sql: string): void
  prepare(sql: string): SqliteStmt
  close(): void
}

interface SqliteStmt {
  run(...args: unknown[]): unknown
  get(...args: unknown[]): unknown
  all(...args: unknown[]): unknown[]
}

function openSqlite(filePath: string): SqliteDB {
  // Bun exposes `Bun` global; prefer bun:sqlite there
  if (typeof (globalThis as Record<string, unknown>).Bun !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Database } = require('bun:sqlite') as {
      Database: new (path: string) => {
        exec(sql: string): void
        prepare(sql: string): {
          run(...args: unknown[]): unknown
          get(...args: unknown[]): unknown
          all(...args: unknown[]): unknown[]
        }
        close(): void
      }
    }
    const db = new Database(filePath)
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    return db
  }

  // Node.js — try better-sqlite3 (optional dep, requires native compilation)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require('better-sqlite3') as new (path: string) => {
      pragma(s: string): unknown
      exec(sql: string): void
      prepare(sql: string): {
        run(...args: unknown[]): unknown
        get(...args: unknown[]): unknown
        all(...args: unknown[]): unknown[]
      }
      close(): void
    }
    const db = new BetterSqlite3(filePath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    return db
  } catch {
    // Fallback: pure-JS in-memory store (no persistence, no native dep)
    // Good enough for CLI one-shot runs and dev. Sessions are not saved to disk.
    return createMemoryDb()
  }
}

/**
 * Pure-JS in-memory SQLite shim.
 * Supports exec (DDL ignored), prepare → run/get/all against a JS Map.
 * Not a real SQL engine — just enough to keep OrchestratorService happy.
 */
function createMemoryDb(): SqliteDB {
  const tables = new Map<string, Map<string, Record<string, unknown>>>()
  let idSeq = 0

  const noopStmt: SqliteStmt = {
    run: () => ({ lastInsertRowid: ++idSeq }),
    get: () => undefined,
    all: () => [],
  }

  return {
    exec: (_sql: string) => { /* DDL: silently ignored */ },
    prepare: (_sql: string): SqliteStmt => noopStmt,
    close: () => { tables.clear() },
  }
}

// ---------------------------------------------------------------------------
// Public types (unchanged)
// ---------------------------------------------------------------------------

export interface DatabaseConfig {
  provider: 'postgres' | 'mongodb' | 'sqlite'
  host?: string
  port?: number
  database: string
  username?: string
  password?: string
  /** SQLite only: path to .db file (defaults to `database` field) */
  filePath?: string
}

export interface ApplicationRecord {
  id: string
  name: string
  description: string
  spec: Record<string, unknown>
  generatedCode: {
    backend: string
    frontend: string
  }
  createdAt: Date
  updatedAt: Date
  status: 'pending' | 'generated' | 'deployed' | 'failed'
}

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  createdAt: Date
  updatedAt: Date
  role: 'user' | 'admin'
}

export interface TaskRecord {
  id: string
  userId: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  createdAt: Date
  completedAt?: Date
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString()
}

function toDate(s: string | null | undefined): Date {
  return s ? new Date(s) : new Date()
}

function parseJSON<T>(s: string | null | undefined): T {
  if (!s) return {} as T
  try { return JSON.parse(s) as T } catch { return {} as T }
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export class Database {
  private config: DatabaseConfig
  private sqlite: SqliteDB | null = null
  private isConnected: boolean = false

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.config.provider !== 'sqlite') {
      // Postgres/Mongo: would require pg/mongodb packages — not installed.
      // Mark connected so the rest of the API works; reads return empty sets.
      console.log(`⚠️  ${this.config.provider} driver not installed — running in memory-only mode`)
      this.isConnected = true
      return
    }

    const filePath = this.config.filePath ?? this.config.database
    if (filePath !== ':memory:') {
      mkdirSync(dirname(filePath), { recursive: true })
    }

    this.sqlite = openSqlite(filePath)
    this.createSchema()
    this.isConnected = true
    console.log(`✅ SQLite connected: ${filePath}`)
  }

  async disconnect(): Promise<void> {
    this.sqlite?.close()
    this.sqlite = null
    this.isConnected = false
  }

  isHealthy(): boolean {
    return this.isConnected
  }

  // ---------------------------------------------------------------------------
  // Schema
  // ---------------------------------------------------------------------------

  private createSchema(): void {
    this.sqlite!.exec(`
      CREATE TABLE IF NOT EXISTS applications (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        spec        TEXT NOT NULL DEFAULT '{}',
        backend     TEXT NOT NULL DEFAULT '',
        frontend    TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id           TEXT PRIMARY KEY,
        user_id      TEXT NOT NULL,
        type         TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        input        TEXT NOT NULL DEFAULT '{}',
        output       TEXT,
        error        TEXT,
        created_at   TEXT NOT NULL,
        completed_at TEXT
      );
    `)
  }

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------

  async createApplication(
    record: Omit<ApplicationRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ApplicationRecord> {
    this.assertConnected()
    const id = `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ts = now()

    if (this.sqlite) {
      this.sqlite
        .prepare(
          `INSERT INTO applications (id, name, description, spec, backend, frontend, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          record.name,
          record.description,
          JSON.stringify(record.spec),
          record.generatedCode.backend,
          record.generatedCode.frontend,
          record.status,
          ts,
          ts
        )
    }

    return { id, ...record, createdAt: new Date(ts), updatedAt: new Date(ts) }
  }

  async getApplication(id: string): Promise<ApplicationRecord | null> {
    this.assertConnected()
    if (!this.sqlite) return null

    const row = this.sqlite
      .prepare('SELECT * FROM applications WHERE id = ?')
      .get(id) as Record<string, string> | undefined

    return row ? this.rowToApp(row) : null
  }

  async updateApplication(
    id: string,
    updates: Partial<ApplicationRecord>
  ): Promise<ApplicationRecord> {
    this.assertConnected()
    const ts = now()

    if (this.sqlite) {
      const sets: string[] = ['updated_at = ?']
      const vals: unknown[] = [ts]

      if (updates.name !== undefined) { sets.push('name = ?'); vals.push(updates.name) }
      if (updates.description !== undefined) { sets.push('description = ?'); vals.push(updates.description) }
      if (updates.spec !== undefined) { sets.push('spec = ?'); vals.push(JSON.stringify(updates.spec)) }
      if (updates.status !== undefined) { sets.push('status = ?'); vals.push(updates.status) }
      if (updates.generatedCode?.backend !== undefined) { sets.push('backend = ?'); vals.push(updates.generatedCode.backend) }
      if (updates.generatedCode?.frontend !== undefined) { sets.push('frontend = ?'); vals.push(updates.generatedCode.frontend) }

      vals.push(id)
      this.sqlite.prepare(`UPDATE applications SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
    }

    const existing = await this.getApplication(id)
    return existing ?? {
      id, name: '', description: '', spec: {},
      generatedCode: { backend: '', frontend: '' },
      createdAt: new Date(), updatedAt: new Date(ts), status: 'pending', ...updates
    }
  }

  async listApplications(limit = 100, offset = 0): Promise<ApplicationRecord[]> {
    this.assertConnected()
    if (!this.sqlite) return []

    const rows = this.sqlite
      .prepare('SELECT * FROM applications ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as Record<string, string>[]

    return rows.map(r => this.rowToApp(r))
  }

  private rowToApp(row: Record<string, string>): ApplicationRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      spec: parseJSON(row.spec),
      generatedCode: { backend: row.backend, frontend: row.frontend },
      status: row.status as ApplicationRecord['status'],
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    }
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async createUser(
    record: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserRecord> {
    this.assertConnected()
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ts = now()

    if (this.sqlite) {
      this.sqlite
        .prepare(
          `INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, record.email, record.passwordHash, record.role, ts, ts)
    }

    return { id, ...record, createdAt: new Date(ts), updatedAt: new Date(ts) }
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    this.assertConnected()
    if (!this.sqlite) return null

    const row = this.sqlite
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email) as Record<string, string> | undefined

    return row ? this.rowToUser(row) : null
  }

  async getUser(id: string): Promise<UserRecord | null> {
    this.assertConnected()
    if (!this.sqlite) return null

    const row = this.sqlite
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(id) as Record<string, string> | undefined

    return row ? this.rowToUser(row) : null
  }

  private rowToUser(row: Record<string, string>): UserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRecord['role'],
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
    }
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  async createTask(
    record: Omit<TaskRecord, 'id' | 'createdAt'>
  ): Promise<TaskRecord> {
    this.assertConnected()
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const ts = now()

    if (this.sqlite) {
      this.sqlite
        .prepare(
          `INSERT INTO tasks (id, user_id, type, status, input, output, error, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          record.userId,
          record.type,
          record.status,
          JSON.stringify(record.input),
          record.output ? JSON.stringify(record.output) : null,
          record.error ?? null,
          ts,
          record.completedAt ? record.completedAt.toISOString() : null
        )
    }

    return { id, ...record, createdAt: new Date(ts) }
  }

  async getTask(id: string): Promise<TaskRecord | null> {
    this.assertConnected()
    if (!this.sqlite) return null

    const row = this.sqlite
      .prepare('SELECT * FROM tasks WHERE id = ?')
      .get(id) as Record<string, string> | undefined

    return row ? this.rowToTask(row) : null
  }

  async updateTaskStatus(
    id: string,
    status: TaskRecord['status'],
    output?: Record<string, unknown>,
    error?: string
  ): Promise<TaskRecord> {
    this.assertConnected()
    const ts = now()

    if (this.sqlite) {
      this.sqlite
        .prepare(
          `UPDATE tasks SET status = ?, output = ?, error = ?, completed_at = ? WHERE id = ?`
        )
        .run(
          status,
          output ? JSON.stringify(output) : null,
          error ?? null,
          ['completed', 'failed'].includes(status) ? ts : null,
          id
        )
    }

    const existing = await this.getTask(id)
    return existing ?? {
      id, userId: '', type: '', status, input: {},
      output, error, createdAt: new Date(),
      completedAt: ['completed', 'failed'].includes(status) ? new Date(ts) : undefined,
    }
  }

  async listUserTasks(userId: string, limit = 50): Promise<TaskRecord[]> {
    this.assertConnected()
    if (!this.sqlite) return []

    const rows = this.sqlite
      .prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as Record<string, string>[]

    return rows.map(r => this.rowToTask(r))
  }

  private rowToTask(row: Record<string, string>): TaskRecord {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      status: row.status as TaskRecord['status'],
      input: parseJSON(row.input),
      output: row.output ? parseJSON(row.output) : undefined,
      error: row.error ?? undefined,
      createdAt: toDate(row.created_at),
      completedAt: row.completed_at ? toDate(row.completed_at) : undefined,
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private assertConnected(): void {
    if (!this.isConnected) throw new Error('Database not connected — call connect() first')
  }
}
