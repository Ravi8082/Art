import assert from 'node:assert/strict'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const configUrl = pathToFileURL(resolve('next.config.mjs')).href
let counter = 0
async function load(env) {
  const saved = { ...process.env }
  delete process.env.BACKEND_API_URL
  delete process.env.NEXT_PUBLIC_BACKEND_API_URL
  Object.assign(process.env, env)
  try {
    const { default: config } = await import(`${configUrl}?case=${counter++}`)
    return { config, rewrites: await config.rewrites() }
  } finally {
    process.env = saved
  }
}

test('without BACKEND_API_URL no proxy is configured (local development talks to the backend directly)', async () => {
  const { config, rewrites } = await load({})
  assert.deepEqual(rewrites, [])
  assert.deepEqual(config.env, {})
})

test('BACKEND_API_URL proxies /api/* to the backend, tolerating a trailing slash', async () => {
  for (const value of ['https://haat-backend.onrender.com', 'https://haat-backend.onrender.com/']) {
    const { rewrites } = await load({ BACKEND_API_URL: value })
    assert.deepEqual(rewrites, [{ source: '/api/:path*', destination: 'https://haat-backend.onrender.com/api/:path*' }])
  }
})

test('the proxy only exposes /api and forwards everything (no header or cookie filtering)', async () => {
  const { rewrites } = await load({ BACKEND_API_URL: 'https://haat-backend.onrender.com' })
  assert.equal(rewrites.length, 1)
  assert.equal(rewrites[0].has, undefined)
  assert.equal(rewrites[0].missing, undefined)
  assert.ok(!rewrites[0].destination.includes('/health'))
})

test('browser code defaults to same-origin URLs when the proxy is on, unless a public URL is set explicitly', async () => {
  assert.deepEqual((await load({ BACKEND_API_URL: 'https://b.onrender.com' })).config.env, { NEXT_PUBLIC_BACKEND_API_URL: '' })
  assert.deepEqual((await load({ BACKEND_API_URL: 'https://b.onrender.com', NEXT_PUBLIC_BACKEND_API_URL: 'http://localhost:4000' })).config.env, {})
})

test('security headers are still applied to every route', async () => {
  const { config } = await load({ BACKEND_API_URL: 'https://b.onrender.com' })
  const [rule] = await config.headers()
  assert.equal(rule.source, '/(.*)')
  assert.ok(rule.headers.some((h) => h.key === 'Strict-Transport-Security'))
})
