import crypto from 'node:crypto'
import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from '../services/rate-limit.js'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, requireRole, type AuthRequest } from '../middleware/auth.js'
import { cachePublic } from '../middleware/cache.js'
import { queueEmail } from '../services/mailer.js'
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

const registerInput = z.object({
  eventSlug: z.string().trim().min(1).max(255),
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().regex(/^[0-9+() -]{10,18}$/),
  email: z.string().email().max(255),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
  passPlan: z.enum(['FREE', 'PAID']),
  preferredVisitDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.number().int().min(1).max(10),
})

function makePassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from(crypto.randomBytes(4), (byte) => alphabet[byte % alphabet.length]).join('')
  return `THOA-${new Date().getFullYear()}-${suffix}`
}

const publicRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = registerInput.parse(req.body)
    const email = input.email.trim().toLowerCase()
    const event = await findEventBySlug(input.eventSlug)
    if (!event) return res.status(409).json({ error: 'Registration is not open for this exhibition.' })
    const outcome = await withTransaction(async (connection) => {
      const [eventRows] = await connection.query<any[]>(`SELECT id,slug,title,city,state,venue,starts_at startsAt,
        ends_at endsAt FROM events e WHERE id=? AND ${openEventWhere} FOR UPDATE`, [event.id])
      const currentEvent = eventRows[0]
      if (!currentEvent) return { status: 409 as const, error: 'Registration is not open for this exhibition.' }

      const [configRows] = await connection.query<any[]>(`SELECT pass_mode passMode,free_capacity freeCapacity,
        paid_price paidPrice,paid_capacity paidCapacity,free_perks freePerks,paid_perks paidPerks
        FROM event_pass_configs WHERE event_id=? FOR UPDATE`, [event.id])
      const config = passConfig(configRows[0])
      if ((config.passMode === 'FREE' && input.passPlan !== 'FREE') || (config.passMode === 'PAID' && input.passPlan !== 'PAID')) {
        return { status: 409 as const, error: 'This pass plan is not currently offered for the selected exhibition.' }
      }

      const [dateRows] = await connection.query<any[]>(`SELECT (? BETWEEN DATE(starts_at) AND DATE(ends_at)) validDay
        FROM events WHERE id=?`, [input.preferredVisitDay, event.id])
      if (!Number(dateRows[0]?.validDay)) {
        return { status: 400 as const, error: 'Choose a visit day within the exhibition dates.' }
      }

      const [profiles] = await connection.query<any[]>('SELECT id FROM visitor_profiles WHERE email=? FOR UPDATE', [email])
      const profileId = profiles[0]?.id ?? crypto.randomUUID()
      const [registrationRows] = await connection.query<any[]>(`SELECT r.id registrationId,r.status,r.pass_tier passTier,
        r.quantity,r.payment_status paymentStatus,q.id passId,c.id checkedIn
        FROM event_registrations r LEFT JOIN qr_passes q ON q.registration_id=r.id
        LEFT JOIN check_ins c ON c.pass_id=q.id WHERE r.event_id=? AND r.visitor_id=? FOR UPDATE`,
      [event.id, profileId])
      const existing = registrationRows[0]
      if (existing?.checkedIn) return { status: 409 as const, error: 'This registration has already been used. Please contact the event team for help.' }

      const passTier = input.passPlan
      const capacity = passTier === 'FREE' ? config.freeCapacity : config.paidCapacity
      const [usageRows] = await connection.query<any[]>(`SELECT COALESCE(SUM(quantity),0) issued
        FROM event_registrations WHERE event_id=? AND pass_tier=? AND status='REGISTERED'
          AND (? IS NULL OR id<>?)`, [event.id, passTier, existing?.registrationId ?? null, existing?.registrationId ?? null])
      const issued = Number(usageRows[0]?.issued ?? 0)
      if (capacity !== null && issued + input.quantity > capacity) {
        return { status: 409 as const, error: 'This pass tier has reached its current capacity. Please choose another pass plan or exhibition.' }
      }

      if (profiles.length) {
        await connection.query('UPDATE visitor_profiles SET full_name=?,phone=?,city=?,attending_as=? WHERE id=?',
          [input.fullName, input.phone, input.city, 'Visitor', profileId])
      } else {
        await connection.query(`INSERT INTO visitor_profiles
          (id,email,full_name,phone,city,attending_as,marketing_consent,email_verified_at)
          VALUES (?,?,?,?,?,'Visitor',FALSE,NULL)`, [profileId, email, input.fullName, input.phone, input.city])
      }

      const registrationId = existing?.registrationId ?? crypto.randomUUID()
      const passId = existing?.passId ?? crypto.randomUUID()
      const passCode = makePassCode()
      const reference = newReferenceCode()
      const qrData = referenceQrValue(reference)
      const paymentStatus = passTier === 'FREE' ? 'NOT_REQUIRED' : 'PENDING'
      if (existing) {
        await connection.query(`UPDATE event_registrations SET status='REGISTERED',visitor_state=?,visitor_city=?,
          pass_tier=?,quantity=?,preferred_visit_day=?,payment_status=?,pass_code=? WHERE id=?`,
        [input.state, input.city, passTier, input.quantity, input.preferredVisitDay, paymentStatus, passCode, registrationId])
        if (existing.passId) {
          await connection.query('UPDATE qr_passes SET token_hash=?,reference_code=?,revoked_at=NULL WHERE id=?',
            [hashPassToken(reference), reference, passId])
        } else {
          await connection.query('INSERT INTO qr_passes(id,registration_id,token_hash,reference_code) VALUES (?,?,?,?)',
            [passId, registrationId, hashPassToken(reference), reference])
        }
      } else {
        await connection.query(`INSERT INTO event_registrations
          (id,event_id,visitor_id,status,visitor_state,visitor_city,pass_tier,quantity,preferred_visit_day,payment_status,pass_code)
          VALUES (?,?,?,'REGISTERED',?,?,?,?,?,?,?)`,
        [registrationId, event.id, profileId, input.state, input.city, passTier, input.quantity,
          input.preferredVisitDay, paymentStatus, passCode])
        await connection.query('INSERT INTO qr_passes(id,registration_id,token_hash,reference_code) VALUES (?,?,?,?)',
          [passId, registrationId, hashPassToken(reference), reference])
      }

      await connection.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (NULL,?,?,?,?)',
        ['visitor.pass.issued', 'event_registration', registrationId, JSON.stringify({
          eventId: event.id, source: 'public_visitor_pass_form', passTier, quantity: input.quantity, paymentStatus,
        })])
      return {
        status: 200 as const,
        pass: {
          passId, passCode, qrData, eventSlug: currentEvent.slug, eventTitle: currentEvent.title,
          startsAt: currentEvent.startsAt, endsAt: currentEvent.endsAt, city: currentEvent.city,
          state: currentEvent.state, venue: currentEvent.venue, passTier, paymentStatus,
          amount: passTier === 'PAID' ? config.paidPrice : 0,
          quantity: input.quantity, preferredVisitDay: input.preferredVisitDay,
        },
      }
    })
    if (!outcome.pass) return res.status(outcome.status).json({ error: outcome.error })

    const paymentNote = outcome.pass.paymentStatus === 'PENDING'
      ? 'This VIP reservation is pending payment. Payment collection is not enabled yet, so the QR is not valid for entry until payment is confirmed.'
      : 'Your free visitor pass is confirmed.'
    const passUrl = `${process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'}/visitor/pass/${encodeURIComponent(outcome.pass.qrData)}`
    const emailDelivery = await queueEmail(email, 'Your Haat of Art visitor pass',
      `${paymentNote}\n\nPass ID: ${outcome.pass.passCode}\nExhibition: ${outcome.pass.eventTitle}\nVisit day: ${input.preferredVisitDay}\nNumber of passes: ${outcome.pass.quantity}\nView your digital pass: ${passUrl}`,
      { whatsappPhone: input.phone })
    if (!emailDelivery.delivered) {
      console.error('Visitor pass confirmation email could not be delivered', { reason: emailDelivery.reason })
    }
    res.json({
      pass: outcome.pass,
      emailSent: emailDelivery.delivered,
      message: outcome.pass.paymentStatus === 'PENDING'
        ? `Your VIP reservation QR is ready. ${paymentNote}${emailDelivery.delivered ? ' A copy was emailed to you.' : ''}`
        : `Your free entry QR pass is ready.${emailDelivery.delivered ? ' A copy was emailed to you.' : ' The confirmation email could not be sent.'}`,
    })
  } catch (error) {
    next(error)
  }
}

visitorPassesRouter.post('/', registerLimit, publicRegistration)
