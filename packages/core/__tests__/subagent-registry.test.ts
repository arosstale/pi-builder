import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SubagentRegistry } from '../src/orchestration/subagent-registry'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('SubagentRegistry', () => {
  let tempDir: string
  let registry: SubagentRegistry

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = join(tmpdir(), `subagent-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up temp directory
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  })

  describe('empty registry', () => {
    it('should return count 0 when no template dirs exist', () => {
      registry = new SubagentRegistry(tempDir)
      
      expect(registry.count()).toBe(0)
      expect(registry.list()).toEqual([])
      expect(registry.names()).toEqual([])
    })
  })

  describe('.pi/agents/*.md discovery', () => {
    it('should read .pi/agents/*.md files', () => {
      // Create .pi/agents directory
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      // Create a simple markdown file
      const agentFile = join(agentsDir, 'test-agent.md')
      writeFileSync(agentFile, `---
name: test-agent
description: A test agent
---

This is the prompt body.`)
      
      registry = new SubagentRegistry(tempDir)
      
      expect(registry.count()).toBe(1)
      expect(registry.names()).toContain('test-agent')
      
      const template = registry.get('test-agent')
      expect(template).toBeDefined()
      expect(template?.frontmatter.name).toBe('test-agent')
      expect(template?.frontmatter.description).toBe('A test agent')
      expect(template?.promptBody).toBe('This is the prompt body.')
    })
  })

  describe('YAML frontmatter parsing', () => {
    it('should parse name, description, model, and capabilities', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      const agentFile = join(agentsDir, 'build-agent.md')
      writeFileSync(agentFile, `---
name: build-agent
description: Compiles and tests the project
model: claude
capabilities:
  - testing
  - code-generation
---

You are a build agent.`)
      
      registry = new SubagentRegistry(tempDir)
      
      const template = registry.get('build-agent')
      expect(template).toBeDefined()
      expect(template?.frontmatter.name).toBe('build-agent')
      expect(template?.frontmatter.description).toBe('Compiles and tests the project')
      expect(template?.frontmatter.model).toBe('claude')
      expect(template?.frontmatter.capabilities).toEqual(['testing', 'code-generation'])
      expect(template?.promptBody).toBe('You are a build agent.')
    })
  })

  describe('files without frontmatter', () => {
    it('should use filename as name for files without frontmatter', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      const agentFile = join(agentsDir, 'simple-agent.md')
      writeFileSync(agentFile, 'Just a simple prompt without frontmatter.')
      
      registry = new SubagentRegistry(tempDir)
      
      expect(registry.count()).toBe(1)
      expect(registry.names()).toContain('simple-agent')
      
      const template = registry.get('simple-agent')
      expect(template).toBeDefined()
      expect(template?.frontmatter.name).toBe('simple-agent')
      expect(template?.frontmatter.description).toBe('simple-agent')
      expect(template?.promptBody).toBe('Just a simple prompt without frontmatter.')
    })
  })

  describe('.claude/agents/*.md discovery', () => {
    it('should also discover .claude/agents/*.md files', () => {
      // Create both .pi and .claude directories
      const piAgentsDir = join(tempDir, '.pi', 'agents')
      const claudeAgentsDir = join(tempDir, '.claude', 'agents')
      mkdirSync(piAgentsDir, { recursive: true })
      mkdirSync(claudeAgentsDir, { recursive: true })
      
      // Create agent in .pi/agents
      writeFileSync(join(piAgentsDir, 'pi-agent.md'), `---
name: pi-agent
description: Pi agent
---

Pi agent prompt.`)
      
      // Create agent in .claude/agents
      writeFileSync(join(claudeAgentsDir, 'claude-agent.md'), `---
name: claude-agent
description: Claude agent
---

Claude agent prompt.`)
      
      registry = new SubagentRegistry(tempDir)
      
      expect(registry.count()).toBe(2)
      expect(registry.names()).toContain('pi-agent')
      expect(registry.names()).toContain('claude-agent')
      
      const piTemplate = registry.get('pi-agent')
      const claudeTemplate = registry.get('claude-agent')
      
      expect(piTemplate).toBeDefined()
      expect(claudeTemplate).toBeDefined()
      expect(piTemplate?.frontmatter.description).toBe('Pi agent')
      expect(claudeTemplate?.frontmatter.description).toBe('Claude agent')
    })
  })

  describe('reload()', () => {
    it('should re-discover templates after reload', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      // Create initial agent
      writeFileSync(join(agentsDir, 'agent1.md'), `---
name: agent1
description: First agent
---

First prompt.`)
      
      registry = new SubagentRegistry(tempDir)
      expect(registry.count()).toBe(1)
      expect(registry.names()).toContain('agent1')
      
      // Add another agent file
      writeFileSync(join(agentsDir, 'agent2.md'), `---
name: agent2
description: Second agent
---

Second prompt.`)
      
      // Reload to discover new file
      registry.reload()
      
      expect(registry.count()).toBe(2)
      expect(registry.names()).toContain('agent1')
      expect(registry.names()).toContain('agent2')
    })
  })

  describe('list()', () => {
    it('should return all templates', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      writeFileSync(join(agentsDir, 'agent1.md'), `---
name: agent1
---
Prompt 1`)
      
      writeFileSync(join(agentsDir, 'agent2.md'), `---
name: agent2
---
Prompt 2`)
      
      writeFileSync(join(agentsDir, 'agent3.md'), `---
name: agent3
---
Prompt 3`)
      
      registry = new SubagentRegistry(tempDir)
      
      const templates = registry.list()
      expect(templates.length).toBe(3)
      
      const names = templates.map(t => t.frontmatter.name)
      expect(names).toContain('agent1')
      expect(names).toContain('agent2')
      expect(names).toContain('agent3')
    })
  })

  describe('get()', () => {
    it('should return correct template by name', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      writeFileSync(join(agentsDir, 'target-agent.md'), `---
name: target-agent
description: Target description
model: aider
capabilities:
  - bug-fixing
---

Target prompt body.`)
      
      writeFileSync(join(agentsDir, 'other-agent.md'), `---
name: other-agent
---
Other prompt.`)
      
      registry = new SubagentRegistry(tempDir)
      
      const template = registry.get('target-agent')
      expect(template).toBeDefined()
      expect(template?.frontmatter.name).toBe('target-agent')
      expect(template?.frontmatter.description).toBe('Target description')
      expect(template?.frontmatter.model).toBe('aider')
      expect(template?.frontmatter.capabilities).toEqual(['bug-fixing'])
      expect(template?.promptBody).toBe('Target prompt body.')
      
      const otherTemplate = registry.get('other-agent')
      expect(otherTemplate).toBeDefined()
      expect(otherTemplate?.frontmatter.name).toBe('other-agent')
    })

    it('should return undefined for non-existent template', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      registry = new SubagentRegistry(tempDir)
      
      const template = registry.get('non-existent')
      expect(template).toBeUndefined()
    })
  })

  describe('names()', () => {
    it('should return string array of template names', () => {
      const agentsDir = join(tempDir, '.pi', 'agents')
      mkdirSync(agentsDir, { recursive: true })
      
      writeFileSync(join(agentsDir, 'alpha.md'), `---
name: alpha
---
Alpha`)
      
      writeFileSync(join(agentsDir, 'beta.md'), `---
name: beta
---
Beta`)
      
      writeFileSync(join(agentsDir, 'gamma.md'), `---
name: gamma
---
Gamma`)
      
      registry = new SubagentRegistry(tempDir)
      
      const names = registry.names()
      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBe(3)
      expect(names.every(name => typeof name === 'string')).toBe(true)
      expect(names).toContain('alpha')
      expect(names).toContain('beta')
      expect(names).toContain('gamma')
    })
  })
})
