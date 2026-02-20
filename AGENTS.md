# AGENTS.md

Conventions for AI agents working on pi-builder.

Read the codebase first. This file fills gaps the code can't answer.

---

## What pi-builder is

A local-first WebSocket gateway that routes prompts across any installed CLI coding agent (pi, claude, codex, gemini, aider, opencode, crush, …). One interface, any agent, automatic fallback.

**Not** a chat UI wrapper. **Not** a cloud service. The orchestration layer runs on your machine.

---

## Layout

```
pi-builder/
├── packages/core/src/
│   ├── integrations/
│   │   ├── agent-wrappers.ts      # BaseAgentWrapper + 11 concrete wrappers + WrapperOrchestrator
│   │   └── pi-agent-sdk.ts        # PiAgentWrapper — pi SDK in-process (no subprocess)
│   ├── orchestration/
│   │   └── orchestrator-service.ts # OrchestratorService — middleware, routing, history, queue
│   ├── server/
│   │   └── websocket-server.ts    # PiBuilderGateway — HTTP + WS on port 18900
│   └── db/
│       └── database.ts            # SQLite — bun:sqlite (Bun) / in-memory shim (Node)
├── apps/
│   ├── cli/src/cli.ts             # start / agents [--json] / run commands
│   ├── web/pi-builder-ui.html     # Single-file web UI (agent bar, queue badge, diff panel)
│   └── desktop/src/main.ts        # Electron — spawns bun subprocess for gateway
├── scripts/
│   ├── reflect.sh                 # Pre-push gate (Mitsuhiko's rule)
│   └── smoke-test.mjs             # E2E WebSocket smoke test
└── docs/
    ├── START_HERE.md
    └── pi-mono-discord-proposal.md
```

---

## Commands

```bash
bun install                        # install (bun workspaces, no npm/yarn)
bun run start                      # start gateway at http://127.0.0.1:18900/
bun run apps/cli/src/cli.ts agents # list available agents + health
bun run typecheck                  # tsc --noEmit
npx vitest run packages/core       # run tests (40 files, 1000 pass, 3 skipped)
bun run reflect                    # pre-push gate — run before every push
bun scripts/smoke-test.mjs         # e2e WebSocket test
```

**Never** use `bun test` — it doesn't set VITEST=true and breaks better-sqlite3 detection.

---

## Architecture

### Agent wrappers (`agent-wrappers.ts`)

Each wrapper extends `BaseAgentWrapper`:
- `health()` → `version()` → `execFileAsync(binary, ['--version'], {timeout:3000})`
- `execute(task)` → spawn + collect stdout
- `executeStream(task)` → AsyncGenerator yielding chunks

Special cases:
- **GeminiCLIWrapper** overrides `version()` — `gemini --version` hangs indefinitely, so we kill after 2s and resolve with buffered stdout on close.
- **PiAgentWrapper** — uses `@mariozechner/pi-coding-agent` SDK in-process via `createAgentSession()`. No subprocess. Always preferred when available.

`WrapperOrchestrator` manages the pool: 30s health cache, `preferredAgents` ordering, capability matching, fallback chain.

### OrchestratorService (`orchestrator-service.ts`)

Single session per gateway instance. Key properties:
- `history: ChatMessage[]` — in-memory + persisted to `pi_chat_history` SQLite table when `dbPath` is set
- `messageQueue` — messages received while `isExecuting` are queued and drained sequentially via `_drainQueue()` after each turn
- `middleware: MiddlewareFn[]` — built-in: `@agent prefix` routing (`@claude fix auth.ts` → routes to claude wrapper)

Message flow: `processMessage()` → queue if busy → `_processMessageNow()` → middleware → select wrapper → `executeStream()` → persist → emit events → drain queue.

### WebSocket server (`websocket-server.ts`)

Port 18900. HTTP serves `apps/web/pi-builder-ui.html` at `GET /`.

Protocol frames (client → server):
```
{ type: "send",    message: string }     # prompt
{ type: "agents"  }                      # list available agents
{ type: "health"  }                      # health check all agents
{ type: "history" }                      # get full chat history
{ type: "clear"   }                      # clear history
{ type: "diff"    }                      # get git diff HEAD --stat
{ type: "queue"   }                      # get pending message queue
```

Protocol frames (server → client):
```
{ type: "hello",        sessionId }
{ type: "user_message", message }
{ type: "agent_start",  agent, task }
{ type: "chunk",        agent, text }
{ type: "agent_end",    agent, status, durationMs }
{ type: "turn_complete",message, agentResult }
{ type: "queued",       queueLength, preview }
{ type: "diff",         diff: string|null }
{ type: "agents",       list: AgentInfo[] }
{ type: "health",       agents: Record<string,boolean> }
{ type: "history",      messages: ChatMessage[] }
{ type: "error",        message }
{ type: "ok",           method }
```

Optional auth: `GatewayConfig.authToken` — Bearer token for HTTP, `?token=` query param or Authorization header for WS. Localhost (`127.0.0.1` / `::1`) bypasses auth by default.

### Web UI (`apps/web/pi-builder-ui.html`)

Single HTML file, no build step. Key JS state:
- `pinnedAgent` — null = Auto, string = agent id. Pinned agent prepends `@agentid ` to messages.
- `queueCount` — pending messages while agent is running. Shows amber badge on Send.
- Sidebar: agent health dots + git diff panel. Auto-opens when first diff arrives.
- On WS connect: sends `{type:"history"}` to restore session.

---

## Code style

- TypeScript strict mode. No `any`. No `as never` / `as unknown` without a comment explaining why.
- 2-space indent, single quotes, no semicolons, 100 char line width.
- ESM (`"type": "module"`). Named exports. No barrel re-exports that break tree-shaking.
- Error paths must be handled. No silent swallowing.
- When uncertain about a type or behavior: add a `// TODO:` and read the source. Honest gap > hallucinated boilerplate.

---

## Pre-push gate

Before every `git push`, run:

```bash
bun run reflect
```

This runs: diff stat → type cast audit → typecheck → tests → import check → final diff read.

The self-review is a separate pass from the one that wrote the code. The question is "is this correct?" not "does this match what I intended?" — those are different questions.

---

## Git conventions

- Stage explicitly: `git add path/to/file.ts` — never `git add -A` or `git add .`
- Never delete files without confirmation — archive instead
- Commit format: `<type>(<scope>): <summary>` then blank line then body
- Types: `feat` / `fix` / `docs` / `refactor` / `chore` / `test` / `perf`
- Body always present unless trivial typo — explain what, why, decisions made

---

## What's in progress / known gaps

- Session persistence only works with file-backed SQLite (`dbPath`). Default `:memory:` loses history on restart.
- Mobile / relay: not implemented. Happier has this. We don't yet.
- Git diff is `--stat` only (summary). Full patch view not in UI yet.
- `crush` and `opencode` wrappers spawn real subprocesses — their non-interactive flags may need tuning per version.
