/**
 * Agent Teams Driver
 *
 * Reads and writes the Claude Code Agent Teams filesystem protocol:
 *   ~/.claude/teams/{team-name}/config.json  — team members
 *   ~/.claude/tasks/{team-name}/             — task JSON files
 *   ~/.claude/teams/{team-name}/inbox/       — inter-agent messages
 *
 * Surfaces team state via EventEmitter for the WebSocket gateway.
 * Can create teams, watch task progress, inject messages to agents.
 *
 * Ref: https://code.claude.com/docs/en/agent-teams
 *      https://github.com/wshobson/agents (agent-teams plugin)
 */

import { EventEmitter } from 'events'
import {
  readFileSync, writeFileSync, mkdirSync,
  readdirSync, existsSync, watchFile, unwatchFile,
} from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

// ---------------------------------------------------------------------------
// Types — mirrors the Claude Code teams filesystem schema
// ---------------------------------------------------------------------------

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted'
export type AgentType =
  | 'team-lead'
  | 'team-reviewer'
  | 'team-debugger'
  | 'team-implementer'
  | 'general-purpose'

export type TeamPreset =
  | 'review'
  | 'debug'
  | 'feature'
  | 'fullstack'
  | 'research'
  | 'security'
  | 'migration'
  | 'custom'

export interface TeamMember {
  name: string
  agentId: string
  agentType: AgentType
}

export interface TeamConfig {
  teamName: string
  teamId: string
  createdAt: string
  members: TeamMember[]
}

export interface AgentTask {
  id: string
  subject: string
  description: string
  status: TaskStatus
  owner?: string
  blockedBy?: string[]
  blocks?: string[]
  createdAt: string
  updatedAt: string
}

export interface TeamMessage {
  id: string
  type: 'message' | 'broadcast' | 'shutdown_request' | 'shutdown_response' | 'plan_approval_request' | 'plan_approval_response'
  from: string
  to: string
  content: string
  summary?: string
  timestamp: string
}

export interface TeamState {
  config: TeamConfig
  tasks: AgentTask[]
  progress: { completed: number; total: number; pct: number }
}

// ---------------------------------------------------------------------------
// Preset configurations (from wshobson/agents plugin)
// ---------------------------------------------------------------------------

export const TEAM_PRESETS: Record<TeamPreset, {
  description: string
  members: Array<{ role: string; agentType: AgentType }>
  defaultName: string
}> = {
  review: {
    description: 'Multi-dimensional code review (security, performance, architecture)',
    members: [
      { role: 'security-reviewer',      agentType: 'team-reviewer' },
      { role: 'performance-reviewer',   agentType: 'team-reviewer' },
      { role: 'architecture-reviewer',  agentType: 'team-reviewer' },
    ],
    defaultName: 'review-team',
  },
  debug: {
    description: 'Competing hypotheses debugging with parallel investigators',
    members: [
      { role: 'investigator-1', agentType: 'team-debugger' },
      { role: 'investigator-2', agentType: 'team-debugger' },
      { role: 'investigator-3', agentType: 'team-debugger' },
    ],
    defaultName: 'debug-team',
  },
  feature: {
    description: 'Parallel feature development (lead + 2 implementers)',
    members: [
      { role: 'team-lead',       agentType: 'team-lead' },
      { role: 'implementer-1',   agentType: 'team-implementer' },
      { role: 'implementer-2',   agentType: 'team-implementer' },
    ],
    defaultName: 'feature-team',
  },
  fullstack: {
    description: 'Full-stack development (lead + frontend + backend + tests)',
    members: [
      { role: 'team-lead',   agentType: 'team-lead' },
      { role: 'frontend',    agentType: 'team-implementer' },
      { role: 'backend',     agentType: 'team-implementer' },
      { role: 'tests',       agentType: 'team-implementer' },
    ],
    defaultName: 'fullstack-team',
  },
  research: {
    description: 'Parallel research across codebase and web',
    members: [
      { role: 'researcher-1', agentType: 'general-purpose' },
      { role: 'researcher-2', agentType: 'general-purpose' },
      { role: 'researcher-3', agentType: 'general-purpose' },
    ],
    defaultName: 'research-team',
  },
  security: {
    description: 'Comprehensive security audit (OWASP, auth, deps, secrets)',
    members: [
      { role: 'owasp-reviewer',        agentType: 'team-reviewer' },
      { role: 'auth-reviewer',         agentType: 'team-reviewer' },
      { role: 'dependency-reviewer',   agentType: 'team-reviewer' },
      { role: 'secrets-reviewer',      agentType: 'team-reviewer' },
    ],
    defaultName: 'security-team',
  },
  migration: {
    description: 'Codebase migration (lead + 2 implementers + reviewer)',
    members: [
      { role: 'team-lead',     agentType: 'team-lead' },
      { role: 'implementer-1', agentType: 'team-implementer' },
      { role: 'implementer-2', agentType: 'team-implementer' },
      { role: 'verifier',      agentType: 'team-reviewer' },
    ],
    defaultName: 'migration-team',
  },
  custom: {
    description: 'Custom team composition',
    members: [],
    defaultName: 'custom-team',
  },
}

// ---------------------------------------------------------------------------
// AgentTeamsDriver
// ---------------------------------------------------------------------------

export class AgentTeamsDriver extends EventEmitter {
  private readonly teamsDir: string
  private readonly tasksDir: string
  private watchedTeams = new Set<string>()
  private pollTimers = new Map<string, ReturnType<typeof setInterval>>()

  constructor(baseDir = homedir()) {
    super()
    this.teamsDir = join(baseDir, '.claude', 'teams')
    this.tasksDir = join(baseDir, '.claude', 'tasks')
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  listTeams(): string[] {
    try {
      return readdirSync(this.teamsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
    } catch { return [] }
  }

  getTeamConfig(teamName: string): TeamConfig | null {
    const path = join(this.teamsDir, teamName, 'config.json')
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as TeamConfig
    } catch { return null }
  }

  getTasks(teamName: string): AgentTask[] {
    const dir = join(this.tasksDir, teamName)
    if (!existsSync(dir)) return []
    try {
      return readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try { return JSON.parse(readFileSync(join(dir, f), 'utf-8')) as AgentTask }
          catch { return null }
        })
        .filter(Boolean) as AgentTask[]
    } catch { return [] }
  }

  getTeamState(teamName: string): TeamState | null {
    const config = this.getTeamConfig(teamName)
    if (!config) return null
    const tasks = this.getTasks(teamName)
    const completed = tasks.filter(t => t.status === 'completed').length
    const total = tasks.filter(t => t.status !== 'deleted').length
    return {
      config,
      tasks,
      progress: { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 },
    }
  }

  getAllTeamStates(): TeamState[] {
    return this.listTeams()
      .map(name => this.getTeamState(name))
      .filter(Boolean) as TeamState[]
  }

  // ---------------------------------------------------------------------------
  // Create team (writes config.json, creates task dir)
  // ---------------------------------------------------------------------------

  createTeam(teamName: string, members: TeamMember[]): TeamConfig {
    const teamId = randomUUID()
    const config: TeamConfig = {
      teamName,
      teamId,
      createdAt: new Date().toISOString(),
      members,
    }
    const dir = join(this.teamsDir, teamName)
    mkdirSync(join(dir, 'inbox'), { recursive: true })
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2))
    mkdirSync(join(this.tasksDir, teamName), { recursive: true })
    this.emit('team:created', config)
    return config
  }

  createTeamFromPreset(preset: TeamPreset, teamName?: string): TeamConfig {
    const p = TEAM_PRESETS[preset]
    const name = teamName ?? `${p.defaultName}-${Date.now()}`
    const members: TeamMember[] = p.members.map(m => ({
      name: m.role,
      agentId: randomUUID(),
      agentType: m.agentType,
    }))
    return this.createTeam(name, members)
  }

  // ---------------------------------------------------------------------------
  // Task management
  // ---------------------------------------------------------------------------

  createTask(teamName: string, task: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt'>): AgentTask {
    const full: AgentTask = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const dir = join(this.tasksDir, teamName)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${full.id}.json`), JSON.stringify(full, null, 2))
    this.emit('task:created', teamName, full)
    return full
  }

  updateTask(teamName: string, taskId: string, updates: Partial<AgentTask>): AgentTask | null {
    const path = join(this.tasksDir, teamName, `${taskId}.json`)
    try {
      const task = JSON.parse(readFileSync(path, 'utf-8')) as AgentTask
      const updated = { ...task, ...updates, updatedAt: new Date().toISOString() }
      writeFileSync(path, JSON.stringify(updated, null, 2))
      this.emit('task:updated', teamName, updated)
      return updated
    } catch { return null }
  }

  // ---------------------------------------------------------------------------
  // Messaging — write to agent inbox
  // ---------------------------------------------------------------------------

  sendMessage(teamName: string, msg: Omit<TeamMessage, 'id' | 'timestamp'>): TeamMessage {
    const full: TeamMessage = {
      ...msg,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    }
    const inboxDir = join(this.teamsDir, teamName, 'inbox', msg.to)
    mkdirSync(inboxDir, { recursive: true })
    writeFileSync(join(inboxDir, `${full.id}.json`), JSON.stringify(full, null, 2))
    this.emit('message:sent', teamName, full)
    return full
  }

  broadcast(teamName: string, from: string, content: string, summary?: string): void {
    const config = this.getTeamConfig(teamName)
    if (!config) return
    for (const member of config.members) {
      if (member.name === from) continue
      this.sendMessage(teamName, { type: 'broadcast', from, to: member.name, content, summary })
    }
  }

  // ---------------------------------------------------------------------------
  // Spawn — launch claude with agent teams enabled
  // ---------------------------------------------------------------------------

  spawnTeam(teamName: string, prompt: string, opts: {
    cwd?: string
    teammateMode?: 'in-process' | 'tmux' | 'auto'
  } = {}): void {
    const env = {
      ...process.env,
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    }
    const args = ['--teammate-mode', opts.teammateMode ?? 'in-process']
    const child = spawn('claude', args, {
      cwd: opts.cwd ?? process.cwd(),
      env,
      stdio: 'pipe',
    })

    // Send the prompt on stdin
    child.stdin?.write(prompt + '\n')

    child.stdout?.on('data', (chunk: Buffer) => {
      this.emit('team:output', teamName, chunk.toString())
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      this.emit('team:stderr', teamName, chunk.toString())
    })
    child.on('exit', (code) => {
      this.emit('team:exit', teamName, code)
    })

    this.emit('team:spawned', teamName)
  }

  // ---------------------------------------------------------------------------
  // Watch — poll task files for changes (every 2s)
  // ---------------------------------------------------------------------------

  watch(teamName: string): void {
    if (this.watchedTeams.has(teamName)) return
    this.watchedTeams.add(teamName)

    let prevJson = JSON.stringify(this.getTasks(teamName))

    const timer = setInterval(() => {
      const tasks = this.getTasks(teamName)
      const json = JSON.stringify(tasks)
      if (json !== prevJson) {
        prevJson = json
        this.emit('tasks:changed', teamName, tasks)
      }
    }, 2000)

    this.pollTimers.set(teamName, timer)
  }

  unwatch(teamName: string): void {
    const timer = this.pollTimers.get(teamName)
    if (timer) { clearInterval(timer); this.pollTimers.delete(teamName) }
    this.watchedTeams.delete(teamName)
  }

  stopAll(): void {
    for (const [name] of this.pollTimers) this.unwatch(name)
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  deleteTeam(teamName: string): void {
    this.unwatch(teamName)
    // Don't delete files — just emit; let user confirm before rm
    this.emit('team:cleanup_requested', teamName)
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _driver: AgentTeamsDriver | null = null

export function getAgentTeamsDriver(): AgentTeamsDriver {
  if (!_driver) _driver = new AgentTeamsDriver()
  return _driver
}
