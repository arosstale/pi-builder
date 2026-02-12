import type { ValidationError } from './types'

export function validateConfig(config: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate required fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push({
      field: 'name',
      message: 'Name is required and must be a string',
      value: config.name,
    })
  }

  if (!Array.isArray(config.platforms)) {
    errors.push({
      field: 'platforms',
      message: 'Platforms must be an array',
      value: config.platforms,
    })
  }

  // Validate platforms
  const validPlatforms = ['web', 'desktop', 'mobile', 'cli']
  if (Array.isArray(config.platforms)) {
    config.platforms.forEach((platform, idx) => {
      if (!validPlatforms.includes(platform as string)) {
        errors.push({
          field: `platforms[${idx}]`,
          message: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}`,
          value: platform,
        })
      }
    })
  }

  return errors
}

export function mergeConfigs<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>
): T {
  return { ...base, ...override }
}
