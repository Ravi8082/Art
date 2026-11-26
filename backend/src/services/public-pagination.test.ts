import assert from 'node:assert/strict'
import test from 'node:test'
import { pageMetadata, publicPaginationSchema, paginationRequested } from './public-pagination.js'

test('public pagination defaults safely and bounds each requested page', () => {
  assert.deepEqual(publicPaginationSchema.parse({}), { page: 1, pageSize: 20 })
  assert.deepEqual(publicPaginationSchema.parse({ page: '2', pageSize: '10' }), { page: 2, pageSize: 10 })
  assert.equal(publicPaginationSchema.safeParse({ page: '0' }).success, false)
  assert.equal(publicPaginationSchema.safeParse({ pageSize: '51' }).success, false)
})

test('pagination metadata reports whether another page exists', () => {
  assert.deepEqual(pageMetadata(1, 20, 21), { page: 1, pageSize: 20, total: 21, hasMore: true })
  assert.equal(pageMetadata(2, 20, 21).hasMore, false)
  assert.equal(paginationRequested({ upcoming: 'true' }), false)
  assert.equal(paginationRequested({ page: '1' }), true)
})
