import assert from 'node:assert/strict'
import test from 'node:test'
import { otpCode, selectEmailProvider, sendEmail } from './mailer.js'
import { sessionCookieOptions } from '../middleware/session-cookie.js'

test('OTP generator returns six-digit codes', () => {
  for (let i = 0; i < 100; i++) {
    assert.match(otpCode(), /^\d{6}$/)
  }
})

test('email provider selection keeps SMTP and log behaviour and only enables Brevo explicitly', () => {
  assert.equal(selectEmailProvider({}), 'none')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'log' }), 'none')
  assert.equal(selectEmailProvider({ SMTP_HOST: 'smtp.example.com' }), 'smtp')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'log', SMTP_HOST: 'smtp.example.com' }), 'smtp')
  // A Brevo key alone must never switch real email on.
  assert.equal(selectEmailProvider({ BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'a@example.com' }), 'none')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'brevo', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 'a@example.com' }), 'brevo')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'BREVO', BREVO_API_KEY: 'k', MAIL_FROM: 'Haat <a@example.com>' }), 'brevo')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'brevo', BREVO_SENDER_EMAIL: 'a@example.com' }), 'none')
  assert.equal(selectEmailProvider({ MAIL_MODE: 'brevo', BREVO_API_KEY: 'k' }), 'none')
})

test('unconfigured mail reports not configured without sending anything', async () => {
  const saved = { ...process.env }
  const realFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => { calls++; return new Response('{}') }) as typeof fetch
  try {
    delete process.env.SMTP_HOST; delete process.env.BREVO_API_KEY; process.env.MAIL_MODE = 'log'
    assert.deepEqual(await sendEmail('x@example.com', 's', 't'), { configured: false, accepted: false })
    assert.equal(calls, 0)
  } finally { globalThis.fetch = realFetch; process.env = saved }
})

test('Brevo sends over HTTPS with the key in a header, and errors never contain the key', async () => {
  const saved = { ...process.env }
  const realFetch = globalThis.fetch
  const secretKey = 'xkeysib-test-secret-value'
  let seen: { url: string; init: RequestInit } | undefined
  Object.assign(process.env, { MAIL_MODE: 'brevo', BREVO_API_KEY: secretKey, BREVO_SENDER_EMAIL: 'sender@example.com', BREVO_SENDER_NAME: 'Haat' })
  try {
    globalThis.fetch = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('{"messageId":"1"}', { status: 201 }) }) as typeof fetch
    assert.deepEqual(await sendEmail('to@example.com', 'Subject', 'Body'), { configured: true, accepted: true })
    assert.equal(seen?.url, 'https://api.brevo.com/v3/smtp/email')
    assert.equal((seen?.init.headers as Record<string, string>)['api-key'], secretKey)
    const body = JSON.parse(String(seen?.init.body))
    assert.deepEqual(body.to, [{ email: 'to@example.com' }])
    assert.deepEqual(body.sender, { email: 'sender@example.com', name: 'Haat' })
    assert.equal(String(seen?.init.body).includes(secretKey), false)

    globalThis.fetch = (async () => new Response(`rejected ${secretKey}`, { status: 401 })) as typeof fetch
    await assert.rejects(() => sendEmail('to@example.com', 'S', 'B'), (error: Error) => {
      assert.match(error.message, /status 401/)
      assert.equal(error.message.includes(secretKey), false)
      return true
    })
  } finally { globalThis.fetch = realFetch; process.env = saved }
})

test('session cookie is httpOnly, signed, host-only and secure in production', () => {
  const production = sessionCookieOptions({ NODE_ENV: 'production' })
  assert.equal(production.httpOnly, true)
  assert.equal(production.signed, true)
  assert.equal(production.secure, true)
  assert.equal(production.sameSite, 'lax')
  assert.equal(production.maxAge, 15 * 60 * 1000)
  assert.equal('domain' in production, false)
  assert.equal(sessionCookieOptions({ NODE_ENV: 'development' }).secure, false)
})
