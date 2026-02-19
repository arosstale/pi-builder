# AGENTS.md

This file contains conventions and guidelines for AI agents working on the pi-builder repository.

## Repository Overview

**pi-builder** is a TypeScript monorepo (bun workspaces) that orchestrates CLI coding agents. It provides a unified interface over any CLI coding agent with WebSocket protocol support for multi-platform usage.

## Repository Layout

```
pi-builder/
├── packages/
│   ├── core/       # Core orchestration logic, agent wrappers, WebSocket server
│   ├── types/      # Shared TypeScript types
│   └── utils/      # Utility functions
└── apps/
    ├── cli/        # Command-line interface application
    ├── web/        # Web UI (pi-builder-ui.html)
    └── desktop/    # Electron desktop application
```

## Key Files

When working on core functionality, pay attention to these key files:

- **`packages/core/src/integrations/agent-wrappers.ts`** - CLI agent wrapper implementations (claude, aider, opencode, etc.)
- **`packages/core/src/orchestration/orchestrator-service.ts`** - Routes user messages to agents with middleware support
- **`packages/core/src/server/websocket-server.ts`** - WebSocket server (port 18900) using ws library
- **`packages/core/src/db/database.ts`** - SQLite persistence via bun:sqlite (Bun) or better-sqlite3 (Node)

## Build & Test Commands

### Installation
```bash
bun install  # Run at repository root
```

### Testing
```bash
npx vitest run packages/core  # Run core tests (39 test files, 983 passing tests)
npm run test                  # Run all tests
npm run test:watch            # Watch mode
```

### Building
```bash
npm run build                 # Build all packages (typecheck)
npm run build:packages        # Build packages only

# For Electron desktop app:
cd apps/desktop
tsc                          # TypeScript compilation for Electron
```

### Development
```bash
npm run dev:cli              # Run CLI in dev mode
npm run dev:web              # Run web UI in dev mode
npm run dev:desktop          # Run desktop app in dev mode
```

### Linting
```bash
npm run lint                 # Check linting
npm run lint:fix             # Auto-fix linting issues
npm run typecheck            # TypeScript type checking
```

## Code Style

**Strict TypeScript Requirements:**
- TypeScript `strict: true` mode is enabled
- **Never use `any` type** - use proper types or `unknown` with type guards
- 2-space indentation (configured in `.prettierrc`)
- Single quotes for strings
- No semicolons
- Arrow parens: avoid (e.g., `x => x` not `(x) => x`)
- Print width: 100 characters
- Trailing commas: ES5

Example:
```typescript
// ✓ Good
export interface AgentTask {
  prompt: string
  workDir?: string
  timeout?: number
}

function processTask(task: AgentTask): Promise<AgentResult> {
  return orchestrator.execute(task)
}

// ✗ Bad
export interface AgentTask {
  prompt: any;  // Never use any!
  workDir?: any;
}

function processTask(task: any): Promise<any> {  // Bad!
    return orchestrator.execute(task);  // 4 spaces, semicolons
}
```

## Architecture Details

### WebSocket Server
- **Default port:** 18900
- **Protocol:** JSON frames over WebSocket
- Located in `packages/core/src/server/websocket-server.ts`

### Database
- **Type:** SQLite
- **Driver:** `bun:sqlite` (Bun runtime) or `better-sqlite3` (Node.js)
- **Location:** `packages/core/src/db/database.ts`
- Used for session persistence and chat history

### Middleware System
- **Location:** `OrchestratorService.use(fn)`
- **Purpose:** Transform, block, or route prompts before they reach agents
- **Middleware actions:**
  - `pass` - Continue as-is
  - `transform` - Rewrite the prompt
  - `block` - Stop processing with reason
  - `route` - Force a specific agent

Example:
```typescript
orchestrator.use((prompt, ctx) => {
  if (prompt.includes('delete all')) {
    return { action: 'block', reason: 'Destructive operation requires confirmation' }
  }
  return { action: 'pass' }
})
```

## Important Git Conventions

**DO NOT:**
- ❌ Use `git add -A` or `git add .` - Be explicit about which files you're adding
- ❌ Delete files without explicit user confirmation
- ❌ Make sweeping changes across multiple files without incremental commits

**DO:**
- ✓ Add files explicitly: `git add path/to/specific/file.ts`
- ✓ Make small, focused commits
- ✓ Ask for confirmation before deleting files
- ✓ Use `.gitignore` to exclude build artifacts and dependencies

## Workspaces

This is a **bun workspaces** monorepo. Package references:
```json
{
  "workspaces": ["packages/*", "apps/*"]
}
```

Path aliases (defined in `tsconfig.json`):
- `@pi-builder/core` → `packages/core/src`
- `@pi-builder/types` → `packages/types/src`
- `@pi-builder/utils` → `packages/utils/src`

## Testing Philosophy

- Tests are located in `packages/core/__tests__/`
- Test files: `*.test.ts`
- Currently: 39 test files with 983 passing tests
- Run specific tests: `npx vitest run packages/core`
- Use vitest for all testing

## Additional Notes

- Node.js version requirement: `>=20.0.0`
- Module system: ESM (`"type": "module"`)
- Supported CLI agents: aider, claude, codex, crush, gemini, goose, gptme, opencode, plandex, swe-agent
- Health check caching: 30 seconds TTL for agent version checks

---

For more details, see:
- `README.md` - Project overview and quick start
- `CONTRIBUTING.md` - Contribution guidelines
- Individual package `package.json` files for specific dependencies
