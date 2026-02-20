/**
 * TerminalPane — renders a ghostty-web Terminal for one PTY session.
 *
 * ghostty-web is the same VT100 parser that runs in native Ghostty,
 * compiled to WASM. xterm.js-compatible API.
 */

import { useEffect, useRef } from 'react'
import { init, Terminal } from 'ghostty-web'

let ghosttyReady: Promise<void> | null = null
function ensureGhosttyReady() {
  if (!ghosttyReady) ghosttyReady = init()
  return ghosttyReady
}

interface Props {
  sessionId: string
  cols: number
  rows: number
  onData: (data: string) => void
  onResize: (cols: number, rows: number) => void
  /** Call this with the write function so the parent can push PTY data in */
  onMount: (write: (data: string) => void) => void
}

export function TerminalPane({ sessionId, onData, onResize, onMount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<InstanceType<typeof Terminal> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    let term: InstanceType<typeof Terminal>
    let disposed = false

    ensureGhosttyReady().then(() => {
      if (disposed) return

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        scrollback: 50000,
        theme: {
          background: '#0d0d0d',
          foreground: '#e6edf3',
          cursor:     '#58a6ff',
          selectionBackground: '#264f78',
          black: '#0d1117', brightBlack: '#6e7681',
          red:   '#f85149', brightRed:   '#f85149',
          green: '#3fb950', brightGreen: '#3fb950',
          yellow:'#d29922', brightYellow:'#e3b341',
          blue:  '#58a6ff', brightBlue:  '#79c0ff',
          magenta:'#bc8cff',brightMagenta:'#d2a8ff',
          cyan:  '#76e3ea', brightCyan:  '#b3f0ff',
          white: '#b1bac4', brightWhite: '#f0f6fc',
        },
      })

      term.open(container)
      termRef.current = term

      // User typing → parent → Tauri → PTY stdin
      term.onData((data: string) => onData(data))

      // Terminal resize → parent → Tauri → PTY resize
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => onResize(cols, rows))

      // Expose write() to parent
      onMount((data: string) => term.write(data))

      // Initial fit
      fit(container, term, onResize)
    })

    // ResizeObserver for automatic fitting
    const ro = new ResizeObserver(() => {
      if (termRef.current) fit(container, termRef.current, onResize)
    })
    ro.observe(container)

    return () => {
      disposed = true
      ro.disconnect()
      termRef.current?.dispose()
      termRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', padding: 8, background: '#0d0d0d' }}
    />
  )
}

function fit(
  container: HTMLElement,
  term: InstanceType<typeof Terminal>,
  onResize: (cols: number, rows: number) => void,
) {
  const rect = container.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const charW = 7.8
  const charH = 16
  const cols = Math.max(20, Math.floor((rect.width  - 16) / charW))
  const rows = Math.max(5,  Math.floor((rect.height - 16) / charH))
  term.resize(cols, rows)
  onResize(cols, rows)
}
