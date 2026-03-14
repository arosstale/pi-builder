/**
 * usePty — React hook wrapping Tauri PTY commands + event listeners.
 *
 * Tauri emits PTY output as high-frequency events on the channel
 * "pty://data/<sessionId>". No WebSocket — the IPC bridge handles it.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface PtySessionInfo {
  sessionId: string
  agentId: string
  alive: boolean
  cols: number
  rows: number
}

export interface PtyDataEvent {
  sessionId: string
  agentId: string
  data: string
}

export interface PtyExitEvent {
  sessionId: string
  exitCode: number
}

export function usePty() {
  const [sessions, setSessions] = useState<PtySessionInfo[]>([])
  const unlisteners = useRef<Map<string, UnlistenFn[]>>(new Map())

  const spawn = useCallback(async (
    agentId: string,
    cmd: string[],
    opts: { cwd?: string; cols?: number; rows?: number } = {},
    onData: (e: PtyDataEvent) => void,
    onExit: (e: PtyExitEvent) => void,
  ): Promise<string> => {
    const { session_id } = await invoke<{ session_id: string }>('pty_spawn', {
      args: { agent_id: agentId, cmd, ...opts },
    })

    // Subscribe to data + exit events for this session
    const unlistenData = await listen<PtyDataEvent>(
      `pty://data/${session_id}`,
      (event) => onData(event.payload),
    )
    const unlistenExit = await listen<PtyExitEvent>(
      `pty://exit/${session_id}`,
      (event) => {
        onExit(event.payload)
        setSessions(prev => prev.map(s =>
          s.sessionId === session_id ? { ...s, alive: false } : s
        ))
      },
    )

    unlisteners.current.set(session_id, [unlistenData, unlistenExit])
    setSessions(prev => [...prev, {
      sessionId: session_id,
      agentId,
      alive: true,
      cols: opts.cols ?? 220,
      rows: opts.rows ?? 50,
    }])

    return session_id
  }, [])

  const writeInput = useCallback((sessionId: string, data: string) => {
    void invoke('pty_input', { sessionId, data })
  }, [])

  const resize = useCallback((sessionId: string, cols: number, rows: number) => {
    void invoke('pty_resize', { sessionId, cols, rows })
  }, [])

  const kill = useCallback((sessionId: string) => {
    invoke('pty_kill', { sessionId }).then(() => {
      const fns = unlisteners.current.get(sessionId)
      fns?.forEach(fn => fn())
      unlisteners.current.delete(sessionId)
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    })
  }, [])

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      for (const fns of unlisteners.current.values()) {
        fns.forEach(fn => fn())
      }
    }
  }, [])

  return { sessions, spawn, writeInput, resize, kill }
}
