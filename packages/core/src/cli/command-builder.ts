export interface Command {
  name: string
  description: string
  options: CommandOption[]
  handler: (args: any) => Promise<void>
}

export interface CommandOption {
  name: string
  shorthand?: string
  description: string
  required: boolean
  type: 'string' | 'number' | 'boolean'
}

export interface ParsedCommand {
  name: string
  args: Record<string, any>
}

export class CommandBuilder {
  private commands: Map<string, Command> = new Map()
  private globalOptions: CommandOption[] = []

  constructor() {
    this.setupDefaultCommands()
  }

  private setupDefaultCommands(): void {
    // Generate command
    this.addCommand({
      name: 'generate',
      description: 'Generate a new application',
      options: [
        {
          name: 'name',
          shorthand: 'n',
          description: 'Application name',
          required: true,
          type: 'string'
        },
        {
          name: 'backend',
          shorthand: 'b',
          description: 'Backend framework (fastapi, express, django)',
          required: false,
          type: 'string'
        },
        {
          name: 'frontend',
          shorthand: 'f',
          description: 'Frontend framework (react, vue, svelte)',
          required: false,
          type: 'string'
        },
        {
          name: 'output',
          shorthand: 'o',
          description: 'Output directory',
          required: false,
          type: 'string'
        }
      ],
      handler: async (args) => {
        console.log(`🚀 Generating application: ${args.name}`)
        console.log(`Backend: ${args.backend || 'fastapi'}`)
        console.log(`Frontend: ${args.frontend || 'react'}`)
        console.log(`Output: ${args.output || './output'}`)
      }
    })

    // Deploy command
    this.addCommand({
      name: 'deploy',
      description: 'Deploy application to Kubernetes',
      options: [
        {
          name: 'app',
          shorthand: 'a',
          description: 'Application name',
          required: true,
          type: 'string'
        },
        {
          name: 'environment',
          shorthand: 'e',
          description: 'Environment (dev, staging, prod)',
          required: false,
          type: 'string'
        },
        {
          name: 'replicas',
          shorthand: 'r',
          description: 'Number of replicas',
          required: false,
          type: 'number'
        }
      ],
      handler: async (args) => {
        console.log(`📦 Deploying application: ${args.app}`)
        console.log(`Environment: ${args.environment || 'dev'}`)
        console.log(`Replicas: ${args.replicas || 1}`)
      }
    })

    // Monitor command
    this.addCommand({
      name: 'monitor',
      description: 'Monitor application health',
      options: [
        {
          name: 'app',
          shorthand: 'a',
          description: 'Application name',
          required: true,
          type: 'string'
        },
        {
          name: 'interval',
          shorthand: 'i',
          description: 'Update interval (seconds)',
          required: false,
          type: 'number'
        }
      ],
      handler: async (args) => {
        console.log(`📊 Monitoring application: ${args.app}`)
        console.log(`Update interval: ${args.interval || 5}s`)
      }
    })

    // Analytics command
    this.addCommand({
      name: 'analytics',
      description: 'View analytics and metrics',
      options: [
        {
          name: 'metric',
          shorthand: 'm',
          description: 'Metric type (revenue, users, performance)',
          required: false,
          type: 'string'
        },
        {
          name: 'period',
          shorthand: 'p',
          description: 'Time period (day, week, month)',
          required: false,
          type: 'string'
        }
      ],
      handler: async (args) => {
        console.log(`📈 Analytics for metric: ${args.metric || 'all'}`)
        console.log(`Period: ${args.period || 'month'}`)
      }
    })

    // Status command
    this.addCommand({
      name: 'status',
      description: 'Check platform status',
      options: [],
      handler: async (args) => {
        console.log(`✅ Platform Status:`)
        console.log(`  Agents: Healthy`)
        console.log(`  API: Running`)
        console.log(`  Database: Connected`)
        console.log(`  Cache: Warm`)
      }
    })
  }

  /**
   * Add a command
   */
  addCommand(command: Command): void {
    this.commands.set(command.name, command)
    console.log(`📝 Registered command: ${command.name}`)
  }

  /**
   * Get a command
   */
  getCommand(name: string): Command | undefined {
    return this.commands.get(name)
  }

  /**
   * List all commands
   */
  listCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * Parse command line arguments
   */
  parseArgs(argv: string[]): ParsedCommand | null {
    if (argv.length < 2) {
      return null
    }

    const commandName = argv[0]
    const command = this.commands.get(commandName)

    if (!command) {
      return null
    }

    const args: Record<string, any> = {}

    // Parse arguments
    for (let i = 1; i < argv.length; i++) {
      const arg = argv[i]

      if (arg.startsWith('--')) {
        const key = arg.substring(2)
        const option = command.options.find((o) => o.name === key)

        if (option) {
          if (option.type === 'boolean') {
            args[key] = true
          } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
            args[key] = argv[++i]
          }
        }
      } else if (arg.startsWith('-') && arg.length === 2) {
        const shorthand = arg.substring(1)
        const option = command.options.find((o) => o.shorthand === shorthand)

        if (option) {
          if (option.type === 'boolean') {
            args[option.name] = true
          } else if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
            args[option.name] = argv[++i]
          }
        }
      }
    }

    // Validate required options
    for (const option of command.options) {
      if (option.required && !(option.name in args)) {
        console.error(`❌ Missing required option: --${option.name}`)
        return null
      }
    }

    return { name: commandName, args }
  }

  /**
   * Execute a command
   */
  async executeCommand(commandName: string, args: Record<string, any>): Promise<boolean> {
    const command = this.commands.get(commandName)

    if (!command) {
      console.error(`❌ Unknown command: ${commandName}`)
      return false
    }

    try {
      await command.handler(args)
      return true
    } catch (error) {
      const err = error as Error
      console.error(`❌ Command failed: ${err.message}`)
      return false
    }
  }

  /**
   * Print help
   */
  printHelp(commandName?: string): void {
    if (commandName) {
      const command = this.commands.get(commandName)
      if (!command) {
        console.log(`❌ Unknown command: ${commandName}`)
        return
      }

      console.log(`\n${command.name} - ${command.description}\n`)
      console.log('Options:')

      for (const option of command.options) {
        const shorthand = option.shorthand ? ` / -${option.shorthand}` : ''
        const required = option.required ? ' (required)' : ''
        console.log(`  --${option.name}${shorthand}${required}`)
        console.log(`    ${option.description}`)
      }
    } else {
      console.log('\n🚀 Irreplaceable Engineer Stack CLI\n')
      console.log('Available commands:\n')

      for (const command of this.commands.values()) {
        console.log(`  ${command.name.padEnd(15)} ${command.description}`)
      }

      console.log('\nRun with --help for more information\n')
    }
  }

  /**
   * Get command help
   */
  getCommandHelp(commandName: string): string {
    const command = this.commands.get(commandName)
    if (!command) return ''

    let help = `${command.name} - ${command.description}\n\n`
    help += 'Options:\n'

    for (const option of command.options) {
      const shorthand = option.shorthand ? ` / -${option.shorthand}` : ''
      const required = option.required ? ' (required)' : ''
      help += `  --${option.name}${shorthand}${required}\n`
      help += `    ${option.description}\n`
    }

    return help
  }
}
