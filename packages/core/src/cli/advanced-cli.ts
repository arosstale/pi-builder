import { EventEmitter } from 'events'

export interface CliCommand {
  name: string
  description: string
  args?: string[]
  flags?: Record<string, string>
  handler: (args: Record<string, unknown>) => Promise<string>
}

export interface CliConfig {
  name: string
  version: string
  description: string
  debug: boolean
}

export class AdvancedCLI extends EventEmitter {
  private config: CliConfig
  private commands: Map<string, CliCommand>
  private aliases: Map<string, string>

  constructor(config: CliConfig) {
    super()
    this.config = config
    this.commands = new Map()
    this.aliases = new Map()
  }

  registerCommand(command: CliCommand): void {
    this.commands.set(command.name, command)
    this.emit('command:registered', command.name)
  }

  registerAlias(alias: string, commandName: string): void {
    this.aliases.set(alias, commandName)
    this.emit('alias:registered', { alias, command: commandName })
  }

  async execute(input: string): Promise<string> {
    try {
      const tokens = input.trim().split(/\s+/)
      const commandName = tokens[0]
      const args = tokens.slice(1)

      // Resolve alias
      const actualCommand = this.aliases.get(commandName) || commandName

      // Get command
      const command = this.commands.get(actualCommand)
      if (!command) {
        return `❌ Command not found: ${commandName}`
      }

      // Parse arguments
      const parsedArgs = this.parseArgs(args, command)

      // Execute
      this.emit('command:executing', { command: actualCommand, args: parsedArgs })
      const result = await command.handler(parsedArgs)
      this.emit('command:executed', { command: actualCommand, result })

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.emit('command:error', { error: message })
      return `❌ Error: ${message}`
    }
  }

  private parseArgs(args: string[], command: CliCommand): Record<string, unknown> {
    const parsed: Record<string, unknown> = {}

    // Parse positional arguments
    if (command.args) {
      for (let i = 0; i < Math.min(args.length, command.args.length); i++) {
        const argName = command.args[i]
        parsed[argName] = args[i]
      }
    }

    // Parse flags
    if (command.flags) {
      for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
          const flagName = args[i].substring(2)
          const flagType = command.flags[flagName]
          if (flagType) {
            if (flagType === 'boolean') {
              parsed[flagName] = true
            } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
              parsed[flagName] = args[i + 1]
              i++
            }
          }
        }
      }
    }

    return parsed
  }

  listCommands(): string[] {
    return Array.from(this.commands.keys())
  }

  getCommand(name: string): CliCommand | undefined {
    return this.commands.get(name)
  }

  help(commandName?: string): string {
    if (commandName) {
      const command = this.commands.get(commandName)
      if (!command) return `Command not found: ${commandName}`

      let help = `\n📖 ${command.name}\n`
      help += `   ${command.description}\n`

      if (command.args && command.args.length > 0) {
        help += `\n   Arguments:\n`
        command.args.forEach((arg) => {
          help += `     ${arg}\n`
        })
      }

      if (command.flags && Object.keys(command.flags).length > 0) {
        help += `\n   Flags:\n`
        Object.entries(command.flags).forEach(([flag, type]) => {
          help += `     --${flag} (${type})\n`
        })
      }

      return help
    }

    // List all commands
    let help = `\n🎯 ${this.config.name} v${this.config.version}\n`
    help += `   ${this.config.description}\n\n`
    help += `   Commands:\n`

    this.commands.forEach((command) => {
      help += `     ${command.name.padEnd(20)} - ${command.description}\n`
    })

    return help
  }
}
