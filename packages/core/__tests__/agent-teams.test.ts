/**
 * AgentTeamsDriver tests
 *
 * Tests the filesystem-based Agent Teams protocol driver.
 * All tests use a tmp directory — no writes to ~/.claude.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  AgentTeamsDriver,
  TEAM_PRESETS,
  type TeamPreset,
} from '../src/teams/agent-teams'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

let tmpDir: string
let driver: AgentTeamsDriver

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'pi-builder-teams-'))
  driver = new AgentTeamsDriver(tmpDir)
})

afterEach(() => {
  driver.stopAll()
  rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// TEAM_PRESETS
// ---------------------------------------------------------------------------

describe('TEAM_PRESETS', () => {
  it('has all expected preset keys', () => {
    const keys: TeamPreset[] = ['review', 'debug', 'feature', 'fullstack', 'research', 'security', 'migration', 'custom']
    for (const k of keys) expect(TEAM_PRESETS).toHaveProperty(k)
  })

  it('review preset has 3 team-reviewer members', () => {
    const p = TEAM_PRESETS.review
    expect(p.members).toHaveLength(3)
    expect(p.members.every(m => m.agentType === 'team-reviewer')).toBe(true)
  })

  it('debug preset has 3 team-debugger members', () => {
    expect(TEAM_PRESETS.debug.members.every(m => m.agentType === 'team-debugger')).toBe(true)
  })

  it('feature preset has lead + 2 implementers', () => {
    const members = TEAM_PRESETS.feature.members
    expect(members.find(m => m.agentType === 'team-lead')).toBeTruthy()
    expect(members.filter(m => m.agentType === 'team-implementer')).toHaveLength(2)
  })

  it('security preset has 4 reviewers', () => {
    expect(TEAM_PRESETS.security.members).toHaveLength(4)
  })

  it('migration preset has lead + 2 implementers + reviewer', () => {
    const m = TEAM_PRESETS.migration.members
    expect(m.filter(x => x.agentType === 'team-implementer')).toHaveLength(2)
    expect(m.filter(x => x.agentType === 'team-lead')).toHaveLength(1)
    expect(m.filter(x => x.agentType === 'team-reviewer')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// createTeam / createTeamFromPreset
// ---------------------------------------------------------------------------

describe('AgentTeamsDriver.createTeam', () => {
  it('creates config.json and inbox dir', () => {
    const config = driver.createTeam('my-team', [
      { name: 'lead', agentId: 'a1', agentType: 'team-lead' },
    ])
    expect(config.teamName).toBe('my-team')
    expect(config.members).toHaveLength(1)

    const found = driver.getTeamConfig('my-team')
    expect(found?.teamName).toBe('my-team')
  })

  it('emits team:created event', () => {
    let emitted: unknown = null
    driver.on('team:created', (c) => { emitted = c })
    driver.createTeam('evt-team', [{ name: 'x', agentId: 'y', agentType: 'general-purpose' }])
    expect((emitted as { teamName: string }).teamName).toBe('evt-team')
  })

  it('createTeamFromPreset uses preset members', () => {
    const config = driver.createTeamFromPreset('review', 'test-review')
    expect(config.teamName).toBe('test-review')
    expect(config.members).toHaveLength(3)
    expect(config.members.every(m => m.agentType === 'team-reviewer')).toBe(true)
  })

  it('createTeamFromPreset generates name if omitted', () => {
    const config = driver.createTeamFromPreset('debug')
    expect(config.teamName).toMatch(/^debug-team-/)
  })
})

// ---------------------------------------------------------------------------
// listTeams / getTeamState / getAllTeamStates
// ---------------------------------------------------------------------------

describe('team discovery', () => {
  it('listTeams returns empty when no teams', () => {
    expect(driver.listTeams()).toEqual([])
  })

  it('listTeams returns created teams', () => {
    driver.createTeamFromPreset('review', 'r1')
    driver.createTeamFromPreset('debug', 'd1')
    const teams = driver.listTeams()
    expect(teams).toContain('r1')
    expect(teams).toContain('d1')
  })

  it('getTeamState returns null for unknown team', () => {
    expect(driver.getTeamState('ghost')).toBeNull()
  })

  it('getTeamState includes progress 0/0 when no tasks', () => {
    driver.createTeamFromPreset('review', 'r2')
    const state = driver.getTeamState('r2')
    expect(state?.progress.total).toBe(0)
    expect(state?.progress.pct).toBe(0)
  })

  it('getAllTeamStates returns all teams', () => {
    driver.createTeamFromPreset('review', 'ra')
    driver.createTeamFromPreset('debug', 'db')
    const all = driver.getAllTeamStates()
    expect(all.map(s => s.config.teamName)).toContain('ra')
    expect(all.map(s => s.config.teamName)).toContain('db')
  })
})

// ---------------------------------------------------------------------------
// Task management
// ---------------------------------------------------------------------------

describe('task management', () => {
  beforeEach(() => {
    driver.createTeamFromPreset('review', 'task-team')
  })

  it('createTask writes JSON and emits event', () => {
    let emitted: unknown = null
    driver.on('task:created', (_, task) => { emitted = task })

    const task = driver.createTask('task-team', {
      subject: 'Review auth module',
      description: 'Check for security issues',
      status: 'pending',
    })

    expect(task.id).toBeTruthy()
    expect(task.status).toBe('pending')
    expect(emitted).not.toBeNull()

    const tasks = driver.getTasks('task-team')
    expect(tasks.find(t => t.id === task.id)).toBeTruthy()
  })

  it('updateTask changes status', () => {
    const task = driver.createTask('task-team', {
      subject: 'Performance review',
      description: '',
      status: 'pending',
    })

    const updated = driver.updateTask('task-team', task.id, { status: 'in_progress', owner: 'perf-reviewer' })
    expect(updated?.status).toBe('in_progress')
    expect(updated?.owner).toBe('perf-reviewer')
  })

  it('updateTask returns null for unknown task', () => {
    expect(driver.updateTask('task-team', 'ghost-task', { status: 'completed' })).toBeNull()
  })

  it('progress calculation counts completed vs total', () => {
    driver.createTask('task-team', { subject: 'T1', description: '', status: 'completed' })
    driver.createTask('task-team', { subject: 'T2', description: '', status: 'in_progress' })
    driver.createTask('task-team', { subject: 'T3', description: '', status: 'pending' })

    const state = driver.getTeamState('task-team')
    expect(state?.progress.total).toBe(3)
    expect(state?.progress.completed).toBe(1)
    expect(state?.progress.pct).toBe(33)
  })

  it('deleted tasks excluded from total', () => {
    driver.createTask('task-team', { subject: 'D', description: '', status: 'deleted' })
    driver.createTask('task-team', { subject: 'A', description: '', status: 'completed' })
    const state = driver.getTeamState('task-team')
    expect(state?.progress.total).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

describe('messaging', () => {
  beforeEach(() => {
    driver.createTeam('msg-team', [
      { name: 'lead', agentId: 'a1', agentType: 'team-lead' },
      { name: 'reviewer-1', agentId: 'a2', agentType: 'team-reviewer' },
      { name: 'reviewer-2', agentId: 'a3', agentType: 'team-reviewer' },
    ])
  })

  it('sendMessage writes inbox file and emits event', () => {
    let emitted: unknown = null
    driver.on('message:sent', (_, msg) => { emitted = msg })

    const msg = driver.sendMessage('msg-team', {
      type: 'message',
      from: 'lead',
      to: 'reviewer-1',
      content: 'Start your review',
    })

    expect(msg.id).toBeTruthy()
    expect(msg.type).toBe('message')
    expect(emitted).not.toBeNull()
  })

  it('broadcast sends to all other members', () => {
    const sent: string[] = []
    driver.on('message:sent', (_, msg: { to: string }) => { sent.push(msg.to) })

    driver.broadcast('msg-team', 'lead', 'Critical update')

    // lead is excluded (from === lead), so 2 messages
    expect(sent).toHaveLength(2)
    expect(sent).toContain('reviewer-1')
    expect(sent).toContain('reviewer-2')
  })
})

// ---------------------------------------------------------------------------
// Watch / unwatch
// ---------------------------------------------------------------------------

describe('watch', () => {
  it('watch does not throw', () => {
    driver.createTeamFromPreset('review', 'w-team')
    expect(() => driver.watch('w-team')).not.toThrow()
    driver.unwatch('w-team')
  })

  it('double-watch is idempotent', () => {
    driver.createTeamFromPreset('review', 'w2')
    driver.watch('w2')
    driver.watch('w2') // second call ignored
    driver.unwatch('w2')
  })

  it('stopAll clears all watchers', () => {
    driver.createTeamFromPreset('review', 'wa')
    driver.createTeamFromPreset('debug', 'wb')
    driver.watch('wa')
    driver.watch('wb')
    expect(() => driver.stopAll()).not.toThrow()
  })
})
