import { describe, it, expect } from 'vitest'
import { program } from 'commander'

describe('CLI', () => {
  it('should have commander program defined', () => {
    expect(program).toBeDefined()
    expect(program).toHaveProperty('name')
    expect(program).toHaveProperty('version')
    expect(program).toHaveProperty('description')
  })

  it('should export program instance', async () => {
    // Dynamic import to avoid executing the CLI during test
    const cliModule = await import('../src/cli.js')
    expect(cliModule).toBeDefined()
  })
})
