# Start here

## What works right now

```bash
# 1. Check installed agents
bun run apps/cli/src/cli.ts agents

# 2. Start the gateway (serves UI at http://127.0.0.1:18900)
bun run start
# → HTTP: http://127.0.0.1:18900
# → WS:   ws://127.0.0.1:18900

# 3. Open http://127.0.0.1:18900 in your browser
# → Type a prompt → routes to best available agent → streams back

# 4. One-shot from CLI
bun run apps/cli/src/cli.ts run "add error handling to src/main.ts"

# 5. E2E smoke test
bun run smoke
```

## Real files (read these first)

```
packages/core/src/
  integrations/agent-wrappers.ts        11 CLI wrappers + WrapperOrchestrator + RpcSessionManager
  orchestration/orchestrator-service.ts routing, history, SQLite, EventEmitter
  server/websocket-server.ts            WS gateway + HTTP server (serves UI)
  server/pty-manager.ts                 node-pty PTY sessions
  teams/agent-teams.ts                  Agent Teams filesystem driver
  db/database.ts                        SQLite (bun:sqlite / better-sqlite3 fallback)

apps/
  cli/src/cli.ts                        start | agents | run
  web/pi-builder-ui.html                browser chat UI (4 tabs, no build step)
  desktop/src/main.ts                   Electron app (spawns gateway subprocess)
  desktop-tauri/                        Tauri app (Rust PTY + git2 worktrees)
```

## Tests

```bash
npx vitest run packages/core   # 41 files, 1030 pass, 3 skipped
```
