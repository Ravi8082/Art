import type { NextFunction, Request, Response } from 'express'

type Entry = { body: unknown; expires: number }
const MAX_ENTRIES = 500

// Short-lived response cache for public GET endpoints so traffic spikes hit memory (and the CDN), not MySQL.
export function cachePublic(ttlSeconds: number) {
  const store = new Map<string, Entry>()
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next()
    res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 2}`)
    const key = req.originalUrl
    const hit = store.get(key)
    if (hit && hit.expires > Date.now()) return res.json(hit.body)
    const send = res.json.bind(res)
    res.json = (body: unknown) => {
      if (res.statusCode === 200) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value as string)
        store.set(key, { body, expires: Date.now() + ttlSeconds * 1000 })
      } else {
        res.setHeader('Cache-Control', 'no-store')
      }
      return send(body)
    }
    next()
  }
}
