# pi-builder

Extension builder for Pi. Scaffold, validate, and publish Pi extensions from inside Pi.

The tool that built 82+ packages, productized.

## Install

```bash
pi install npm:@artale/pi-builder
```

## Commands

```
/build new <name> [--desc "..."]   — scaffold a new extension
/build validate [dir]              — validate structure + API usage
/build publish [dir]               — git init + GitHub repo + npm publish
/build audit [dir]                 — deep validation
/build list                        — list your published packages
```

## What `/build new` creates

```
pi-myext/
├── package.json        # name, version, pi-package keyword, pi config
├── src/extension.ts    # working template with addCommand + addTool
├── tsconfig.json       # ES2022, bundler resolution
└── README.md           # install instructions
```

## What `/build validate` checks

- ✅ package.json exists and is valid
- ✅ `pi-package` keyword present
- ✅ Extension file exists
- ✅ `export default function` present
- ✅ No old API usage (registerCommand/registerTool)
- ✅ Proper imports
- ⚠️ Missing README, tsconfig
- ℹ️ Line count, commands, tools, events

## What `/build publish` does

1. Validates the extension
2. `git init` + `git add -A` + `git commit`
3. `gh repo create` (public, push)
4. `npm publish --access public`

All in one command.

## Tools

- `builder_scaffold` — create extension project
- `builder_validate` — validate extension
- `builder_publish` — publish to npm

## The workflow

```
/build new pi-awesome --desc "Something awesome"
# Edit src/extension.ts
/build validate ~/Projects/pi-awesome
/build publish ~/Projects/pi-awesome
```

Three commands. Scaffold → code → ship.

## License

MIT
