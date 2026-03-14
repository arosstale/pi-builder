import { describe, it, expect, beforeEach } from 'vitest'
import { Builder } from '../src/builder'
import type { BuilderConfig } from '../src/types'

describe('Builder', () => {
  let builder: Builder
  let config: BuilderConfig

  beforeEach(() => {
    config = {
      name: 'test-project',
      description: 'Test project',
      rootDir: '/tmp/test',
      platforms: ['web', 'cli'],
      aiProvider: 'claude',
    }
    builder = new Builder(config)
  })

  it('should create builder instance', () => {
    expect(builder).toBeDefined()
    expect(builder.getConfig()).toEqual(config)
  })

  it('should initialize project', async () => {
    await builder.initialize({ verbose: false })

    const metadata = builder.getMetadata()
    expect(metadata).toBeDefined()
    expect(metadata?.name).toBe('test-project')
    expect(metadata?.platforms).toEqual(['web', 'cli'])
  })

  it('should have unique project ID', async () => {
    const builder2 = new Builder(config)
    await builder.initialize()
    await builder2.initialize()

    const meta1 = builder.getMetadata()
    const meta2 = builder2.getMetadata()

    expect(meta1?.id).not.toBe(meta2?.id)
  })

  it('should track timestamps', async () => {
    await builder.initialize()

    const metadata = builder.getMetadata()
    expect(metadata?.createdAt).toBeInstanceOf(Date)
    expect(metadata?.updatedAt).toBeInstanceOf(Date)
  })

  it('should handle multiple platforms', async () => {
    const multiPlatformConfig: BuilderConfig = {
      name: 'multi-platform',
      rootDir: '/tmp/test',
      platforms: ['web', 'desktop', 'mobile', 'cli'],
    }

    const mpBuilder = new Builder(multiPlatformConfig)
    await mpBuilder.initialize()

    const metadata = mpBuilder.getMetadata()
    expect(metadata?.platforms).toHaveLength(4)
    expect(metadata?.platforms).toContain('web')
    expect(metadata?.platforms).toContain('desktop')
    expect(metadata?.platforms).toContain('mobile')
    expect(metadata?.platforms).toContain('cli')
  })
})
