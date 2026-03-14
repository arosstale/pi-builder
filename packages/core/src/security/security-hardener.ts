import crypto from 'crypto'

export interface SecurityConfig {
  enableRateLimiting: boolean
  maxRequestsPerMinute: number
  enableCSRF: boolean
  enableCORS: boolean
  allowedOrigins: string[]
  enableHSTS: boolean
  enableContentSecurityPolicy: boolean
}

export interface SecurityHeaders {
  [key: string]: string
}

export interface RateLimitEntry {
  count: number
  resetTime: number
}

export class SecurityHardener {
  private config: SecurityConfig
  private rateLimitMap: Map<string, RateLimitEntry> = new Map()
  private csrfTokens: Map<string, { token: string; expiresAt: number }> = new Map()

  constructor(config: SecurityConfig) {
    this.config = config
    this.validateConfig()
  }

  private validateConfig(): void {
    if (this.config.maxRequestsPerMinute < 1) {
      throw new Error('maxRequestsPerMinute must be at least 1')
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(userId: string): string {
    if (!this.config.enableCSRF) {
      return ''
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour

    this.csrfTokens.set(userId, { token, expiresAt })
    return token
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(userId: string, token: string): boolean {
    if (!this.config.enableCSRF) {
      return true
    }

    const entry = this.csrfTokens.get(userId)
    if (!entry) return false

    if (entry.expiresAt < Date.now()) {
      this.csrfTokens.delete(userId)
      return false
    }

    return entry.token === token
  }

  /**
   * Check rate limit
   */
  checkRateLimit(clientId: string): boolean {
    if (!this.config.enableRateLimiting) {
      return true
    }

    const now = Date.now()
    const entry = this.rateLimitMap.get(clientId)

    if (!entry) {
      this.rateLimitMap.set(clientId, {
        count: 1,
        resetTime: now + 60 * 1000 // 1 minute
      })
      return true
    }

    if (entry.resetTime < now) {
      // Reset counter
      entry.count = 1
      entry.resetTime = now + 60 * 1000
      return true
    }

    entry.count++
    return entry.count <= this.config.maxRequestsPerMinute
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(clientId: string): { count: number; limit: number; remaining: number } {
    const entry = this.rateLimitMap.get(clientId)
    const count = entry ? entry.count : 0
    const limit = this.config.maxRequestsPerMinute
    const remaining = Math.max(0, limit - count)

    return { count, limit, remaining }
  }

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Validate email
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { valid: boolean; score: number; issues: string[] } {
    const issues: string[] = []
    let score = 0

    if (password.length >= 8) score += 1
    else issues.push('Password must be at least 8 characters')

    if (password.length >= 12) score += 1
    if (/[a-z]/.test(password)) score += 1
    else issues.push('Password must contain lowercase letters')

    if (/[A-Z]/.test(password)) score += 1
    else issues.push('Password must contain uppercase letters')

    if (/[0-9]/.test(password)) score += 1
    else issues.push('Password must contain numbers')

    if (/[!@#$%^&*]/.test(password)) score += 1
    else issues.push('Password must contain special characters')

    return {
      valid: issues.length === 0,
      score: Math.floor((score / 6) * 100),
      issues
    }
  }

  /**
   * Get security headers
   */
  getSecurityHeaders(): SecurityHeaders {
    const headers: SecurityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    }

    if (this.config.enableHSTS) {
      headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    }

    if (this.config.enableContentSecurityPolicy) {
      headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'"
    }

    if (this.config.enableCORS) {
      const origin = this.config.allowedOrigins[0] || 'http://localhost:3000'
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    }

    return headers
  }

  /**
   * Hash sensitive data for logging
   */
  hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8)
  }

  /**
   * Validate CORS origin
   */
  isAllowedOrigin(origin: string): boolean {
    if (!this.config.enableCORS) {
      return true
    }

    return this.config.allowedOrigins.includes(origin) || this.config.allowedOrigins.includes('*')
  }

  /**
   * Generate secure cookie
   */
  generateSecureCookie(name: string, value: string, maxAge: number = 3600): string {
    const httpOnly = 'HttpOnly'
    const secure = 'Secure'
    const sameSite = 'SameSite=Strict'
    const maxAgeStr = `Max-Age=${maxAge}`

    return `${name}=${value}; ${maxAgeStr}; ${httpOnly}; ${secure}; ${sameSite}`
  }

  /**
   * Get security score (0-100)
   */
  getSecurityScore(): number {
    let score = 0

    if (this.config.enableRateLimiting) score += 15
    if (this.config.enableCSRF) score += 15
    if (this.config.enableCORS) score += 15
    if (this.config.enableHSTS) score += 15
    if (this.config.enableContentSecurityPolicy) score += 15
    score += 25 // Base score

    return Math.min(100, score)
  }

  /**
   * Clear expired tokens
   */
  clearExpiredTokens(): number {
    const now = Date.now()
    let cleared = 0

    for (const [userId, entry] of this.csrfTokens.entries()) {
      if (entry.expiresAt < now) {
        this.csrfTokens.delete(userId)
        cleared++
      }
    }

    return cleared
  }

  /**
   * Get security report
   */
  getSecurityReport(): {
    score: number
    enabledFeatures: string[]
    issues: string[]
  } {
    const enabledFeatures: string[] = []
    const issues: string[] = []

    if (this.config.enableRateLimiting) enabledFeatures.push('Rate Limiting')
    else issues.push('Rate limiting disabled')

    if (this.config.enableCSRF) enabledFeatures.push('CSRF Protection')
    else issues.push('CSRF protection disabled')

    if (this.config.enableCORS) enabledFeatures.push('CORS Management')
    else issues.push('CORS not configured')

    if (this.config.enableHSTS) enabledFeatures.push('HSTS')
    else issues.push('HSTS not enabled')

    if (this.config.enableContentSecurityPolicy) enabledFeatures.push('CSP')
    else issues.push('CSP not enabled')

    return {
      score: this.getSecurityScore(),
      enabledFeatures,
      issues
    }
  }
}
