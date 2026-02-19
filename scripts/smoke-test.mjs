/**
 * End-to-end smoke test: connects to gateway, lists agents, sends a prompt.
 * Usage: node scripts/smoke-test.mjs [port] [prompt]
 */
import { WebSocket } from 'ws'

const port = parseInt(process.argv[2] ?? '18911', 10)
const prompt = process.argv[3] ?? '@pi What is 2+2? Answer in one word only.'

console.log(`Connecting to ws://127.0.0.1:${port} ...`)
console.log(`Prompt: ${prompt}\n`)

const ws = new WebSocket(`ws://127.0.0.1:${port}`)
let gotAgents = false

ws.on('open', () => {
  console.log('✅ Connected')
  ws.send(JSON.stringify({ type: 'agents', id: 'init' }))
})

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString())

  switch (msg.type) {
    case 'hello':
      console.log(`Session: ${msg.sessionId}`)
      break

    case 'agents':
      if (!gotAgents) {
        gotAgents = true
        const ids = (msg.list ?? []).map(a => a.id)
        console.log(`Agents: ${ids.join(', ') || '(none)'}`)
        console.log('\nSending prompt...\n')
        ws.send(JSON.stringify({ type: 'send', id: 'p1', message: prompt }))
      }
      break

    case 'agent_start':
      process.stdout.write(`[${msg.agent}] `)
      break

    case 'chunk':
      process.stdout.write(msg.text)
      break

    case 'turn_complete':
    case 'agent_end':
      process.stdout.write('\n')
      console.log(`\n✅ Done — ${msg.agent ?? 'agent'} ${msg.durationMs ? `(${msg.durationMs}ms)` : ''}`)
      ws.close()
      process.exit(0)
      break

    case 'error':
      process.stdout.write('\n')
      console.error(`\n❌ Gateway error: ${msg.message}`)
      ws.close()
      process.exit(1)
      break
  }
})

ws.on('error', (e) => { console.error('WS error:', e.message); process.exit(1) })
ws.on('close', () => { console.log('Connection closed') })

setTimeout(() => {
  console.error('\n⏰ Timeout after 120s')
  ws.close()
  process.exit(2)
}, 120_000)
