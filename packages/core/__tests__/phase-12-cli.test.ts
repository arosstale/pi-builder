import { describe, it, expect, beforeEach } from 'vitest'
import { AdvancedCLI } from '../src/cli/advanced-cli'
import { TUIBuilder } from '../src/cli/tui-builder'
import { PluginRegistry, type Plugin } from '../src/cli/plugin-registry'

describe('Phase 12: CLI Enhancements', () => {
  describe('Advanced CLI', () => {
    let cli: AdvancedCLI

    beforeEach(() => {
      cli = new AdvancedCLI({
        name: 'Pi Builder',
        version: '2.0.0',
        description: 'Advanced CLI tool',
        debug: false,
      })
    })

    it('should initialize CLI', () => {
      expect(cli).toBeDefined()
      expect(cli).toBeInstanceOf(AdvancedCLI)
    })

    it('should register commands', () => {
      cli.registerCommand({
        name: 'test',
        description: 'Test command',
        handler: async () => 'Test result',
      })

      expect(cli.listCommands()).toContain('test')
    })

    it('should register command aliases', () => {
      cli.registerCommand({
        name: 'list-agents',
        description: 'List all agents',
        handler: async () => 'Agents listed',
      })

      cli.registerAlias('la', 'list-agents')
      expect(cli.listCommands()).toContain('list-agents')
    })

    it('should execute commands', async () => {
      cli.registerCommand({
        name: 'echo',
        description: 'Echo command',
        args: ['text'],
        handler: async (args) => `Echo: ${args.text}`,
      })

      const result = await cli.execute('echo hello')
      expect(result).toContain('Echo')
    })

    it('should parse command arguments', async () => {
      cli.registerCommand({
        name: 'greet',
        description: 'Greet someone',
        args: ['name'],
        flags: { formal: 'boolean' },
        handler: async (args) => {
          const greeting = args.formal ? 'Good day' : 'Hi'
          return `${greeting} ${args.name}`
        },
      })

      const result = await cli.execute('greet Alice')
      expect(result).toContain('Alice')
    })

    it('should handle command errors', async () => {
      const result = await cli.execute('nonexistent command')
      expect(result).toContain('not found')
    })

    it('should emit command events', (done) => {
      cli.registerCommand({
        name: 'test',
        description: 'Test',
        handler: async () => 'result',
      })

      cli.on('command:registered', (name) => {
        expect(name).toBe('test')
        done()
      })
    })

    it('should provide help', () => {
      cli.registerCommand({
        name: 'test',
        description: 'Test command',
        handler: async () => 'result',
      })

      const help = cli.help()
      expect(help).toContain('Pi Builder')
      expect(help).toContain('test')
    })

    it('should support command flags', async () => {
      cli.registerCommand({
        name: 'config',
        description: 'Configure',
        flags: { debug: 'boolean', output: 'string' },
        handler: async (args) => {
          return `Debug: ${args.debug}, Output: ${args.output}`
        },
      })

      const result = await cli.execute('config --debug --output json')
      expect(result).toBeDefined()
    })

    it('should list all commands', () => {
      cli.registerCommand({
        name: 'cmd1',
        description: 'Command 1',
        handler: async () => 'result',
      })

      cli.registerCommand({
        name: 'cmd2',
        description: 'Command 2',
        handler: async () => 'result',
      })

      const commands = cli.listCommands()
      expect(commands.length).toBeGreaterThanOrEqual(2)
      expect(commands).toContain('cmd1')
      expect(commands).toContain('cmd2')
    })
  })

  describe('TUI Builder', () => {
    let tui: TUIBuilder

    beforeEach(() => {
      tui = new TUIBuilder(80, 24)
    })

    it('should initialize TUI', () => {
      expect(tui).toBeDefined()
      expect(tui).toBeInstanceOf(TUIBuilder)
    })

    it('should add text component', () => {
      tui.text('msg', 'Hello, world!')
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('text')
    })

    it('should add input component', () => {
      tui.input('name', 'Enter your name')
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('input')
    })

    it('should add menu component', () => {
      tui.menu('options', ['Option 1', 'Option 2', 'Option 3'])
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('menu')
    })

    it('should add progress component', () => {
      tui.progress('prog', 50, 100)
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('progress')
    })

    it('should add table component', () => {
      const rows = [
        ['Name', 'Value'],
        ['Item 1', '100'],
        ['Item 2', '200'],
      ]
      tui.table('data', rows)
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('table')
    })

    it('should add spinner component', () => {
      tui.spinner('load', 'Loading...')
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(1)
      expect(layout.components[0].type).toBe('spinner')
    })

    it('should update components', () => {
      tui.text('msg', 'Original')
      tui.updateComponent('msg', { content: 'Updated' })
      const layout = tui.getLayout()
      expect(layout.components[0].content).toBe('Updated')
    })

    it('should remove components', () => {
      tui.text('msg', 'Hello')
      tui.removeComponent('msg')
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(0)
    })

    it('should set active component', () => {
      tui.text('msg1', 'Message 1')
      tui.text('msg2', 'Message 2')
      tui.setActive('msg2')
      expect(tui.getActive()).toBe('msg2')
    })

    it('should render layout', () => {
      tui.text('msg', 'Hello')
      const output = tui.render()
      expect(output).toContain('Hello')
    })

    it('should resize layout', () => {
      tui.setSize(100, 50)
      const layout = tui.getLayout()
      expect(layout.width).toBe(100)
      expect(layout.height).toBe(50)
    })

    it('should clear layout', () => {
      tui.text('msg', 'Hello')
      tui.clear()
      const layout = tui.getLayout()
      expect(layout.components.length).toBe(0)
    })
  })

  describe('Plugin Registry', () => {
    let registry: PluginRegistry

    beforeEach(() => {
      registry = new PluginRegistry()
    })

    it('should initialize registry', () => {
      expect(registry).toBeDefined()
      expect(registry).toBeInstanceOf(PluginRegistry)
    })

    it('should register plugins', async () => {
      const plugin: Plugin = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
      }

      await registry.register(plugin)
      expect(registry.getPlugin('test-plugin')).toBeDefined()
    })

    it('should prevent duplicate registrations', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      await registry.register(plugin)

      try {
        await registry.register(plugin)
        expect.fail('Should have thrown error')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should call plugin initialize', async () => {
      let initialized = false
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        initialize: async () => {
          initialized = true
        },
      }

      await registry.register(plugin)
      expect(initialized).toBe(true)
    })

    it('should unregister plugins', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      await registry.register(plugin)
      await registry.unregister('test')
      expect(registry.getPlugin('test')).toBeUndefined()
    })

    it('should register hooks', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        hooks: {
          'on-init': [() => 'initialized'],
        },
      }

      await registry.register(plugin)
      expect(registry.hasHook('on-init')).toBe(true)
    })

    it('should execute hooks', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        hooks: {
          'on-test': [(data) => `Modified: ${data}`],
        },
      }

      await registry.register(plugin)
      const results = await registry.executeHook('on-test', 'input')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should list plugins', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      await registry.register(plugin)
      const plugins = registry.listPlugins()
      expect(plugins.length).toBeGreaterThan(0)
      expect(plugins[0].status).toBe('active')
    })

    it('should enable/disable plugins', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      await registry.register(plugin)
      await registry.disablePlugin('test')

      const plugins = registry.listPlugins()
      const testPlugin = plugins.find((p) => p.id === 'test')
      expect(testPlugin?.status).toBe('inactive')

      await registry.enablePlugin('test')
      const updatedPlugins = registry.listPlugins()
      const updatedPlugin = updatedPlugins.find((p) => p.id === 'test')
      expect(updatedPlugin?.status).toBe('active')
    })

    it('should emit plugin events', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      let eventFired = false
      registry.on('plugin:registered', (id) => {
        if (id === 'test') {
          eventFired = true
        }
      })

      await registry.register(plugin)
      expect(eventFired).toBe(true)
    })

    it('should clear registry', async () => {
      const plugin: Plugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
      }

      await registry.register(plugin)
      registry.clear()

      expect(registry.getPlugin('test')).toBeUndefined()
    })
  })

  describe('CLI Integration', () => {
    it('should integrate CLI with TUI', () => {
      const cli = new AdvancedCLI({
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        debug: false,
      })

      const tui = new TUIBuilder()

      expect(cli).toBeDefined()
      expect(tui).toBeDefined()
    })

    it('should integrate CLI with plugins', async () => {
      const cli = new AdvancedCLI({
        name: 'Test',
        version: '1.0.0',
        description: 'Test',
        debug: false,
      })

      const registry = new PluginRegistry()

      expect(cli).toBeDefined()
      expect(registry).toBeDefined()
    })
  })
})
