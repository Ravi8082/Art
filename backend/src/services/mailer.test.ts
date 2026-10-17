import assert from 'node:assert/strict'
import test from 'node:test'
import { otpCode } from './mailer.js'

test('OTP generator returns six-digit codes', () => {
  for (let i = 0; i < 100; i++) {
    assert.match(otpCode(), /^\d{6}$/)
  }
})
