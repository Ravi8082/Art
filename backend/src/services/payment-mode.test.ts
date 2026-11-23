import assert from 'node:assert/strict'
import test from 'node:test'
import { paymentModeFor } from './payment-mode.js'

test('production payment methods require manual verification', () => {
  assert.equal(paymentModeFor('ONLINE', 'production'), 'unavailable')
  assert.equal(paymentModeFor('UPI', 'production'), 'unavailable')
  assert.equal(paymentModeFor('BANK_TRANSFER', 'production'), 'manual')
  assert.equal(paymentModeFor('ONLINE', 'development'), 'sandbox')
  assert.equal(paymentModeFor('UPI', 'test'), 'sandbox')
})
