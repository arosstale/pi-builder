import { EventEmitter } from 'events'

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author?: string
  initialize?: () => Promise<void>
  destroy?: () => Promise<void>
  hooks?: Record<string, Array<(data: unknown) => unknown>>
}

export interface PluginMetadata {
  id: string
  name: string
  version: string
  status: 'active' | 'inactive' | 'error'
  loadedAt?: Date
  error?: string
}

export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, Plugin>
  private metadata: Map<string, PluginMetadata>
  private hooks: Map<string, Array<(data: unknown) => unknown>>

  constructor() {
    super()
    this.plugins = new Map()
    this.metadata = new Map()
    this.hooks = new Map()
  }

  async register(plugin: Plugin): Promise<void> {
    try {
      // Validate plugin
      if (!plugin.id || !plugin.name || !plugin.version) {
        throw new Error('Plugin missing required fields: id, name, version')
      }

      // Check for duplicates
      if (this.plugins.has(plugin.id)) {
        throw new Error(`Plugin already registered: ${plugin.id}`)
      }

      // Initialize if needed
      if (plugin.initialize) {
        await plugin.initialize()
      }

      // Store plugin
      this.plugins.set(plugin.id, plugin)
      this.metadata.set(plugin.id, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        status: 'active',
        loadedAt: new Date(),
      })

      // Register hooks
      if (plugin.hooks) {
        Object.entries(plugin.hooks).forEach(([hookName, handlers]) => {
          if (!this.hooks.has(hookName)) {
            this.hooks.set(hookName, [])
          }
          const hookList = this.hooks.get(hookName)!
          hookList.push(...handlers)
        })
      }

      this.emit('plugin:registered', plugin.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.metadata.set(plugin.id, {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        status: 'error',
        error: message,
      })
      this.emit('plugin:error', { plugin: plugin.id, error: message })
      throw error
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    // Destroy if needed
    if (plugin.destroy) {
      await plugin.destroy()
    }

    // Remove hooks
    if (plugin.hooks) {
      Object.keys(plugin.hooks).forEach((hookName) => {
        const hookList = this.hooks.get(hookName)
        if (hookList) {
          const handlers = plugin.hooks![hookName]
          handlers.forEach((handler) => {
            const index = hookList.indexOf(handler)
            if (index !== -1) {
              hookList.splice(index, 1)
            }
          })
        }
      })
    }

    this.plugins.delete(pluginId)
    this.metadata.delete(pluginId)
    this.emit('plugin:unregistered', pluginId)
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id)
  }

  listPlugins(): PluginMetadata[] {
    return Array.from(this.metadata.values())
  }

  async executeHook(hookName: string, data: unknown): Promise<unknown[]> {
    const handlers = this.hooks.get(hookName)
    if (!handlers) {
      return []
    }

    const results: unknown[] = []
    for (const handler of handlers) {
      try {
        const result = handler(data)
        results.push(result)
      } catch (error) {
        this.emit('hook:error', { hook: hookName, error })
      }
    }

    return results
  }

  hasHook(hookName: string): boolean {
    return this.hooks.has(hookName)
  }

  getHooks(hookName: string): Array<(data: unknown) => unknown> {
    return this.hooks.get(hookName) || []
  }

  async enablePlugin(id: string): Promise<void> {
    const metadata = this.metadata.get(id)
    if (!metadata) {
      throw new Error(`Plugin not found: ${id}`)
    }

    metadata.status = 'active'
    this.emit('plugin:enabled', id)
  }

  async disablePlugin(id: string): Promise<void> {
    const metadata = this.metadata.get(id)
    if (!metadata) {
      throw new Error(`Plugin not found: ${id}`)
    }

    metadata.status = 'inactive'
    this.emit('plugin:disabled', id)
  }

  clear(): void {
    this.plugins.clear()
    this.metadata.clear()
    this.hooks.clear()
    this.emit('registry:cleared')
  }
}
