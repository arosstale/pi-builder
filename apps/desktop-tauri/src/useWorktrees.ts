/**
 * useWorktrees — polls Tauri worktree_list every 5 s.
 * Returns divergence stats for each agent worktree.
 */

import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

export interface WorktreeInfo {
  name: string
  path: string
  branch: string
  ahead: number
  behind: number
  dirty: boolean
}

export function useWorktrees(repoPath: string | null, intervalMs = 5000) {
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([])

  useEffect(() => {
    if (!repoPath) { setWorktrees([]); return }

    let cancelled = false

    const poll = async () => {
      try {
        const wts = await invoke<WorktreeInfo[]>('worktree_list')
        if (!cancelled) setWorktrees(wts)
      } catch {
        // Not a git repo or worktree plugin unavailable — silent
      }
    }

    void poll()
    const id = setInterval(() => { void poll() }, intervalMs)
    return () => { cancelled = true; clearInterval(id) }
  }, [repoPath, intervalMs])

  return worktrees
}
