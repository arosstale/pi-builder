/**
 * pi-builder — Extension builder for Pi
 *
 * Scaffold, build, test, and publish Pi extensions from inside Pi.
 * The tool that built 82+ packages, productized.
 *
 * Commands:
 *   /build new <name> [--desc <d>]   — scaffold a new extension
 *   /build validate [dir]            — validate extension structure
 *   /build publish [dir]             — git init + gh repo + npm publish
 *   /build audit [dir]               — check API usage, imports, exports
 *   /build list                      — list your published packages
 *
 * Tools:
 *   builder_scaffold  — create extension project structure
 *   builder_validate  — validate extension
 *   builder_publish   — publish to npm
 */

import type { ExtensionAPI } from '@anthropic-ai/claude-code'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { execSync } from 'child_process'
import { homedir } from 'os'

const TEMPLATES = {
  packageJson: (name: string, desc: string, author: string) => JSON.stringify({
    name: `@${author}/${name}`,
    version: '1.0.0',
    description: desc,
    keywords: ['pi-package'],
    license: 'MIT',
    author,
    repository: { type: 'git', url: `https://github.com/${author}/${name}.git` },
    files: ['src/extension.ts'],
    pi: { extensions: ['src/extension.ts'] },
    peerDependencies: { '@mariozechner/pi-coding-agent': '*' },
  }, null, 2),

  extensionTs: (name: string, desc: string) => `/**
 * ${name} — ${desc}
 *
 * Commands:
 *   /${name.replace('pi-', '')} — main command
 *
 * Tools:
 *   ${name.replace(/-/g, '_')}_run — main tool
 */

import type { ExtensionAPI } from '@anthropic-ai/claude-code'

export default function init(pi: ExtensionAPI) {
  pi.addCommand({
    name: '${name.replace('pi-', '')}',
    description: '${desc}',
    handler: async (args) => {
      pi.sendMessage({
        content: '${name} is running! Args: ' + args,
        display: true,
      }, { triggerTurn: false })
    },
  })

  pi.addTool({
    name: '${name.replace(/-/g, '_')}_run',
    description: '${desc}',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Input for the tool' },
      },
    },
    handler: async (params: { input?: string }) => {
      return \`${name} executed with: \${params.input || 'no input'}\`
    },
  })
}
`,

  tsconfig: JSON.stringify({
    compilerOptions: {
      target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
      strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: true,
    },
    include: ['src'],
  }, null, 2),

  readme: (name: string, desc: string, author: string) => `# ${name}\n\n${desc}\n\n## Install\n\n\`\`\`bash\npi install npm:@${author}/${name}\n\`\`\`\n\n## License\n\nMIT\n`,
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

function validateExtension(dir: string): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [], info: [] }

  // Check package.json
  const pkgPath = join(dir, 'package.json')
  if (!existsSync(pkgPath)) {
    result.errors.push('Missing package.json')
    result.valid = false
    return result
  }

  let pkg: any
  try { pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) }
  catch { result.errors.push('Invalid package.json JSON'); result.valid = false; return result }

  if (!pkg.name) { result.errors.push('Missing "name" in package.json'); result.valid = false }
  if (!pkg.version) { result.errors.push('Missing "version"'); result.valid = false }
  if (!pkg.keywords?.includes('pi-package')) { result.warnings.push('Missing "pi-package" keyword — won\'t appear on pi.dev') }
  if (!pkg.description) { result.warnings.push('Missing "description"') }
  if (!pkg.pi?.extensions?.length && !pkg.extensions?.length) { result.warnings.push('No extensions array in pi config') }

  // Check extension source
  const extPaths = pkg.pi?.extensions || pkg.extensions || ['src/extension.ts']
  for (const extPath of extPaths) {
    const fullPath = join(dir, extPath)
    if (!existsSync(fullPath)) {
      result.errors.push(`Extension file not found: ${extPath}`)
      result.valid = false
      continue
    }

    const src = readFileSync(fullPath, 'utf-8')

    // Check export
    if (!src.includes('export default function')) {
      result.errors.push(`${extPath}: Missing "export default function" — extension won't load`)
      result.valid = false
    }

    // Check for old API
    if (src.includes('registerCommand') || src.includes('registerTool')) {
      result.warnings.push(`${extPath}: Uses old API (registerCommand/registerTool) — consider migrating to addCommand/addTool`)
    }

    // Check imports
    if (!src.includes('ExtensionAPI')) {
      result.warnings.push(`${extPath}: No ExtensionAPI import — might not type-check`)
    }

    // Check for common issues
    if (src.includes('require(')) {
      result.warnings.push(`${extPath}: Uses require() — prefer ES imports`)
    }

    // Info
    const lines = src.split('\n').length
    const hasCommands = src.includes('addCommand') || src.includes('registerCommand')
    const hasTools = src.includes('addTool') || src.includes('registerTool')
    const hasEvents = src.includes('pi.on(')
    result.info.push(`${extPath}: ${lines} lines, ${hasCommands ? 'commands' : 'no commands'}, ${hasTools ? 'tools' : 'no tools'}, ${hasEvents ? 'events' : 'no events'}`)
  }

  // Check README
  if (!existsSync(join(dir, 'README.md'))) { result.warnings.push('Missing README.md') }

  // Check tsconfig
  if (!existsSync(join(dir, 'tsconfig.json'))) { result.warnings.push('Missing tsconfig.json') }

  // Check git
  if (!existsSync(join(dir, '.git'))) { result.info.push('Not a git repository') }

  return result
}

function formatValidation(result: ValidationResult, dir: string): string {
  const lines = [`## Validation: ${basename(dir)}`, '']
  lines.push(`**Status:** ${result.valid ? '✅ Valid' : '❌ Invalid'}`)
  lines.push('')

  if (result.errors.length) {
    lines.push('### Errors')
    result.errors.forEach(e => lines.push(`- ❌ ${e}`))
    lines.push('')
  }
  if (result.warnings.length) {
    lines.push('### Warnings')
    result.warnings.forEach(w => lines.push(`- ⚠️ ${w}`))
    lines.push('')
  }
  if (result.info.length) {
    lines.push('### Info')
    result.info.forEach(i => lines.push(`- ℹ️ ${i}`))
  }

  return lines.join('\n')
}

function scaffoldExtension(name: string, desc: string, baseDir: string, author: string): string {
  const dir = join(baseDir, name)
  if (existsSync(dir)) return `Directory already exists: ${dir}`

  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), TEMPLATES.packageJson(name, desc, author))
  writeFileSync(join(dir, 'src', 'extension.ts'), TEMPLATES.extensionTs(name, desc))
  writeFileSync(join(dir, 'tsconfig.json'), TEMPLATES.tsconfig)
  writeFileSync(join(dir, 'README.md'), TEMPLATES.readme(name, desc, author))

  return `Scaffolded **${name}** at \`${dir}\`\n\nFiles:\n- package.json\n- src/extension.ts\n- tsconfig.json\n- README.md\n\nNext:\n1. Edit \`src/extension.ts\`\n2. \`/build validate ${dir}\`\n3. \`/build publish ${dir}\``
}

function publishExtension(dir: string): string {
  const results: string[] = []

  // Validate first
  const validation = validateExtension(dir)
  if (!validation.valid) {
    return `❌ Validation failed. Fix errors first:\n${validation.errors.map(e => `- ${e}`).join('\n')}`
  }

  // Git init if needed
  if (!existsSync(join(dir, '.git'))) {
    try {
      execSync('git init', { cwd: dir, stdio: 'pipe' })
      execSync('git add -A', { cwd: dir, stdio: 'pipe' })
      execSync('git commit -m "feat: initial release"', { cwd: dir, stdio: 'pipe' })
      results.push('✅ Git initialized + committed')
    } catch (e: any) { results.push(`⚠️ Git init: ${e.message.slice(0, 100)}`) }
  }

  // Read package name for gh repo
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'))
  const repoName = basename(dir)

  // Create GitHub repo
  try {
    execSync(`gh repo create ${repoName} --public --source=. --push`, { cwd: dir, stdio: 'pipe', timeout: 60000 })
    results.push(`✅ GitHub repo created + pushed`)
  } catch (e: any) {
    // Repo might already exist
    try {
      execSync('git push', { cwd: dir, stdio: 'pipe', timeout: 30000 })
      results.push('✅ Pushed to existing repo')
    } catch { results.push(`⚠️ GitHub: ${e.message.slice(0, 100)}`) }
  }

  // npm publish
  try {
    execSync('npm publish --access public', { cwd: dir, stdio: 'pipe', timeout: 60000 })
    results.push(`✅ Published ${pkg.name}@${pkg.version} to npm`)
  } catch (e: any) { results.push(`❌ npm publish failed: ${e.message.slice(0, 200)}`) }

  return `## Publish: ${pkg.name}\n\n${results.join('\n')}`
}

function listPublished(author: string): string {
  try {
    const output = execSync(`npm search @${author} --json`, { encoding: 'utf-8', timeout: 30000 })
    const pkgs = JSON.parse(output)
    const lines = [`## Published @${author} packages: ${pkgs.length}`, '']
    for (const p of pkgs.sort((a: any, b: any) => a.name.localeCompare(b.name))) {
      lines.push(`- \`${p.name}\` v${p.version}`)
    }
    return lines.join('\n')
  } catch { return 'Failed to list packages.' }
}

export default function init(pi: ExtensionAPI) {
  const cwd = process.cwd()
  const projectsDir = join(homedir(), 'Projects')

  pi.addCommand({
    name: 'build',
    description: 'Extension builder — scaffold, validate, publish Pi extensions',
    handler: async (args) => {
      const parts = args.trim().split(/\s+/)
      const sub = parts[0]?.toLowerCase()

      if (sub === 'new') {
        const name = parts[1]
        if (!name) { pi.sendMessage({ content: 'Usage: /build new <name> [--desc <description>]', display: true }, { triggerTurn: false }); return }
        const descMatch = args.match(/--desc\s+"([^"]+)"/) || args.match(/--desc\s+(.+)$/)
        const desc = descMatch ? descMatch[1] : `${name} extension for Pi`
        const result = scaffoldExtension(name, desc, projectsDir, 'artale')
        pi.sendMessage({ content: result, display: true }, { triggerTurn: false }); return
      }

      if (sub === 'validate') {
        const dir = parts[1] || cwd
        const result = validateExtension(dir)
        pi.sendMessage({ content: formatValidation(result, dir), display: true }, { triggerTurn: false }); return
      }

      if (sub === 'publish') {
        const dir = parts[1] || cwd
        const result = publishExtension(dir)
        pi.sendMessage({ content: result, display: true }, { triggerTurn: false }); return
      }

      if (sub === 'audit') {
        const dir = parts[1] || cwd
        const result = validateExtension(dir)
        pi.sendMessage({ content: formatValidation(result, dir), display: true }, { triggerTurn: false }); return
      }

      if (sub === 'list') {
        const result = listPublished('artale')
        pi.sendMessage({ content: result, display: true }, { triggerTurn: false }); return
      }

      pi.sendMessage({
        content: [
          '## /build — Extension Builder',
          '',
          '- `/build new <name> [--desc "..."]` — scaffold new extension',
          '- `/build validate [dir]` — validate structure + API usage',
          '- `/build publish [dir]` — git + github + npm publish',
          '- `/build audit [dir]` — deep validation',
          '- `/build list` — list your published packages',
        ].join('\n'),
        display: true,
      }, { triggerTurn: false })
    },
  })

  // Tools
  pi.addTool({
    name: 'builder_scaffold',
    description: 'Scaffold a new Pi extension project with package.json, extension.ts template, tsconfig, README.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Extension name (e.g. pi-mytool)' },
        description: { type: 'string', description: 'What the extension does' },
      },
      required: ['name'],
    },
    handler: async (params: { name: string; description?: string }) => {
      return scaffoldExtension(params.name, params.description || `${params.name} for Pi`, projectsDir, 'artale')
    },
  })

  pi.addTool({
    name: 'builder_validate',
    description: 'Validate a Pi extension project — checks package.json, exports, API usage, imports.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Extension project directory' },
      },
    },
    handler: async (params: { directory?: string }) => {
      const dir = params.directory || cwd
      const result = validateExtension(dir)
      return formatValidation(result, dir)
    },
  })

  pi.addTool({
    name: 'builder_publish',
    description: 'Publish a Pi extension — git init, GitHub repo, npm publish in one step.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Extension project directory' },
      },
    },
    handler: async (params: { directory?: string }) => {
      return publishExtension(params.directory || cwd)
    },
  })
}
