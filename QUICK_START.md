# Pi Builder Quick Start

## 🎯 What's This?

**Pi Builder** is what we're building instead of Auto Maker. Better, open-source, no license bullshit. Multi-platform out of the box.

## 📦 What's Included?

```
pi-builder/
├── packages/           # Shared code
│   ├── core            # Main builder engine
│   ├── types           # TypeScript types
│   └── utils           # Helper functions
├── apps/               # Platform apps
│   ├── web             # Next.js web UI
│   ├── cli             # Command-line tool
│   └── desktop         # Electron/Tauri
└── scripts/            # Build & dev tools
```

## 🚀 First Time Setup

```bash
cd pi-builder
npm install
npm run build:packages
```

## 💻 Development

```bash
# Start everything
npm run dev

# Or specific platforms
npm run dev:web        # Web UI on localhost:3000
npm run dev:cli        # CLI development
npm run dev:desktop    # Desktop app
```

## 🧪 Testing & Quality

```bash
npm test               # Run all tests
npm run typecheck      # TypeScript check
npm run lint           # Check code style
npm run lint:fix       # Auto-fix style
```

## 📝 Building

```bash
npm run build          # Build all apps
npm run build:packages # Build just core packages
```

## 🤖 AI Integration (Next)

The `CodeGenerator` class is ready to hook up to Claude API:

```typescript
import { CodeGenerator } from '@pi-builder/core'

const gen = new CodeGenerator(process.env.CLAUDE_API_KEY)
const result = await gen.generate({
  prompt: 'Generate a React component for a form',
  language: 'typescript',
  framework: 'react'
})
```

## 📱 Supported Platforms

- ✅ **Web**: React + Next.js (localhost:3000)
- ✅ **Desktop**: Electron + Tauri
- ✅ **Mobile**: React Native (coming)
- ✅ **CLI**: Command-line tool

## 🔑 Environment Variables

Create `.env` file:

```env
CLAUDE_API_KEY=sk-...
DEBUG=true             # Optional: enable debug logging
```

## 📚 Key Files

| File | Purpose |
|------|---------|
| `package.json` | Workspace configuration |
| `tsconfig.json` | TypeScript settings |
| `.eslintrc.js` | Linting rules |
| `.prettierrc` | Code formatting |

## 🎓 Next Steps

1. **Understand the architecture**: Read README.md
2. **Explore packages**: Each package has its own src/
3. **Try the CLI**: `npm run cli -- init my-app`
4. **Check test examples**: Look at __tests__/ folders
5. **Join development**: See CONTRIBUTING.md

## 💬 Questions?

- Check package READMEs
- Look at TypeScript types for API docs
- Review test files for usage examples

---

**Remember**: This is open-source with MIT license. No restrictions! 🎉
