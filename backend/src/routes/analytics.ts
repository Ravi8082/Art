import rateLimit from '../services/rate-limit.js'
import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { analyticsEventSchema, normalizeAnalyticsPath, normalizeAnalyticsTarget } from '../services/analytics-validation.js'

export const analyticsRouter = Router()

const analyticsLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false })

analyticsRouter.post('/events', analyticsLimit, async (req, res, next) => {
  try {
    const event = analyticsEventSchema.parse(req.body)
    const pagePath = normalizeAnalyticsPath(event.pagePath)
    const targetPath = normalizeAnalyticsTarget(event.targetPath)
    if (!pagePath) return res.status(400).json({ error: 'Invalid analytics event' })
    await pool.query(
      `INSERT INTO site_analytics_events(visitor_id,event_type,page_path,target_path,source,medium,campaign)
       VALUES (?,?,?,?,?,?,?)`,
      [event.visitorId, event.type.toUpperCase(), pagePath, targetPath ?? null, event.source.toUpperCase(), event.medium ?? null, event.campaign ?? null],
    )
    res.status(202).json({ ok: true })
  } catch (error) {
    next(error)
  }
})

analyticsRouter.delete('/consent', analyticsLimit, async (req, res, next) => {
  try {
    const { visitorId } = z.object({ visitorId: z.string().uuid() }).strict().parse(req.body)
    await pool.query('DELETE FROM site_analytics_events WHERE visitor_id=?', [visitorId])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
