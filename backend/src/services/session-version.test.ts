import assert from 'node:assert/strict'
import test from 'node:test'
import { sessionVersionMatches } from './session-version.js'

test('session versions accept the current version and legacy version zero', () => {
  assert.equal(sessionVersionMatches(undefined, 0), true)
  assert.equal(sessionVersionMatches(4, '4'), true)
})

test('session versions reject revoked and malformed token claims', () => {
  assert.equal(sessionVersionMatches(0, 1), false)
  assert.equal(sessionVersionMatches('1', 1), false)
  assert.equal(sessionVersionMatches(-1, -1), false)
  assert.equal(sessionVersionMatches(1.5, 1.5), false)
  assert.equal(sessionVersionMatches(0, null), false)
})
