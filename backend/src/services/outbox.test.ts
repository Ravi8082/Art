import assert from 'node:assert/strict'
import test from 'node:test'
import { retryDelaySeconds } from './outbox.js'

test('retry backoff grows and is capped at one hour', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(retryDelaySeconds), [60, 300, 900, 3600, 3600, 3600])
})
