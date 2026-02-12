/**
 * Plugin System
 * Extensible plugin architecture for Pi Builder
 *
 * @module platform/plugin-system
 */

import { AgentLogger } from '../agents/logger'

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  id: string
  name: string
  version: string
  author: string
  description: string
  entryPoint: string
  requiredVersion?: string
  dependencies?: string[]
}

/**
 * Plugin hooks
 */
export interface PluginHooks {
  onInit?: () => Promise<void>
  onEnable?: () => Promise<void>
  onDisable?: () => Promise<void>
  onUninstall?: () => Promise<void>
}

/**
 * Plugin interface
 */
export interface IPlugin {
  metadata: PluginMetadata
  hooks?: PluginHooks
  execute: (context: PluginContext) => Promise<unknown>
}

/**
 * Plugin context
 */
export interface PluginContext {
  pluginId: string
  logger: AgentLogger
  config?: Record<string, unknown>
}

/**
 * Installed plugin
 */
export interface InstalledPlugin extends IPlugin {
  enabled: boolean
  installedAt: Date
  lastExecuted?: Date
}

/**
 * Plugin System
 */
export class PluginSystem {
  private plugins: Map<string, InstalledPlugin> = new Map()
  private hooks: Map<string, PluginHooks> = new Map()
  private logger: AgentLogger

  constructor() {
    this.logger = new AgentLogger('PluginSystem')
  }

  /**
   * Install plugin
   */
  async installPlugin(plugin: IPlugin): Promise<InstalledPlugin> {
    // Validate plugin
    if (!plugin.metadata.id) {
      throw new Error('Plugin must have an id')
    }

    if (this.plugins.has(plugin.metadata.id)) {
      throw new Error(`Plugin already installed: ${plugin.metadata.id}`)
    }

    // Check dependencies
    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Dependency not installed: ${dep}`)
        }
      }
    }

    const installed: InstalledPlugin = {
      ...plugin,
      enabled: false,
      installedAt: new Date()
    }

    this.plugins.set(plugin.metadata.id, installed)

    // Register hooks
    if (plugin.hooks) {
      this.hooks.set(plugin.metadata.id, plugin.hooks)
      if (plugin.hooks.onInit) {
        await plugin.hooks.onInit()
      }
    }

    this.logger.info(`Plugin installed: ${plugin.metadata.id} v${plugin.metadata.version}`)

    return installed
  }

  /**
   * Enable plugin
   */
  async enablePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`Plugin not found: ${id}`)
    }

    plugin.enabled = true

    const hooks = this.hooks.get(id)
    if (hooks?.onEnable) {
      await hooks.onEnable()
    }

    this.logger.info(`Plugin enabled: ${id}`)
  }

  /**
   * Disable plugin
   */
  async disablePlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`Plugin not found: ${id}`)
    }

    plugin.enabled = false

    const hooks = this.hooks.get(id)
    if (hooks?.onDisable) {
      await hooks.onDisable()
    }

    this.logger.info(`Plugin disabled: ${id}`)
  }

  /**
   * Execute plugin
   */
  async executePlugin(
    id: string,
    context?: Record<string, unknown>
  ): Promise<unknown> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`Plugin not found: ${id}`)
    }

    if (!plugin.enabled) {
      throw new Error(`Plugin not enabled: ${id}`)
    }

    const pluginContext: PluginContext = {
      pluginId: id,
      logger: this.logger,
      config: context
    }

    const result = await plugin.execute(pluginContext)
    plugin.lastExecuted = new Date()

    return result
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(id: string): Promise<void> {
    const plugin = this.plugins.get(id)
    if (!plugin) {
      throw new Error(`Plugin not found: ${id}`)
    }

    // Disable if enabled
    if (plugin.enabled) {
      await this.disablePlugin(id)
    }

    // Call uninstall hook
    const hooks = this.hooks.get(id)
    if (hooks?.onUninstall) {
      await hooks.onUninstall()
    }

    this.plugins.delete(id)
    this.hooks.delete(id)

    this.logger.info(`Plugin uninstalled: ${id}`)
  }

  /**
   * Get plugin
   */
  getPlugin(id: string): InstalledPlugin | undefined {
    return this.plugins.get(id)
  }

  /**
   * List plugins
   */
  listPlugins(enabledOnly = false): InstalledPlugin[] {
    const plugins = Array.from(this.plugins.values())
    return enabledOnly ? plugins.filter(p => p.enabled) : plugins
  }

  /**
   * Get plugin metrics
   */
  getPluginMetrics(): {
    totalPlugins: number
    enabledPlugins: number
    disabledPlugins: number
  } {
    const total = this.plugins.size
    const enabled = Array.from(this.plugins.values()).filter(p => p.enabled).length

    return {
      totalPlugins: total,
      enabledPlugins: enabled,
      disabledPlugins: total - enabled
    }
  }

  /**
   * Update plugin
   */
  async updatePlugin(id: string, plugin: IPlugin): Promise<void> {
    const existing = this.plugins.get(id)
    if (!existing) {
      throw new Error(`Plugin not found: ${id}`)
    }

    const wasEnabled = existing.enabled

    // Uninstall old version
    await this.uninstallPlugin(id)

    // Install new version
    const installed = await this.installPlugin(plugin)

    // Restore enabled state
    if (wasEnabled) {
      await this.enablePlugin(id)
    }

    this.logger.info(`Plugin updated: ${id} to v${plugin.metadata.version}`)
  }

  /**
   * Validate plugin compatibility
   */
  validatePluginCompatibility(plugin: IPlugin): {
    compatible: boolean
    errors: string[]
  } {
    const errors: string[] = []

    if (!plugin.metadata.id) {
      errors.push('Plugin must have an id')
    }

    if (!plugin.metadata.version) {
      errors.push('Plugin must have a version')
    }

    if (!plugin.execute) {
      errors.push('Plugin must have an execute function')
    }

    if (plugin.metadata.dependencies) {
      for (const dep of plugin.metadata.dependencies) {
        if (!this.plugins.has(dep)) {
          errors.push(`Dependency not installed: ${dep}`)
        }
      }
    }

    return {
      compatible: errors.length === 0,
      errors
    }
  }
}
