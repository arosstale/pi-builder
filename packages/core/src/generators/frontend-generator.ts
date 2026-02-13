import { ClaudeAgent } from '../agents/claude-agent'
import { Task } from '../agents/base-agent'

export interface FrontendSpec {
  name: string
  framework: 'react' | 'vue' | 'svelte'
  features: string[]
  styling?: 'tailwind' | 'mui' | 'styled-components'
  components?: string[]
}

export class FrontendGenerator {
  private agent: ClaudeAgent

  constructor() {
    this.agent = new ClaudeAgent()
  }

  async generate(spec: FrontendSpec): Promise<string> {
    const prompt = `
Generate a production-ready ${spec.framework} frontend for: ${spec.name}

Features:
${spec.features.map(f => `- ${f}`).join('\n')}

${spec.components ? `Components needed:\n${spec.components.map(c => `- ${c}`).join('\n')}` : ''}

Styling: ${spec.styling || 'tailwind'}

Requirements:
1. Modern best practices
2. Responsive design (mobile-first)
3. Accessibility (a11y) compliance
4. Component-based architecture
5. TypeScript with strict types
6. Unit tests (Jest/Vitest)
7. Props validation
8. Error boundaries

Output ONLY the code, no explanations.
`

    const task: Task = {
      id: `frontend-gen-${Date.now()}`,
      type: 'generate',
      description: prompt
    }

    const result = await this.agent.execute(task)

    if (!result.success) {
      throw new Error(`Frontend generation failed: ${result.error}`)
    }

    return result.output || ''
  }

  async generateWithRoutes(spec: FrontendSpec, routes: Record<string, string>): Promise<string> {
    const routeStr = Object.entries(routes)
      .map(([path, component]) => `- ${path} → ${component}`)
      .join('\n')

    return this.generate({
      ...spec,
      features: [
        ...spec.features,
        `Routes:\n${routeStr}`
      ]
    })
  }

  async generateWithState(spec: FrontendSpec, stateSchema: Record<string, any>): Promise<string> {
    const stateStr = JSON.stringify(stateSchema, null, 2)

    return this.generate({
      ...spec,
      features: [
        ...spec.features,
        `State management:\n${stateStr}`
      ]
    })
  }
}
