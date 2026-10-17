import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeHtml } from './services/html-sanitize.js'

test('html sanitizer keeps allowed rich text and strips unsafe markup', () => {
  const clean = sanitizeHtml('<p>Hello <b>world</b> <a href="https://example.com">link</a></p><ul><li>one</li></ul>')
  assert.match(clean, /<p>Hello <b>world<\/b>/)
  assert.match(clean, /href="https:\/\/example\.com"/)
  assert.match(clean, /<li>one<\/li>/)
})

test('html sanitizer removes scripts, styles, event handlers and javascript urls', () => {
  const dirty = sanitizeHtml('<script>alert(1)</script><style>p{}</style><p onclick="evil()">text</p><a href="javascript:alert(1)">bad</a><img src=x onerror=alert(1)>')
  assert.doesNotMatch(dirty, /script/i)
  assert.doesNotMatch(dirty, /style/i)
  assert.doesNotMatch(dirty, /onclick/i)
  assert.doesNotMatch(dirty, /javascript:/i)
  assert.doesNotMatch(dirty, /onerror/i)
  assert.doesNotMatch(dirty, /<img/i)
  assert.match(dirty, /<p>text<\/p>/)
})
