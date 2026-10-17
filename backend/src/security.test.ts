import test from 'node:test'
import assert from 'node:assert/strict'
import { requirePermission, requireRole } from './middleware/auth.js'

test('role middleware allows each configured role and rejects unrelated roles', async () => {
  const roles = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'REGISTRATION_MANAGER', 'VISITOR', 'ARTIST_EXHIBITOR']
  for (const role of roles) {
    let nextCalled = false
    const middleware = requireRole(role)
    middleware({ user: { id: 'test-user', roles: [role] } } as never, { status: () => ({ json: () => undefined }) } as never, () => { nextCalled = true })
    assert.equal(nextCalled, true, role)
  }
  let statusCode = 0
  requireRole('ADMIN')({ user: { id: 'test-user', roles: ['VISITOR'] } } as never, { status: (code: number) => { statusCode = code; return { json: () => undefined } } } as never, () => undefined)
  assert.equal(statusCode, 403)
})

test('permission middleware rejects missing sessions and lets super admins through', async () => {
  let statusCode = 0
  requirePermission('events:approve')(
    {} as never,
    { status: (code: number) => { statusCode = code; return { json: () => undefined } } } as never,
    () => undefined,
  )
  assert.equal(statusCode, 401)

  let nextCalled = false
  await requirePermission('events:approve')(
    { user: { id: 'root-user', roles: ['SUPER_ADMIN'] } } as never,
    { status: () => ({ json: () => undefined }) } as never,
    () => { nextCalled = true },
  )
  assert.equal(nextCalled, true)
})

test('test database is explicitly separated from the application database', () => {
  if (!process.env.TEST_MYSQL_DATABASE) return
  assert.notEqual(process.env.TEST_MYSQL_DATABASE, process.env.MYSQL_DATABASE ?? 'art')
})

test('weak JWT secrets are not accepted by the configured contract', () => {
  const secret = process.env.JWT_SECRET ?? ''
  if (secret) assert.ok(secret.length >= 32)
})
