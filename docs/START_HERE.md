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
  integrations/agent-wrappers.ts        10 CLI wrappers + WrapperOrchestrator
  orchestration/orchestrator-service.ts routing, history, SQLite, EventEmitter
  server/websocket-server.ts            WS gateway + HTTP server (serves UI)
  db/database.ts                        SQLite (bun:sqlite / better-sqlite3 fallback)
  integrations/pi-agent-sdk.ts          @mariozechner/pi-coding-agent SDK wrapper

apps/
  cli/src/cli.ts                        start | agents | run
  web/pi-builder-ui.html                browser chat UI (no build step)
  desktop/src/main.ts                   Electron app (spawns gateway subprocess)
```

## Tests

```bash
npx vitest run packages/core   # 40 files, 993 pass
```

## What's in progress

- Optional WS auth (`authToken` in `GatewayConfig`) — Copilot PR #6
- Electron build CI — Copilot PR #7
- pi-mono contributions (#1533, #1487) — branches ready, posting Feb 23
