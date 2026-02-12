# Pi Builder 🚀

**Beautiful, open-source, unrestricted multi-platform AI code builder.**

A modern replacement for Auto Maker with zero license restrictions. Build apps for web, desktop (Electron/Tauri), mobile (React Native), and CLI—all from one codebase.

## Features

- ✨ **Web UI** - Browser-based code generation and automation
- 🖥️ **Desktop** - Native apps via Electron & Tauri
- 📱 **Mobile** - React Native support (iOS/Android)
- 🔧 **CLI** - Command-line code generation tool
- 🤖 **AI-Powered** - Claude integration for intelligent code generation
- 📦 **Multi-Platform** - Single source, compile to any platform
- 🔓 **MIT License** - No restrictions on commercial use, monetization, or deployment

## Get Started

```bash
# Clone and install
git clone https://github.com/yourusername/pi-builder.git
cd pi-builder
npm install

# Development
npm run dev:web      # Start web UI dev server
npm run dev:desktop  # Start desktop dev
npm run dev:cli      # CLI development

# Production
npm run build
```

## Architecture

```
pi-builder/
├── packages/
│   ├── @pi-builder/core       # Core engine
│   ├── @pi-builder/types      # Shared types
│   ├── @pi-builder/prompts    # AI prompts
│   └── @pi-builder/utils      # Utilities
├── apps/
│   ├── web/                   # Next.js/React web UI
│   ├── desktop/               # Electron + Tauri desktop
│   ├── mobile/                # React Native
│   └── cli/                   # Node.js CLI tool
└── scripts/
    └── dev.mjs                # Dev orchestration
```

## Why Pi Builder?

| Feature | Auto Maker | Pi Builder |
|---------|-----------|-----------|
| **License** | Custom (restrictive) | MIT (unrestricted) |
| **Monetization** | Requires Core Contributor vote | ✅ Free to monetize |
| **Hosting/SaaS** | Not allowed | ✅ Deploy anywhere |
| **Forks/Derivatives** | Limited | ✅ Full freedom |
| **Commercial Use** | Restricted | ✅ Unrestricted |
| **Multi-Platform** | Electron only | Web + Desktop + Mobile + CLI |

## Development Workflow

```bash
# Install dependencies
npm install

# Build shared packages
npm run build:packages

# Watch mode (all platforms)
npm run dev

# Individual platform development
npm run dev:web      # Port 3000
npm run dev:desktop  # Electron dev
npm run dev:cli      # Node dev

# Testing
npm run test
npm test:watch

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run typecheck
```

## Project Status

- 🚧 **Phase 1**: Core architecture & package setup
- 🚧 **Phase 2**: Web UI foundation
- 🚧 **Phase 3**: Desktop & mobile apps
- 🚧 **Phase 4**: AI integration & automation

## License

MIT License - Use freely for any purpose, including commercial projects.

---

**Built with 💜 by Artale** - No restrictions, full freedom.
