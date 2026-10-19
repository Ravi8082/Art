import { raw, Router } from 'express'
import crypto from 'node:crypto'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'
import { announceEvent } from './newsletter.js'
import { countAudience } from '../services/outbox.js'
import rateLimit from 'express-rate-limit'
import { cachePublic } from '../middleware/cache.js'

export const eventsRouter = Router()
const announceLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const eventInput = z.object({ title: z.string().trim().min(2).max(255), description: z.string().trim().min(10), startsAt: z.coerce.date(), endsAt: z.coerce.date(), venue: z.string().trim().min(2).max(255), city: z.string().trim().max(500).default(''), state: z.string().trim().max(255).default(''), registrationDeadline: z.coerce.date().nullable().optional() }).refine((value) => value.endsAt > value.startsAt, 'End must be after start')
const stallPlan = z.array(z.object({ stallTypeId: z.string().uuid(), count: z.coerce.number().int().min(0).max(500) })).max(20).default([])
const slugify = (value: string) => `${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${crypto.randomBytes(3).toString('hex')}`

eventsRouter.get('/', cachePublic(30), async (_req, res, next) => {
  try {
    const [events] = await pool.query<any[]>(`
      SELECT e.id, e.slug, e.title, e.description, e.starts_at startsAt, e.ends_at endsAt,
        e.venue, e.city, e.state, e.status
      FROM events e
      WHERE e.status IN ('PUBLISHED','APPROVED')
      ORDER BY e.starts_at
    `)
    if (!events.length) return res.json([])

    const placeholders = events.map(() => '?').join(',')
    const [media] = await pool.query<any[]>(`
      SELECT id, event_id eventId, alt_text altText, media_type mediaType
      FROM event_media
      WHERE event_id IN (${placeholders}) AND data IS NOT NULL
      ORDER BY sort_order, id
    `, events.map((event) => event.id))
    const mediaByEvent = new Map<string, typeof media>()
    for (const item of media) {
      const group = mediaByEvent.get(item.eventId) ?? []
      group.push(item)
      mediaByEvent.set(item.eventId, group)
    }
    res.json(events.map((event) => ({
      ...event,
      media: (mediaByEvent.get(event.id) ?? []).map((item) => ({
        id: item.id,
        altText: item.altText,
        mediaType: item.mediaType,
        url: `/api/events/${event.id}/media/${item.id}`,
      })),
    })))
  } catch (error) {
    next(error)
  }
})

const splitList = (value: unknown) => String(value ?? '').split(/[,;/]|\band\b/i).map((part) => part.replace(/^(pan india|multiple states)\s*[—-]\s*/i, '').trim()).filter(Boolean)

eventsRouter.get('/admin/overview', requireAuth, requirePermission('events:publish'), async (_req, res, next) => {
  try {
    const [events] = await pool.query<any[]>(`
      SELECT e.id, e.slug, e.title, e.venue, e.city, e.state, e.status, e.starts_at startsAt, e.ends_at endsAt,
        e.announced_at announcedAt, e.announce_summary announceSummary,
        (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id=e.id AND r.status='REGISTERED') registrations,
        (SELECT COUNT(*) FROM exhibition_applications a WHERE a.event_id=e.id) applications,
        (SELECT COUNT(*) FROM stalls s WHERE s.event_id=e.id) totalStalls,
        (SELECT COUNT(*) FROM stalls s WHERE s.event_id=e.id AND s.status='AVAILABLE'
           AND NOT EXISTS (SELECT 1 FROM stall_bookings b WHERE b.stall_id=s.id AND b.status IN ('CONFIRMED','PAYMENT_PENDING','REFUND_PENDING'))) availableStalls
      FROM events e WHERE e.status <> 'REJECTED' ORDER BY e.starts_at DESC LIMIT 100`)
    const [byCity] = await pool.query<any[]>(`
      SELECT r.event_id eventId, COALESCE(NULLIF(v.city,''),'Not given') city, COUNT(*) total
      FROM event_registrations r JOIN visitor_profiles v ON v.id=r.visitor_id
      WHERE r.status='REGISTERED' GROUP BY r.event_id, city`)
    const [artistStates] = await pool.query<any[]>(`
      SELECT COALESCE(NULLIF(state,''),'Not given') state, COUNT(*) total
      FROM artist_profiles GROUP BY state ORDER BY total DESC`)
    const audience = await countAudience()
    res.json({
      audience,
      artistStates,
      events: events.map((event) => ({
        ...event,
        announceSummary: typeof event.announceSummary === 'string' ? JSON.parse(event.announceSummary) : event.announceSummary,
        cities: splitList(event.city),
        states: splitList(event.state),
        visitorCities: byCity.filter((row) => row.eventId === event.id).map((row) => ({ city: row.city, total: Number(row.total) })),
      })),
    })
  } catch (error) {
    next(error)
  }
})

eventsRouter.get('/:id/media/:mediaId', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT media.data, media.mime_type
      FROM event_media media
      JOIN events e ON e.id = media.event_id
      WHERE e.id = ? AND media.id = ? AND e.status IN ('PUBLISHED','APPROVED')
    `, [req.params.id, req.params.mediaId])
    if (!rows[0]?.data) return res.status(404).json({ error: 'Event media not found' })
    res.set('Content-Type', rows[0].mime_type)
    res.set('Cache-Control', 'public, max-age=3600')
    res.send(rows[0].data)
  } catch (error) {
    next(error)
  }
})

eventsRouter.post('/', requireAuth, requirePermission('events:create'), async (req: AuthRequest, res, next) => {
  try {
    const value = eventInput.parse(req.body)
    const plan = stallPlan.parse(req.body?.stalls ?? []).filter((item) => item.count > 0)
    if (plan.length) {
      const granted = await new Promise<boolean>((resolve) => {
        void requirePermission('bookings:manage')(req, res, (error?: unknown) => resolve(!error)).then(() => { if (res.headersSent) resolve(false) })
      })
      if (!granted) { if (!res.headersSent) res.status(403).json({ error: 'Insufficient permissions' }); return }
    }
    const id = crypto.randomUUID()
    const stallsCreated = await withTransaction(async (db) => {
      await db.query('INSERT INTO events(id,title,slug,description,starts_at,ends_at,venue,city,state,registration_deadline,status,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,\'PENDING_APPROVAL\',?)', [id, value.title, slugify(value.title), value.description, value.startsAt, value.endsAt, value.venue, value.city, value.state, value.registrationDeadline ?? null, req.user!.id])
      let order = 0
      for (const item of plan) {
        const [types] = await db.query<any[]>('SELECT code FROM stall_types WHERE id=? AND active=1', [item.stallTypeId])
        if (!types[0]) throw Object.assign(new Error('Unknown stall type'), { status: 400 })
        for (let n = 1; n <= item.count; n += 1) {
          order += 1
          await db.query('INSERT INTO stalls(id,event_id,stall_type_id,code,sort_order) VALUES (?,?,?,?,?)', [crypto.randomUUID(), id, item.stallTypeId, `${String(types[0].code).slice(0, 13)}-${String(n).padStart(3, '0')}`, order])
        }
      }
      return order
    })
    res.status(201).json({ id, status: 'PENDING_APPROVAL', stalls: stallsCreated })
  } catch (error) { next(error) }
})

eventsRouter.post('/:id/media', requireAuth, requirePermission('content:manage'), raw({
  type: [...supportedMediaTypes.keys()],
  limit: '50mb',
}), async (req: AuthRequest, res, next) => {
  try {
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    const mediaType = contentType ? supportedMediaTypes.get(contentType) : undefined
    if (!contentType || !mediaType) return res.status(415).json({ error: 'Unsupported media type' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Media file is required' })
    if (!hasValidMediaSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its media type' })

    const rawAlt = req.get('x-alt-text') ?? ''
    let decodedAlt = rawAlt
    try { decodedAlt = decodeURIComponent(rawAlt) } catch { /* plain-text header from older clients */ }
    const altText = z.string().trim().min(1).max(255).safeParse(decodedAlt)
    if (!altText.success) return res.status(400).json({ error: 'Valid x-alt-text header is required' })

    const id = crypto.randomUUID()
    const result = await withTransaction(async (db) => {
      const [events] = await db.query<any[]>('SELECT status FROM events WHERE id=? FOR UPDATE', [req.params.id])
      if (!events[0]) return 'missing'
      if (events[0].status === 'PUBLISHED') return 'published'
      await db.query(
        'INSERT INTO event_media(id,event_id,url,alt_text,sort_order,mime_type,media_type,byte_size,data) VALUES (?,?,NULL,?,0,?,?,?,?)',
        [id, req.params.id, altText.data, contentType, mediaType, req.body.length, req.body],
      )
      return 'created'
    })

    if (result === 'missing') return res.status(404).json({ error: 'Event not found' })
    if (result === 'published') return res.status(409).json({ error: 'Published events cannot be changed' })
    res.status(201).json({ id, mediaType, mimeType: contentType, byteSize: req.body.length })
  } catch (error) {
    next(error)
  }
})

eventsRouter.patch('/:id/approve', requireAuth, requirePermission('events:approve'), async (req: AuthRequest, res, next) => { try { const [result] = await pool.query<any>('UPDATE events SET status=\'APPROVED\',approved_by=? WHERE id=? AND status=\'PENDING_APPROVAL\'', [req.user!.id, req.params.id]); if (!result.affectedRows) return res.status(409).json({ error: 'Event is not awaiting approval' }); res.json({ status: 'APPROVED' }) } catch (error) { next(error) } })
eventsRouter.patch('/:id', requireAuth, requirePermission('events:edit'), async (req: AuthRequest, res, next) => { try { const value = eventInput.partial().parse(req.body); const fields = Object.entries(value); if (!fields.length) return res.status(400).json({ error: 'At least one field is required' }); const allowed = new Set(['title','description','startsAt','endsAt','venue','city','state','registrationDeadline']); const updates = fields.filter(([key]) => allowed.has(key)); if (!updates.length) return res.status(400).json({ error: 'No editable fields supplied' }); const set = updates.map(([key]) => `${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}=?`).join(','); const values = updates.map(([, value]) => value); const [result] = await pool.query<any>(`UPDATE events SET ${set}, status='PENDING_APPROVAL' WHERE id=? AND status NOT IN ('PUBLISHED')`, [...values, req.params.id]); if (!result.affectedRows) return res.status(409).json({ error: 'Event cannot be edited in its current state' }); res.json({ status: 'PENDING_APPROVAL' }) } catch (error) { next(error) } })

eventsRouter.patch('/:id/publish', requireAuth, requirePermission('events:publish'), async (req, res, next) => { try { const [result] = await pool.query<any>('UPDATE events SET status=\'PUBLISHED\',published_at=NOW() WHERE id=? AND status=\'APPROVED\'', [req.params.id]); if (!result.affectedRows) return res.status(409).json({ error: 'Only approved events can be published' }); void announceEvent(String(req.params.id)).catch((error) => console.error('Event announcement failed', error)); res.json({ status: 'PUBLISHED' }) } catch (error) { next(error) } })

eventsRouter.post('/:id/announce', requireAuth, requirePermission('events:publish'), announceLimit, async (req: AuthRequest, res, next) => { try { const outcome = await announceEvent(String(req.params.id), { force: true }); await pool.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)', [req.user!.id, 'EVENT_ANNOUNCE_RESEND', 'event', String(req.params.id), JSON.stringify(outcome)]); res.json(outcome) } catch (error) { next(error) } })

eventsRouter.patch('/:id/archive', requireAuth, requirePermission('events:publish'), async (req, res, next) => { try { const [result] = await pool.query<any>(`UPDATE events SET status='REJECTED' WHERE id=? AND status='PUBLISHED'`, [req.params.id]); if (!result.affectedRows) return res.status(409).json({ error: 'Only published events can be archived' }); res.json({ status: 'REJECTED' }) } catch (error) { next(error) } })
