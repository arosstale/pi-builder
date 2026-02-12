#!/usr/bin/env node

import { program } from 'commander'
import { Builder } from '@pi-builder/core'
import { logger } from '@pi-builder/utils'

const version = '0.1.0'

program
  .name('pi-builder')
  .description('Beautiful, open-source AI code generator for all platforms')
  .version(version)

program
  .command('init <name>')
  .description('Initialize a new Pi Builder project')
  .option('-p, --platforms <platforms>', 'Platforms to include (web,desktop,mobile,cli)')
  .option('-d, --description <desc>', 'Project description')
  .action(async (name, options) => {
    try {
      const platforms = (options.platforms || 'web,cli').split(',').map((p: string) => p.trim())

      const config = {
        name,
        description: options.description,
        rootDir: process.cwd(),
        platforms,
      }

      const builder = new Builder(config)
      await builder.initialize({ verbose: true })

      logger.log(`Project "${name}" initialized successfully!`)
      logger.log(`Platforms: ${platforms.join(', ')}`)
    } catch (error) {
      logger.error(
        `Failed to initialize project: ${error instanceof Error ? error.message : String(error)}`
      )
      process.exit(1)
    }
  })

program
  .command('generate')
  .description('Generate code using AI')
  .option('-p, --prompt <prompt>', 'Code generation prompt')
  .option('-l, --language <language>', 'Programming language')
  .action(async options => {
    logger.log('Code generation coming soon!')
  })

program
  .command('build')
  .description('Build the project')
  .option('--platform <platform>', 'Build specific platform')
  .action(options => {
    logger.log('Build functionality coming soon!')
  })

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
