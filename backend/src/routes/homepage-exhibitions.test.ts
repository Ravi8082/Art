import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { exhibitionAnnouncementInput } from './homepage.js'

const baseInput = {
  title: 'The Haat of Art — Jaipur Edition',
  description: 'A new showcase of contemporary Indian art and local artists.',
  state: 'Rajasthan',
  city: 'Jaipur',
  venue: '',
  startsAt: null,
  endsAt: null,
  isFirstInState: true,
  imageKey: null,
  status: 'PUBLISHED',
}

describe('homepage exhibition announcements', () => {
  it('allows a published state announcement with dates not yet announced', () => {
    const result = exhibitionAnnouncementInput.safeParse(baseInput)
    assert.equal(result.success, true)
    if (result.success) {
      assert.equal(result.data.startsAt, null)
      assert.equal(result.data.endsAt, null)
      assert.equal(result.data.isFirstInState, true)
    }
  })

  it('requires both dates or neither date', () => {
    const result = exhibitionAnnouncementInput.safeParse({ ...baseInput, startsAt: '2027-01-01T10:00:00.000Z' })
    assert.equal(result.success, false)
  })

  it('rejects an end date that is not after the start date', () => {
    const result = exhibitionAnnouncementInput.safeParse({
      ...baseInput,
      startsAt: '2027-01-02T10:00:00.000Z',
      endsAt: '2027-01-01T10:00:00.000Z',
    })
    assert.equal(result.success, false)
  })
})
