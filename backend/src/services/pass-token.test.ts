import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassToken, passIdFromToken, passTokenForId } from './pass-token.js'

const passId = 'a71d5f5a-5a24-4d74-82be-1bfa14c382f7'
const secret = 'test-secret-with-at-least-32-characters'

test('visitor pass tokens are verifiable and stable for a pass id', () => {
  const token = passTokenForId(passId, secret)
  assert.equal(passTokenForId(passId, secret), token)
  assert.equal(passIdFromToken(token, secret), passId)
  assert.equal(hashPassToken(token).length, 64)
})

test('visitor pass tokens reject tampering, a different secret, and malformed ids', () => {
  const token = passTokenForId(passId, secret)
  assert.equal(passIdFromToken(token, `${secret}-other`), null)
  assert.equal(passIdFromToken(`${passId}.invalid`, secret), null)
  assert.equal(passIdFromToken(`not-a-uuid.${token.split('.')[1]}`, secret), null)
  assert.equal(passIdFromToken(`${token}.extra`, secret), null)
})
