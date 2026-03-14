/**
 * App — pi-builder desktop (Tauri + Rust PTY + ghostty-web)
 *
 * Layout:
 *   Header: repo path picker + spawn toolbar
 *   Left sidebar: agent session tabs + worktree divergence
 *   Main: ghostty-web terminal pane for active session
 */

import { invoke } from '@tauri-apps/api/core'
import { useCallback, useRef, useState } from 'react'
import { TerminalPane } from './TerminalPane'
import { usePty, type PtySessionInfo } from './usePty'
import { useWorktrees } from './useWorktrees'

const AGENT_PRESETS: Record<string, string[]> = {
  pi:     ['pi', '--no-color'],
  claude: ['claude', '--print'],
  aider:  ['aider', '--no-pretty'],
  crush:  ['crush', 'run', '--quiet'],
  shell:  ['cmd.exe'],
}

export default function App() {
  const [repoPath, setRepoPath] = useState<string>('')
  const [agentInput, setAgentInput] = useState('pi')
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const { sessions, spawn, writeInput, resize, kill } = usePty()
  const worktrees = useWorktrees(repoPath || null)

  // Map sessionId → write() fn provided by TerminalPane on mount
  const writers = useRef<Map<string, (data: string) => void>>(new Map())

  const handleSpawn = useCallback(async () => {
    const key = agentInput.trim() || 'pi'
    const cmd = AGENT_PRESETS[key] ?? key.split(/\s+/)

    const id = await spawn(
      key,
      cmd,
      { cwd: repoPath || undefined, cols: 220, rows: 50 },
      // onData from PTY → write to terminal
      (e) => writers.current.get(e.sessionId)?.(e.data),
      // onExit
      (e) => {
        writers.current.get(e.sessionId)?.(
          `\r\n\x1b[31m[exited ${e.exitCode}]\x1b[0m\r\n`
        )
      },
    )
    setActiveSession(id)

    // If repo configured, create worktree for this session
    if (repoPath) {
      try {
        await invoke('worktree_create', { sessionId: id })
      } catch {
        // Not a git repo or worktree failed — carry on
      }
    }
  }, [agentInput, repoPath, spawn])

  const handleSetRepo = useCallback(async () => {
    // TODO: use Tauri dialog when tauri-plugin-dialog is added
    const path = window.prompt('Repository path:', repoPath)
    if (!path) return
    setRepoPath(path)
    await invoke('set_repo_path', { path })
  }, [repoPath])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={styles.header}>
        <span style={styles.logo}>pi-builder</span>
        <button style={styles.btn} onClick={handleSetRepo}>
          {repoPath ? `📁 ${repoPath.split(/[\\/]/).pop()}` : '📁 set repo'}
        </button>
        <select
          value={agentInput}
          onChange={e => setAgentInput(e.target.value)}
          style={styles.select}
        >
          {Object.keys(AGENT_PRESETS).map(k => (
            <option key={k} value={k}>{k}</option>
          ))}
          <option value="custom">custom…</option>
        </select>
        {agentInput === 'custom' && (
          <input
            style={styles.input}
            placeholder="command args…"
            onBlur={e => setAgentInput(e.target.value)}
          />
        )}
        <button style={{ ...styles.btn, background: '#1c2d40', color: '#58a6ff', borderColor: '#264563' }} onClick={handleSpawn}>
          + Spawn
        </button>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#8b949e' }}>
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarTitle}>Sessions</div>
          {sessions.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: '#8b949e' }}>
              No sessions — click + Spawn
            </div>
          )}
          {sessions.map(s => (
            <SessionRow
              key={s.sessionId}
              session={s}
              active={s.sessionId === activeSession}
              onSelect={() => setActiveSession(s.sessionId)}
              onKill={() => {
                kill(s.sessionId)
                writers.current.delete(s.sessionId)
                if (activeSession === s.sessionId) {
                  const remaining = sessions.filter(x => x.sessionId !== s.sessionId)
                  setActiveSession(remaining[remaining.length - 1]?.sessionId ?? null)
                }
              }}
            />
          ))}

          {/* Worktree divergence */}
          {worktrees.length > 0 && (
            <>
              <div style={{ ...styles.sidebarTitle, marginTop: 8 }}>Worktrees</div>
              {worktrees.map(wt => (
                <WorktreeRow key={wt.name} wt={wt} />
              ))}
            </>
          )}
        </div>

        {/* Terminal area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {sessions.length === 0 ? (
            <div style={styles.empty}>
              <div style={{ fontSize: 14, color: '#58a6ff', marginBottom: 8 }}>pi-builder desktop</div>
              <div style={{ fontSize: 12, color: '#8b949e' }}>
                Spawn an agent session to start a real terminal.
              </div>
            </div>
          ) : (
            sessions.map(s => (
              <div
                key={s.sessionId}
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  display: s.sessionId === activeSession ? 'flex' : 'none',
                }}
              >
                <TerminalPane
                  sessionId={s.sessionId}
                  cols={s.cols}
                  rows={s.rows}
                  onData={(data) => writeInput(s.sessionId, data)}
                  onResize={(cols, rows) => resize(s.sessionId, cols, rows)}
                  onMount={(write) => writers.current.set(s.sessionId, write)}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function WorktreeRow({ wt }: { wt: import('./useWorktrees').WorktreeInfo }) {
  return (
    <div style={{
      padding: '6px 16px',
      fontSize: 11,
      fontFamily: "'JetBrains Mono', monospace",
      color: '#8b949e',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      borderBottom: '1px solid #21262d',
    }}>
      <span style={{ color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {wt.branch}
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {wt.ahead > 0 && (
          <span style={{ color: '#3fb950' }}>↑{wt.ahead}</span>
        )}
        {wt.behind > 0 && (
          <span style={{ color: '#f85149' }}>↓{wt.behind}</span>
        )}
        {wt.dirty && (
          <span style={{ color: '#d29922' }}>●</span>
        )}
        {!wt.ahead && !wt.behind && !wt.dirty && (
          <span style={{ color: '#3fb950' }}>✓ clean</span>
        )}
      </div>
    </div>
  )
}

function SessionRow({
  session, active, onSelect, onKill,
}: {
  session: PtySessionInfo
  active: boolean
  onSelect: () => void
  onKill: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        background: active ? '#1c2d40' : 'transparent',
        borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
        cursor: 'pointer',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        color: active ? '#58a6ff' : '#e6edf3',
      }}
    >
      <span
        style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: session.alive ? '#3fb950' : '#f85149',
        }}
      />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {session.agentId}
      </span>
      <span
        onClick={e => { e.stopPropagation(); onKill() }}
        style={{ opacity: 0.5, cursor: 'pointer', fontSize: 10 }}
        title="kill session"
      >
        ✕
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles (inline — no CSS-in-JS dep)
// ---------------------------------------------------------------------------

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    background: '#161b22',
    borderBottom: '1px solid #30363d',
    flexShrink: 0,
  } as React.CSSProperties,

  logo: {
    fontSize: 16,
    fontWeight: 700,
    color: '#58a6ff',
    letterSpacing: -0.5,
  } as React.CSSProperties,

  btn: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '4px 12px',
    color: '#e6edf3',
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,

  select: {
    background: '#21262d',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '4px 8px',
    color: '#e6edf3',
    fontSize: 12,
  } as React.CSSProperties,

  input: {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '4px 8px',
    color: '#e6edf3',
    fontSize: 12,
    width: 200,
  } as React.CSSProperties,

  sidebar: {
    width: 200,
    background: '#161b22',
    borderRight: '1px solid #30363d',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflowY: 'auto',
  } as React.CSSProperties,

  sidebarTitle: {
    padding: '10px 16px 6px',
    fontSize: 11,
    fontWeight: 600,
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #30363d',
  } as React.CSSProperties,

  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8b949e',
    fontSize: 13,
  } as React.CSSProperties,
}
