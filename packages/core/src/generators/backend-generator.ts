import { ClaudeAgent } from '../agents/claude-agent'
import { Task } from '../agents/base-agent'

export interface BackendSpec {
  name: string
  framework: 'fastapi' | 'express' | 'django'
  features: string[]
  database?: 'postgres' | 'mongodb'
}

export class BackendGenerator {
  private agent: ClaudeAgent

  constructor() {
    this.agent = new ClaudeAgent()
  }

  async generate(spec: BackendSpec): Promise<string> {
    const prompt = `
Generate a production-ready ${spec.framework} backend for: ${spec.name}

Features:
${spec.features.map(f => `- ${f}`).join('\n')}

${spec.database ? `Database: ${spec.database}` : 'Database: PostgreSQL'}

Requirements:
1. Production-ready code
2. Error handling with proper exceptions
3. Type safety (use types/interfaces)
4. Comprehensive API documentation
5. Unit tests included
6. Environment configuration support
7. Logging implementation

Output ONLY the code, no explanations.
`

    const task: Task = {
      id: `backend-gen-${Date.now()}`,
      type: 'generate',
      description: prompt
    }

    const result = await this.agent.execute(task)

    if (!result.success) {
      throw new Error(`Backend generation failed: ${result.error}`)
    }

    return result.output || ''
  }

  async generateWithSchema(spec: BackendSpec, schema: Record<string, any>): Promise<string> {
    const schemaStr = JSON.stringify(schema, null, 2)

    return this.generate({
      ...spec,
      features: [
        ...spec.features,
        `Database schema:\n${schemaStr}`
      ]
    })
  }

  async generateRESTEndpoints(spec: BackendSpec, endpoints: string[]): Promise<string> {
    const endpointStr = endpoints.map(e => `- ${e}`).join('\n')

    return this.generate({
      ...spec,
      features: [
        ...spec.features,
        `Required endpoints:\n${endpointStr}`
      ]
    })
  }
}
