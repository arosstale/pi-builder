/**
 * Prompt Optimizer - Intelligent Prompt Optimization
 *
 * Strategies:
 * 1. Cost optimization: Reduce tokens (target 15%+ reduction)
 * 2. Latency optimization: Simplify prompt (faster processing)
 * 3. Quality optimization: Enhance prompt clarity
 * 4. Model-specific: Optimize for specific model's strengths
 */

/**
 * Optimization result
 */
export interface OptimizationResult {
  original: string
  optimized: string
  originalTokens: number
  optimizedTokens: number
  tokenReduction: number
  reductionPercent: number
  strategy: OptimizationStrategy
  confidence: number
  metadata?: Record<string, any>
}

/**
 * Optimization strategies
 */
export type OptimizationStrategy = 'cost' | 'latency' | 'quality' | 'model-specific'

/**
 * Model optimization profile
 */
export interface ModelOptimizationProfile {
  modelId: string
  preferredStyle: 'concise' | 'detailed' | 'structured'
  supportsMarkdown: boolean
  supportsJSON: boolean
  supportsXML: boolean
  tokenEfficiency: number // 0-1
  recommendations: string[]
}

/**
 * Prompt Optimizer - Intelligent prompt optimization
 */
export class PromptOptimizer {
  private tokenEstimates: Map<string, number> = new Map()
  private modelProfiles: Map<string, ModelOptimizationProfile> = new Map()

  constructor() {
    this.initializeModelProfiles()
  }

  /**
   * Initialize model optimization profiles
   */
  private initializeModelProfiles(): void {
    // Claude models
    this.modelProfiles.set('claude-opus-4-5-20251101', {
      modelId: 'claude-opus-4-5-20251101',
      preferredStyle: 'detailed',
      supportsMarkdown: true,
      supportsJSON: true,
      supportsXML: true,
      tokenEfficiency: 0.95,
      recommendations: ['Use clear structure', 'Add examples'],
    })

    // GPT models
    this.modelProfiles.set('gpt-4o', {
      modelId: 'gpt-4o',
      preferredStyle: 'structured',
      supportsMarkdown: true,
      supportsJSON: true,
      supportsXML: false,
      tokenEfficiency: 0.9,
      recommendations: ['Use JSON for structured output', 'Keep instructions concise'],
    })

    // Gemini models
    this.modelProfiles.set('gemini-2.0-flash', {
      modelId: 'gemini-2.0-flash',
      preferredStyle: 'concise',
      supportsMarkdown: true,
      supportsJSON: true,
      supportsXML: true,
      tokenEfficiency: 0.85,
      recommendations: ['Shorter is better', 'Focus on key points'],
    })
  }

  /**
   * Estimate tokens in text (simplified)
   * In production, use model-specific tokenizers
   */
  private estimateTokens(text: string): number {
    // Approximate: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Cost optimization: Reduce tokens by 15-30%
   */
  optimizeForCost(prompt: string, model: string = 'claude'): OptimizationResult {
    const originalTokens = this.estimateTokens(prompt)

    // Remove redundancy
    let optimized = this.removeRedundancy(prompt)

    // Compress whitespace
    optimized = this.compressWhitespace(optimized)

    // Remove unnecessary words
    optimized = this.removeUnnecessaryWords(optimized)

    // Abbreviate common phrases
    optimized = this.abbreviateCommonPhrases(optimized)

    const optimizedTokens = this.estimateTokens(optimized)
    const reduction = originalTokens - optimizedTokens
    const reductionPercent = (reduction / originalTokens) * 100

    return {
      original: prompt,
      optimized,
      originalTokens,
      optimizedTokens,
      tokenReduction: reduction,
      reductionPercent,
      strategy: 'cost',
      confidence: Math.min(0.95, Math.max(0.7, reductionPercent / 30)), // 70-95% confidence
    }
  }

  /**
   * Latency optimization: Simplify for faster processing
   */
  optimizeForLatency(prompt: string, model: string = 'claude'): OptimizationResult {
    const originalTokens = this.estimateTokens(prompt)

    let optimized = prompt

    // Shorten complex explanations
    optimized = this.shortenExplanations(optimized)

    // Reduce examples (keep essential ones)
    optimized = this.reduceExamples(optimized, 2)

    // Use simpler vocabulary
    optimized = this.simplifyVocabulary(optimized)

    const optimizedTokens = this.estimateTokens(optimized)
    const reduction = originalTokens - optimizedTokens
    const reductionPercent = (reduction / originalTokens) * 100

    return {
      original: prompt,
      optimized,
      originalTokens,
      optimizedTokens,
      tokenReduction: reduction,
      reductionPercent,
      strategy: 'latency',
      confidence: 0.8,
    }
  }

  /**
   * Quality optimization: Enhance clarity
   */
  optimizeForQuality(prompt: string, model: string = 'claude'): OptimizationResult {
    const originalTokens = this.estimateTokens(prompt)

    let optimized = prompt

    // Add structure
    optimized = this.addStructure(optimized)

    // Add context
    optimized = this.addContext(optimized)

    // Clarify expectations
    optimized = this.clarifyExpectations(optimized)

    const optimizedTokens = this.estimateTokens(optimized)
    const reduction = originalTokens - optimizedTokens
    const reductionPercent = (reduction / originalTokens) * 100

    return {
      original: prompt,
      optimized,
      originalTokens,
      optimizedTokens,
      tokenReduction: reduction,
      reductionPercent,
      strategy: 'quality',
      confidence: 0.85,
      metadata: { qualityScore: 0.9 },
    }
  }

  /**
   * Model-specific optimization
   */
  optimizeForModel(prompt: string, modelId: string): OptimizationResult {
    const profile = this.modelProfiles.get(modelId)
    if (!profile) {
      // Fallback to cost optimization
      return this.optimizeForCost(prompt, modelId)
    }

    const originalTokens = this.estimateTokens(prompt)
    let optimized = prompt

    // Apply model-specific optimizations
    if (profile.preferredStyle === 'concise') {
      optimized = this.makeConcise(optimized)
    } else if (profile.preferredStyle === 'structured') {
      optimized = this.addStructure(optimized)
    }

    // Use preferred format
    if (profile.supportsJSON && !prompt.includes('JSON')) {
      optimized = this.suggestJSON(optimized)
    }

    const optimizedTokens = this.estimateTokens(optimized)
    const reduction = originalTokens - optimizedTokens
    const reductionPercent = (reduction / originalTokens) * 100

    return {
      original: prompt,
      optimized,
      originalTokens,
      optimizedTokens,
      tokenReduction: reduction,
      reductionPercent,
      strategy: 'model-specific',
      confidence: 0.88,
      metadata: { modelProfile: profile.modelId },
    }
  }

  /**
   * Remove redundant content
   */
  private removeRedundancy(text: string): string {
    const lines = text.split('\n')
    const seen = new Set<string>()
    const unique: string[] = []

    for (const line of lines) {
      const normalized = line.trim()
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized)
        unique.push(line)
      }
    }

    return unique.join('\n')
  }

  /**
   * Compress whitespace
   */
  private compressWhitespace(text: string): string {
    return text
      .replace(/\n\n+/g, '\n\n') // Remove multiple newlines
      .replace(/  +/g, ' ') // Remove multiple spaces
      .trim()
  }

  /**
   * Remove unnecessary words
   */
  private removeUnnecessaryWords(text: string): string {
    const unnecessaryWords = ['very', 'quite', 'rather', 'just', 'really', 'literally', 'basically']
    let result = text

    for (const word of unnecessaryWords) {
      const regex = new RegExp(`\\b${word}\\s+`, 'gi')
      result = result.replace(regex, '')
    }

    return result
  }

  /**
   * Abbreviate common phrases
   */
  private abbreviateCommonPhrases(text: string): string {
    const abbreviations: Record<string, string> = {
      'as soon as possible': 'ASAP',
      'for example': 'e.g.',
      'that is': 'i.e.',
      'for instance': 'e.g.',
      'in other words': '',
    }

    let result = text
    for (const [phrase, abbrev] of Object.entries(abbreviations)) {
      result = result.replace(new RegExp(phrase, 'gi'), abbrev)
    }

    return result
  }

  /**
   * Shorten explanations
   */
  private shortenExplanations(text: string): string {
    // Replace long explanations with summaries
    return text.replace(/explanation:.*?(?=\n|$)/gi, (match) => {
      return match.substring(0, 100) + (match.length > 100 ? '...' : '')
    })
  }

  /**
   * Reduce examples
   */
  private reduceExamples(text: string, keepCount: number): string {
    const examples = text.match(/example.*?(?=\n|$)/gi) || []
    let result = text

    for (let i = keepCount; i < examples.length; i++) {
      result = result.replace(examples[i], '')
    }

    return result
  }

  /**
   * Simplify vocabulary
   */
  private simplifyVocabulary(text: string): string {
    const simplifications: Record<string, string> = {
      utilize: 'use',
      facilitate: 'help',
      comprehend: 'understand',
      ascertain: 'find out',
    }

    let result = text
    for (const [complex, simple] of Object.entries(simplifications)) {
      result = result.replace(new RegExp(`\\b${complex}\\b`, 'gi'), simple)
    }

    return result
  }

  /**
   * Add structure
   */
  private addStructure(text: string): string {
    // Add clear sections
    if (!text.includes('## ') && !text.includes('### ')) {
      const lines = text.split('\n')
      let result = ''

      for (let i = 0; i < lines.length; i++) {
        if (i % 5 === 0 && i > 0) {
          result += '\n## Section\n'
        }
        result += lines[i] + '\n'
      }

      return result
    }

    return text
  }

  /**
   * Add context
   */
  private addContext(text: string): string {
    // Add brief context if missing
    if (!text.toLowerCase().includes('context') && !text.toLowerCase().includes('background')) {
      return `Context: This is a task that requires attention to detail.\n\n${text}`
    }

    return text
  }

  /**
   * Clarify expectations
   */
  private clarifyExpectations(text: string): string {
    if (!text.includes('Expected') && !text.includes('Should')) {
      return text + '\n\nExpected: Clear, structured response'
    }

    return text
  }

  /**
   * Make concise
   */
  private makeConcise(text: string): string {
    return this.removeUnnecessaryWords(this.compressWhitespace(text))
  }

  /**
   * Suggest JSON format
   */
  private suggestJSON(text: string): string {
    if (!text.includes('```json') && text.toLowerCase().includes('structure')) {
      return `${text}\n\nFormat the response as JSON with clear keys and values.`
    }

    return text
  }

  /**
   * Get optimization recommendations for a prompt
   */
  getRecommendations(prompt: string, model: string = 'claude'): string[] {
    const recommendations: string[] = []
    const tokens = this.estimateTokens(prompt)

    if (tokens > 1000) {
      recommendations.push('Prompt is long (>1000 tokens). Consider breaking into steps.')
    }

    if (prompt.toLowerCase().includes('please') && prompt.toLowerCase().includes('thank you')) {
      recommendations.push('Remove politeness markers to save tokens (e.g., "please", "thank you")')
    }

    if (!prompt.includes('\n')) {
      recommendations.push('Add line breaks for better structure and clarity')
    }

    if (prompt.includes('  ')) {
      recommendations.push('Multiple spaces detected. Use single spaces.')
    }

    const profile = this.modelProfiles.get(model)
    if (profile) {
      recommendations.push(...profile.recommendations)
    }

    return recommendations
  }

  /**
   * Compare optimization strategies
   */
  compareStrategies(prompt: string, model: string = 'claude'): {
    strategies: Array<OptimizationResult & { name: string }>
    bestStrategy: string
    recommendation: string
  } {
    const cost = this.optimizeForCost(prompt, model)
    const latency = this.optimizeForLatency(prompt, model)
    const quality = this.optimizeForQuality(prompt, model)
    const modelSpecific = this.optimizeForModel(prompt, model)

    const strategies = [
      { ...cost, name: 'Cost Optimization' },
      { ...latency, name: 'Latency Optimization' },
      { ...quality, name: 'Quality Optimization' },
      { ...modelSpecific, name: 'Model-Specific' },
    ]

    // Determine best strategy
    const bestStrategy = strategies.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev
    )

    return {
      strategies,
      bestStrategy: bestStrategy.name,
      recommendation: `Recommended: ${bestStrategy.name} (${bestStrategy.reductionPercent.toFixed(1)}% reduction, ${bestStrategy.confidence.toFixed(2)} confidence)`,
    }
  }
}

/**
 * Global optimizer instance
 */
export const promptOptimizer = new PromptOptimizer()
