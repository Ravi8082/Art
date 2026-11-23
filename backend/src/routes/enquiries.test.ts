import assert from 'node:assert/strict'
import test from 'node:test'
import { newRefCode } from './enquiries.js'

test('contact references use the THOA year-based public format', () => {
  assert.match(newRefCode(new Date('2026-11-20T00:00:00Z')), /^THOA-ENQ-2026-[A-HJ-NP-Z2-9]{4}$/)
})
