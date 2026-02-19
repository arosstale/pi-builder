import { describe, it, expect } from 'vitest'
import { program } from 'commander'

describe('CLI', () => {
  it('should have commander program defined', () => {
    expect(program).toBeDefined()
    expect(program).toHaveProperty('name')
    expect(program).toHaveProperty('version')
    expect(program).toHaveProperty('description')
  })

  it('should verify commander program structure', () => {
    // Test that commander provides expected API
    const testProgram = program
    expect(typeof testProgram.name).toBe('function')
    expect(typeof testProgram.version).toBe('function')
    expect(typeof testProgram.command).toBe('function')
    expect(typeof testProgram.parse).toBe('function')
  })
})
