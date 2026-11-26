import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

const accessLifetimeSeconds = 15 * 60

function jwtSecret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}

export function newMobileRefreshToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export function hashMobileRefreshToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function issueMobileAccessToken(userId: string, sessionVersion: number) {
  return jwt.sign(
    { sub: userId, sessionVersion, tokenUse: 'mobile_access' },
    jwtSecret(),
    { algorithm: 'HS256', expiresIn: accessLifetimeSeconds },
  )
}
