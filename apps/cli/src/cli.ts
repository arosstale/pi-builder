#!/usr/bin/env node

import { program } from 'commander'
import { startGateway } from '@pi-builder/core'
import { createOrchestrator } from '@pi-builder/core'

const version = '0.1.0'

program
  .name('pi-builder')
  .description('Unified interface over any installed CLI coding agent')
  .version(version)

// ── start ──────────────────────────────────────────────────────────────────

program
  .command('start')
  .description('Start the pi-builder gateway (WebSocket + web UI)')
  .option('-p, --port <port>', 'WebSocket port', '18900')
  .option('--host <host>', 'Bind host', '127.0.0.1')
  .option('--work-dir <dir>', 'Agent working directory', process.cwd())
  .option('--agents <agents>', 'Preferred agent order (comma-separated)', '')
  .option('--db <path>', 'SQLite database path', ':memory:')
  .action(async (options: Record<string, string>) => {
    const port = parseInt(options.port, 10)
    const preferredAgents = options.agents
      ? options.agents.split(',').map((a: string) => a.trim()).filter(Boolean)
      : undefined

    console.log('🚀 Pi Builder starting...')

    const gw = await startGateway({
      port,
      host: options.host,
      orchestrator: {
        workDir: options.workDir,
        preferredAgents,
        dbPath: options.db,
      },
    })

    console.log(`✅ Gateway: ${gw.url}`)
    console.log(`🌐 Web UI:  http://${options.host}:${options.port}/`)
    console.log('')
    console.log('Checking installed agents...')

    // Non-blocking health check
    const orch = createOrchestrator({ preferredAgents, fallback: true })
    orch.checkHealth().then((health) => {
      const available = Object.entries(health).filter(([, ok]) => ok).map(([id]) => id)
      const missing   = Object.entries(health).filter(([, ok]) => !ok).map(([id]) => id)
      if (available.length > 0) console.log(`✅ Available: ${available.join(', ')}`)
      if (missing.length > 0)   console.log(`⚠️  Not found: ${missing.join(', ')}`)
      if (available.length === 0) {
        console.log('❌ No agents found. Install one:')
        console.log('   npm install -g @anthropic-ai/claude-code')
        console.log('   pip install aider-chat')
      }
    }).catch(() => {})

    console.log('')
    console.log('Press Ctrl+C to stop.')

    process.on('SIGINT', async () => { await gw.stop(); process.exit(0) })
    process.on('SIGTERM', async () => { await gw.stop(); process.exit(0) })
  })

// ── agents ─────────────────────────────────────────────────────────────────

program
  .command('agents')
  .description('List installed CLI coding agents and their health')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const orch = createOrchestrator({ fallback: true })
    const wrappers = orch.getWrappers()

    if (!options.json) console.log('🔍 Checking installed agents...\n')

    const health = await orch.checkHealth()
    const results = wrappers.map((w) => ({
      id: w.id,
      name: w.name,
      binary: w.binary,
      capabilities: w.capabilities,
      available: health[w.id] ?? false,
    }))

    if (options.json) {
      console.log(JSON.stringify(results, null, 2))
    } else {
      for (const r of results) {
        const icon = r.available ? '✅' : '❌'
        const caps = r.capabilities.slice(0, 3).join(', ')
        console.log(`${icon}  ${r.id.padEnd(12)} ${caps}`)
      }
      const available = results.filter(r => r.available).length
      console.log(`\n${available}/${results.length} agents available`)
    }
    process.exit(0)
  })

// ── run ────────────────────────────────────────────────────────────────────

program
  .command('run <prompt>')
  .description('One-shot: run a prompt with the best available agent')
  .option('--agent <id>', 'Force a specific agent')
  .option('--work-dir <dir>', 'Working directory', process.cwd())
  .action(async (prompt: string, options: Record<string, string>) => {
    const preferredAgents = options.agent ? [options.agent] : undefined
    const orch = createOrchestrator({ preferredAgents, fallback: true })
    const task = { prompt, workDir: options.workDir }

    const wrapper = await orch.selectForTask(task)
    if (!wrapper) {
      console.error('❌ No available agent. Run `pi-builder agents` to see what\'s installed.')
      process.exit(1)
    }

    console.log(`🤖 ${wrapper.name}\n`)
    for await (const chunk of wrapper.executeStream(task)) {
      process.stdout.write(chunk)
    }
    process.stdout.write('\n')
    process.exit(0)
  })

program.parse(process.argv)

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
