# Start here

## What works right now

```bash
# 1. Check installed agents
npx tsx apps/cli/src/cli.ts agents

# 2. Start the gateway
npx tsx apps/cli/src/cli.ts start
# → Gateway: ws://127.0.0.1:18900

# 3. Open apps/web/pi-builder-ui.html in browser
# → Type a prompt → it routes to best available agent → streams back

# 4. One-shot
npx tsx apps/cli/src/cli.ts run "add error handling to src/main.ts"
```

## Real files (read these)

```
packages/core/src/
  integrations/agent-wrappers.ts       10 CLI wrappers + WrapperOrchestrator
  orchestration/orchestrator-service.ts routing, history, SQLite, EventEmitter
  server/websocket-server.ts           WS gateway, JSON frame protocol
  db/database.ts                       SQLite (bun:sqlite / better-sqlite3)
  code-generator.ts                    Claude API direct (Anthropic + OpenRouter)

apps/
  cli/src/cli.ts                       start | agents | run
  web/pi-builder-ui.html               browser chat UI, no build step needed
```

## Tests

```bash
npx vitest run packages/core   # 38 files, 968 pass
```

## What's next

- Serve `pi-builder-ui.html` from the gateway HTTP server (open `http://localhost:18900`)
- Input transform middleware (intercept/modify prompts before they hit an agent)
- Dynamic wrapper registry (register wrappers at runtime vs hardcoded list)
- Desktop app (`apps/desktop/`)
