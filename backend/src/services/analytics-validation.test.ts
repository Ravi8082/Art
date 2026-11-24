import assert from 'node:assert/strict'
import test from 'node:test'
import { analyticsEventSchema, normalizeAnalyticsPath, normalizeAnalyticsTarget } from './analytics-validation.js'

test('analytics paths exclude private areas and remove query strings and UUIDs', () => {
  assert.equal(normalizeAnalyticsPath('/artists/7ce25a67-33ca-4fd8-858a-6e5c4db0b613?email=private@example.com'), '/artists/:id')
  assert.equal(normalizeAnalyticsPath('/dashboard/users'), null)
  assert.equal(normalizeAnalyticsPath('/visitor/pass/private-token'), null)
  assert.equal(normalizeAnalyticsPath('//external.example/path'), null)
})

test('analytics targets retain only public paths or an external platform category', () => {
  assert.equal(normalizeAnalyticsTarget('/exhibitions?utm_source=instagram'), '/exhibitions')
  assert.equal(normalizeAnalyticsTarget('external:instagram'), 'external:instagram')
  assert.equal(normalizeAnalyticsTarget('https://external.example/?token=secret'), null)
})

test('analytics events reject personal form fields and arbitrary metadata', () => {
  const event = {
    visitorId: '4a39c2a8-b4c7-4aeb-98c5-67f90cdef018',
    type: 'page_view',
    pagePath: '/exhibitions',
    source: 'instagram',
  }
  assert.equal(analyticsEventSchema.safeParse(event).success, true)
  assert.equal(analyticsEventSchema.safeParse({ ...event, email: 'person@example.com' }).success, false)
  assert.equal(analyticsEventSchema.safeParse({ ...event, source: 'person@example.com' }).success, false)
})
