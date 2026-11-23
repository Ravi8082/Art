import assert from 'node:assert/strict'
import test from 'node:test'
import { hasNotExpired } from '../lib/exhibitions-schedule.js'

test('upcoming cards retain undated announcements but remove expired dates', () => {
  const now = Date.parse('2026-11-20T12:00:00+05:30')
  assert.equal(hasNotExpired(null, now), true)
  assert.equal(hasNotExpired('2026-11-20T12:00:00+05:30', now), true)
  assert.equal(hasNotExpired('2026-11-20T11:59:59+05:30', now), false)
  assert.equal(hasNotExpired('not-a-date', now), false)
})
