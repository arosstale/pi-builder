/**
 * pi-builder-bridge — pi extension
 *
 * Forwards pi session events to a running pi-builder gateway over HTTP.
 * This closes the loop: pi can push turn completions, tool calls, and
 * chain artifact notifications to the browser UI without polling.
 *
 * Install: already in ~/.pi/agent/extensions/ (auto-discovered)
 * Config:  set PIBUILDER_BRIDGE_URL env var (default: http://127.0.0.1:18900)
 *          set PIBUILDER_BRIDGE_TOKEN env var if gateway has auth
 *
 * Events forwarded to POST /bridge:
 *   { type: "turn_end",               sessionId, turnIndex, summary }
 *   { type: "tool_execution_end",     sessionId, toolName, success }
 *   { type: "artifact_written",       sessionId, filePath, size }
 *   { type: "session_start",          sessionId }
 *   { type: "session_shutdown",       sessionId }
 *
 * The gateway broadcasts these as WebSocket frames to connected browsers.
 *
 * Chain artifact detection:
 *   When a "write" tool writes *.md, context.md, plan.md, research.md,
 *   we fire artifact_written so the Threads tab can show a "view" button.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

const BRIDGE_URL = process.env.PIBUILDER_BRIDGE_URL ?? "http://127.0.0.1:18900"
const BRIDGE_TOKEN = process.env.PIBUILDER_BRIDGE_TOKEN ?? ""
const ENDPOINT = `${BRIDGE_URL.replace(/\/$/, "")}/bridge`

// Whether the gateway is reachable — avoid spamming failed posts
let gatewayUp = false
let lastCheck = 0
const CHECK_INTERVAL = 30_000  // re-probe every 30s

async function post(payload: Record<string, unknown>): Promise<void> {
  const now = Date.now()
  // Lazy probe: skip if gateway was down and we haven't retried yet
  if (!gatewayUp && now - lastCheck < CHECK_INTERVAL) return
  lastCheck = now

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (BRIDGE_TOKEN) headers["Authorization"] = `Bearer ${BRIDGE_TOKEN}`

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    })
    gatewayUp = res.ok
  } catch {
    gatewayUp = false
  }
}

// ── Extension entry point ─────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let sessionId = "unknown"

  // ── session start ─────────────────────────────────────────────────────────
  pi.on("session_start", async (_event, ctx) => {
    sessionId = ctx.sessionManager?.currentSession?.sessionId ?? "unknown"
    await post({ type: "session_start", sessionId })
  })

  // ── turn complete ─────────────────────────────────────────────────────────
  pi.on("turn_end", async (event, _ctx) => {
    // Extract a short text summary from the last assistant message
    const msg = event.message
    let summary = ""
    if (msg && msg.role === "assistant") {
      const content = msg.content
      if (typeof content === "string") {
        summary = content.slice(0, 200)
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b: Record<string, unknown>) => b.type === "text")
        if (textBlock) summary = String((textBlock as Record<string, unknown>).text ?? "").slice(0, 200)
      }
    }
    await post({
      type: "turn_end",
      sessionId,
      turnIndex: event.turnIndex,
      summary,
    })
  })

  // ── tool execution complete ───────────────────────────────────────────────
  pi.on("tool_execution_end", async (event, _ctx) => {
    const { toolName, toolCallId } = event

    // Detect artifact writes — chain outputs like context.md, plan.md, research.md
    if (toolName === "write") {
      const args = (event as Record<string, unknown>).args as Record<string, unknown> | undefined
      const filePath = String(args?.file_path ?? args?.path ?? "")
      if (filePath && (filePath.endsWith(".md") || filePath.endsWith(".txt"))) {
        // Estimate size from content if available
        const content = String(args?.content ?? "")
        await post({
          type: "artifact_written",
          sessionId,
          filePath,
          size: content.length,
          toolCallId,
        })
      }
    }

    await post({
      type: "tool_execution_end",
      sessionId,
      toolName,
      toolCallId,
      // success inferred from result — tool_execution_end fires on completion
      success: true,
    })
  })

  // ── session shutdown ──────────────────────────────────────────────────────
  pi.on("session_shutdown", async (_event, _ctx) => {
    await post({ type: "session_shutdown", sessionId })
  })
}
