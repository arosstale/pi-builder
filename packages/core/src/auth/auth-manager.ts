import crypto from 'crypto'

export interface JWTPayload {
  userId: string
  email: string
  role: 'user' | 'admin'
  iat: number
  exp: number
}

export interface AuthConfig {
  jwtSecret: string
  jwtExpiresIn: number // seconds
  saltRounds: number
}

export class AuthManager {
  private config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
    this.validateConfig()
  }

  private validateConfig(): void {
    if (!this.config.jwtSecret || this.config.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters')
    }
    if (this.config.jwtExpiresIn < 300) {
      throw new Error('JWT expiration must be at least 300 seconds (5 minutes)')
    }
  }

  /**
   * Hash password using crypto
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex')
    return `${salt}:${hash}`
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hash: string): boolean {
    const [salt, storedHash] = hash.split(':')
    const computedHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
      .toString('hex')
    return computedHash === storedHash
  }

  /**
   * Create JWT token
   */
  createToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000)
    const jwt: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + this.config.jwtExpiresIn
    }

    // Simple JWT encoding (in production, use jsonwebtoken library)
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    }

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(jwt)).toString('base64url')

    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url')

    return `${encodedHeader}.${encodedPayload}.${signature}`
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.')

      if (!encodedHeader || !encodedPayload || !signature) {
        return null
      }

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwtSecret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url')

      if (signature !== expectedSignature) {
        return null
      }

      // Decode payload
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString()
      ) as JWTPayload

      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }

      return payload
    } catch (error) {
      return null
    }
  }

  /**
   * Create refresh token (longer expiration)
   */
  createRefreshToken(userId: string): string {
    const now = Math.floor(Date.now() / 1000)
    const refreshToken = {
      userId,
      type: 'refresh',
      iat: now,
      exp: now + this.config.jwtExpiresIn * 7 // 7x longer
    }

    const encoded = Buffer.from(JSON.stringify(refreshToken)).toString('base64url')
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(encoded)
      .digest('base64url')

    return `${encoded}.${signature}`
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const [encoded, signature] = token.split('.')

      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwtSecret)
        .update(encoded)
        .digest('base64url')

      if (signature !== expectedSignature) {
        return null
      }

      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())

      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }

      return { userId: payload.userId }
    } catch (error) {
      return null
    }
  }

  /**
   * Generate secure random token (for email verification, password reset, etc.)
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * Check if user has required role
   */
  hasRole(payload: JWTPayload, requiredRole: string | string[]): boolean {
    if (typeof requiredRole === 'string') {
      return payload.role === requiredRole
    }
    return requiredRole.includes(payload.role)
  }

  /**
   * Check if token is about to expire (within 5 minutes)
   */
  isTokenExpiringSoon(payload: JWTPayload, windowSeconds: number = 300): boolean {
    const now = Math.floor(Date.now() / 1000)
    return payload.exp - now < windowSeconds
  }
}
