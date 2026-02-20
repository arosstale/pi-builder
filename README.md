# pi-builder

Our personal build of [pi](https://github.com/badlogic/pi-mono) — a routing layer that dispatches coding tasks to whichever CLI agent is installed.

MIT License.

---

## What it does

You talk to pi-builder. pi-builder figures out which coding agent you have installed (claude, aider, opencode, gemini, goose, plandex, codex, swe-agent, crush, gptme) and routes your prompt to it. Responses stream back in real-time over WebSocket to a browser UI.

```
You → pi-builder gateway → best available agent → streamed back to you
```

---

## Quick start

```bash
# Install dependencies
bun install

# Check which agents you have
npx tsx apps/cli/src/cli.ts agents

# Start the gateway + open the web UI
npx tsx apps/cli/src/cli.ts start

# Open apps/web/pi-builder-ui.html in your browser
# Send a prompt — it routes to whatever agent is installed

# One-shot from CLI
npx tsx apps/cli/src/cli.ts run "refactor this file to use async/await"
```

---

## Architecture

```
┌─────────────┐
│   Web UI    │  apps/web/pi-builder-ui.html (single-file, no build)
│  (Browser)  │
└──────┬──────┘
       │ WebSocket (port 18900)
       ↓
┌────────────────────────────────────────────────┐
│  PiBuilderGateway  (packages/core/src/server/) │
│  ├─ HTTP (serves web UI at GET /)              │
│  ├─ WebSocket server                           │
│  └─ OrchestratorService + EventEmitter stream  │
└──────┬─────────────────────────────────────────┘
       ↓
┌────────────────────────────────────────────────┐
│  WrapperOrchestrator  (src/integrations/)      │
│  ├─ Health check (30s TTL via --version)       │
│  ├─ Capability-based routing                   │
│  ├─ Message queue (drain after each turn)      │
│  ├─ Fallback (try next on failure)             │
│  └─ SQLite session persistence                 │
└──────┬─────────────────────────────────────────┘
       ↓
  [claude|aider|opencode|codex|gemini|goose|plandex|swe-agent|crush|gptme]

Key files:
  apps/cli/src/cli.ts                         — start | agents | run
  packages/core/src/integrations/
    agent-wrappers.ts                         — 10 CLI wrappers + WrapperOrchestrator
    pi-agent-sdk.ts                           — pi SDK in-process (no subprocess)
  packages/core/src/orchestration/
    orchestrator-service.ts                   — middleware, routing, history, queue
  packages/core/src/server/websocket-server.ts — WS gateway
  packages/core/src/db/database.ts            — SQLite (bun:sqlite / in-memory shim)
```

---

## Supported agents

| Agent | Binary | Key capabilities |
|-------|--------|-----------------|
| Claude Code | `claude` | code-gen, analysis, debugging |
| Aider | `aider` | pair-programming, git-aware, multi-file |
| OpenCode | `opencode` | multi-provider, LSP-aware |
| Codex CLI | `codex` | command execution, repo tasks |
| Gemini CLI | `gemini` | large-context, multimodal |
| Goose | `goose` | local-first, MCP, execution |
| Plandex | `plandex` | plan-first, structured steps |
| SWE-agent | `swe-agent` | research-backed, structured |
| Crush | `crush` | fast iteration, terminal-native |
| gptme | `gptme` | open-source, self-hosted |

You don't need all of them. pi-builder detects what's installed and picks the best available one for each task.

---

## WebSocket protocol

Connect to `ws://127.0.0.1:18900`.

**Client → server:**
```json
{ "type": "send",    "id": "1", "message": "fix the bug in auth.ts" }
{ "type": "history", "id": "2" }
{ "type": "agents",  "id": "3" }
{ "type": "health",  "id": "4" }
{ "type": "clear",   "id": "5" }
```

**Server → client:**
```json
{ "type": "hello",         "sessionId": "session-..." }
{ "type": "chunk",         "agent": "claude", "text": "..." }
{ "type": "turn_complete", "id": "1", "message": {...}, "agentResult": {...} }
{ "type": "agent_start",   "agent": "claude", "task": "fix the bug..." }
{ "type": "agent_end",     "agent": "claude", "status": "success", "durationMs": 4200 }
{ "type": "history",       "id": "2", "messages": [...] }
{ "type": "agents",        "id": "3", "list": [...] }
{ "type": "health",        "id": "4", "agents": {"claude": true, "aider": false} }
{ "type": "error",         "id": "?", "message": "..." }
```

---

## Tests

```bash
npx vitest run packages/core
# 40 files, 1000 pass
```

---

## Status

| Component | Status |
|-----------|--------|
| Agent wrappers (10 agents) | ✅ Done |
| WS gateway | ✅ Done |
| Web UI | ✅ Done |
| CLI (start / agents / run) | ✅ Done |
| SQLite session persistence | ✅ Done |
| Code generator (Claude direct) | ✅ Done |
| pi SDK integration | ✅ Done |
| HTTP serving web UI from gateway | ✅ Done |
| Input transform middleware | ✅ Done |
| Electron desktop app | ✅ Done |
| Optional WS auth (`authToken`) | 🔲 In progress |
| Electron build CI | 🔲 In progress |

---

Built by Artale. MIT.
