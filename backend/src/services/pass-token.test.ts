import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassToken, newReferenceCode, passIdFromToken, passTokenForId, referenceFromScannedValue, referenceQrValue, tokenFromScannedValue } from './pass-token.js'

test('reference codes are opaque, random and parse back from the QR value', () => {
  const reference = newReferenceCode()
  assert.match(reference, /^[A-HJ-NP-Z2-9]{12}$/)
  assert.notEqual(newReferenceCode(), reference)
  assert.equal(referenceFromScannedValue(referenceQrValue(reference)), reference)
  assert.equal(referenceFromScannedValue(reference.toLowerCase()), reference)
  assert.equal(referenceFromScannedValue('short'), null)
  assert.equal(referenceFromScannedValue(passTokenForId(passId, secret)), null)
})

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

test('website scanner accepts public pass URLs as well as legacy raw tokens', () => {
  const token = passTokenForId(passId, secret)
  assert.equal(tokenFromScannedValue(token), token)
  assert.equal(tokenFromScannedValue(`https://haat.example/visitor/pass/${token}`), token)
  assert.equal(tokenFromScannedValue(`https://haat.example/visitor/pass/${token}?source=camera`), token)
  assert.equal(tokenFromScannedValue('not-a-url'), 'not-a-url')
  assert.equal(tokenFromScannedValue('https://haat.example/unrelated/path'), 'https://haat.example/unrelated/path')
})
