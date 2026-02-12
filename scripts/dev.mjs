#!/usr/bin/env node

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function startProcess(name, command, args, cwd = rootDir) {
  console.log(`🚀 Starting ${name}...`)

  const proc = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  })

  proc.on('error', err => {
    console.error(`❌ ${name} error:`, err)
  })

  proc.on('exit', code => {
    if (code !== 0) {
      console.error(`❌ ${name} exited with code ${code}`)
    }
  })

  return proc
}

// Start watchers for packages
console.log('🔍 Starting development mode...\n')

startProcess('Build packages', 'npm', ['run', 'build:packages', '--workspace=false'])

// Start platform-specific dev servers based on arguments
const target = process.argv[2]

if (!target || target === 'web') {
  startProcess('Web dev server', 'npm', ['run', 'dev:web', '--workspace=false'])
}

if (!target || target === 'cli') {
  startProcess('CLI watch', 'npm', ['run', 'dev', '--workspace=@pi-builder/cli'])
}

if (target === 'desktop') {
  startProcess('Desktop app', 'npm', ['run', 'dev', '--workspace=@pi-builder/desktop'])
}

console.log('\n✅ Development environment ready!')
console.log('   Web: http://localhost:3000')
console.log('   CLI: npm run cli:dev')
console.log('   Desktop: npm run dev:desktop\n')
