import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from '../services/rate-limit.js'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, requireRole, type AuthRequest } from '../middleware/auth.js'
import { cachePublic } from '../middleware/cache.js'
import { hashPassToken, newReferenceCode, referenceQrValue } from '../services/pass-token.js'

export const exhibitionsRouter = Router()
export const visitorPassesRouter = Router()

const publicPassLimit = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const openEventWhere = `e.status IN ('APPROVED','PUBLISHED') AND e.ends_at>=NOW()
  AND (e.registration_deadline IS NULL OR e.registration_deadline>NOW())`
const freePerksDefault = [
  '3-day exhibition access',
  'Live art demonstrations',
  'Artist gallery walkthroughs',
]
const paidPerksDefault = [
  'Priority fast-track entry',
  'Opening-day collector preview access',
  'Printed exhibition catalog',
  'Reserved workshop seat',
]
const adminRoles = ['ADMIN', 'SUPER_ADMIN']

type PassMode = 'FREE' | 'PAID' | 'BOTH'
type PassTierConfig = {
  passMode: PassMode
  freeCapacity: number | null
  freeRemaining: number | null
  paidPrice: number
  paidCapacity: number | null
  paidRemaining: number | null
  freePerks: string[]
  paidPerks: string[]
}

function jsonArray(value: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string')
    } catch {
      return fallback
    }
  }
  return fallback
}

function passConfig(row?: Record<string, unknown> | null, freeIssued = 0, paidIssued = 0): PassTierConfig {
  const freeCapacity = row?.freeCapacity == null ? null : Number(row.freeCapacity)
  const paidCapacity = row?.paidCapacity == null ? null : Number(row.paidCapacity)
  return {
    passMode: row?.passMode === 'FREE' || row?.passMode === 'PAID' ? row.passMode : 'BOTH',
    freeCapacity,
    freeRemaining: freeCapacity == null ? null : Math.max(0, freeCapacity - freeIssued),
    paidPrice: row?.paidPrice == null ? 499 : Number(row.paidPrice),
    paidCapacity,
    paidRemaining: paidCapacity == null ? null : Math.max(0, paidCapacity - paidIssued),
    freePerks: jsonArray(row?.freePerks, freePerksDefault),
    paidPerks: jsonArray(row?.paidPerks, paidPerksDefault),
  }
}

exhibitionsRouter.get('/stalls', publicPassLimit, async (_req, res, next) => {
  try {
    const [stallTypes] = await pool.query<any[]>(`SELECT id, code, name, category, width_m widthM, depth_m depthM, includes
      FROM stall_types WHERE active=1 ORDER BY sort_order, price`)
    const [rows] = await pool.query<any[]>(`SELECT e.id eventId, e.title, e.city, e.venue,
        e.starts_at startsAt, e.ends_at endsAt, st.code stallTypeCode,
        pricing.price, pricing.tax_rate taxRate
      FROM events e
      LEFT JOIN event_stall_pricing pricing ON pricing.event_id=e.id AND pricing.public_visible=1
      LEFT JOIN stall_types st ON st.id=pricing.stall_type_id AND st.active=1
      WHERE e.status IN ('APPROVED','PUBLISHED') AND e.ends_at>=NOW()
      ORDER BY e.starts_at ASC, e.id ASC, st.sort_order ASC`)
    const editions = new Map<string, {
      eventId: string
      title: string
      city: string
      venue: string
      startsAt: Date | string
      endsAt: Date | string
      rates: Record<string, { price: number; taxRate: number }>
    }>()

    for (const row of rows) {
      const edition: {
        eventId: string
        title: string
        city: string
        venue: string
        startsAt: Date | string
        endsAt: Date | string
        rates: Record<string, { price: number; taxRate: number }>
      } = editions.get(row.eventId) ?? {
        eventId: row.eventId,
        title: row.title,
        city: row.city ?? '',
        venue: row.venue ?? '',
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        rates: {},
      }
      if (row.stallTypeCode && row.price != null) {
        edition.rates[String(row.stallTypeCode)] = {
          price: Number(row.price),
          taxRate: Number(row.taxRate),
        }
      }
      editions.set(row.eventId, edition)
    }

    res.setHeader('Cache-Control', 'no-store')
    res.json({ stallTypes, editions: [...editions.values()] })
  } catch (error) {
    next(error)
  }
})

async function findEventBySlug(slugValue: unknown, allowUnpublished = false) {
  const slug = z.string().trim().min(1).max(255).parse(slugValue)
  const statusFilter = allowUnpublished ? '' : `AND ${openEventWhere}`
  const [rows] = await pool.query<any[]>(`SELECT e.id,e.slug,e.title,e.city,e.state,e.venue,
    e.starts_at startsAt,e.ends_at endsAt,e.registration_deadline registrationDeadline
    FROM events e WHERE e.slug=? ${statusFilter} LIMIT 1`, [slug])
  return rows[0] ?? null
}

exhibitionsRouter.get('/nearest', publicPassLimit, cachePublic(30), async (_req, res, next) => {
  try {
    const [events] = await pool.query<any[]>(`SELECT e.id,e.slug,e.title,e.description,e.city,e.state,e.venue,
      e.starts_at startsAt,e.ends_at endsAt,e.registration_deadline registrationDeadline,
      c.pass_mode passMode,c.free_capacity freeCapacity,c.paid_price paidPrice,c.paid_capacity paidCapacity,
      c.free_perks freePerks,c.paid_perks paidPerks,
      COALESCE(i.freeIssued,0) freeIssued,COALESCE(i.paidIssued,0) paidIssued
      FROM events e
      LEFT JOIN event_pass_configs c ON c.event_id=e.id
      LEFT JOIN (
        SELECT event_id,
          SUM(CASE WHEN pass_tier='FREE' THEN quantity ELSE 0 END) freeIssued,
          SUM(CASE WHEN pass_tier='PAID' THEN quantity ELSE 0 END) paidIssued
        FROM event_registrations WHERE status='REGISTERED' GROUP BY event_id
      ) i ON i.event_id=e.id
      WHERE ${openEventWhere}
      ORDER BY e.starts_at ASC,e.id ASC`)
    const results = events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      city: event.city,
      state: event.state,
      venue: event.venue,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      registrationDeadline: event.registrationDeadline,
      passConfig: passConfig({
        passMode: event.passMode,
        freeCapacity: event.freeCapacity,
        paidPrice: event.paidPrice,
        paidCapacity: event.paidCapacity,
        freePerks: event.freePerks,
        paidPerks: event.paidPerks,
      }, Number(event.freeIssued), Number(event.paidIssued)),
    }))
    res.json({ nearest: results[0] ?? null, events: results })
  } catch (error) {
    next(error)
  }
})

exhibitionsRouter.get('/:eventSlug/passes/admin', requireAuth, requireRole(...adminRoles), requirePermission('events:edit'), async (req: AuthRequest, res, next) => {
  try {
    const event = await findEventBySlug(req.params.eventSlug, true)
    if (!event) return res.status(404).json({ error: 'Exhibition not found' })
    const [[row]] = await pool.query<any[]>(`SELECT pass_mode passMode,free_capacity freeCapacity,
      paid_price paidPrice,paid_capacity paidCapacity,free_perks freePerks,paid_perks paidPerks
      FROM event_pass_configs WHERE event_id=?`, [event.id])
    res.json({ eventSlug: event.slug, config: passConfig(row) })
  } catch (error) {
    next(error)
  }
})

const passConfigInput = z.object({
  passMode: z.enum(['FREE', 'PAID', 'BOTH']),
  freeCapacity: z.number().int().min(0).max(1_000_000).nullable(),
  paidPrice: z.number().min(0).max(10_000_000),
  paidCapacity: z.number().int().min(0).max(1_000_000).nullable(),
  freePerks: z.array(z.string().trim().min(1).max(200)).max(12),
  paidPerks: z.array(z.string().trim().min(1).max(200)).max(12),
})

exhibitionsRouter.post('/:eventSlug/passes', requireAuth, requireRole(...adminRoles), requirePermission('events:edit'), async (req: AuthRequest, res, next) => {
  try {
    const event = await findEventBySlug(req.params.eventSlug, true)
    if (!event) return res.status(404).json({ error: 'Exhibition not found' })
    const input = passConfigInput.parse(req.body)
    await pool.query(`INSERT INTO event_pass_configs
      (event_id,pass_mode,free_capacity,paid_price,paid_capacity,free_perks,paid_perks,updated_by)
      VALUES (?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE pass_mode=VALUES(pass_mode),free_capacity=VALUES(free_capacity),
        paid_price=VALUES(paid_price),paid_capacity=VALUES(paid_capacity),
        free_perks=VALUES(free_perks),paid_perks=VALUES(paid_perks),updated_by=VALUES(updated_by)`,
    [event.id, input.passMode, input.freeCapacity, input.paidPrice, input.paidCapacity,
      JSON.stringify(input.freePerks), JSON.stringify(input.paidPerks), req.user!.id])
    await pool.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
      [req.user!.id, 'visitor.pass_config.updated', 'event', event.id, JSON.stringify(input)])
    res.json({ eventSlug: event.slug, config: passConfig(input) })
  } catch (error) {
    next(error)
  }
})

visitorPassesRouter.post('/', registerLimit, (_req, res) => {
  res.status(428).json({
    error: 'Email verification is required. Request and verify a code through the visitor pass registration flow before a pass can be issued.',
  })
})
