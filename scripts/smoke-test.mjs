/**
 * End-to-end smoke test: connects to gateway, lists agents, sends a prompt.
 * Usage: node scripts/smoke-test.mjs [port] [prompt]
 *
 * Uses globalThis.WebSocket (Node 22+) with ws fallback for older runtimes.
 */
const WS = globalThis.WebSocket ?? (await import('ws')).WebSocket

const port = parseInt(process.argv[2] ?? '18911', 10)
const prompt = process.argv[3] ?? '@pi What is 2+2? Answer in one word only.'

console.log(`Connecting to ws://127.0.0.1:${port} ...`)
console.log(`Prompt: ${prompt}\n`)

const ws = new WS(`ws://127.0.0.1:${port}`)
let gotAgents = false

ws.addEventListener('open', () => {
  console.log('✅ Connected')
  ws.send(JSON.stringify({ type: 'agents', id: 'init' }))
})

ws.addEventListener('message', (event) => {
  const data = typeof event.data === 'string' ? event.data : event.data.toString()
  const msg = JSON.parse(data)

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

ws.addEventListener('error', (e) => { console.error('WS error:', e.message ?? e); process.exit(1) })
ws.addEventListener('close', () => { console.log('Connection closed') })

setTimeout(() => {
  console.error('\n⏰ Timeout after 120s')
  ws.close()
  process.exit(2)
}, 120_000)
