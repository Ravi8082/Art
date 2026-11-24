import assert from 'node:assert/strict'
import test from 'node:test'
import { publicPassView, type PublicPassRecord } from './public-pass.js'

const validPass: PublicPassRecord = {
  eventTitle: 'Mumbai Art Fair',
  city: 'Mumbai',
  venue: 'Art Hall',
  startsAt: '2026-12-01T10:00:00.000Z',
  endsAt: '2026-12-01T18:00:00.000Z',
  revokedAt: null,
  registrationStatus: 'REGISTERED',
  paymentStatus: 'NOT_REQUIRED',
  checkedIn: false,
  notStarted: false,
  dayOver: false,
}

test('public pass view returns only event logistics and a validity verdict', () => {
  assert.deepEqual(publicPassView(validPass), {
    event: 'Mumbai Art Fair',
    city: 'Mumbai',
    venue: 'Art Hall',
    startsAt: '2026-12-01T10:00:00.000Z',
    endsAt: '2026-12-01T18:00:00.000Z',
    status: 'Valid',
  })
})

test('public pass view does not mark revoked, pending, used, inactive, or expired passes valid', () => {
  const invalidRecords: PublicPassRecord[] = [
    { ...validPass, revokedAt: '2026-11-01T10:00:00.000Z' },
    { ...validPass, registrationStatus: 'CANCELLED' },
    { ...validPass, paymentStatus: 'PENDING' },
    { ...validPass, checkedIn: true },
    { ...validPass, notStarted: true },
    { ...validPass, dayOver: true },
  ]

  for (const record of invalidRecords) {
    assert.equal(publicPassView(record).status, 'Not valid')
  }
})
