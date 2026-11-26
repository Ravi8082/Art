import { z } from 'zod'

export const publicPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

export function paginationRequested(query: Record<string, unknown>) {
  return query.page !== undefined || query.pageSize !== undefined
}

export function pageMetadata(page: number, pageSize: number, total: number) {
  return { page, pageSize, total, hasMore: page * pageSize < total }
}
