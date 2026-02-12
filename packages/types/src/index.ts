/**
 * @pi-builder/types
 * Shared TypeScript types
 */

export type Platform = 'web' | 'desktop' | 'mobile' | 'cli'
export type AIProvider = 'claude' | 'openai' | 'custom'
export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'

export interface AppSpec {
  name: string
  description: string
  platforms: Platform[]
  aiProvider: AIProvider
  features: string[]
  design: DesignSpec
}

export interface DesignSpec {
  theme: 'light' | 'dark' | 'auto'
  colorScheme?: string
  typography?: string
  components?: string[]
}

export interface WorkflowStep {
  id: string
  name: string
  description: string
  type: 'code-gen' | 'build' | 'test' | 'deploy'
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  triggers?: string[]
}
