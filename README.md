# pi-builder

A local-first WebSocket gateway that routes coding prompts to any installed CLI agent, with session persistence, PTY terminal multiplexing, RPC-native pi sessions, Claude Code Agent Teams, and **thread-based engineering** via [pi-subagents](https://github.com/nicobailon/pi-async-subagents).

MIT License.

---

## What it does

```
You → pi-builder gateway → best available agent → streamed back to you
                        ↘ pi-subagents threads → scout → planner → worker → …
```

One interface, any agent. Automatic capability-based routing with fallback. Talk to it via browser, Electron, or Tauri desktop — or connect your own client over WebSocket.

---

## Quick start

```bash
bun install

# Install pi-subagents extension (enables Threads tab)
pi install npm:pi-subagents

# Optional: install bridge extension for live event push from pi → browser
cp extensions/pi-builder-bridge.ts ~/.pi/agent/extensions/

# Check which agents are installed
npx tsx apps/cli/src/cli.ts agents

# Start gateway (HTTP + WebSocket on port 18900)
npx tsx apps/cli/src/cli.ts start

# Open http://localhost:18900 in your browser
# — or open apps/web/pi-builder-ui.html directly

# One-shot from CLI
npx tsx apps/cli/src/cli.ts run "refactor auth.ts to use async/await"
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser UI  apps/web/pi-builder-ui.html  (single-file, no build)    │
│  ├─ Chat tab      — prompt → streamed response + git diff sidebar    │
│  ├─ Threads tab   — thread-based engineering (base/P/C/F/B/L/Z)     │
│  ├─ Sessions tab  — long-lived pi RPC sessions, event stream         │
│  ├─ Teams tab     — Claude Code Agent Teams (create/watch/msg)       │
│  └─ Terminal tab  — PTY multiplexer (ghostty-web WASM renderer)      │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ WebSocket  port 18900
                    ┌────┴────┐
                    │ HTTP    │ POST /bridge  ← pi-builder-bridge.ts
                    │ GET /   │              (pi extension, auto-push)
                    └────┬────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PiBuilderGateway   packages/core/src/server/websocket-server.ts     │
│  ├─ WS    chat, health, agents, history, diff/diff_full, queue       │
│  ├─ PTY   pty_spawn/input/resize/kill/list  (node-pty)               │
│  ├─ RPC   rpc_new/prompt/abort/kill/list    (pi --mode rpc)          │
│  ├─ Teams teams_list/create/spawn/watch/message/broadcast            │
│  └─ Threads thread_launch/list/kill/abort/steer/preset/agents/async  │
└───┬──────────────────────────────────┬───────────────────────────────┘
    │                                  │
    ▼                                  ▼
┌──────────────────────┐   ┌─────────────────────┐   ┌──────────────────┐
│  WrapperOrchestrator │   │  AgentTeamsDriver   │   │  ThreadEngine    │
│  11 CLI wrappers     │   │  7 presets          │   │  pi-subagents    │
│  capability routing  │   │  ~/.claude/teams/   │   │  /run /chain     │
│  RpcSessionManager   │   │  task CRUD          │   │  /parallel       │
└──────────────────────┘   └─────────────────────┘   └──────────────────┘
    │
    ▼
  [pi · claude · aider · codex · gemini · goose · plandex · crush · gptme · opencode · swe-agent]
```

---

## Key files

```
apps/
  cli/src/cli.ts                    start | agents | run
  web/pi-builder-ui.html            single-file browser UI (4 tabs)
  desktop/src/main.ts               Electron — spawns bun gateway subprocess
  desktop-tauri/                    Tauri — Rust PTY + git2 worktrees + React

packages/core/src/
  integrations/
    agent-wrappers.ts               11 wrappers + WrapperOrchestrator + RpcSessionManager
  orchestration/
    orchestrator-service.ts         middleware, routing, history, message queue
  server/
    websocket-server.ts             HTTP + WS gateway (PTY + RPC + Teams)
    pty-manager.ts                  node-pty PTY sessions
  teams/
    agent-teams.ts                  Agent Teams filesystem driver
  db/
    database.ts                     SQLite (bun:sqlite or in-memory shim)

scripts/
  reflect.sh                        pre-push gate (typecheck + tests + diff review)
  smoke-test.mjs                    E2E WebSocket smoke test
```

---

## Supported agents

| Agent | Binary | Notes |
|-------|--------|-------|
| pi | `pi` | Preferred — RPC mode (`pi --mode rpc`), structured event stream |
| Claude Code | `claude` | Agent Teams support |
| Aider | `aider` | git-aware, multi-file |
| OpenCode | `opencode` | multi-provider, LSP-aware |
| Codex CLI | `codex` | command execution |
| Gemini CLI | `gemini` | large-context; `--version` killed after 2s |
| Goose | `goose` | local-first, MCP |
| Plandex | `plandex` | plan-first |
| SWE-agent | `swe-agent` | research-backed |
| Crush | `crush` | `--quiet` required |
| gptme | `gptme` | open-source, self-hosted |

---

## WebSocket protocol

Connect to `ws://127.0.0.1:18900`.

### Chat
```json
{ "type": "send",    "id": "1", "message": "fix auth.ts" }
{ "type": "history", "id": "2" }
{ "type": "agents",  "id": "3" }
{ "type": "health",  "id": "4" }
{ "type": "clear",   "id": "5" }
{ "type": "diff",    "id": "6" }
{ "type": "queue",   "id": "7" }
```

### PTY terminal
```json
{ "type": "pty_spawn",  "id": "1", "agentId": "pi", "cmd": ["pi","--no-color"] }
{ "type": "pty_input",  "sessionId": "s1", "data": "\r" }
{ "type": "pty_resize", "sessionId": "s1", "cols": 220, "rows": 50 }
{ "type": "pty_kill",   "sessionId": "s1" }
{ "type": "pty_list",   "id": "2" }
```

### RPC sessions (pi --mode rpc)
```json
{ "type": "rpc_new",    "id": "1", "sessionId": "my-session", "cwd": "/repo" }
{ "type": "rpc_prompt", "id": "2", "sessionId": "my-session", "message": "refactor X" }
{ "type": "rpc_abort",  "sessionId": "my-session" }
{ "type": "rpc_kill",   "sessionId": "my-session" }
{ "type": "rpc_list",   "id": "3" }
```

### Agent Teams
```json
{ "type": "teams_list",        "id": "1" }
{ "type": "teams_create",      "id": "2", "preset": "review", "teamName": "my-review" }
{ "type": "teams_spawn",       "id": "3", "teamName": "my-review", "cwd": "/repo" }
{ "type": "teams_watch",       "id": "4", "teamName": "my-review" }
{ "type": "teams_task_update", "id": "5", "teamName": "my-review", "taskId": "t1", "updates": {"status":"completed"} }
{ "type": "teams_message",     "id": "6", "teamName": "my-review", "from": "lead", "to": "security-reviewer", "content": "..." }
{ "type": "teams_broadcast",   "id": "7", "teamName": "my-review", "from": "lead", "content": "..." }
```

---

## Agent Teams

pi-builder drives Claude Code's [Agent Teams](https://code.claude.com/docs/en/agent-teams) via the filesystem protocol:

- `~/.claude/teams/{name}/config.json` — member registry
- `~/.claude/tasks/{name}/*.json` — tasks with status/owner/deps
- `~/.claude/teams/{name}/inbox/{member}/` — inter-agent messages

**7 presets** (from [wshobson/agents](https://github.com/wshobson/agents)):

| Preset | Team | Use case |
|--------|------|----------|
| `review` | 3 reviewers | Security + performance + architecture review |
| `debug` | 3 investigators | Competing-hypotheses debugging (ACH method) |
| `feature` | lead + 2 implementers | Parallel feature dev with file ownership |
| `fullstack` | lead + frontend + backend + tests | Cross-layer feature |
| `research` | 3 researchers | Parallel codebase + web research |
| `security` | 4 reviewers | OWASP + auth + deps + secrets audit |
| `migration` | lead + 2 impl + verifier | Large refactor / framework migration |

Enable Agent Teams in Claude Code:
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
# or in ~/.claude/settings.json: { "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" } }
```

---

## Tests

```bash
npx vitest run packages/core
# 41 files, 1030 pass, 3 skipped
```

---

## Status

| Component | Status |
|-----------|--------|
| 11 agent wrappers | ✅ |
| WS gateway (chat, health, history, queue, diff) | ✅ |
| Browser UI (4-tab: Chat / Sessions / Teams / Terminal) | ✅ |
| CLI (start / agents / run) | ✅ |
| SQLite session persistence | ✅ |
| Input transform middleware + `@agent` routing | ✅ |
| Message queue (drain after each turn) | ✅ |
| Git diff panel | ✅ |
| PTY terminal multiplexer (node-pty + ghostty-web) | ✅ |
| RPC sessions (pi --mode rpc, structured event stream) | ✅ |
| Agent Teams driver (7 presets, task CRUD, messaging) | ✅ |
| Electron desktop app | ✅ |
| Tauri desktop (Rust PTY + git2 worktrees) | ✅ |
| Tauri worktree divergence sidebar | ✅ |
| CI (bun, vitest) | ✅ |
| Release workflow (tag-triggered) | ✅ |

---

Built by Artale. MIT.
