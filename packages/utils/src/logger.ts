import type { Logger } from './types'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
}

export const logger: Logger = {
  log(message: string) {
    console.log(`${colors.blue}✓${colors.reset} ${message}`)
  },

  error(message: string) {
    console.error(`${colors.red}✗${colors.reset} ${message}`)
  },

  warn(message: string) {
    console.warn(`${colors.yellow}⚠${colors.reset} ${message}`)
  },

  debug(message: string) {
    if (process.env.DEBUG) {
      console.log(`${colors.gray}[DEBUG]${colors.reset} ${message}`)
    }
  },
}
