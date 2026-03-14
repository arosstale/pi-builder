/**
 * Simple Logger for Agent System
 * Used internally by agents to log information
 */

export class AgentLogger {
  private name: string

  constructor(name: string = 'Agent') {
    this.name = name
  }

  debug(message: string, data?: unknown): void {
    if (process.env.DEBUG) {
      console.debug(`[${this.name}] ${message}`, data)
    }
  }

  info(message: string, data?: unknown): void {
    console.info(`[${this.name}] ${message}`, data)
  }

  warn(message: string, data?: unknown): void {
    console.warn(`[${this.name}] ${message}`, data)
  }

  error(message: string, error?: unknown): void {
    console.error(`[${this.name}] ${message}`, error)
  }
}
