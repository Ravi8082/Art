import assert from 'node:assert/strict'
import test from 'node:test'
import jwt from 'jsonwebtoken'
import {
  hashMobileRefreshToken,
  issueMobileAccessToken,
  newMobileRefreshToken,
} from './mobile-tokens.js'

test('mobile refresh tokens are random, URL-safe, and stored as one-way hashes', () => {
  const first = newMobileRefreshToken()
  const second = newMobileRefreshToken()

  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
  assert.match(hashMobileRefreshToken(first), /^[a-f0-9]{64}$/)
  assert.notEqual(hashMobileRefreshToken(first), first)
})

test('mobile access tokens carry a dedicated token use and the current session version', () => {
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'mobile-session-test-secret-with-at-least-32-characters'
  try {
    const token = issueMobileAccessToken('user-id', 7)
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload

    assert.equal(payload.sub, 'user-id')
    assert.equal(payload.sessionVersion, 7)
    assert.equal(payload.tokenUse, 'mobile_access')
    assert.equal(payload.exp! - payload.iat!, 15 * 60)
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  }
})
