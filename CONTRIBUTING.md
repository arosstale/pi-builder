# Contributing to Pi Builder

Thanks for your interest in contributing! Pi Builder is open-source and welcomes contributions from everyone.

## Code of Conduct

- Be respectful and inclusive
- Avoid hostile or discriminatory language
- Collaborate constructively

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/pi-builder.git`
3. Install dependencies: `bun install`
4. Create a feature branch: `git checkout -b feat/your-feature`

## Development Workflow

```bash
# Start the gateway
bun run start

# Run tests
npx vitest run packages/core

# Typecheck
bun run typecheck

# Lint and fix
bun run lint:fix

# Pre-push gate (Mitsuhiko's rule)
bash scripts/reflect.sh
```

## Pull Request Process

1. **Keep it focused**: One feature per PR
2. **Test your changes**: Run `npx vitest run packages/core` before submitting
3. **Run the pre-push gate**: `bash scripts/reflect.sh`
4. **Follow the style guide**: 2-space indent, single quotes, no semicolons
5. **Write clear commit messages**: Describe the _what_ and _why_
6. **Reference issues**: Link to related issues when applicable

## Commit Message Format

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Test additions/changes
- `chore`: Build, CI, dependencies

**Example:**
```
feat(gateway): add RPC session persistence

Store RPC session state in SQLite so sessions
survive gateway restarts.

Closes #123
```

## Testing

- Write tests for new features
- Run `npx vitest run packages/core` — never `bun test`
- Ensure all tests pass before opening a PR

## Code Style

- TypeScript strict mode. No `any`.
- 2-space indent, single quotes, no semicolons, 100 char line width
- ESM (`"type": "module"`). Named exports only.
- Stage explicitly: `git add path/to/file.ts` — never `git add -A`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
