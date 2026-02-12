# Contributing to Pi Builder

Thanks for your interest in contributing! Pi Builder is open-source and welcomes contributions from everyone.

## Code of Conduct

- Be respectful and inclusive
- Avoid hostile or discriminatory language
- Collaborate constructively

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/pi-builder.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feat/your-feature`

## Development Workflow

```bash
# Build all packages
npm run build:packages

# Run tests
npm test

# Run specific platform dev
npm run dev:web
npm run dev:cli
npm run dev:desktop

# Lint and fix
npm run lint:fix
npm run typecheck
```

## Pull Request Process

1. **Keep it focused**: One feature per PR
2. **Test your changes**: Run `npm test` before submitting
3. **Follow the style guide**: Use `npm run lint:fix` for formatting
4. **Write clear commit messages**: Describe the _what_ and _why_
5. **Reference issues**: Link to related issues when applicable

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
feat(cli): add generate command

Implement AI-powered code generation via CLI
using Claude API integration.

Closes #123
```

## Testing

- Write tests for new features
- Ensure all tests pass: `npm test`
- Aim for >80% coverage

## Documentation

- Update README.md for user-facing changes
- Update inline code comments for complex logic
- Add TypeScript comments for public APIs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open an issue or ask in our Discord community.
