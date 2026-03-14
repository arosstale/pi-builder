import { describe, it, expect, beforeEach } from 'vitest'
import { CodeGenerator } from '../src/code-generator'
import type { CodeGenerationRequest } from '../src/types'

describe('CodeGenerator', () => {
  let generator: CodeGenerator
  let testRequest: CodeGenerationRequest

  beforeEach(() => {
    process.env.CLAUDE_API_KEY = 'test-key'
    generator = new CodeGenerator('test-key')
    testRequest = {
      prompt: 'Create a simple function',
      language: 'typescript',
      framework: 'none',
    }
  })

  it('should create generator instance', () => {
    expect(generator).toBeDefined()
  })

  it('should create generator without key', () => {
    const generatorNoKey = new CodeGenerator('')
    expect(generatorNoKey).toBeDefined()
  })

  it('should generate code from prompt', async () => {
    const response = await generator.generate(testRequest)

    expect(response).toBeDefined()
    expect(response.code).toBeDefined()
    expect(response.language).toBe('typescript')
    expect(response.metadata).toBeDefined()
  })

  it('should include metadata in response', async () => {
    const response = await generator.generate(testRequest)

    expect(response.metadata.tokensUsed).toBeGreaterThan(0)
    expect(response.metadata.generatedAt).toBeInstanceOf(Date)
    expect(response.metadata.model).toBeDefined()
  })

  it('should handle context in requests', async () => {
    const requestWithContext: CodeGenerationRequest = {
      ...testRequest,
      context: {
        projectName: 'test-app',
        framework: 'react',
      },
    }

    const response = await generator.generate(requestWithContext)
    expect(response.code).toBeDefined()
  })

  it('should support different languages', async () => {
    const languages = ['typescript', 'javascript', 'python', 'rust']

    for (const lang of languages) {
      const response = await generator.generate({
        ...testRequest,
        language: lang,
      })
      expect(response.language).toBe(lang)
    }
  })

  it('should estimate tokens correctly', async () => {
    const shortRequest: CodeGenerationRequest = {
      prompt: 'hi',
      language: 'typescript',
    }

    const longRequest: CodeGenerationRequest = {
      prompt: 'A'.repeat(1000),
      language: 'typescript',
    }

    const shortResponse = await generator.generate(shortRequest)
    const longResponse = await generator.generate(longRequest)

    expect(longResponse.metadata.tokensUsed).toBeGreaterThan(
      shortResponse.metadata.tokensUsed
    )
  })
})
