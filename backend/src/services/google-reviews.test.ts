import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mapGoogleReviews } from './google-reviews.js'

test('google reviews are mapped and low-rated or empty ones are dropped', () => {
  const items = mapGoogleReviews({
    reviews: [
      { name: 'places/x/reviews/1', rating: 5, text: { text: 'Loved it' }, authorAttribution: { displayName: 'Asha' } },
      { name: 'places/x/reviews/2', rating: 2, text: { text: 'Bad' }, authorAttribution: { displayName: 'B' } },
      { name: 'places/x/reviews/3', rating: 5, text: { text: '' }, authorAttribution: { displayName: 'C' } },
    ],
  })
  assert.equal(items.length, 1)
  assert.equal(items[0]!.authorName, 'Asha')
  assert.equal(items[0]!.authorRole, 'Google review')
  assert.deepEqual(mapGoogleReviews(null), [])
})
