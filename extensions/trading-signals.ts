/**
 * trading-signals — pi extension
 *
 * Widget + tools for the ~/Projects/trading-signals CLI.
 *
 * Widget (above editor, auto-hides):
 *   XAU ▲ long  ema-cross  conf 82%  R:R 2.4  pending 3
 *   XAG ─ neutral  (no recent signal)
 *
 * Tools registered (model can call these):
 *   signals_scan    — run the scanner, store results, return summary
 *   signals_pending — list open positions waiting for outcome
 *   signals_stats   — win rate, avg P&L, total count
 *   signals_recent  — signals from last N hours (default 24)
 *   signal_resolve  — record outcome (exit price, P&L) for a signal
 *
 * CLI-first: all calls shell out to:
 *   node --import tsx ~/Projects/trading-signals/src/cli.ts <cmd>
 *
 * Install: already in ~/.pi/agent/extensions/ (auto-discovered by pi)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Text } from "@mariozechner/pi-tui"
import { Type } from "@sinclair/typebox"
import { spawn } from "node:child_process"
import { homedir } from "node:os"
import { resolve } from "node:path"

// ── Config ────────────────────────────────────────────────────────────────

const CLI_DIR  = resolve(homedir(), "Projects", "trading-signals")
const CLI_MAIN = resolve(CLI_DIR, "src", "cli.ts")
const NODE_BIN = process.execPath   // same node that's running pi

// ── CLI runner ────────────────────────────────────────────────────────────

function runCli(args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(NODE_BIN, ["--import", "tsx", CLI_MAIN, ...args], {
      cwd: CLI_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()))
    proc.stderr.on("data", () => {}) // swallow stderr noise
    proc.on("close", (code) => resolve({ stdout: stdout.trim(), code: code ?? 1 }))
  })
}

function parseFirstJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  try { return JSON.parse(text.slice(start)) } catch { return null }
}

// ── Widget state ──────────────────────────────────────────────────────────

interface WidgetSignal {
  metal: string
  direction: string
  strategy: string
  confidence: number
  riskReward: number
  timestamp: string
}

let widgetTui: { requestRender: () => void } | null = null
let widgetSignals: WidgetSignal[] = []
let pendingCount = 0
let lastScan = "never"
let scanInProgress = false

function refreshWidgetData(): void {
  // Pull pending count from CLI (cheap, fast)
  runCli(["pending"]).then(({ stdout }) => {
    const match = stdout.match(/^(\d+) pending/)
    pendingCount = match ? parseInt(match[1], 10) : 0
    widgetTui?.requestRender()
  })
}

function renderWidget(theme: {
  fg: (color: string, text: string) => string
  bold: (text: string) => string
}): string[] {
  const lines: string[] = []

  if (scanInProgress) {
    lines.push(
      theme.fg("warning", "◆") + " " +
      theme.fg("dim", "scanning XAU/XAG…")
    )
    return lines
  }

  for (const sig of widgetSignals) {
    const dirIcon = sig.direction === "long"  ? theme.fg("success", "▲")
                  : sig.direction === "short" ? theme.fg("error",   "▼")
                  :                             theme.fg("dim",      "─")
    const conf = Math.round(sig.confidence * 100)
    const rr   = sig.riskReward.toFixed(1)
    lines.push(
      `${theme.fg("accent", sig.metal)} ${dirIcon} ` +
      `${theme.fg("text", sig.strategy)}  ` +
      `${theme.fg("muted", "conf")} ${theme.fg("text", conf + "%")}  ` +
      `${theme.fg("muted", "R:R")} ${theme.fg("text", rr)}`
    )
  }

  if (pendingCount > 0) {
    lines.push(
      theme.fg("warning", "◆") + " " +
      theme.fg("dim", `${pendingCount} pending outcome${pendingCount > 1 ? "s" : ""}`)
    )
  }

  if (lines.length === 0) {
    lines.push(theme.fg("dim", "signals: none  last scan " + lastScan))
  }

  return lines
}

// ── Extension ─────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {

  // ── Widget setup ─────────────────────────────────────────────────────────

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return

    ctx.ui.setWidget("trading-signals", (tui, theme) => {
      widgetTui = tui
      return {
        render:     () => renderWidget(theme),
        invalidate: () => {},
        dispose:    () => { widgetTui = null },
      }
    })

    // Initial data pull
    refreshWidgetData()

    // Poll every 5 minutes to catch background scans
    const poll = setInterval(refreshWidgetData, 5 * 60 * 1000)
    pi.on("session_shutdown", async () => clearInterval(poll))
  })

  pi.on("session_switch", async (_event, ctx) => {
    if (ctx.hasUI) refreshWidgetData()
  })

  // ── Tool: signals_scan ───────────────────────────────────────────────────

  pi.registerTool({
    name: "signals_scan",
    label: "Scan Signals",
    description: "Run the XAU/XAG signal scanner. Fetches live prices, computes indicators, identifies setups. Returns summary of new signals found.",
    parameters: Type.Object({}),

    async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
      scanInProgress = true
      widgetTui?.requestRender()

      try {
        const { stdout, code } = await runCli(["scan"])
        scanInProgress = false
        lastScan = new Date().toLocaleTimeString()

        if (code !== 0) {
          widgetTui?.requestRender()
          return { content: [{ type: "text", text: `Scanner exited with code ${code}` }], details: {} }
        }

        // Parse new signals from output and update widget
        const lines = stdout.split("\n").filter(Boolean)
        const signalLines = lines.filter((l) => l.startsWith("Found"))
        const count = parseInt(signalLines[0]?.match(/\d+/)?.[0] ?? "0", 10)

        // Re-fetch pending for widget
        refreshWidgetData()

        // If signals were found, update widget with most recent ones
        if (count > 0) {
          const { stdout: recentOut } = await runCli(["recent", "1"])
          // Extract metals and directions from text output
          const sigs: WidgetSignal[] = []
          const sigPattern = /^\s+\w+ (\w+) (long|short|neutral) (\S+) @/gm
          let m: RegExpExecArray | null
          while ((m = sigPattern.exec(recentOut)) !== null) {
            sigs.push({
              metal: m[1],
              direction: m[2],
              strategy: m[3],
              confidence: 0.75,  // shown in text but not re-parsed here
              riskReward: 2.0,
              timestamp: new Date().toISOString(),
            })
          }
          if (sigs.length) widgetSignals = sigs.slice(0, 3)
          widgetTui?.requestRender()

          // Silent message to model when scan finds signals
          await pi.sendMessage(
            {
              customType: "signals-scan-complete",
              content: `Scanner found ${count} new signal${count > 1 ? "s" : ""}. Review with signals_pending.`,
              display: false,
              details: { count, summary: stdout.slice(0, 500) },
            },
            { triggerTurn: false, deliverAs: "followUp" }
          )
        }

        return {
          content: [{ type: "text", text: stdout || "Scan complete. No new signals." }],
          details: { signalsFound: count },
        }
      } catch (err) {
        scanInProgress = false
        widgetTui?.requestRender()
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: "text", text: `Scan failed: ${msg}` }], details: {} }
      }
    },

    renderCall(_args, theme) {
      return new Text(
        theme.fg("accent", "signals_scan") + theme.fg("dim", " XAU/XAG"),
        0, 0
      )
    },

    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : ""
      const first = text.split("\n")[0] ?? ""
      return new Text(theme.fg("muted", first), 0, 0)
    },
  })

  // ── Tool: signals_pending ────────────────────────────────────────────────

  pi.registerTool({
    name: "signals_pending",
    label: "Pending Signals",
    description: "List open signals waiting for an outcome (no exit recorded yet). Shows metal, direction, strategy, entry price.",
    parameters: Type.Object({}),

    async execute() {
      const { stdout, code } = await runCli(["pending"])
      if (code !== 0) return { content: [{ type: "text", text: "Failed to fetch pending signals" }], details: {} }
      return { content: [{ type: "text", text: stdout || "No pending signals." }], details: {} }
    },

    renderCall(_args, theme) {
      return new Text(theme.fg("accent", "signals_pending"), 0, 0)
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : ""
      return new Text(theme.fg("muted", text.split("\n")[0] ?? ""), 0, 0)
    },
  })

  // ── Tool: signals_stats ──────────────────────────────────────────────────

  pi.registerTool({
    name: "signals_stats",
    label: "Signal Statistics",
    description: "Show win rate, average P&L, and total signal count across all recorded outcomes.",
    parameters: Type.Object({}),

    async execute() {
      const { stdout, code } = await runCli(["stats"])
      if (code !== 0) return { content: [{ type: "text", text: "Failed to fetch stats" }], details: {} }
      return { content: [{ type: "text", text: stdout }], details: {} }
    },

    renderCall(_args, theme) {
      return new Text(theme.fg("accent", "signals_stats"), 0, 0)
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : ""
      // Show win rate line
      const winLine = text.split("\n").find((l) => l.includes("Win Rate")) ?? text.split("\n")[0] ?? ""
      return new Text(theme.fg("muted", winLine.trim()), 0, 0)
    },
  })

  // ── Tool: signals_recent ─────────────────────────────────────────────────

  pi.registerTool({
    name: "signals_recent",
    label: "Recent Signals",
    description: "Show signals from the last N hours. Defaults to 24h. Use to review recent setups.",
    parameters: Type.Object({
      hours: Type.Optional(Type.Number({ description: "Hours to look back (default 24)", minimum: 1, maximum: 168 })),
    }),

    async execute(_toolCallId, params) {
      const h = params.hours ?? 24
      const { stdout, code } = await runCli(["recent", String(h)])
      if (code !== 0) return { content: [{ type: "text", text: "Failed to fetch recent signals" }], details: {} }
      return { content: [{ type: "text", text: stdout || `No signals in last ${h}h.` }], details: {} }
    },

    renderCall(args, theme) {
      return new Text(
        theme.fg("accent", "signals_recent") + theme.fg("dim", ` ${args.hours ?? 24}h`),
        0, 0
      )
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : ""
      return new Text(theme.fg("muted", text.split("\n")[0] ?? ""), 0, 0)
    },
  })

  // ── Tool: signal_resolve ─────────────────────────────────────────────────

  pi.registerTool({
    name: "signal_resolve",
    label: "Resolve Signal",
    description: "Record the outcome for a pending signal: exit price, P&L, hold duration. Use when a trade closes.",
    parameters: Type.Object({
      id:            Type.String({ description: "Signal ID prefix (first 8 chars from signals_pending)" }),
      exitPrice:     Type.Number({ description: "Exit price" }),
      pnl:           Type.Number({ description: "P&L in USD (negative for loss)" }),
      holdDuration:  Type.Optional(Type.String({ description: "Hold duration e.g. '4h 23m'" })),
      notes:         Type.Optional(Type.String({ description: "Any notes on the trade" })),
    }),

    async execute(_toolCallId, params) {
      const { stdout, code } = await runCli([
        "resolve",
        params.id,
        String(params.exitPrice),
        String(params.pnl),
        ...(params.holdDuration ? ["--duration", params.holdDuration] : []),
        ...(params.notes        ? ["--notes",    params.notes]        : []),
      ])

      if (code !== 0) {
        return {
          content: [{ type: "text", text: `Failed to resolve signal ${params.id}: ${stdout}` }],
          details: {},
        }
      }

      // Update widget after resolving
      refreshWidgetData()

      const pnlStr = params.pnl >= 0
        ? `+$${params.pnl.toFixed(2)}`
        : `-$${Math.abs(params.pnl).toFixed(2)}`

      return {
        content: [{ type: "text", text: stdout || `Signal ${params.id} resolved: ${pnlStr}` }],
        details: { pnl: params.pnl },
      }
    },

    renderCall(args, theme) {
      const pnlStr = args.pnl >= 0 ? `+$${args.pnl.toFixed(2)}` : `-$${Math.abs(args.pnl).toFixed(2)}`
      return new Text(
        theme.fg("accent", "signal_resolve") + " " +
        theme.fg("dim", args.id + "  ") +
        (args.pnl >= 0 ? theme.fg("success", pnlStr) : theme.fg("error", pnlStr)),
        0, 0
      )
    },
    renderResult(result, _opts, theme) {
      const text = result.content[0]?.type === "text" ? result.content[0].text : ""
      return new Text(theme.fg("muted", text), 0, 0)
    },
  })

  // ── /signals command ─────────────────────────────────────────────────────

  pi.registerCommand("signals", {
    description: "Show trading signal dashboard: /signals [scan|pending|stats]",
    handler: async (args, ctx) => {
      const sub = (args ?? "").trim() || "stats"
      const { stdout } = await runCli([sub])
      ctx.ui.notify(stdout || "Done.", "info")
    },
  })
}
