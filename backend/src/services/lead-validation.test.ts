import assert from 'node:assert/strict'
import test from 'node:test'
import { hasValidWhatsAppContact, leadAttributionSchema } from './lead-validation.js'

test('lead attribution accepts bounded campaign labels and defaults to no marketing consent', () => {
  assert.deepEqual(leadAttributionSchema.parse({}), {
    source: 'direct',
    medium: null,
    campaign: null,
    marketingEmailConsent: false,
    marketingWhatsAppConsent: false,
  })
  assert.equal(leadAttributionSchema.safeParse({
    source: 'instagram',
    medium: 'paid-social',
    campaign: 'winter-reel-2026',
    marketingEmailConsent: true,
    marketingWhatsAppConsent: true,
  }).success, true)
})

test('lead attribution rejects personal data and malformed campaign labels', () => {
  assert.equal(leadAttributionSchema.safeParse({ campaign: 'person@example.com' }).success, false)
  assert.equal(leadAttributionSchema.safeParse({ source: 'person@example.com' }).success, false)
  assert.equal(leadAttributionSchema.safeParse({ unexpected: 'field' }).success, false)
})

test('WhatsApp marketing consent requires a contactable phone number', () => {
  assert.equal(hasValidWhatsAppContact('', false), true)
  assert.equal(hasValidWhatsAppContact('9876543210', true), true)
  assert.equal(hasValidWhatsAppContact('123', true), false)
})
