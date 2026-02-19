# Pi Builder

**Unified CLI agent orchestration layer for coding tasks**

## What It Does

Pi Builder routes coding tasks to any installed CLI agent (Claude Code, Aider, OpenCode, etc.) with capability-based routing, health caching, and automatic fallback. It provides a WebSocket gateway, streaming execution, and a single-file web UI—no framework overhead.

## Quick Start

```bash
# Option 1: Install globally
npm install -g @pi-builder/cli

# Option 2: Clone and install
git clone https://github.com/arosstale/pi-builder.git && cd pi-builder && bun install

# Start the gateway
pi-builder start
```

## Supported Agents

| Agent | Binary | Key Capabilities |
|-------|--------|-----------------|
| Claude Code | `claude` | code-generation, refactoring, testing, explanation |
| Aider | `aider` | pair-programming, refactoring, testing, git-aware |
| OpenCode | `opencode` | code-generation, multi-provider, lsp-aware |
| Codex CLI | `codex` | code-generation, command-execution, repo-tasks |
| Gemini CLI | `gemini` | code-generation, research, large-context |
| Goose | `goose` | code-generation, execution, testing, mcp |
| Plandex | `plandex` | plan-first, multi-file, structured-steps |
| SWE-agent | `sweagent` | bug-fixing, issue-resolution, pr-tasks |
| Crush | `crush` | code-generation, lsp-aware, multi-model |
| gptme | `gptme` | code-generation, web-browsing, file-management |

## Architecture

```
┌─────────────┐
│   Web UI    │  apps/web/pi-builder-ui.html (single-file, no build)
│  (Browser)  │
└──────┬──────┘
       │ WebSocket (port 18900)
       ↓
┌─────────────────────────────────────────────────────────────────┐
│  PiBuilderGateway  (packages/core/src/server/)                  │
│  ├─ WebSocket Server                                            │
│  └─ OrchestratorService + EventEmitter streaming                │
└──────┬──────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────────────┐
│  WrapperOrchestrator  (packages/core/src/integrations/)         │
│  ├─ Health check (30s TTL via --version)                        │
│  ├─ Capability-based routing                                    │
│  ├─ Fallback (try next best on failure)                         │
│  └─ SQLite persistence (better-sqlite3)                         │
└──────┬──────────────────────────────────────────────────────────┘
       ↓
  [claude|aider|opencode|codex|gemini|goose|plandex|swe-agent|crush|gptme]
```

## CLI Reference

```bash
# Start gateway + show available agents
pi-builder start

# Health check all 10 agents
pi-builder agents

# One-shot prompt to best available agent
pi-builder run "add unit tests to src/utils.ts"
```

## Web UI

After running `pi-builder start`, open `apps/web/pi-builder-ui.html` in your browser. The gateway runs on `ws://127.0.0.1:18900` by default. No build step required.

## Development

```bash
# Install dependencies
bun install

# Run tests
npx vitest run packages/core

# Type check
npx tsc --noEmit

# Build packages
npm run build:packages
```

## License

MIT License
