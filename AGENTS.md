# AGENTS.md

Conventions for AI agents working on pi-builder.

Read the codebase before editing. This file fills gaps the code can't answer.

---

## What pi-builder is

A local-first WebSocket gateway that routes prompts across any installed CLI coding agent. One interface, any agent, automatic fallback. Also drives Claude Code Agent Teams via the filesystem protocol, runs pi in structured RPC mode, and provides a PTY terminal multiplexer with a ghostty-web WASM renderer.

**Not** a chat UI wrapper. **Not** a cloud service. Everything runs on your machine.

---

## Layout

```
pi-builder/
├── packages/core/src/
│   ├── integrations/
│   │   └── agent-wrappers.ts      # BaseAgentWrapper + 11 wrappers + WrapperOrchestrator
│   │                              #   + RpcSessionManager (pi --mode rpc long-lived sessions)
│   ├── orchestration/
│   │   └── orchestrator-service.ts # middleware, routing, history, message queue
│   ├── server/
│   │   ├── websocket-server.ts    # PiBuilderGateway — HTTP + WS (chat/PTY/RPC/Teams)
│   │   └── pty-manager.ts         # node-pty PTY sessions
│   ├── teams/
│   │   └── agent-teams.ts         # AgentTeamsDriver — ~/.claude/teams/ filesystem protocol
│   └── db/
│       └── database.ts            # SQLite (bun:sqlite in Bun, in-memory shim in Node)
├── apps/
│   ├── cli/src/cli.ts             # start / agents [--json] / run
│   ├── web/pi-builder-ui.html     # Single-file browser UI (4 tabs, no build step)
│   ├── desktop/src/main.ts        # Electron — spawns bun gateway subprocess
│   └── desktop-tauri/             # Tauri — Rust PTY (portable-pty) + git2 worktrees + React
├── scripts/
│   ├── reflect.sh                 # Pre-push gate (Mitsuhiko's rule)
│   └── smoke-test.mjs             # E2E WebSocket smoke test
└── docs/
    └── pi-mono-discord-proposal.md
```

---

## Commands

```bash
bun install                        # install (bun workspaces — never npm/yarn)
npx tsx apps/cli/src/cli.ts start  # start gateway at http://127.0.0.1:18900/
npx tsx apps/cli/src/cli.ts agents # list available agents + health
npx vitest run packages/core       # run tests (41 files, 1030 pass, 3 skipped)
bun run typecheck                  # tsc --noEmit
bash scripts/reflect.sh            # pre-push gate (run before every push)
node scripts/smoke-test.mjs        # e2e WebSocket smoke test
```

**Never use `bun test`** — it doesn't set `VITEST=true`, breaks `better-sqlite3` detection, and vitest's `vi.mock` is not available.

---

## Architecture

### Agent wrappers (`agent-wrappers.ts`)

Each wrapper extends `BaseAgentWrapper`:
- `health()` → `version()` → `execFileAsync(binary, ['--version'], { timeout: 3000 })`
- `execute(task)` → spawn, collect stdout → `{ output, status, durationMs }`
- `executeStream(task)` → `AsyncGenerator<string>` yielding chunks

Special cases:
- **PiAgentWrapper** — uses `pi --mode rpc` subprocess via `RpcClient`. One isolated process per task. `loadRpcClient()` uses `createRequire(import.meta.url)` to load `@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-client.js` (bypasses the package `exports` restriction). Always preferred when `pi` is available.
- **GeminiCLIWrapper** — `gemini --version` hangs; kills after 2s and resolves on close.
- **CrushWrapper** — requires `--quiet` flag to suppress TUI spinner.

`WrapperOrchestrator` manages the pool: 30s health TTL, `preferredAgents` ordering, capability matching, fallback chain.

### RpcSessionManager (`agent-wrappers.ts`)

Long-lived named pi sessions. Each session has one `RpcClient` subprocess (via `pi --mode rpc`).

```typescript
const mgr = new RpcSessionManager()
await mgr.create('my-session', { cwd: '/repo' })
await mgr.prompt('my-session', 'refactor auth.ts')
// events come via mgr.on('event', (sessionId, agentEvent) => ...)
await mgr.kill('my-session')
```

Events emitted: `event(sessionId, agentEvent)`, `idle(sessionId)`, `killed(sessionId)`.

### OrchestratorService (`orchestrator-service.ts`)

Single session per gateway. Key behaviour:
- `history: ChatMessage[]` — in-memory + SQLite `pi_chat_history` table when `dbPath` is set
- `messageQueue` — drained sequentially via `_drainQueue()` after each turn
- Middleware: `@agent prefix` routing — `@claude fix auth.ts` pins to the `claude` wrapper

### WebSocket server (`websocket-server.ts`)

Port 18900. HTTP serves `apps/web/pi-builder-ui.html` at `GET /` with COOP/COEP headers (required for ghostty-web `SharedArrayBuffer`).

Frame namespaces:
- **Chat**: `send, health, agents, history, clear, diff, queue`
- **PTY**: `pty_spawn, pty_input, pty_resize, pty_kill, pty_list`
- **RPC**: `rpc_new, rpc_prompt, rpc_abort, rpc_kill, rpc_list`
- **Teams**: `teams_list, teams_create, teams_spawn, teams_task_update, teams_message, teams_broadcast, teams_watch, teams_delete`

### AgentTeamsDriver (`teams/agent-teams.ts`)

Reads/writes Claude Code Agent Teams filesystem protocol:
- `~/.claude/teams/{name}/config.json` — `TeamConfig` (members, teamId, createdAt)
- `~/.claude/tasks/{name}/*.json` — `AgentTask` (id, subject, status, owner, blockedBy)
- `~/.claude/teams/{name}/inbox/{member}/` — `TeamMessage` files

Key API:
```typescript
driver.createTeamFromPreset('review', 'my-review')   // writes config.json + inbox dir
driver.createTask('my-review', { subject: '...', status: 'pending' })
driver.updateTask('my-review', taskId, { status: 'in_progress', owner: 'security-reviewer' })
driver.sendMessage('my-review', { type: 'message', from: 'lead', to: 'reviewer-1', content: '...' })
driver.broadcast('my-review', 'lead', 'Critical update')
driver.spawnTeam('my-review', prompt, { cwd, teammateMode: 'in-process' })
driver.watch('my-review')   // polls task files every 2s, emits tasks:changed
```

7 presets: `review, debug, feature, fullstack, research, security, migration`

Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the environment for claude to use Agent Teams tools.

### PTY manager (`server/pty-manager.ts`)

Real pseudo-terminal sessions via `node-pty`. Each session gets its own PTY with resize support. The gateway routes `pty_data` frames to all WS clients; `pty_exit` marks sessions dead.

### Web UI (`apps/web/pi-builder-ui.html`)

Single HTML file, no build step. 4 tabs:

| Tab | Pane | Key elements |
|-----|------|--------------|
| Chat | `<main>` | message stream, agent pill bar, git diff sidebar |
| Sessions | `#rpc-pane` | session list, structured event stream, prompt textarea |
| Teams | `#teams-pane` | team list, member cards, progress bar, task cards, msg bar |
| Terminal | `#terminal-pane` | ghostty-web WASM, one container per PTY session |

`window.switchView(view)` — canonical implementation in the RPC script block. Terminal module patches on top with `fitTerm` side-effect.

Key state:
- `pinnedAgent` — null = Auto; string = agent id. Prepends `@agentid ` to messages.
- `queueCount` — pending messages while busy. Shows badge on Send button.
- `rpcSessions: Map<string, {alive, events[]}>` — in-memory event replay on session switch.
- `teamsState: Map<string, TeamState>` — latest team/task data.

---

## Code style

- TypeScript strict mode. No `any`. No `as never` / `as unknown` without explaining why.
- 2-space indent, single quotes, no semicolons, 100 char line width.
- ESM (`"type": "module"`). Named exports only.
- All error paths handled. No silent swallowing.
- When uncertain: add `// TODO:` and read the source. Honest gap > hallucinated boilerplate.
- Stage explicitly: `git add path/to/file.ts` — never `git add -A` or `git add .`

---

## Pre-push gate

```bash
bash scripts/reflect.sh
```

Runs: diff stat → type cast audit → typecheck → tests → import check → final diff read.

The self-review is a separate cognitive pass from the one that wrote the code. "Is this correct?" is a different question from "does this match what I intended?"

---

## Known gaps / next items

- Git diff panel: **stat** (default) and **full patch** (syntax-colored unified diff) both implemented.
  `diff_full` frame returns `{ patch, stat }` — toggle via stat/full buttons in sidebar.
- `teams_output`: surfaced in Teams detail panel below member cards. Auto-shown on spawn, cleared on team switch.
- `researcher` and `context-builder` agents: copied from `pi-subagents` to `~/.pi/agent/agents/` — 7 agents total.
- Tauri `cargo build` only tested on Windows. Linux/macOS Rust deps may differ.
- Mobile / relay mode: not implemented.
- `crush` and `opencode` non-interactive flags may need tuning per CLI version.
- Thread engine sends `/chain --no-clarify` via RPC but pi-subagents chain clarify TUI runs in the subprocess terminal — works fine in PTY terminal mode, skipped in pure RPC mode via `skipClarify: true`.
