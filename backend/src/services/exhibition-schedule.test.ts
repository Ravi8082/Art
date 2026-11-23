import assert from 'node:assert/strict'
import test from 'node:test'
import { currentIndiaSqlDateTime, isScheduleActive, toIndiaSqlDateTime } from './exhibition-schedule.js'

test('schedule timestamps preserve India-local wall time in the database', () => {
  assert.equal(toIndiaSqlDateTime('2026-12-07T23:59:59+05:30'), '2026-12-07 23:59:59')
  assert.equal(currentIndiaSqlDateTime(new Date('2026-12-07T18:29:59.000Z')), '2026-12-07 23:59:59')
})

test('schedule expiry includes the final second and excludes undated entries', () => {
  const endDate = '2026-12-07T23:59:59+05:30'
  assert.equal(isScheduleActive(endDate, Date.parse(endDate)), true)
  assert.equal(isScheduleActive(endDate, Date.parse(endDate) + 1), false)
  assert.equal(isScheduleActive(null), false)
})

