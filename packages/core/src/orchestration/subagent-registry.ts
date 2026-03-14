/**
 * SubagentRegistry
 *
 * Discovers and loads subagent templates from the filesystem.
 * Inspired by the TAC course subagent_loader.py pattern.
 *
 * Templates live in:
 *   <workDir>/.pi/agents/*.md        (pi-builder convention)
 *   <workDir>/.claude/agents/*.md    (Claude Code convention — also supported)
 *
 * Template format (markdown with YAML frontmatter):
 *
 *   ---
 *   name: build-agent
 *   description: Compiles and tests the project
 *   model: claude           # optional — which CLI agent to use
 *   capabilities:           # optional — override capability matching
 *     - testing
 *     - code-generation
 *   ---
 *
 *   You are a build agent. Your job is to...
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubagentFrontmatter {
  name: string
  description: string
  model?: string           // preferred CLI agent id (claude, aider, opencode, …)
  capabilities?: string[]
  tools?: string[]         // allowed tools hint
}

export interface SubagentTemplate {
  frontmatter: SubagentFrontmatter
  promptBody: string
  filePath: string
}

// ---------------------------------------------------------------------------
// SubagentRegistry
// ---------------------------------------------------------------------------

export class SubagentRegistry {
  private templates = new Map<string, SubagentTemplate>()
  private workDir: string

  constructor(workDir: string) {
    this.workDir = workDir
    this.discover()
  }

  // ---------------------------------------------------------------------------
  // Discovery
  // ---------------------------------------------------------------------------

  private discover(): void {
    const searchPaths = [
      join(this.workDir, '.pi', 'agents'),
      join(this.workDir, '.claude', 'agents'),
    ]

    for (const dir of searchPaths) {
      if (!existsSync(dir)) continue
      try {
        const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
        for (const file of files) {
          try {
            const tmpl = this.parse(join(dir, file))
            if (tmpl) this.templates.set(tmpl.frontmatter.name, tmpl)
          } catch {
            // Skip malformed templates silently
          }
        }
      } catch {
        // Directory not readable — skip
      }
    }
  }

  private parse(filePath: string): SubagentTemplate | null {
    const raw = readFileSync(filePath, 'utf-8')

    // Extract YAML frontmatter between --- delimiters
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
    if (!fmMatch) {
      // No frontmatter — use filename as name, whole file as body
      const name = basename(filePath, '.md')
      return {
        frontmatter: { name, description: name },
        promptBody: raw.trim(),
        filePath,
      }
    }

    const [, yamlStr, body] = fmMatch
    const frontmatter = parseSimpleYaml(yamlStr)

    if (!frontmatter.name) {
      frontmatter.name = basename(filePath, '.md')
    }
    if (!frontmatter.description) {
      frontmatter.description = frontmatter.name
    }

    return {
      frontmatter: frontmatter as unknown as SubagentFrontmatter,
      promptBody: body.trim(),
      filePath,
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  get(name: string): SubagentTemplate | undefined {
    return this.templates.get(name)
  }

  list(): SubagentTemplate[] {
    return [...this.templates.values()]
  }

  names(): string[] {
    return [...this.templates.keys()]
  }

  count(): number {
    return this.templates.size
  }

  /** Reload templates from disk */
  reload(): void {
    this.templates.clear()
    this.discover()
  }
}

// ---------------------------------------------------------------------------
// Minimal YAML parser (handles key: value and key:\n  - item lists)
// ---------------------------------------------------------------------------

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (!kvMatch) { i++; continue }

    const [, key, val] = kvMatch

    if (val.trim() === '') {
      // Possibly a list follows
      const items: string[] = []
      i++
      while (i < lines.length && lines[i].match(/^\s+-\s+(.+)/)) {
        const m = lines[i].match(/^\s+-\s+(.+)/)
        if (m) items.push(m[1].trim())
        i++
      }
      result[key] = items.length > 0 ? items : undefined
    } else {
      result[key] = val.trim().replace(/^['"]|['"]$/g, '') // strip quotes
      i++
    }
  }

  return result
}
