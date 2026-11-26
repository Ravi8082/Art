import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { queueEmail } from '../services/mailer.js'
import { recordAudit } from '../services/audit.js'
import { paymentModeFor } from '../services/payment-mode.js'
import { storeAsset } from './about.js'

export const bookingsRouter = Router()

const artist = [requireAuth] as const
const manage = [requireAuth, requirePermission('bookings:manage')] as const
const uploadBody = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'], limit: '25mb' })

const HOLD_MINUTES = Math.max(0.05, Number(process.env.BOOKING_HOLD_MINUTES ?? 1440))
const STALL_SELECTION_HOLD_MINUTES = 10
const webhookSecret = () => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') throw new Error('PAYMENT_WEBHOOK_SECRET must be configured in production')
  return 'development-webhook-secret'
}
const signWebhook = (idempotencyKey: string, transactionRef: string, amount: number, status: string) =>
  crypto.createHmac('sha256', webhookSecret()).update(`${idempotencyKey}.${transactionRef}.${amount}.${status}`).digest('hex')

const refCode = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
const splitStates = (value: unknown) => String(value ?? '').split(/[,;/]/).map((part) => part.trim()).filter(Boolean)

// Discriminated transaction results: `ok` is a literal so narrowing is reliable.
const fail = (status: number, error: string) => ({ ok: false as const, status, error })
const done = <T extends object>(data: T) => ({ ok: true as const, ...data })
function isActiveStallDuplicate(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'
    && 'message' in error && typeof error.message === 'string'
    && /uq_active_stall_(hold|booking)|uq_active_selection_user/.test(error.message)
}

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<unknown> }

async function notify(db: Queryable, entry: { applicationId?: string; bookingId?: string; email: string; type: string; subject: string; text: string }) {
  await db.query('INSERT INTO notification_logs(id,application_id,booking_id,recipient_email,type,subject,status) VALUES (?,?,?,?,?,?,?)',
    [crypto.randomUUID(), entry.applicationId ?? null, entry.bookingId ?? null, entry.email, entry.type, entry.subject, 'QUEUED'])
  const sent = await queueEmail(entry.email, entry.subject, entry.text)
  await db.query('UPDATE notification_logs SET status=? WHERE application_id<=>? AND booking_id<=>? AND type=? ORDER BY created_at DESC LIMIT 1',
    [sent.delivered ? 'SENT' : 'FAILED', entry.applicationId ?? null, entry.bookingId ?? null, entry.type])
}

// ---------- shared selectors ----------
const stallSelect = `
  SELECT s.id, s.code, s.state, s.location, s.sort_order sortOrder, s.floor_x floorX, s.floor_y floorY, s.status baseStatus,
         st.id typeId, st.code typeCode, st.name typeName, st.category, st.width_m widthM, st.depth_m depthM,
         COALESCE(statePricing.price, pricing.price) price, COALESCE(statePricing.tax_rate, pricing.tax_rate) taxRate, st.includes,
         b.id bookingId, b.status bookingStatus,
         h.expires_at holdExpiresAt, selectionHold.id selectionHoldId, selectionHold.expires_at selectionHoldExpiresAt
  FROM stalls s
  JOIN stall_types st ON st.id = s.stall_type_id
  LEFT JOIN event_state_stall_pricing statePricing ON statePricing.event_id = s.event_id AND statePricing.state = s.state AND statePricing.stall_type_id = st.id
  LEFT JOIN event_stall_pricing pricing ON pricing.event_id = s.event_id AND pricing.stall_type_id = st.id
`
const stallBookingsJoins = `
  LEFT JOIN stall_bookings b ON b.stall_id = s.id AND (
    b.status IN ('CONFIRMED','REFUND_PENDING')
    OR (b.status = 'PAYMENT_PENDING' AND EXISTS (
      SELECT 1 FROM stall_holds activeHold
      WHERE activeHold.booking_id = b.id AND activeHold.released_at IS NULL AND activeHold.expires_at > NOW()
    ))
  )
  LEFT JOIN stall_holds h ON h.booking_id = b.id AND h.released_at IS NULL AND h.expires_at > NOW()
  LEFT JOIN stall_holds selectionHold ON selectionHold.stall_id = s.id AND selectionHold.booking_id IS NULL
    AND selectionHold.released_at IS NULL AND selectionHold.expires_at > NOW()`

function stallStatus(row: { baseStatus: string; bookingStatus: string | null; selectionHoldId: string | null }) {
  if (row.baseStatus === 'DISABLED') return 'DISABLED'
  if (row.bookingStatus === 'CONFIRMED' || row.bookingStatus === 'REFUND_PENDING') return 'BOOKED'
  if (row.bookingStatus) return 'HELD'
  if (row.selectionHoldId) return 'HELD'
  if (row.baseStatus === 'BOOKED') return 'BOOKED'
  if (row.baseStatus === 'RESERVED') return 'RESERVED'
  return 'AVAILABLE'
}

const exhibitionSelect = `
  SELECT e.id, e.title, e.city, e.state, e.venue, e.starts_at startsAt, e.ends_at endsAt,
         e.registration_deadline registrationDeadline,
         (SELECT COUNT(*) FROM stalls s
           WHERE s.event_id = e.id AND s.status = 'AVAILABLE'
             AND NOT EXISTS (SELECT 1 FROM stall_bookings b WHERE b.stall_id = s.id
               AND (b.status IN ('CONFIRMED','REFUND_PENDING') OR (b.status='PAYMENT_PENDING'
                 AND EXISTS (SELECT 1 FROM stall_holds h WHERE h.booking_id=b.id AND h.released_at IS NULL AND h.expires_at>NOW()))))
             AND NOT EXISTS (SELECT 1 FROM stall_holds h WHERE h.stall_id=s.id
               AND h.booking_id IS NULL AND h.released_at IS NULL AND h.expires_at>NOW())) availableStalls,
         (SELECT COUNT(*) FROM stalls s WHERE s.event_id = e.id) totalStalls
  FROM events e
  WHERE e.status IN ('PUBLISHED','APPROVED') AND e.ends_at >= NOW()`

const floorPlanExhibitions = [
  {
    title: 'The Haat of Art — Indore',
    city: 'Indore',
    venue: 'Abhay Prashal Sports Club, Indore, Madhya Pradesh',
    state: 'Madhya Pradesh',
    startsAt: '2026-10-30 10:00:00',
    endsAt: '2026-11-01 20:00:00',
  },
  {
    title: 'The Haat of Art — Mumbai Art Fair',
    city: 'Mumbai',
    venue: 'NESCO, Mumbai, Maharashtra',
    state: 'Maharashtra',
    startsAt: '2026-11-14 10:00:00',
    endsAt: '2026-11-16 20:00:00',
  },
  {
    title: 'The Haat of Art — Bengaluru Art Collective',
    city: 'Bengaluru',
    venue: 'Palace Grounds, Bengaluru, Karnataka',
    state: 'Karnataka',
    startsAt: '2026-12-05 10:00:00',
    endsAt: '2026-12-07 20:00:00',
  },
  {
    title: 'The Haat of Art — India Art Exhibition Tour 2027',
    city: 'Pan India — Mumbai, Delhi, Bengaluru, Indore, Hyderabad, Pune, Jaipur and Ahmedabad',
    venue: 'Multiple Exhibition Venues — India Tour',
    state: 'Pan India',
    startsAt: '2027-01-15 10:00:00',
    endsAt: '2027-01-17 20:00:00',
  },
] as const

const floorPlanStallTypes = [
  { code: 'COMPACT', name: 'Compact Stall', category: 'INDIVIDUAL', widthM: 2, depthM: 2, price: 15000, includes: '2 spotlights, 1 table, 2 chairs, fascia name board', sortOrder: 1 },
  { code: 'STANDARD', name: 'Standard Stall', category: 'INDIVIDUAL', widthM: 3, depthM: 3, price: 28000, includes: '4 spotlights, 2 display tables, 2 chairs, fascia name board', sortOrder: 2 },
  { code: 'GROUP', name: 'Group Stall', category: 'GROUP', widthM: 6, depthM: 4, price: 55000, includes: '6 spotlights, 3 tables, 6 chairs, 3-wall display panel', sortOrder: 3 },
  { code: 'GALLERY', name: 'Gallery Space', category: 'GALLERY', widthM: 10, depthM: 8, price: 120000, includes: '12 track lights, lounge seating, VIP wall branding, storage closet', sortOrder: 4 },
] as const

type SeedStallStatus = 'AVAILABLE' | 'BOOKED' | 'RESERVED'
const floorPlanBooths = [
  ...Array.from({ length: 8 }, (_, index) => ({
    typeCode: 'COMPACT',
    code: `A${index + 1}`,
    status: (index === 0 ? 'BOOKED' : index === 6 ? 'RESERVED' : 'AVAILABLE') as SeedStallStatus,
    sortOrder: index + 1,
    floorX: (index % 4) + 1,
    floorY: Math.floor(index / 4) + 1,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    typeCode: 'GROUP',
    code: `B${index + 1}`,
    status: (index === 0 ? 'BOOKED' : index === 3 ? 'RESERVED' : 'AVAILABLE') as SeedStallStatus,
    sortOrder: index + 9,
    floorX: (index % 4) + 1,
    floorY: Math.floor(index / 4) + 1,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    typeCode: 'GALLERY',
    code: `G${index + 1}`,
    status: (index === 0 ? 'RESERVED' : index === 3 ? 'BOOKED' : 'AVAILABLE') as SeedStallStatus,
    sortOrder: index + 14,
    floorX: index + 1,
    floorY: 1,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    typeCode: 'STANDARD',
    code: `A${index + 9}`,
    location: 'Hall A',
    status: (index === 0 ? 'BOOKED' : index === 2 ? 'RESERVED' : 'AVAILABLE') as SeedStallStatus,
    sortOrder: index + 18,
    floorX: (index % 4) + 1,
    floorY: 1,
  })),
]

async function exhibitionsWithMedia() {
  const [events] = await pool.query<any[]>(`${exhibitionSelect} ORDER BY e.starts_at`)
  if (!events.length) return []
  const placeholders = events.map(() => '?').join(',')
  const [media] = await pool.query<any[]>(
    `SELECT id, event_id eventId, alt_text altText FROM event_media WHERE event_id IN (${placeholders}) AND data IS NOT NULL AND media_type='IMAGE' ORDER BY sort_order, id`,
    events.map((event) => event.id),
  )
  const mediaByEvent = new Map<string, typeof media>()
  for (const item of media) {
    const group = mediaByEvent.get(item.eventId) ?? []
    group.push(item)
    mediaByEvent.set(item.eventId, group)
  }
  return events.map((event) => ({
    ...event,
    registrationOpen: !event.registrationDeadline || new Date(event.registrationDeadline) > new Date(),
    media: (mediaByEvent.get(event.id) ?? []).map((item) => ({
      id: item.id, altText: item.altText, mediaType: 'IMAGE', url: `/api/events/${event.id}/media/${item.id}`,
    })),
  }))
}

const bookingProfileInput = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^[0-9+()\s-]{6,30}$/),
  address: z.string().trim().min(6).max(500),
  websiteUrl: z.string().trim().max(512).default('').refine((value) => !value || /^https?:\/\/.+/i.test(value)),
  instagramUrl: z.string().trim().max(512).default('').refine((value) => !value || /^https?:\/\/.+/i.test(value)),
})

async function loadBookingProfile(userId: string) {
  const [users] = await pool.query<any[]>(`SELECT u.email, u.full_name fullName,
      p.first_name firstName, p.last_name lastName, p.phone, p.address,
      p.website_url websiteUrl, p.instagram_url instagramUrl
    FROM users u LEFT JOIN artist_profiles p ON p.user_id=u.id WHERE u.id=?`, [userId])
  const user = users[0]
  if (!user) return null

  const [applications] = await pool.query<any[]>(`SELECT first_name firstName, last_name lastName, phone, address,
      website_url websiteUrl, instagram_url instagramUrl
    FROM exhibition_applications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 1`, [userId])
  const latest = applications[0] ?? {}
  const accountName = String(user.fullName ?? '').trim().split(/\s+/).filter(Boolean)

  return {
    firstName: user.firstName || latest.firstName || accountName[0] || '',
    lastName: user.lastName || latest.lastName || accountName.slice(1).join(' '),
    phone: user.phone || latest.phone || '',
    email: user.email,
    address: user.address || latest.address || '',
    websiteUrl: user.websiteUrl || latest.websiteUrl || '',
    instagramUrl: user.instagramUrl || latest.instagramUrl || '',
  }
}

// ---------- authenticated: exhibitor profile ----------
bookingsRouter.get('/profile', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const profile = await loadBookingProfile(req.user!.id)
    if (!profile) return res.status(404).json({ error: 'Exhibitor profile not found' })
    res.json(profile)
  } catch (error) { next(error) }
})

bookingsRouter.put('/profile', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const parsed = bookingProfileInput.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid exhibitor profile' })
    const profile = parsed.data
    const displayName = `${profile.firstName} ${profile.lastName}`.trim()
    await pool.query(`INSERT INTO artist_profiles
        (user_id, display_name, first_name, last_name, phone, address, website_url, instagram_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name),
        phone=VALUES(phone), address=VALUES(address), website_url=VALUES(website_url),
        instagram_url=VALUES(instagram_url)`,
    [req.user!.id, displayName, profile.firstName, profile.lastName, profile.phone, profile.address, profile.websiteUrl, profile.instagramUrl])
    const saved = await loadBookingProfile(req.user!.id)
    res.json(saved)
  } catch (error) { next(error) }
})

// ---------- public: catalogue ----------
bookingsRouter.get('/exhibitions', async (_req, res, next) => {
  try { res.json(await exhibitionsWithMedia()) } catch (error) { next(error) }
})

bookingsRouter.get('/exhibit-info', async (_req, res, next) => {
  try {
    const [types] = await pool.query<any[]>('SELECT id, code, name, category, width_m widthM, depth_m depthM, price, tax_rate taxRate, includes FROM stall_types WHERE active = 1 ORDER BY sort_order, price')
    const [[window]] = await pool.query<any[]>(`SELECT MIN(starts_at) startsAt, MAX(ends_at) endsAt, COUNT(*) upcoming FROM events
      WHERE status IN ('PUBLISHED','APPROVED') AND ends_at >= NOW()`)
    const [[stats]] = await pool.query<any[]>(`SELECT
      (SELECT COUNT(*) FROM events WHERE status IN ('PUBLISHED','APPROVED')) events,
      (SELECT COUNT(*) FROM stall_bookings WHERE status='CONFIRMED') stallsBooked,
      (SELECT COUNT(*) FROM event_registrations WHERE status='REGISTERED') visitors,
      (SELECT COUNT(*) FROM artist_profiles WHERE status='APPROVED') artists,
      (SELECT COUNT(*) FROM stalls s JOIN events e ON e.id=s.event_id WHERE e.status IN ('PUBLISHED','APPROVED') AND e.ends_at>=NOW() AND s.status='AVAILABLE'
        AND NOT EXISTS (SELECT 1 FROM stall_bookings b WHERE b.stall_id=s.id AND
          (b.status IN ('CONFIRMED','REFUND_PENDING') OR (b.status='PAYMENT_PENDING' AND EXISTS (
            SELECT 1 FROM stall_holds h WHERE h.booking_id=b.id AND h.released_at IS NULL AND h.expires_at>NOW()))))
        AND NOT EXISTS (SELECT 1 FROM stall_holds h WHERE h.stall_id=s.id AND h.booking_id IS NULL
          AND h.released_at IS NULL AND h.expires_at>NOW())) openStalls`)
    res.json({ stallTypes: types, window, stats })
  } catch (error) { next(error) }
})

bookingsRouter.get('/stall-types', async (_req, res, next) => {
  try {
    const [types] = await pool.query<any[]>('SELECT id, code, name, category, width_m widthM, depth_m depthM, price, tax_rate taxRate, includes FROM stall_types WHERE active = 1 ORDER BY sort_order, price')
    res.json(types)
  } catch (error) { next(error) }
})

bookingsRouter.get('/events/:eventId/stall-types', async (req, res, next) => {
  try {
    const [events] = await pool.query<any[]>("SELECT id, state FROM events WHERE id=? AND status IN ('PUBLISHED','APPROVED')", [req.params.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const parsedState = req.query.state === undefined ? null : z.string().trim().min(1).max(120).safeParse(req.query.state)
    if (parsedState && !parsedState.success) return res.status(400).json({ error: 'Select a valid state' })
    const state = parsedState?.success ? parsedState.data : ''
    const [stateModeRows] = await pool.query<any[]>(
      'SELECT state FROM event_state_stall_pricing WHERE event_id=? LIMIT 1',
      [req.params.eventId])
    if (stateModeRows.length) {
      if (!state) return res.json([])
      if (!splitStates(events[0].state).includes(state)) return res.status(400).json({ error: 'Select a state assigned to this exhibition' })
      const [types] = await pool.query<any[]>(
        `SELECT st.id, st.code, st.name, st.category, st.width_m widthM, st.depth_m depthM,
                pricing.price, pricing.tax_rate taxRate, st.includes
         FROM event_state_stall_pricing pricing
         JOIN stall_types st ON st.id = pricing.stall_type_id
         WHERE pricing.event_id=? AND pricing.state=? AND pricing.public_visible=1 AND st.active=1
         ORDER BY st.sort_order, pricing.price`, [req.params.eventId, state])
      return res.json(types)
    }
    const [types] = await pool.query<any[]>(
        `SELECT st.id, st.code, st.name, st.category, st.width_m widthM, st.depth_m depthM,
                pricing.price, pricing.tax_rate taxRate, st.includes
         FROM event_stall_pricing pricing
         JOIN stall_types st ON st.id = pricing.stall_type_id
         WHERE pricing.event_id=? AND pricing.public_visible=1 AND st.active=1
         ORDER BY st.sort_order, pricing.price`, [req.params.eventId])
    res.json(types)
  } catch (error) { next(error) }
})

bookingsRouter.get('/events/:eventId/stalls', async (req, res, next) => {
  try {
    const [events] = await pool.query<any[]>("SELECT id, state FROM events WHERE id=? AND status IN ('PUBLISHED','APPROVED')", [req.params.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const parsedState = req.query.state === undefined ? null : z.string().trim().min(1).max(120).safeParse(req.query.state)
    if (parsedState && !parsedState.success) return res.status(400).json({ error: 'Select a valid state' })
    const state = parsedState?.success ? parsedState.data : ''
    const [stateModeRows] = await pool.query<any[]>(
      'SELECT state FROM event_state_stall_pricing WHERE event_id=? LIMIT 1',
      [req.params.eventId])
    const stateSpecific = stateModeRows.length > 0
    if (stateSpecific && !state) return res.json([])
    if (stateSpecific && !splitStates(events[0].state).includes(state)) {
      return res.status(400).json({ error: 'Select a state assigned to this exhibition' })
    }
    const stateFilter = stateSpecific ? ' AND s.state=?' : ''
    const visibilityFilter = stateSpecific
      ? ' AND statePricing.event_id IS NOT NULL AND statePricing.public_visible=1'
      : ' AND pricing.public_visible=1'
    const [stalls] = await pool.query<any[]>(
      `${stallSelect}${stallBookingsJoins}
       WHERE st.active = 1 AND s.event_id = ?${visibilityFilter}${stateFilter}
       ORDER BY s.sort_order, s.code`,
      stateSpecific ? [req.params.eventId, state] : [req.params.eventId])
    res.json(stalls.map((row) => ({
      id: row.id, code: row.code, state: row.state, location: row.location, sortOrder: row.sortOrder, floorX: row.floorX, floorY: row.floorY,
      status: stallStatus(row), holdExpiresAt: row.holdExpiresAt ?? row.selectionHoldExpiresAt ?? null,
      type: { id: row.typeId, code: row.typeCode, name: row.typeName, category: row.category, widthM: row.widthM, depthM: row.depthM, price: row.price, taxRate: row.taxRate, includes: row.includes },
    })))
  } catch (error) { next(error) }
})

bookingsRouter.post('/events/:eventId/stalls/:stallId/hold', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const result = await withTransaction(async (db) => {
      const [users] = await db.query<any[]>(
        "SELECT id, email_verified_at emailVerifiedAt FROM users WHERE id=? AND status='ACTIVE' FOR UPDATE",
        [req.user!.id])
      if (!users[0]?.emailVerifiedAt) return fail(403, 'Verify your email address before reserving a stall')

      const [stalls] = await db.query<any[]>(
        `SELECT s.id, s.status FROM stalls s
         JOIN events e ON e.id=s.event_id AND e.status IN ('PUBLISHED','APPROVED')
         JOIN stall_types st ON st.id=s.stall_type_id AND st.active=1
         LEFT JOIN event_state_stall_pricing statePricing ON statePricing.event_id=s.event_id AND statePricing.state=s.state AND statePricing.stall_type_id=st.id
         LEFT JOIN event_stall_pricing pricing ON pricing.event_id=s.event_id AND pricing.stall_type_id=st.id
         WHERE s.id=? AND s.event_id=? AND (
           (EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
             AND statePricing.event_id IS NOT NULL AND statePricing.public_visible=1)
           OR (NOT EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
             AND pricing.public_visible=1)
         ) FOR UPDATE`,
        [req.params.stallId, req.params.eventId])
      const stall = stalls[0]
      if (!stall) return fail(404, 'Stall is not available for this exhibition')

      await db.query(
        'UPDATE stall_holds SET released_at=NOW() WHERE stall_id=? AND released_at IS NULL AND expires_at<=NOW()',
        [stall.id])
      await db.query(
        'UPDATE stall_holds SET released_at=NOW() WHERE user_id=? AND booking_id IS NULL AND released_at IS NULL AND expires_at<=NOW()',
        [req.user!.id])
      await db.query(
        `UPDATE stall_bookings b SET b.status='EXPIRED'
         WHERE b.stall_id=? AND b.status='PAYMENT_PENDING'
           AND NOT EXISTS (SELECT 1 FROM stall_holds h WHERE h.booking_id=b.id
             AND h.released_at IS NULL AND h.expires_at>NOW())`,
        [stall.id])
      await db.query(
        `UPDATE payments p JOIN stall_bookings b ON b.id=p.booking_id
         SET p.status='FAILED' WHERE b.stall_id=? AND b.status='EXPIRED' AND p.status='PENDING'`,
        [stall.id])

      if (stall.status !== 'AVAILABLE') return fail(409, 'Stall is not available')
      const [bookings] = await db.query<any[]>(
        "SELECT id FROM stall_bookings WHERE stall_id=? AND status IN ('PAYMENT_PENDING','CONFIRMED','REFUND_PENDING') FOR UPDATE",
        [stall.id])
      if (bookings.length) return fail(409, 'That stall was just taken — please choose another')

      const [activeHolds] = await db.query<any[]>(
        `SELECT id, user_id userId, expires_at expiresAt FROM stall_holds
         WHERE stall_id=? AND released_at IS NULL AND expires_at>NOW() FOR UPDATE`,
        [stall.id])
      const existing = activeHolds[0]
      if (existing && existing.userId !== req.user!.id) {
        return fail(409, 'That stall is temporarily held by another exhibitor')
      }

      const expiresAt = new Date(Date.now() + STALL_SELECTION_HOLD_MINUTES * 60 * 1000)
      if (existing) {
        await db.query('UPDATE stall_holds SET expires_at=? WHERE id=?', [expiresAt, existing.id])
        return done({ id: existing.id, expiresAt: expiresAt.toISOString() })
      }

      await db.query(
        'UPDATE stall_holds SET released_at=NOW() WHERE user_id=? AND booking_id IS NULL AND released_at IS NULL',
        [req.user!.id])
      const id = crypto.randomUUID()
      await db.query(
        'INSERT INTO stall_holds(id,stall_id,application_id,user_id,booking_id,expires_at) VALUES (?,?,NULL,?,NULL,?)',
        [id, stall.id, req.user!.id, expiresAt])
      return done({ id, expiresAt: expiresAt.toISOString() })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.status(201).json({ ...result, holdMinutes: STALL_SELECTION_HOLD_MINUTES })
  } catch (error) {
    if (isActiveStallDuplicate(error)) return res.status(409).json({ error: 'That stall was just taken — please choose another' })
    next(error)
  }
})

bookingsRouter.delete('/events/:eventId/stalls/:stallId/hold', ...artist, async (req: AuthRequest, res, next) => {
  try {
    await withTransaction(async (db) => {
      const [users] = await db.query<any[]>(
        'SELECT id FROM users WHERE id=? AND status=? FOR UPDATE',
        [req.user!.id, 'ACTIVE'])
      if (!users[0]) return
      await db.query(
        `UPDATE stall_holds h JOIN stalls s ON s.id=h.stall_id
         SET h.released_at=NOW()
         WHERE h.stall_id=? AND s.event_id=? AND h.user_id=? AND h.booking_id IS NULL
           AND h.released_at IS NULL`,
        [req.params.stallId, req.params.eventId, req.user!.id])
    })
    res.status(204).end()
  } catch (error) { next(error) }
})

// ---------- public: media upload & access ----------
const mediaKind = z.enum(['artwork', 'portfolio', 'document'])

bookingsRouter.post('/media', ...artist, uploadBody, async (req: AuthRequest, res, next) => {
  try {
    const kind = mediaKind.safeParse(req.get('x-media-kind'))
    if (!kind.success) return res.status(400).json({ error: 'x-media-kind must be artwork, portfolio or document' })
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (kind.data === 'portfolio') {
      if (contentType !== 'application/pdf') return res.status(415).json({ error: 'Portfolio must be a PDF' })
      if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.toString('ascii', 0, 5) !== '%PDF-') return res.status(415).json({ error: 'File content does not match its media type' })
      const id = crypto.randomUUID()
      const altText = z.string().trim().max(255).safeParse(req.get('x-alt-text')).data ?? ''
      await pool.query(`INSERT INTO media_assets(id,kind,mime_type,media_type,byte_size,alt_text,data,uploaded_by) VALUES (?,?,?,?,?,?,?,?)`,
        [id, 'application-portfolio', 'application/pdf', 'DOCUMENT', req.body.length, altText, req.body, req.user!.id])
      return res.status(201).json({ assetId: id, mediaKind: 'portfolio', byteSize: req.body.length })
    }
    const stored = await storeAsset(pool, req, `application-${kind.data}`, req.user!.id)
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    res.status(201).json({ assetId: stored.id, mediaKind: kind.data, byteSize: stored.byteSize })
  } catch (error) { next(error) }
})

bookingsRouter.get('/media/:assetId', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT m.data, m.mime_type, m.uploaded_by, a.user_id applicationOwner
       FROM media_assets m
       LEFT JOIN application_media am ON am.media_asset_id = m.id
       LEFT JOIN exhibition_applications a ON a.id = am.application_id
       WHERE m.id = ?`, [req.params.assetId])
    const asset = rows[0]
    if (!asset?.data) return res.status(404).json({ error: 'Media not found' })
    const isAdmin = req.user!.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')
    if (!isAdmin && asset.uploaded_by !== req.user!.id && asset.applicationOwner !== req.user!.id) {
      return res.status(403).json({ error: 'Insufficient permissions' })
    }
    res.set('Content-Type', asset.mime_type)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'private, max-age=300')
    res.send(asset.data)
  } catch (error) { next(error) }
})

// ---------- public: applications ----------
const allowedTags = new Set(['b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'br', 'p'])

// Stores the artist's bio as HTML, so it is sanitised on write: only the toolbar tags
// survive, and links keep an http(s)/mailto href with rel="nofollow noopener".
function sanitizeBioHtml(input: string) {
  return input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase()
      if (!allowedTags.has(name)) return ''
      if (name === 'br' || name === 'li' || name === 'p') return name === 'br' ? '<br>' : match.startsWith('</') ? `</${name}>` : `<${name}>`
      if (name === 'a') {
        if (match.startsWith('</')) return '</a>'
        const quoted = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(rawAttrs)
        const href = quoted?.[1] ?? quoted?.[2] ?? ''
        if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) return ''
        return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="nofollow noopener noreferrer">`
      }
      return match.startsWith('</') ? `</${name}>` : `<${name}>`
    })
}

const applicationInput = z.object({
  eventId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(''),
  phone: z.string().trim().min(6).max(40),
  address: z.string().trim().max(500).default(''),
  websiteUrl: z.string().trim().url().max(500).nullable().default(null),
  instagramUrl: z.string().trim().url().max(500).nullable().default(null),
  artForm: z.string().trim().min(2).max(120),
  fasciaName: z.string().trim().max(160).default(''),
  bio: z.string().trim().min(20).max(2000),
  spaceCategory: z.enum(['INDIVIDUAL', 'GROUP', 'GALLERY']),
  preferredStallTypeId: z.string().uuid().nullable().default(null),
  requestedStallId: z.string().uuid().nullable().default(null),
  approxSizeSqm: z.coerce.number().min(1).max(500).nullable().default(null),
  specialRequirements: z.string().trim().max(500).default(''),
  artworkAssetIds: z.array(z.string().uuid()).max(10).default([]),
  portfolioAssetId: z.string().uuid().nullable().default(null),
  stallHoldId: z.string().uuid().nullable().default(null),
  agreeTerms: z.literal(true),
})

bookingsRouter.post('/applications', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const input = applicationInput.parse(req.body)
    if (input.requestedStallId && !input.stallHoldId) {
      return res.status(409).json({ error: 'Select and temporarily reserve your stall before submitting' })
    }
    if (!input.requestedStallId && input.stallHoldId) {
      return res.status(400).json({ error: 'A stall hold was provided without a selected stall' })
    }

    const artworkAssetIds = [...new Set(input.artworkAssetIds)]
    const wanted = input.portfolioAssetId ? [...artworkAssetIds, input.portfolioAssetId] : artworkAssetIds
    if (wanted.length) {
      const placeholders = wanted.map(() => '?').join(',')
      const [owned] = await pool.query<any[]>(
        `SELECT id FROM media_assets WHERE id IN (${placeholders}) AND uploaded_by = ? AND kind LIKE 'application-%'`,
        [...wanted, req.user!.id])
      if ((owned as any[]).length !== wanted.length) return res.status(400).json({ error: 'One or more uploads do not belong to this account' })
    }

    const id = crypto.randomUUID()
    const applicationRef = refCode('THOA')
    const bio = sanitizeBioHtml(input.bio).slice(0, 6000)
    if (bio.replace(/<[^>]*>/g, '').trim().length < 20) return res.status(400).json({ error: 'Please describe your artwork in a little more detail' })
    const result = await withTransaction(async (db) => {
      const [users] = await db.query<any[]>(
        "SELECT email, email_verified_at emailVerifiedAt FROM users WHERE id=? AND status='ACTIVE' FOR UPDATE",
        [req.user!.id])
      const applicant = users[0]
      if (!applicant?.emailVerifiedAt) return fail(403, 'Verify your email address before submitting an exhibitor application')

      const [events] = await db.query<any[]>(
        `SELECT id, title FROM events WHERE id=? AND status IN ('PUBLISHED','APPROVED')
         AND (registration_deadline IS NULL OR registration_deadline > NOW()) FOR UPDATE`,
        [input.eventId])
      if (!events[0]) return fail(409, 'Exhibition is not open for registration')

      const [duplicates] = await db.query<any[]>(
        `SELECT id, application_ref applicationRef FROM exhibition_applications
         WHERE user_id=? AND event_id=? AND status<>'REJECTED' FOR UPDATE`,
        [req.user!.id, input.eventId])
      if (duplicates.length) {
        return { ...fail(409, 'You already have an application for this exhibition'), applicationRef: duplicates[0].applicationRef ?? null }
      }

      let heldStall: any = null
      if (input.requestedStallId && input.stallHoldId) {
        const [stalls] = await db.query<any[]>(
          `SELECT s.id, s.status FROM stalls s
           JOIN events e ON e.id=s.event_id AND e.status IN ('PUBLISHED','APPROVED')
           JOIN stall_types st ON st.id=s.stall_type_id AND st.active=1
           LEFT JOIN event_state_stall_pricing statePricing ON statePricing.event_id=s.event_id AND statePricing.state=s.state AND statePricing.stall_type_id=st.id
           LEFT JOIN event_stall_pricing pricing ON pricing.event_id=s.event_id AND pricing.stall_type_id=st.id
           WHERE s.id=? AND s.event_id=? AND (
             (EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
               AND statePricing.event_id IS NOT NULL AND statePricing.public_visible=1)
             OR (NOT EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
               AND pricing.public_visible=1)
           ) FOR UPDATE`,
          [input.requestedStallId, input.eventId])
        heldStall = stalls[0]
        if (!heldStall || heldStall.status !== 'AVAILABLE') return fail(409, 'That stall is no longer available — please pick another')

        await db.query(
          `UPDATE stall_holds SET released_at=NOW()
           WHERE stall_id=? AND released_at IS NULL AND expires_at<=NOW()`,
          [input.requestedStallId])
        const [holds] = await db.query<any[]>(
          `SELECT id FROM stall_holds
           WHERE id=? AND stall_id=? AND user_id=? AND booking_id IS NULL AND application_id IS NULL
             AND released_at IS NULL AND expires_at>NOW() FOR UPDATE`,
          [input.stallHoldId, input.requestedStallId, req.user!.id])
        if (!holds.length) return fail(409, 'Your 10-minute stall hold expired — please select the stall again')

        const [bookings] = await db.query<any[]>(
          "SELECT id FROM stall_bookings WHERE stall_id=? AND status IN ('PAYMENT_PENDING','CONFIRMED','REFUND_PENDING') FOR UPDATE",
          [input.requestedStallId])
        if (bookings.length) return fail(409, 'That stall was just taken — please pick another')
      }

      await db.query(
        `INSERT INTO exhibition_applications(id,application_ref,user_id,event_id,first_name,last_name,phone,address,website_url,instagram_url,art_form,fascia_name,bio,space_category,preferred_stall_type_id,requested_stall_id,approx_size_sqm,special_requirements,agree_terms,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'SUBMITTED')`,
        [id, applicationRef, req.user!.id, input.eventId, input.firstName, input.lastName, input.phone, input.address,
         input.websiteUrl, input.instagramUrl, input.artForm, input.fasciaName, bio, input.spaceCategory,
         input.preferredStallTypeId, input.requestedStallId, input.approxSizeSqm, input.specialRequirements, 1],
      )
      for (const [index, assetId] of artworkAssetIds.entries()) {
        await db.query('INSERT INTO application_media(application_id,media_asset_id,kind,sort_order) VALUES (?,?,?,?)', [id, assetId, 'ARTWORK', index + 1])
      }
      if (input.portfolioAssetId) {
        await db.query('INSERT INTO application_media(application_id,media_asset_id,kind,sort_order) VALUES (?,?,?,?)', [id, input.portfolioAssetId, 'PORTFOLIO_PDF', 0])
      }
      if (input.stallHoldId) {
        await db.query(
          'UPDATE stall_holds SET application_id=?, released_at=NOW() WHERE id=? AND user_id=?',
          [id, input.stallHoldId, req.user!.id])
      }
      await notify(db, {
        applicationId: id, email: applicant.email, type: 'application_submitted',
        subject: `Application ${applicationRef} received — The Haat of Art`,
        text: `We received your exhibitor application ${applicationRef} for ${events[0].title}. Our team will review it and email you the outcome.`,
      })
      await recordAudit(req.user!.id, 'application.create', 'exhibition_application', id, { applicationRef, eventId: input.eventId })
      return done({ id, applicationRef, status: 'SUBMITTED' })
    })
    if (!result.ok) {
      const { ok: _ok, status, error, ...details } = result
      return res.status(status).json({ error, ...details })
    }
    res.status(201).json(result)
  } catch (error) {
    if (isActiveStallDuplicate(error)) return res.status(409).json({ error: 'That stall was just taken — please choose another' })
    next(error)
  }
})

bookingsRouter.get('/mine', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const [applications] = await pool.query<any[]>(
      `SELECT a.id, a.application_ref applicationRef, a.status, a.created_at createdAt, a.admin_notes adminNotes, a.requested_stall_id requestedStallId, s.code requestedStallCode, a.event_id eventId,
              e.title eventTitle, e.city eventCity, e.starts_at eventStartsAt
       FROM exhibition_applications a JOIN events e ON e.id = a.event_id
       LEFT JOIN stalls s ON s.id = a.requested_stall_id
       WHERE a.user_id = ? ORDER BY a.created_at DESC`, [req.user!.id])
    const [bookings] = await pool.query<any[]>(
      `SELECT b.id, b.booking_ref bookingRef, b.status, b.base_amount baseAmount, b.tax_amount taxAmount, b.total_amount totalAmount,
              b.currency, b.created_at createdAt, b.event_id eventId, e.title eventTitle, s.code stallCode, st.name stallTypeName,
              a.application_ref applicationRef, i.invoice_no invoiceNo
       FROM stall_bookings b
       JOIN events e ON e.id = b.event_id
       JOIN stalls s ON s.id = b.stall_id
       JOIN stall_types st ON st.id = b.stall_type_id
       JOIN exhibition_applications a ON a.id = b.application_id
       LEFT JOIN invoices i ON i.booking_id = b.id
       WHERE b.user_id = ? ORDER BY b.created_at DESC`, [req.user!.id])
    res.json({ applications, bookings })
  } catch (error) { next(error) }
})

// ---------- public: booking + sandbox payment ----------
async function alertAdminsOfBooking(bookingId: string) {
  const [[row]] = await pool.query<any[]>(
    `SELECT b.booking_ref ref, b.total_amount total, a.first_name firstName, a.last_name lastName, a.phone, u.email,
            e.title eventTitle, s.code stallCode, st.name stallType
     FROM stall_bookings b JOIN exhibition_applications a ON a.id=b.application_id JOIN users u ON u.id=b.user_id
     JOIN events e ON e.id=b.event_id JOIN stalls s ON s.id=b.stall_id JOIN stall_types st ON st.id=b.stall_type_id
     WHERE b.id=?`, [bookingId])
  if (!row) return
  const [admins] = await pool.query<any[]>(
    `SELECT DISTINCT u.email FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
     WHERE r.name IN ('ADMIN','SUPER_ADMIN') AND u.status='ACTIVE' LIMIT 20`)
  const text = `New stall booking ${row.ref}: ${row.firstName} ${row.lastName} booked stall ${row.stallCode} (${row.stallType}) at ${row.eventTitle}. `
    + `Amount ₹${Number(row.total).toLocaleString('en-IN')} incl. GST. Contact: ${row.phone} / ${row.email}. Please call them to collect payment, then mark it paid in Bookings & Payments.`
  for (const admin of admins) {
    await queueEmail(admin.email, `New stall booking ${row.ref} — contact to collect payment`, text)
  }
}
bookingsRouter.post('/bookings', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ applicationId: z.string().uuid(), stallId: z.string().uuid() }).parse(req.body)
    const result = await withTransaction(async (db) => {
      const [users] = await db.query<any[]>(
        "SELECT id, email_verified_at emailVerifiedAt FROM users WHERE id=? AND status='ACTIVE' FOR UPDATE",
        [req.user!.id])
      if (!users[0]?.emailVerifiedAt) return fail(403, 'Verify your email address before booking a stall')

      const [apps] = await db.query<any[]>('SELECT * FROM exhibition_applications WHERE id = ? FOR UPDATE', [input.applicationId])
      const app = apps[0]
      if (!app || app.user_id !== req.user!.id) return fail(404, 'Application not found')
      if (app.status !== 'APPROVED') return fail(409, 'Application must be approved before booking a stall')
      const [existing] = await db.query<any[]>('SELECT id FROM stall_bookings WHERE application_id = ?', [app.id])
      if (existing.length) return fail(409, 'A booking already exists for this application')

      const [stalls] = await db.query<any[]>(
        `SELECT s.*, COALESCE(statePricing.price, pricing.price) price, COALESCE(statePricing.tax_rate, pricing.tax_rate) tax_rate FROM stalls s
         JOIN stall_types st ON st.id = s.stall_type_id AND st.active = 1
         LEFT JOIN event_state_stall_pricing statePricing ON statePricing.event_id = s.event_id AND statePricing.state = s.state AND statePricing.stall_type_id = st.id
         LEFT JOIN event_stall_pricing pricing ON pricing.event_id = s.event_id AND pricing.stall_type_id = st.id
         WHERE s.id = ? AND (
           (EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
             AND statePricing.event_id IS NOT NULL AND statePricing.public_visible=1)
           OR (NOT EXISTS(SELECT 1 FROM event_state_stall_pricing configured WHERE configured.event_id=s.event_id)
             AND pricing.public_visible=1)
         ) FOR UPDATE`,
        [input.stallId])
      const stall = stalls[0]
      if (!stall) return fail(404, 'Stall not found')
      if (stall.event_id !== app.event_id) return fail(400, 'Stall does not belong to the selected exhibition')
      await db.query(
        'UPDATE stall_holds SET released_at=NOW() WHERE stall_id=? AND released_at IS NULL AND expires_at<=NOW()',
        [stall.id])
      await db.query(
        `UPDATE stall_bookings b SET b.status='EXPIRED'
         WHERE b.stall_id=? AND b.status='PAYMENT_PENDING'
           AND NOT EXISTS (SELECT 1 FROM stall_holds h WHERE h.booking_id=b.id
             AND h.released_at IS NULL AND h.expires_at>NOW())`,
        [stall.id])
      await db.query(
        `UPDATE payments p JOIN stall_bookings b ON b.id=p.booking_id
         SET p.status='FAILED' WHERE b.stall_id=? AND b.status='EXPIRED' AND p.status='PENDING'`,
        [stall.id])
      const [taken] = await db.query<any[]>(
        "SELECT id FROM stall_bookings WHERE stall_id=? AND status IN ('PAYMENT_PENDING','CONFIRMED','REFUND_PENDING') FOR UPDATE",
        [stall.id])
      if (taken.length) return fail(409, 'Stall was just taken — please pick another')

      const [activeHolds] = await db.query<any[]>(
        `SELECT id, user_id userId, booking_id bookingId FROM stall_holds
         WHERE stall_id=? AND released_at IS NULL AND expires_at>NOW() FOR UPDATE`,
        [stall.id])
      if (activeHolds.some((hold) => hold.bookingId || hold.userId !== req.user!.id)) {
        return fail(409, 'Stall is temporarily held by another exhibitor')
      }
      if (activeHolds.length) {
        await db.query(
          'UPDATE stall_holds SET released_at=NOW() WHERE stall_id=? AND booking_id IS NULL AND user_id=? AND released_at IS NULL',
          [stall.id, req.user!.id])
      }
      if (stall.status !== 'AVAILABLE') return fail(409, 'Stall is not available')

      const base = Math.round(Number(stall.price) * 100) / 100
      const tax = Math.round(base * Number(stall.tax_rate)) / 100
      const total = Math.round((base + tax) * 100) / 100
      const bookingId = crypto.randomUUID()
      const bookingRef = refCode('THOA')
      await db.query(
        `INSERT INTO stall_bookings(id,booking_ref,application_id,event_id,stall_id,user_id,stall_type_id,base_amount,tax_amount,total_amount,currency,status)
         VALUES (?,?,?,?,?,?,?,?,?,?, 'INR', 'PAYMENT_PENDING')`,
        [bookingId, bookingRef, app.id, app.event_id, stall.id, req.user!.id, stall.stall_type_id, base, tax, total])
      const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000)
      await db.query('INSERT INTO stall_holds(id,stall_id,application_id,user_id,booking_id,expires_at) VALUES (?,?,?,?,?,?)',
        [crypto.randomUUID(), stall.id, app.id, req.user!.id, bookingId, holdExpiresAt])
      await recordAudit(req.user!.id, 'booking.create', 'stall_booking', bookingId, { bookingRef, stallId: stall.id, total })
      return done({ bookingId, bookingRef, totalAmount: total, holdExpiresAt: holdExpiresAt.toISOString(), status: 'PAYMENT_PENDING' })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    void alertAdminsOfBooking(result.bookingId).catch(() => undefined)
    res.status(201).json(result)
  } catch (error) {
    if (isActiveStallDuplicate(error)) {
      return res.status(409).json({ error: 'Stall was just taken — please pick another' })
    }
    next(error)
  }
})

bookingsRouter.post('/bookings/:id/pay', ...artist, async (req: AuthRequest, res, next) => {
  const idempotencyKey = z.string().min(8).max(80).safeParse(req.get('idempotency-key')).data ?? crypto.randomUUID()
  try {
    const input = z.object({
      method: z.enum(['ONLINE', 'UPI', 'BANK_TRANSFER']).default('ONLINE'),
      paymentProofAssetId: z.string().uuid().nullable().default(null),
    }).parse(req.body)
    const paymentMode = paymentModeFor(input.method)
    if (paymentMode === 'unavailable') {
      return res.status(503).json({ error: 'Online and UPI payments are not configured in production. Choose bank transfer for manual verification.' })
    }
    const sandboxEnabled = paymentMode === 'sandbox'

    const [existing] = await pool.query<any[]>(
      'SELECT p.* FROM payments p JOIN stall_bookings b ON b.id = p.booking_id WHERE p.idempotency_key = ? AND b.id = ? AND b.user_id = ?',
      [idempotencyKey, req.params.id, req.user!.id])
    if (existing[0]) {
      const payment = existing[0]
      return res.json({
        provider: payment.provider, paymentId: payment.id, idempotencyKey, transactionRef: payment.transaction_ref,
        amount: Number(payment.amount), status: payment.status, duplicate: true,
        note: payment.provider === 'SANDBOX'
          ? 'Sandbox adapter — idempotent retry returned the existing payment.'
          : 'Bank transfer is awaiting manual verification.',
      })
    }

    const result = await withTransaction(async (db) => {
      const [bookings] = await db.query<any[]>('SELECT * FROM stall_bookings WHERE id = ? FOR UPDATE', [req.params.id])
      const booking = bookings[0]
      if (!booking || booking.user_id !== req.user!.id) return fail(404, 'Booking not found')
      if (booking.status !== 'PAYMENT_PENDING') return fail(409, `Booking is ${booking.status.toLowerCase()}`)
      const [holds] = await db.query<any[]>('SELECT expires_at FROM stall_holds WHERE booking_id = ? AND released_at IS NULL ORDER BY created_at DESC LIMIT 1', [booking.id])
      if (!holds[0] || new Date(holds[0].expires_at) < new Date()) return fail(409, 'Payment window expired — the hold has been released')

      if (input.paymentProofAssetId) {
        const [owned] = await db.query<any[]>(
          `SELECT id FROM media_assets WHERE id = ? AND uploaded_by = ? AND kind IN ('application-document', 'application-portfolio')`,
          [input.paymentProofAssetId, req.user!.id])
        if (!(owned as any[]).length) return fail(400, 'Payment proof must be a file you uploaded')
        await db.query('UPDATE stall_bookings SET payment_proof_asset_id = ? WHERE id = ?', [input.paymentProofAssetId, booking.id])
      }

      const paymentId = crypto.randomUUID()
      const provider = paymentMode === 'manual' ? 'MANUAL' : 'SANDBOX'
      const transactionRef = `${sandboxEnabled ? 'SBX' : 'MAN'}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      await db.query(
        `INSERT INTO payments(id,booking_id,provider,method,amount,currency,status,transaction_ref,idempotency_key)
         VALUES (?,?,?,?,?,?, 'PENDING', ?, ?)`,
        [paymentId, booking.id, provider, input.method, booking.total_amount, booking.currency, transactionRef, idempotencyKey])
      await recordAudit(req.user!.id, 'payment.initiate', 'payment', paymentId, { bookingId: booking.id, method: input.method })
      return done({
        provider, paymentId, idempotencyKey, transactionRef, amount: Number(booking.total_amount), status: 'PENDING',
        holdExpiresAt: holds[0].expires_at,
        note: sandboxEnabled
          ? 'Sandbox adapter — no real money moves. Success webhook signature is provided so the flow can be completed end-to-end.'
          : 'Bank transfer submitted for manual verification. No payment is processed automatically.',
        sandboxSuccessWebhook: sandboxEnabled && input.method !== 'BANK_TRANSFER' ? {
          url: '/api/bookings/payments/webhook',
          body: {
            idempotencyKey, transactionRef, amount: Number(booking.total_amount), status: 'SUCCESS',
            signature: signWebhook(idempotencyKey, transactionRef, Number(booking.total_amount), 'SUCCESS'),
          },
        } : null,
      })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.status(201).json(result)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      const [retry] = await pool.query<any[]>('SELECT * FROM payments WHERE idempotency_key = ?', [idempotencyKey])
      const payment = retry[0]
      if (payment) return res.json({ provider: payment.provider, paymentId: payment.id, idempotencyKey, transactionRef: payment.transaction_ref, amount: Number(payment.amount), status: payment.status, duplicate: true })
    }
    next(error)
  }
})

bookingsRouter.post('/bookings/:id/cancel', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id)
    const input = z.object({
      reason: z.string().trim().min(3).max(255).default('Withdrawn by the exhibitor before payment'),
    }).parse(req.body)
    const result = await withTransaction(async (db) => {
      const [rows] = await db.query<any[]>('SELECT id, booking_ref bookingRef, user_id userId, status FROM stall_bookings WHERE id = ? FOR UPDATE', [bookingId])
      const booking = rows[0]
      if (!booking || booking.userId !== req.user!.id) return fail(404, 'Booking not found')
      if (booking.status !== 'PAYMENT_PENDING') return fail(409, `Booking is ${booking.status.toLowerCase()} and cannot be released`)

      await db.query('UPDATE payments SET status = ? WHERE booking_id = ? AND status = ?', ['FAILED', bookingId, 'PENDING'])
      await db.query('UPDATE stall_bookings SET status = ?, cancellation_reason = ?, cancelled_at = NOW() WHERE id = ?', ['CANCELLED', input.reason, bookingId])
      await db.query('UPDATE stall_holds SET released_at = NOW() WHERE booking_id = ? AND released_at IS NULL', [bookingId])
      const [users] = await db.query<any[]>('SELECT email FROM users WHERE id = ?', [req.user!.id])
      await notify(db, {
        bookingId, email: users[0].email, type: 'booking_cancelled',
        subject: `Booking ${booking.bookingRef} cancelled — The Haat of Art`,
        text: `Your booking ${booking.bookingRef} was cancelled before payment.`,
      })
      await recordAudit(req.user!.id, 'booking.cancel', 'stall_booking', bookingId, { reason: input.reason, refund: false })
      return done({ bookingId, status: 'CANCELLED' })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

const webhookInput = z.object({
  idempotencyKey: z.string().min(8).max(80),
  transactionRef: z.string().max(120),
  amount: z.coerce.number().positive(),
  status: z.enum(['SUCCESS', 'FAILURE']),
  signature: z.string(),
})

bookingsRouter.post('/payments/webhook', async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(503).json({ error: 'Sandbox payment webhooks are disabled in production.' })
  try {
    const input = webhookInput.parse(req.body)
    const expected = signWebhook(input.idempotencyKey, input.transactionRef, input.amount, input.status)
    const given = Buffer.from(input.signature)
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }
    const outcome = await withTransaction(async (db) => {
      const [payments] = await db.query<any[]>('SELECT * FROM payments WHERE idempotency_key = ? FOR UPDATE', [input.idempotencyKey])
      const payment = payments[0]
      if (!payment) return fail(404, 'Payment not found')
      if (payment.status !== 'PENDING') return done({ duplicate: true, paymentStatus: payment.status })
      if (Number(payment.amount) !== input.amount) return fail(409, 'Amount mismatch')

      if (input.status === 'FAILURE') {
        await db.query(`UPDATE payments SET status='FAILED', raw_payload=? WHERE id=?`, [JSON.stringify(req.body), payment.id])
        return done({ paymentStatus: 'FAILED' })
      }

      const [bookings] = await db.query<any[]>('SELECT * FROM stall_bookings WHERE id = ? FOR UPDATE', [payment.booking_id])
      const booking = bookings[0]
      const [holds] = await db.query<any[]>('SELECT id, expires_at FROM stall_holds WHERE booking_id = ? AND released_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [booking.id])
      if (booking.status !== 'PAYMENT_PENDING' || !holds[0] || new Date(holds[0].expires_at) < new Date()) {
        await db.query(`UPDATE payments SET status='FAILED', raw_payload=? WHERE id=?`, [JSON.stringify({ ...req.body, reason: 'hold_expired' }), payment.id])
        if (booking.status === 'PAYMENT_PENDING') await db.query(`UPDATE stall_bookings SET status='EXPIRED' WHERE id=?`, [booking.id])
        if (holds[0]) await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [holds[0].id])
        return done({ paymentStatus: 'FAILED', reason: 'hold_expired' })
      }

      await db.query(`UPDATE payments SET status='VERIFIED', verified_at=NOW(), raw_payload=? WHERE id=?`, [JSON.stringify(req.body), payment.id])
      await db.query(`UPDATE stall_bookings SET status='CONFIRMED' WHERE id=?`, [booking.id])
      await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [holds[0].id])
      const invoiceNo = refCode('INV')
      await db.query('INSERT INTO invoices(id,booking_id,invoice_no,amount,tax_amount,currency,issued_at) VALUES (?,?,?,?,?,?,NOW())',
        [crypto.randomUUID(), booking.id, invoiceNo, booking.base_amount, booking.tax_amount, booking.currency])
      const [user] = await db.query<any[]>('SELECT email FROM users WHERE id = ?', [booking.user_id])
      await notify(db, {
        bookingId: booking.id, email: user[0].email, type: 'booking_confirmed',
        subject: `Booking ${booking.booking_ref} confirmed — The Haat of Art`,
        text: `Your stall booking ${booking.booking_ref} is confirmed. Invoice ${invoiceNo}. Total paid ${booking.total_amount} ${booking.currency}.`,
      })
      await recordAudit(null, 'payment.verified', 'payment', payment.id, { bookingId: booking.id, transactionRef: input.transactionRef })
      return done({ paymentStatus: 'VERIFIED', bookingStatus: 'CONFIRMED', bookingRef: booking.booking_ref, invoiceNo })
    })
    if (!outcome.ok) return res.status(outcome.status).json({ error: outcome.error })
    res.json(outcome)
  } catch (error) { next(error) }
})

bookingsRouter.get('/bookings/:id/receipt', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const isAdmin = req.user!.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN')
    const [rows] = await pool.query<any[]>(
      `SELECT b.id, b.booking_ref bookingRef, b.status, b.base_amount baseAmount, b.tax_amount taxAmount, b.total_amount totalAmount,
              b.currency, b.created_at createdAt, b.cancellation_reason cancellationReason, b.user_id userId,
              a.application_ref applicationRef, a.first_name firstName, a.last_name lastName, a.phone, a.address, u.email accountEmail,
              e.title eventTitle, e.city eventCity, e.state eventState, e.venue, e.starts_at eventStartsAt, e.ends_at eventEndsAt,
              s.code stallCode, s.location stallLocation, st.name stallTypeName, st.width_m widthM, st.depth_m depthM,
              i.invoice_no invoiceNo, i.issued_at invoiceIssuedAt,
              p.transaction_ref transactionRef, p.method paymentMethod, p.status paymentStatus, p.verified_at paymentVerifiedAt,
              pp.id paymentProofAssetId, pp.mime_type paymentProofMime, pp.byte_size paymentProofBytes,
              (SELECT nl.status FROM notification_logs nl WHERE nl.booking_id = b.id AND nl.type = 'booking_confirmed'
                ORDER BY nl.created_at DESC LIMIT 1) confirmationEmail
       FROM stall_bookings b
       JOIN exhibition_applications a ON a.id = b.application_id
       JOIN users u ON u.id = b.user_id
       JOIN events e ON e.id = b.event_id
       JOIN stalls s ON s.id = b.stall_id
       JOIN stall_types st ON st.id = b.stall_type_id
       LEFT JOIN invoices i ON i.booking_id = b.id
       LEFT JOIN payments p ON p.booking_id = b.id AND p.status = 'VERIFIED'
       LEFT JOIN media_assets pp ON pp.id = b.payment_proof_asset_id
       WHERE b.id = ?`, [req.params.id])
    const receipt = rows[0]
    if (!receipt) return res.status(404).json({ error: 'Booking not found' })
    if (!isAdmin && receipt.userId !== req.user!.id) return res.status(403).json({ error: 'Insufficient permissions' })
    res.json(receipt)
  } catch (error) { next(error) }
})

// ---------- admin ----------
bookingsRouter.get('/admin/locations', ...manage, async (_req, res, next) => {
  try {
    const [locations] = await pool.query<any[]>(
      `SELECT DISTINCT e.city, e.state
       FROM events e
       WHERE EXISTS (SELECT 1 FROM exhibition_applications a WHERE a.event_id = e.id)
          OR EXISTS (SELECT 1 FROM stall_bookings b WHERE b.event_id = e.id)
       ORDER BY e.state, e.city`)
    res.json(locations)
  } catch (error) { next(error) }
})

bookingsRouter.get('/admin/applications', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const status = z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']).safeParse(req.query.status)
    const eventId = z.string().uuid().safeParse(req.query.eventId)
    const city = z.string().trim().max(120).safeParse(req.query.city)
    const state = z.string().trim().max(120).safeParse(req.query.state)
    const q = z.string().trim().max(120).safeParse(req.query.q)
    const where: string[] = []
    const params: unknown[] = []
    if (status.success) { where.push('a.status = ?'); params.push(status.data) }
    if (eventId.success) { where.push('a.event_id = ?'); params.push(eventId.data) }
    if (city.success && city.data) { where.push('e.city = ?'); params.push(city.data) }
    if (state.success && state.data) {
      where.push("FIND_IN_SET(?, REPLACE(REPLACE(REPLACE(REPLACE(e.state, ';', ','), '/', ','), ', ', ','), ' ,', ',')) > 0")
      params.push(state.data)
    }
    if (q.success && q.data) {
      where.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR a.phone LIKE ? OR u.email LIKE ? OR a.application_ref LIKE ? OR rs.code LIKE ?)')
      const like = `%${q.data}%`
      params.push(like, like, like, like, like, like)
    }
    const [applications] = await pool.query<any[]>(
      `SELECT a.id, a.application_ref applicationRef, a.status, a.first_name firstName, a.last_name lastName, a.art_form artForm,
              a.space_category spaceCategory, a.created_at createdAt, a.reviewed_at reviewedAt,
              e.title eventTitle, e.city eventCity, e.state eventState, u.email, st.name preferredStallType,
              rs.code requestedStallCode, a.phone
       FROM exhibition_applications a
       JOIN events e ON e.id = a.event_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN stall_types st ON st.id = a.preferred_stall_type_id
       LEFT JOIN stalls rs ON rs.id = a.requested_stall_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC LIMIT 300`, params)
    res.json(applications)
  } catch (error) { next(error) }
})

bookingsRouter.get('/admin/applications/:id', ...manage, async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT a.id, a.application_ref applicationRef, a.user_id userId, a.event_id eventId,
              a.first_name firstName, a.last_name lastName, a.phone, a.address,
              a.website_url websiteUrl, a.instagram_url instagramUrl, a.art_form artForm, a.fascia_name fasciaName,
              a.bio, a.space_category spaceCategory, a.preferred_stall_type_id preferredStallTypeId,
              a.requested_stall_id requestedStallId, a.approx_size_sqm approxSizeSqm,
              a.special_requirements specialRequirements, a.agree_terms agreeTerms, a.status,
              a.admin_notes adminNotes, a.reviewed_by reviewedBy, a.reviewed_at reviewedAt,
              a.created_at createdAt, a.updated_at updatedAt,
              e.title eventTitle, e.city eventCity, e.state eventState, e.venue, e.starts_at eventStartsAt, u.email, u.email_verified_at emailVerifiedAt,
              st.name preferredStallType, st.price preferredStallPrice, rs.code requestedStallCode, rs.location requestedStallLocation,
              ru.full_name reviewedByName
       FROM exhibition_applications a
       JOIN events e ON e.id = a.event_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN stall_types st ON st.id = a.preferred_stall_type_id
       LEFT JOIN stalls rs ON rs.id = a.requested_stall_id
       LEFT JOIN users ru ON ru.id = a.reviewed_by
       WHERE a.id = ?`, [req.params.id])
    const application = rows[0]
    if (!application) return res.status(404).json({ error: 'Application not found' })
    const [media] = await pool.query<any[]>(
      `SELECT m.id, m.mime_type mimeType, m.byte_size byteSize, m.alt_text altText, am.kind, am.sort_order sortOrder
       FROM application_media am JOIN media_assets m ON m.id = am.media_asset_id
       WHERE am.application_id = ? ORDER BY am.sort_order, am.kind`, [req.params.id])
    res.json({
      ...application,
      media: media.map((item) => ({ ...item, url: `/api/bookings/media/${item.id}` })),
    })
  } catch (error) { next(error) }
})

const decisionInput = z.object({
  action: z.enum(['START_REVIEW', 'APPROVE', 'REJECT', 'REQUEST_CHANGES']),
  notes: z.string().trim().max(1000).optional(),
})

bookingsRouter.put('/admin/applications/:id/decision', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = decisionInput.parse(req.body)
    const nextStatus = { START_REVIEW: 'UNDER_REVIEW', APPROVE: 'APPROVED', REJECT: 'REJECTED', REQUEST_CHANGES: 'CHANGES_REQUESTED' }[input.action]
    const subject = { START_REVIEW: 'is now under review', APPROVE: 'has been approved', REJECT: 'was not approved', REQUEST_CHANGES: 'needs a few changes' }[input.action]
    const result = await withTransaction(async (db) => {
      const [apps] = await db.query<any[]>('SELECT a.*, e.title eventTitle, u.email FROM exhibition_applications a JOIN events e ON e.id=a.event_id JOIN users u ON u.id=a.user_id WHERE a.id = ? FOR UPDATE', [req.params.id])
      const app = apps[0]
      if (!app) return fail(404, 'Application not found')
      await db.query('UPDATE exhibition_applications SET status=?, admin_notes=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?',
        [nextStatus, input.notes ?? app.admin_notes, req.user!.id, app.id])
      await notify(db, {
        applicationId: app.id, email: app.email, type: `application_${nextStatus.toLowerCase()}`,
        subject: `Application ${app.application_ref} ${subject} — The Haat of Art`,
        text: `Your application ${app.application_ref} for ${app.eventTitle} ${subject}.${input.notes ? `\n\nNote from the team: ${input.notes}` : ''}`,
      })
      await recordAudit(req.user!.id, 'application.decision', 'exhibition_application', app.id, { action: input.action, notes: input.notes ?? null })
      return done({ id: app.id, applicationStatus: nextStatus })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

bookingsRouter.get('/admin/bookings', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const status = z.enum(['PAYMENT_PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED']).safeParse(req.query.status)
    const eventId = z.string().uuid().safeParse(req.query.eventId)
    const city = z.string().trim().max(120).safeParse(req.query.city)
    const state = z.string().trim().max(120).safeParse(req.query.state)
    const q = z.string().trim().max(120).safeParse(req.query.q)
    const where: string[] = []
    const params: unknown[] = []
    if (status.success) { where.push('b.status = ?'); params.push(status.data) }
    if (eventId.success) { where.push('b.event_id = ?'); params.push(eventId.data) }
    if (city.success && city.data) { where.push('e.city = ?'); params.push(city.data) }
    if (state.success && state.data) {
      where.push("FIND_IN_SET(?, REPLACE(REPLACE(REPLACE(REPLACE(e.state, ';', ','), '/', ','), ', ', ','), ' ,', ',')) > 0")
      params.push(state.data)
    }
    if (q.success && q.data) {
      where.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR a.phone LIKE ? OR u.email LIKE ? OR a.application_ref LIKE ? OR b.booking_ref LIKE ? OR s.code LIKE ?)')
      const like = `%${q.data}%`
      params.push(like, like, like, like, like, like, like)
    }
    const [bookings] = await pool.query<any[]>(
      `SELECT b.id, b.booking_ref bookingRef, b.status, b.total_amount totalAmount, b.currency, b.created_at createdAt,
              a.application_ref applicationRef, a.first_name firstName, a.last_name lastName, a.phone, a.address, u.email,
              st.name stallType, (SELECT MAX(h.expires_at) FROM stall_holds h WHERE h.booking_id = b.id AND h.released_at IS NULL) holdExpiresAt,
              e.title eventTitle, e.city eventCity, e.state eventState, e.venue, s.code stallCode, s.location stallLocation,
              b.payment_proof_asset_id paymentProofAssetId, pp.mime_type paymentProofMime,
              p.id paymentId, p.status paymentStatus, p.method paymentMethod, p.transaction_ref transactionRef, p.amount paidAmount,
              i.invoice_no invoiceNo
       FROM stall_bookings b
       JOIN exhibition_applications a ON a.id = b.application_id
       JOIN users u ON u.id = b.user_id
       JOIN events e ON e.id = b.event_id
       JOIN stalls s ON s.id = b.stall_id
       JOIN stall_types st ON st.id = b.stall_type_id
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2 WHERE p2.booking_id = b.id
         ORDER BY FIELD(p2.status, 'VERIFIED', 'PENDING', 'FAILED', 'REJECTED'), p2.created_at DESC, p2.id DESC LIMIT 1
       )
       LEFT JOIN media_assets pp ON pp.id = b.payment_proof_asset_id
       LEFT JOIN invoices i ON i.booking_id = b.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.created_at DESC LIMIT 300`, params)
    res.json(bookings)
  } catch (error) { next(error) }
})

async function settlePayment(paymentId: string, verifierId: string | null, mode: 'verify' | 'reject') {
  return withTransaction(async (db) => {
    const [payments] = await db.query<any[]>('SELECT * FROM payments WHERE id = ? FOR UPDATE', [paymentId])
    const payment = payments[0]
    if (!payment) return fail(404, 'Payment not found')
    if (payment.status !== 'PENDING') return fail(409, `Payment is already ${payment.status.toLowerCase()}`)
    if (mode === 'reject') {
      await db.query(`UPDATE payments SET status='REJECTED', verified_by=?, verified_at=NOW() WHERE id=?`, [verifierId, payment.id])
      await recordAudit(verifierId, 'payment.reject', 'payment', payment.id, { bookingId: payment.booking_id })
      return done({ id: payment.id, paymentStatus: 'REJECTED' })
    }
    const [bookings] = await db.query<any[]>('SELECT * FROM stall_bookings WHERE id = ? FOR UPDATE', [payment.booking_id])
    const booking = bookings[0]
    const [holds] = await db.query<any[]>('SELECT id, expires_at FROM stall_holds WHERE booking_id = ? AND released_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [booking.id])
    if (booking.status !== 'PAYMENT_PENDING' || !holds[0] || new Date(holds[0].expires_at) < new Date()) {
      await db.query(`UPDATE payments SET status='FAILED', verified_by=?, verified_at=NOW() WHERE id=?`, [verifierId, payment.id])
      if (booking.status === 'PAYMENT_PENDING') await db.query(`UPDATE stall_bookings SET status='EXPIRED' WHERE id=?`, [booking.id])
      if (holds[0]) await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [holds[0].id])
      return fail(409, 'Hold expired before verification — booking marked expired')
    }
    await db.query(`UPDATE payments SET status='VERIFIED', verified_by=?, verified_at=NOW() WHERE id=?`, [verifierId, payment.id])
    await db.query(`UPDATE stall_bookings SET status='CONFIRMED' WHERE id=?`, [booking.id])
    await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [holds[0].id])
    const invoiceNo = refCode('INV')
    await db.query('INSERT INTO invoices(id,booking_id,invoice_no,amount,tax_amount,currency,issued_at) VALUES (?,?,?,?,?,?,NOW())',
      [crypto.randomUUID(), booking.id, invoiceNo, booking.base_amount, booking.tax_amount, booking.currency])
    const [user] = await db.query<any[]>('SELECT email FROM users WHERE id = ?', [booking.user_id])
    await notify(db, {
      bookingId: booking.id, email: user[0].email, type: 'booking_confirmed',
      subject: `Booking ${booking.booking_ref} confirmed — The Haat of Art`,
      text: `Your stall booking ${booking.booking_ref} is confirmed. Invoice ${invoiceNo}. Total paid ${booking.total_amount} ${booking.currency}.`,
    })
    await recordAudit(verifierId, 'payment.verify', 'payment', payment.id, { bookingId: booking.id })
    return done({ id: payment.id, paymentStatus: 'VERIFIED', bookingId: booking.id, bookingStatus: 'CONFIRMED', invoiceNo })
  })
}

bookingsRouter.post('/admin/payments/:id/verify', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const paymentId = z.string().uuid().parse(req.params.id)
    const result = await settlePayment(paymentId, req.user!.id, 'verify')
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

bookingsRouter.post('/admin/payments/:id/reject', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const paymentId = z.string().uuid().parse(req.params.id)
    const result = await settlePayment(paymentId, req.user!.id, 'reject')
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

// ---------- admin: cancellation & refunds ----------
bookingsRouter.post('/admin/bookings/:id/cancel', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ reason: z.string().trim().min(3).max(255), refund: z.coerce.boolean().default(false) }).parse(req.body)
    const bookingId = z.string().uuid().parse(req.params.id)
    const result = await withTransaction(async (db) => {
      const [rows] = await db.query<any[]>('SELECT * FROM stall_bookings WHERE id = ? FOR UPDATE', [bookingId])
      const booking = rows[0]
      if (!booking) return fail(404, 'Booking not found')
      if (!['PAYMENT_PENDING', 'CONFIRMED'].includes(booking.status)) return fail(409, `Booking is ${booking.status.toLowerCase()} and cannot be cancelled`)
      const [pays] = await db.query<any[]>("SELECT id, status FROM payments WHERE booking_id = ? AND status = 'VERIFIED' FOR UPDATE", [booking.id])
      const paid = pays[0]
      if (input.refund && !paid) return fail(409, 'Only a paid booking can be refunded')
      const nextStatus = input.refund ? 'REFUND_PENDING' : 'CANCELLED'
      await db.query('UPDATE stall_bookings SET status=?, cancellation_reason=?, cancelled_at=NOW() WHERE id=?', [nextStatus, input.reason, booking.id])
      await db.query('UPDATE stall_holds SET released_at = NOW() WHERE booking_id = ? AND released_at IS NULL', [booking.id])
      await db.query(`UPDATE payments SET status='FAILED' WHERE booking_id = ? AND status='PENDING'`, [booking.id])
      const [user] = await db.query<any[]>('SELECT email FROM users WHERE id = ?', [booking.user_id])
      await notify(db, {
        bookingId: booking.id, email: user[0].email, type: 'booking_cancelled',
        subject: `Booking ${booking.booking_ref} ${input.refund ? 'cancelled — refund queued' : 'cancelled'} — The Haat of Art`,
        text: `Your booking ${booking.booking_ref} was cancelled. Reason: ${input.reason}.${input.refund ? `\n\nA refund of ${booking.total_amount} ${booking.currency} has been queued and will reach your account in 5-7 working days.` : ''}`,
      })
      await recordAudit(req.user!.id, 'booking.cancel', 'stall_booking', booking.id, { reason: input.reason, refund: input.refund })
      return done({ bookingId: booking.id, status: nextStatus })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

bookingsRouter.post('/admin/bookings/:id/refund-complete', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const bookingId = z.string().uuid().parse(req.params.id)
    const result = await withTransaction(async (db) => {
      const [rows] = await db.query<any[]>('SELECT * FROM stall_bookings WHERE id = ? FOR UPDATE', [bookingId])
      const booking = rows[0]
      if (!booking) return fail(404, 'Booking not found')
      if (booking.status !== 'REFUND_PENDING') return fail(409, 'Booking does not have a refund pending')
      await db.query(`UPDATE stall_bookings SET status='REFUNDED' WHERE id=?`, [booking.id])
      await db.query(`UPDATE payments SET status='REFUNDED' WHERE booking_id = ? AND status='VERIFIED'`, [booking.id])
      const [user] = await db.query<any[]>('SELECT email FROM users WHERE id = ?', [booking.user_id])
      await notify(db, {
        bookingId: booking.id, email: user[0].email, type: 'booking_refunded',
        subject: `Refund completed for booking ${booking.booking_ref} — The Haat of Art`,
        text: `Your refund of ${booking.total_amount} ${booking.currency} for booking ${booking.booking_ref} has been processed.`,
      })
      await recordAudit(req.user!.id, 'booking.refunded', 'stall_booking', booking.id, { amount: booking.total_amount })
      return done({ bookingId: booking.id, status: 'REFUNDED' })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.json(result)
  } catch (error) { next(error) }
})

// ---------- admin: stalls & stall types ----------
bookingsRouter.get('/admin/stall-types', ...manage, async (_req: AuthRequest, res, next) => {
  try {
    const [types] = await pool.query<any[]>(
      'SELECT id, code, name, category, width_m widthM, depth_m depthM, price, tax_rate taxRate, includes, active FROM stall_types ORDER BY sort_order, price')
    res.json(types)
  } catch (error) { next(error) }
})

bookingsRouter.get('/admin/events/:eventId/stalls', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [events] = await pool.query<any[]>('SELECT id FROM events WHERE id=?', [req.params.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const [rows] = await pool.query<any[]>(
      `${stallSelect}${stallBookingsJoins}
       WHERE s.event_id=?
       ORDER BY s.state, s.sort_order, s.code`,
      [req.params.eventId])
    res.json(rows.map((row) => ({
      id: row.id,
      code: row.code,
      state: row.state,
      location: row.location,
      sortOrder: row.sortOrder,
      floorX: row.floorX,
      floorY: row.floorY,
      status: stallStatus(row),
      holdExpiresAt: row.holdExpiresAt ?? row.selectionHoldExpiresAt ?? null,
      type: {
        id: row.typeId,
        code: row.typeCode,
        name: row.typeName,
        category: row.category,
        widthM: row.widthM,
        depthM: row.depthM,
        price: row.price,
        taxRate: row.taxRate,
        includes: row.includes,
      },
    })))
  } catch (error) { next(error) }
})

bookingsRouter.get('/admin/events/:eventId/stall-pricing', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [events] = await pool.query<any[]>('SELECT id, state FROM events WHERE id=?', [req.params.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const [stateRows] = await pool.query<any[]>(
      'SELECT state, stall_type_id stallTypeId, price, tax_rate taxRate, slot_count slotCount, public_visible publicVisible FROM event_state_stall_pricing WHERE event_id=?',
      [req.params.eventId])
    if (stateRows.length) {
      const [types] = await pool.query<any[]>(
        'SELECT id stallTypeId, code, name, category, width_m widthM, depth_m depthM, active FROM stall_types ORDER BY sort_order, price')
      const [slotRows] = await pool.query<any[]>(
        `SELECT state, stall_type_id stallTypeId, COUNT(*) slotCount FROM stalls WHERE event_id=? AND state<>'' GROUP BY state, stall_type_id`,
        [req.params.eventId])
      const states = [...new Set([...splitStates(events[0].state), ...stateRows.map((row) => String(row.state))])]
      const statePricing = new Map(stateRows.map((row) => [`${row.state}:${row.stallTypeId}`, row]))
      const stateSlots = new Map(slotRows.map((row) => [`${row.state}:${row.stallTypeId}`, Number(row.slotCount)]))
      return res.json(states.flatMap((state) => types.map((type) => {
        const key = `${state}:${type.stallTypeId}`
        const pricing = statePricing.get(key)
        return {
          ...type,
          state,
          price: pricing?.price ?? null,
          taxRate: pricing?.taxRate ?? null,
          publicVisible: pricing?.publicVisible ?? false,
          slotCount: stateSlots.get(key) ?? 0,
        }
      })))
    }
    const [rows] = await pool.query<any[]>(
      `SELECT st.id stallTypeId, st.code, st.name, st.category, st.width_m widthM, st.depth_m depthM, st.active,
              pricing.price, pricing.tax_rate taxRate, pricing.public_visible publicVisible, NULL state,
              (SELECT COUNT(*) FROM stalls s WHERE s.event_id=? AND s.stall_type_id=st.id) slotCount
       FROM stall_types st
       LEFT JOIN event_stall_pricing pricing ON pricing.stall_type_id=st.id AND pricing.event_id=?
       ORDER BY st.sort_order, st.price`, [req.params.eventId, req.params.eventId])
    res.json(rows)
  } catch (error) { next(error) }
})

bookingsRouter.put('/admin/events/:eventId/state-stall-pricing/:state/:stallTypeId', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      price: z.coerce.number().min(0).max(10000000),
      taxRate: z.coerce.number().min(0).max(100),
      publicVisible: z.boolean(),
    }).parse(req.body)
    const state = z.string().trim().min(1).max(120).parse(req.params.state)
    const [events] = await pool.query<any[]>('SELECT id, state FROM events WHERE id=?', [req.params.eventId])
    const [types] = await pool.query<any[]>('SELECT id, active FROM stall_types WHERE id=?', [req.params.stallTypeId])
    if (!events[0] || !types[0]) return res.status(404).json({ error: 'Exhibition or stall type not found' })
    if (!splitStates(events[0].state).includes(state)) return res.status(400).json({ error: 'Select a state assigned to this exhibition' })
    if (input.publicVisible && !types[0].active) return res.status(409).json({ error: 'Show the stall category before publishing its tariff' })
    const [[slots]] = await pool.query<any[]>(
      'SELECT COUNT(*) slotCount FROM stalls WHERE event_id=? AND state=? AND stall_type_id=?',
      [req.params.eventId, state, req.params.stallTypeId])
    await pool.query(
      `INSERT INTO event_state_stall_pricing(event_id,state,stall_type_id,price,tax_rate,slot_count,public_visible)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE price=VALUES(price), tax_rate=VALUES(tax_rate),
         slot_count=VALUES(slot_count), public_visible=VALUES(public_visible)`,
      [req.params.eventId, state, req.params.stallTypeId, input.price, input.taxRate, slots.slotCount, input.publicVisible ? 1 : 0])
    await recordAudit(req.user!.id, 'event_state_stall_pricing.update', 'event_state_stall_pricing', `${req.params.eventId}:${state}:${req.params.stallTypeId}`, input)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

bookingsRouter.put('/admin/events/:eventId/stall-pricing/:stallTypeId', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      price: z.coerce.number().min(0).max(10000000),
      taxRate: z.coerce.number().min(0).max(100),
      publicVisible: z.boolean(),
    }).parse(req.body)
    const [events] = await pool.query<any[]>('SELECT id FROM events WHERE id=?', [req.params.eventId])
    const [types] = await pool.query<any[]>('SELECT id, active FROM stall_types WHERE id=?', [req.params.stallTypeId])
    if (!events[0] || !types[0]) return res.status(404).json({ error: 'Exhibition or stall type not found' })
    if (input.publicVisible && !types[0].active) return res.status(409).json({ error: 'Show the stall category before publishing its tariff' })
    await pool.query(
      `INSERT INTO event_stall_pricing(event_id,stall_type_id,price,tax_rate,public_visible)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE price=VALUES(price), tax_rate=VALUES(tax_rate), public_visible=VALUES(public_visible)`,
      [req.params.eventId, req.params.stallTypeId, input.price, input.taxRate, input.publicVisible ? 1 : 0])
    await recordAudit(req.user!.id, 'event_stall_pricing.update', 'event_stall_pricing', `${req.params.eventId}:${req.params.stallTypeId}`, input)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

const stallInput = z.object({
  eventId: z.string().uuid(),
  stallTypeId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  state: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
})

async function syncStateSlotCount(eventId: string, state: string, stallTypeId: string) {
  if (!state) return
  await pool.query(
    `UPDATE event_state_stall_pricing
     SET slot_count=(SELECT COUNT(*) FROM stalls WHERE event_id=? AND state=? AND stall_type_id=?)
     WHERE event_id=? AND state=? AND stall_type_id=?`,
    [eventId, state, stallTypeId, eventId, state, stallTypeId])
}

bookingsRouter.post('/admin/seed-floor-plans', ...manage, async (req: AuthRequest, res, next) => {
  try {
    let createdEvents = 0
    const result = await withTransaction(async (db) => {
      const eventIds: string[] = []
      for (const exhibition of floorPlanExhibitions) {
        const slug = exhibition.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const [matches] = await db.query<any[]>('SELECT id, title FROM events WHERE title=? OR slug=? LIMIT 2 FOR UPDATE', [exhibition.title, slug])
        const event = matches.find((entry) => entry.title === exhibition.title) ?? matches[0]
        if (event) {
          if (event.title !== exhibition.title) throw new Error(`The exhibition slug "${slug}" is already in use.`)
          await db.query(`UPDATE events SET
              city=IF(city='', ?, city), state=IF(state='', ?, state), venue=IF(venue='', ?, venue),
              description=IF(description='', ?, description)
            WHERE id=?`,
          [exhibition.city, exhibition.state, exhibition.venue,
            `Join artists and collectors at The Haat of Art in ${exhibition.city}.`, event.id])
          eventIds.push(event.id)
          continue
        }

        const eventId = crypto.randomUUID()
        await db.query(`INSERT INTO events
            (id, title, slug, description, starts_at, ends_at, venue, city, state, registration_deadline, status, created_by, approved_by, published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'PUBLISHED', ?, ?, NOW())`,
        [eventId, exhibition.title, slug, `Join artists and collectors at The Haat of Art in ${exhibition.city}.`,
          exhibition.startsAt, exhibition.endsAt, exhibition.venue, exhibition.city, exhibition.state, req.user!.id, req.user!.id])
        eventIds.push(eventId)
        createdEvents += 1
      }

      const stallTypeIds = new Map<string, string>()
      for (const type of floorPlanStallTypes) {
        const proposedId = crypto.randomUUID()
        await db.query(`INSERT INTO stall_types
            (id, code, name, category, width_m, depth_m, price, tax_rate, includes, active, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, 18, ?, 1, ?)
          ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), width_m=VALUES(width_m),
            depth_m=VALUES(depth_m), price=VALUES(price), tax_rate=VALUES(tax_rate),
            includes=IF(VALUES(includes)='', includes, VALUES(includes)),
            active=1, sort_order=VALUES(sort_order)`,
        [proposedId, type.code, type.name, type.category, type.widthM, type.depthM, type.price, type.includes, type.sortOrder])
        const [[stored]] = await db.query<any[]>('SELECT id FROM stall_types WHERE code=?', [type.code])
        if (!stored) throw new Error(`Could not sync stall type ${type.code}.`)
        stallTypeIds.set(type.code, stored.id)
      }

      for (const eventId of eventIds) {
        for (const booth of floorPlanBooths) {
          const stallTypeId = stallTypeIds.get(booth.typeCode)
          if (!stallTypeId) throw new Error(`Missing seeded stall type ${booth.typeCode}.`)
          const [existingRows] = await db.query<any[]>('SELECT id FROM stalls WHERE event_id=? AND code=? FOR UPDATE', [eventId, booth.code])
          const existing = existingRows[0]
          if (!existing) {
            const location = 'location' in booth ? booth.location : 'Main Hall'
            await db.query(`INSERT INTO stalls
                (id, event_id, stall_type_id, code, location, status, sort_order, floor_x, floor_y)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [crypto.randomUUID(), eventId, stallTypeId, booth.code, location, booth.status, booth.sortOrder, booth.floorX, booth.floorY])
            continue
          }

          const [[usage]] = await db.query<any[]>(`SELECT
              EXISTS(SELECT 1 FROM stall_bookings WHERE stall_id=?) OR
              EXISTS(SELECT 1 FROM stall_holds WHERE stall_id=? AND released_at IS NULL) inUse`,
          [existing.id, existing.id])
          if (Number(usage.inUse)) {
            await db.query('UPDATE stalls SET location=?, sort_order=?, floor_x=?, floor_y=? WHERE id=?',
              [location, booth.sortOrder, booth.floorX, booth.floorY, existing.id])
          } else {
            await db.query('UPDATE stalls SET stall_type_id=?, location=?, sort_order=?, floor_x=?, floor_y=? WHERE id=?',
              [stallTypeId, location, booth.sortOrder, booth.floorX, booth.floorY, existing.id])
          }
        }
      }

      return { exhibitionsSynced: eventIds.length, stallTypesSynced: stallTypeIds.size, boothsSynced: eventIds.length * floorPlanBooths.length }
    })
    await recordAudit(req.user!.id, 'floorplan.seed_sync', 'exhibition_floor_plans', null, { ...result, createdEvents })
    res.json({ ...result, createdEvents })
  } catch (error) { next(error) }
})

bookingsRouter.post('/admin/stalls', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = stallInput.parse(req.body)
    const [events] = await pool.query<any[]>('SELECT id, state FROM events WHERE id=?', [input.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const [statePricing] = await pool.query<any[]>('SELECT state FROM event_state_stall_pricing WHERE event_id=? LIMIT 1', [input.eventId])
    if (statePricing.length && !splitStates(events[0].state).includes(input.state)) {
      return res.status(400).json({ error: 'Choose a state assigned to this exhibition' })
    }
    const id = crypto.randomUUID()
    const [next] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 nextOrder FROM stalls WHERE event_id = ?', [input.eventId])
    const [result] = await pool.query<any>('INSERT INTO stalls(id,event_id,stall_type_id,code,state,location,sort_order) VALUES (?,?,?,?,?,?,?)',
      [id, input.eventId, input.stallTypeId, input.code, input.state, input.location, next[0].nextOrder])
    await syncStateSlotCount(input.eventId, input.state, input.stallTypeId)
    await recordAudit(req.user!.id, 'stall.create', 'stall', id, { code: input.code, eventId: input.eventId })
    res.status(201).json({ id, affected: result.affectedRows })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Stall code already exists for this exhibition' })
    next(error)
  }
})

bookingsRouter.put('/admin/stalls/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ code: z.string().trim().min(1).max(20).optional(), state: z.string().trim().max(120).optional(), location: z.string().trim().max(120).optional(), status: z.enum(['AVAILABLE', 'BOOKED', 'RESERVED', 'DISABLED']).optional(), stallTypeId: z.string().uuid().optional() }).parse(req.body)
    const [existingRows] = await pool.query<any[]>('SELECT s.event_id eventId, s.state, s.status, s.stall_type_id stallTypeId, e.state eventStates FROM stalls s JOIN events e ON e.id=s.event_id WHERE s.id=?', [req.params.id])
    const existing = existingRows[0]
    if (!existing) return res.status(404).json({ error: 'Stall not found' })
    if (input.state !== undefined && input.state && !splitStates(existing.eventStates).includes(input.state)) {
      return res.status(400).json({ error: 'Choose a state assigned to this exhibition' })
    }
    if ((input.state !== undefined && input.state !== existing.state)
      || (input.stallTypeId !== undefined && input.stallTypeId !== existing.stallTypeId)) {
      const [[usage]] = await pool.query<any[]>(
        `SELECT EXISTS(SELECT 1 FROM stall_bookings WHERE stall_id=?)
           OR EXISTS(SELECT 1 FROM stall_holds WHERE stall_id=? AND released_at IS NULL AND expires_at>NOW()) inUse`,
        [req.params.id, req.params.id])
      if (Number(usage.inUse) || existing.status === 'BOOKED' || existing.status === 'RESERVED') {
        return res.status(409).json({ error: 'A booked, reserved or held stall cannot be moved to another state or type' })
      }
    }
    const set: string[] = []
    const values: unknown[] = []
    if (input.code !== undefined) { set.push('code=?'); values.push(input.code) }
    if (input.state !== undefined) { set.push('state=?'); values.push(input.state) }
    if (input.location !== undefined) { set.push('location=?'); values.push(input.location) }
    if (input.status !== undefined) { set.push('status=?'); values.push(input.status) }
    if (input.stallTypeId !== undefined) { set.push('stall_type_id=?'); values.push(input.stallTypeId) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE stalls SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Stall not found' })
    const nextState = input.state ?? existing.state
    const nextTypeId = input.stallTypeId ?? existing.stallTypeId
    await syncStateSlotCount(existing.eventId, existing.state, existing.stallTypeId)
    if (nextState !== existing.state || nextTypeId !== existing.stallTypeId) {
      await syncStateSlotCount(existing.eventId, nextState, nextTypeId)
    }
    await recordAudit(req.user!.id, 'stall.update', 'stall', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

bookingsRouter.delete('/admin/stalls/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [stalls] = await pool.query<any[]>('SELECT event_id eventId, state, stall_type_id stallTypeId FROM stalls WHERE id=?', [req.params.id])
    if (!stalls[0]) return res.status(404).json({ error: 'Stall not found' })
    const [used] = await pool.query<any[]>('SELECT id FROM stall_bookings WHERE stall_id = ? LIMIT 1', [req.params.id])
    if (used.length) return res.status(409).json({ error: 'Stall has bookings and cannot be deleted' })
    const [held] = await pool.query<any[]>(
      'SELECT id FROM stall_holds WHERE stall_id=? AND released_at IS NULL AND expires_at>NOW() LIMIT 1',
      [req.params.id])
    if (held.length) return res.status(409).json({ error: 'A selected or held stall cannot be deleted until its hold expires' })
    const [result] = await pool.query<any>('DELETE FROM stalls WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Stall not found' })
    await syncStateSlotCount(stalls[0].eventId, stalls[0].state, stalls[0].stallTypeId)
    await recordAudit(req.user!.id, 'stall.delete', 'stall', req.params.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const stallTypeInput = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  category: z.enum(['INDIVIDUAL', 'GROUP', 'GALLERY']),
  widthM: z.coerce.number().min(1).max(50),
  depthM: z.coerce.number().min(1).max(50),
  price: z.coerce.number().min(0).max(10000000),
  taxRate: z.coerce.number().min(0).max(100).default(18),
  includes: z.string().trim().max(255).default(''),
})

bookingsRouter.post('/admin/stall-types', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = stallTypeInput.parse(req.body)
    const id = crypto.randomUUID()
    const [next] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 nextOrder FROM stall_types')
    await pool.query('INSERT INTO stall_types(id,code,name,category,width_m,depth_m,price,tax_rate,includes,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, input.code.toUpperCase(), input.name, input.category, input.widthM, input.depthM, input.price, input.taxRate, input.includes, next[0].nextOrder])
    await recordAudit(req.user!.id, 'stall_type.create', 'stall_type', id, { code: input.code })
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

bookingsRouter.put('/admin/stall-types/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = stallTypeInput.partial().extend({ active: z.coerce.boolean().optional() }).parse(req.body)
    const map: Record<string, string> = { code: 'code', name: 'name', category: 'category', widthM: 'width_m', depthM: 'depth_m', price: 'price', taxRate: 'tax_rate', includes: 'includes', active: 'active' }
    const entries = Object.entries(input).filter(([key]) => key in map)
    if (!entries.length) return res.status(400).json({ error: 'At least one field is required' })
    const set = entries.map(([key]) => `${map[key]}=?`).join(',')
    const [result] = await pool.query<any>(`UPDATE stall_types SET ${set} WHERE id=?`, [...entries.map(([, value]) => value), req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Stall type not found' })
    await recordAudit(req.user!.id, 'stall_type.update', 'stall_type', req.params.id, { fields: entries.map(([key]) => key) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

// ---------- hold expiry worker ----------
async function expireHolds() {
  const [expired] = await pool.query<any[]>(
    `SELECT h.id, h.booking_id FROM stall_holds h JOIN stall_bookings b ON b.id = h.booking_id
     WHERE h.released_at IS NULL AND h.expires_at <= NOW() AND b.status = 'PAYMENT_PENDING'`)
  if (expired.length) {
    await withTransaction(async (db) => {
      for (const row of expired) {
        await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [row.id])
        await db.query(`UPDATE stall_bookings SET status='EXPIRED' WHERE id=? AND status='PAYMENT_PENDING'`, [row.booking_id])
        await db.query(`UPDATE payments SET status='FAILED' WHERE booking_id=? AND status='PENDING'`, [row.booking_id])
      }
    })
  }
  await pool.query('UPDATE stall_holds SET released_at = NOW() WHERE released_at IS NULL AND expires_at <= NOW()')
}

setInterval(() => { expireHolds().catch((error) => console.error('[hold-expiry]', error instanceof Error ? error.message : error)) }, 30_000).unref()
setTimeout(() => { expireHolds().catch((error) => console.error('[hold-expiry]', error instanceof Error ? error.message : error)) }, 5_000).unref()
