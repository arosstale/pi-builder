import Anthropic from '@anthropic-ai/sdk'
import { BaseAgent, Task, TaskResult } from './base-agent'

export class ClaudeAgent extends BaseAgent {
  private client: Anthropic

  constructor(apiKey?: string) {
    super('Claude')
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY
    })
  }

  /**
   * Execute task using Claude API
   */
  async execute(task: Task): Promise<TaskResult> {
    try {
      this.logger.info(`Executing task: ${task.description}`)

      const prompt = this.buildPrompt(task)
      this.logger.debug(`Prompt: ${prompt}`)

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })

      const output = this.extractContent(message.content)

      // Verify output
      const isValid = await this.verify(output)

      if (!isValid) {
        throw new Error('Output verification failed')
      }

      const result = {
        taskId: task.id,
        success: true,
        output,
        metadata: {
          model: this.model,
          tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
          timestamp: new Date().toISOString()
        }
      }

      this.logExecution(task, result)

      return result
    } catch (error) {
      return this.handleError(error as Error, task)
    }
  }

  /**
   * Generate code
   */
  async generate(prompt: string): Promise<string> {
    this.logger.info('Generating code...')

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

    return this.extractContent(message.content)
  }

  /**
   * Test code
   */
  async test(code: string, testPrompt: string): Promise<string> {
    this.logger.info('Testing code...')

    const prompt = `
Test the following code:

\`\`\`
${code}
\`\`\`

${testPrompt}
`

    return this.generate(prompt)
  }

  /**
   * Review code
   */
  async review(code: string): Promise<string> {
    this.logger.info('Reviewing code...')

    const prompt = `
Review this code for quality, security, and best practices:

\`\`\`
${code}
\`\`\`

Provide:
1. Overall quality score (1-10)
2. Security issues
3. Performance concerns
4. Best practice violations
5. Recommendations
`

    return this.generate(prompt)
  }

  /**
   * Build prompt for task
   */
  private buildPrompt(task: Task): string {
    let prompt = task.description

    if (task.context) {
      prompt += '\n\nContext:\n'
      prompt += JSON.stringify(task.context, null, 2)
    }

    return prompt
  }

  /**
   * Extract content from response
   */
  private extractContent(content: any[]): string {
    if (!content || content.length === 0) {
      throw new Error('Empty response from Claude')
    }

    const textBlock = content.find((block: any) => block.type === 'text')
    if (!textBlock) {
      throw new Error('No text content in response')
    }

    return textBlock.text
  }
}
