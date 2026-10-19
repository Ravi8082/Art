import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { queueEmail } from '../services/mailer.js'
import { recordAudit } from '../services/audit.js'
import { storeAsset } from './about.js'

export const bookingsRouter = Router()

const artist = [requireAuth] as const
const manage = [requireAuth, requirePermission('bookings:manage')] as const
const uploadBody = raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'], limit: '25mb' })

const HOLD_MINUTES = Math.max(0.05, Number(process.env.BOOKING_HOLD_MINUTES ?? 1440))
const webhookSecret = () => process.env.PAYMENT_WEBHOOK_SECRET ?? 'development-webhook-secret'
const signWebhook = (idempotencyKey: string, transactionRef: string, amount: number, status: string) =>
  crypto.createHmac('sha256', webhookSecret()).update(`${idempotencyKey}.${transactionRef}.${amount}.${status}`).digest('hex')

const refCode = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

// Discriminated transaction results: `ok` is a literal so narrowing is reliable.
const fail = (status: number, error: string) => ({ ok: false as const, status, error })
const done = <T extends object>(data: T) => ({ ok: true as const, ...data })

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
  SELECT s.id, s.code, s.location, s.sort_order sortOrder, s.status baseStatus,
         st.id typeId, st.name typeName, st.category, st.width_m widthM, st.depth_m depthM,
         st.price, st.tax_rate taxRate, st.includes,
         b.id bookingId, b.status bookingStatus,
         h.expires_at holdExpiresAt
  FROM stalls s
  JOIN stall_types st ON st.id = s.stall_type_id
  LEFT JOIN stall_bookings b ON b.stall_id = s.id AND b.status IN ('CONFIRMED','PAYMENT_PENDING','REFUND_PENDING')
  LEFT JOIN stall_holds h ON h.booking_id = b.id AND h.released_at IS NULL AND h.expires_at > NOW()`

function stallStatus(row: { baseStatus: string; bookingStatus: string | null }) {
  if (row.baseStatus === 'DISABLED') return 'DISABLED'
  if (row.bookingStatus === 'CONFIRMED') return 'BOOKED'
  if (row.bookingStatus) return 'HELD'
  return 'AVAILABLE'
}

const exhibitionSelect = `
  SELECT e.id, e.title, e.city, e.venue, e.starts_at startsAt, e.ends_at endsAt,
         e.registration_deadline registrationDeadline,
         (SELECT COUNT(*) FROM stalls s
           WHERE s.event_id = e.id AND s.status = 'AVAILABLE'
             AND NOT EXISTS (SELECT 1 FROM stall_bookings b WHERE b.stall_id = s.id
               AND b.status IN ('CONFIRMED','PAYMENT_PENDING','REFUND_PENDING'))) availableStalls,
         (SELECT COUNT(*) FROM stalls s WHERE s.event_id = e.id) totalStalls
  FROM events e
  WHERE e.status IN ('PUBLISHED','APPROVED')`

async function exhibitionsWithMedia() {
  const [events] = await pool.query<any[]>(`${exhibitionSelect} ORDER BY e.starts_at`)
  if (!events.length) return []
  const placeholders = events.map(() => '?').join(',')
  const [media] = await pool.query<any[]>(
    `SELECT id, event_id eventId, alt_text altText FROM event_media WHERE event_id IN (${placeholders}) AND data IS NOT NULL ORDER BY sort_order, id`,
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
      id: item.id, altText: item.altText, url: `/api/events/${event.id}/media/${item.id}`,
    })),
  }))
}

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
        AND NOT EXISTS (SELECT 1 FROM stall_bookings b WHERE b.stall_id=s.id AND b.status IN ('CONFIRMED','PAYMENT_PENDING','REFUND_PENDING'))) openStalls`)
    res.json({ stallTypes: types, window, stats })
  } catch (error) { next(error) }
})

bookingsRouter.get('/stall-types', async (_req, res, next) => {
  try {
    const [types] = await pool.query<any[]>('SELECT id, code, name, category, width_m widthM, depth_m depthM, price, tax_rate taxRate, includes FROM stall_types WHERE active = 1 ORDER BY sort_order, price')
    res.json(types)
  } catch (error) { next(error) }
})

bookingsRouter.get('/events/:eventId/stalls', async (req, res, next) => {
  try {
    const [events] = await pool.query<any[]>("SELECT id FROM events WHERE id=? AND status IN ('PUBLISHED','APPROVED')", [req.params.eventId])
    if (!events[0]) return res.status(404).json({ error: 'Exhibition not found' })
    const [stalls] = await pool.query<any[]>(`${stallSelect} WHERE s.event_id = ? ORDER BY s.sort_order, s.code`, [req.params.eventId])
    res.json(stalls.map((row) => ({
      id: row.id, code: row.code, location: row.location, sortOrder: row.sortOrder,
      status: stallStatus(row), holdExpiresAt: row.holdExpiresAt ?? null,
      type: { id: row.typeId, name: row.typeName, category: row.category, widthM: row.widthM, depthM: row.depthM, price: row.price, taxRate: row.taxRate, includes: row.includes },
    })))
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
  agreeTerms: z.literal(true),
})

bookingsRouter.post('/applications', ...artist, async (req: AuthRequest, res, next) => {
  try {
    const input = applicationInput.parse(req.body)
    const [events] = await pool.query<any[]>(
      `SELECT id, title FROM events WHERE id=? AND status IN ('PUBLISHED','APPROVED') AND (registration_deadline IS NULL OR registration_deadline > NOW())`,
      [input.eventId])
    if (!events[0]) return res.status(409).json({ error: 'Exhibition is not open for registration' })
    const [duplicates] = await pool.query<any[]>(
      `SELECT id, application_ref FROM exhibition_applications WHERE user_id = ? AND event_id = ? AND status <> 'REJECTED'`,
      [req.user!.id, input.eventId])
    if (duplicates.length) return res.status(409).json({ error: 'You already have an application for this exhibition', applicationRef: duplicates[0].application_ref ?? null })

    const artworkAssetIds = [...new Set(input.artworkAssetIds)]
    const wanted = input.portfolioAssetId ? [...artworkAssetIds, input.portfolioAssetId] : artworkAssetIds
    if (wanted.length) {
      const placeholders = wanted.map(() => '?').join(',')
      const [owned] = await pool.query<any[]>(
        `SELECT id FROM media_assets WHERE id IN (${placeholders}) AND uploaded_by = ? AND kind LIKE 'application-%'`,
        [...wanted, req.user!.id])
      if ((owned as any[]).length !== wanted.length) return res.status(400).json({ error: 'One or more uploads do not belong to this account' })
    }
    if (input.requestedStallId) {
      const [rows] = await pool.query<any[]>(
        `SELECT s.status, (SELECT COUNT(*) FROM stall_bookings b WHERE b.stall_id = s.id AND b.status IN ('PAYMENT_PENDING','CONFIRMED','REFUND_PENDING')) activeBookings
         FROM stalls s WHERE s.id = ? AND s.event_id = ?`, [input.requestedStallId, input.eventId])
      const stall = rows[0]
      if (!stall || stall.status !== 'AVAILABLE' || Number(stall.activeBookings) > 0) return res.status(409).json({ error: 'That stall is no longer available — please pick another' })
    }

    const id = crypto.randomUUID()
    const applicationRef = refCode('THOA')
    const bio = sanitizeBioHtml(input.bio).slice(0, 6000)
    if (bio.replace(/<[^>]*>/g, '').trim().length < 20) return res.status(400).json({ error: 'Please describe your artwork in a little more detail' })
    await withTransaction(async (db) => {
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
      const [user] = await db.query<any[]>('SELECT email FROM users WHERE id=?', [req.user!.id])
      await notify(db, {
        applicationId: id, email: user[0].email, type: 'application_submitted',
        subject: `Application ${applicationRef} received — The Haat of Art`,
        text: `We received your exhibitor application ${applicationRef} for ${events[0].title}. Our team will review it and email you the outcome.`,
      })
      await recordAudit(req.user!.id, 'application.create', 'exhibition_application', id, { applicationRef, eventId: input.eventId })
    })
    res.status(201).json({ id, applicationRef, status: 'SUBMITTED' })
  } catch (error) { next(error) }
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
      const [apps] = await db.query<any[]>('SELECT * FROM exhibition_applications WHERE id = ? FOR UPDATE', [input.applicationId])
      const app = apps[0]
      if (!app || app.user_id !== req.user!.id) return fail(404, 'Application not found')
      if (app.status !== 'APPROVED') return fail(409, 'Application must be approved before booking a stall')
      const [existing] = await db.query<any[]>('SELECT id FROM stall_bookings WHERE application_id = ?', [app.id])
      if (existing.length) return fail(409, 'A booking already exists for this application')

      const [stalls] = await db.query<any[]>(
        `SELECT s.*, st.price, st.tax_rate FROM stalls s JOIN stall_types st ON st.id = s.stall_type_id WHERE s.id = ? FOR UPDATE`, [input.stallId])
      const stall = stalls[0]
      if (!stall) return fail(404, 'Stall not found')
      if (stall.event_id !== app.event_id) return fail(400, 'Stall does not belong to the selected exhibition')
      await db.query('UPDATE stall_holds SET released_at = NOW() WHERE stall_id = ? AND released_at IS NULL AND expires_at < NOW()', [stall.id])
      const [taken] = await db.query<any[]>(
        `SELECT b.id FROM stall_bookings b JOIN stall_holds h ON h.booking_id = b.id AND h.released_at IS NULL AND h.expires_at > NOW()
         WHERE b.stall_id = ? AND b.status IN ('PAYMENT_PENDING','CONFIRMED') FOR UPDATE`, [stall.id])
      if (taken.length) return fail(409, 'Stall was just taken — please pick another')
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
      await db.query('INSERT INTO stall_holds(id,stall_id,application_id,booking_id,expires_at) VALUES (?,?,?,?,?)',
        [crypto.randomUUID(), stall.id, app.id, bookingId, holdExpiresAt])
      await recordAudit(req.user!.id, 'booking.create', 'stall_booking', bookingId, { bookingRef, stallId: stall.id, total })
      return done({ bookingId, bookingRef, totalAmount: total, holdExpiresAt: holdExpiresAt.toISOString(), status: 'PAYMENT_PENDING' })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    void alertAdminsOfBooking(result.bookingId).catch(() => undefined)
    res.status(201).json(result)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
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

    const [existing] = await pool.query<any[]>('SELECT * FROM payments WHERE idempotency_key = ?', [idempotencyKey])
    if (existing[0]) {
      const payment = existing[0]
      return res.json({
        provider: 'SANDBOX', paymentId: payment.id, idempotencyKey, transactionRef: payment.transaction_ref,
        amount: Number(payment.amount), status: payment.status, duplicate: true,
        note: 'Sandbox adapter — idempotent retry returned the existing payment.',
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
      const transactionRef = `SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
      await db.query(
        `INSERT INTO payments(id,booking_id,provider,method,amount,currency,status,transaction_ref,idempotency_key)
         VALUES (?,?,?,?,?,?, 'PENDING', ?, ?)`,
        [paymentId, booking.id, 'SANDBOX', input.method, booking.total_amount, booking.currency, transactionRef, idempotencyKey])
      await recordAudit(req.user!.id, 'payment.initiate', 'payment', paymentId, { bookingId: booking.id, method: input.method })
      return done({
        provider: 'SANDBOX', paymentId, idempotencyKey, transactionRef, amount: Number(booking.total_amount), status: 'PENDING',
        holdExpiresAt: holds[0].expires_at,
        note: 'Sandbox adapter — no real money moves. Success webhook signature is provided so the flow can be completed end-to-end.',
        sandboxSuccessWebhook: input.method === 'BANK_TRANSFER' ? null : {
          url: '/api/bookings/payments/webhook',
          body: {
            idempotencyKey, transactionRef, amount: Number(booking.total_amount), status: 'SUCCESS',
            signature: signWebhook(idempotencyKey, transactionRef, Number(booking.total_amount), 'SUCCESS'),
          },
        },
      })
    })
    if (!result.ok) return res.status(result.status).json({ error: result.error })
    res.status(201).json(result)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      const [retry] = await pool.query<any[]>('SELECT * FROM payments WHERE idempotency_key = ?', [idempotencyKey])
      const payment = retry[0]
      if (payment) return res.json({ provider: 'SANDBOX', paymentId: payment.id, idempotencyKey, transactionRef: payment.transaction_ref, amount: Number(payment.amount), status: payment.status, duplicate: true })
    }
    next(error)
  }
})

const webhookInput = z.object({
  idempotencyKey: z.string().min(8).max(80),
  transactionRef: z.string().max(120),
  amount: z.coerce.number().positive(),
  status: z.enum(['SUCCESS', 'FAILURE']),
  signature: z.string(),
})

bookingsRouter.post('/payments/webhook', async (req, res, next) => {
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
              a.application_ref applicationRef, a.first_name firstName, a.last_name lastName, u.email accountEmail,
              e.title eventTitle, e.city eventCity, e.venue, e.starts_at eventStartsAt, e.ends_at eventEndsAt,
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
bookingsRouter.get('/admin/applications', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const status = z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']).safeParse(req.query.status)
    const eventId = z.string().uuid().safeParse(req.query.eventId)
    const q = z.string().trim().max(120).safeParse(req.query.q)
    const where: string[] = []
    const params: unknown[] = []
    if (status.success) { where.push('a.status = ?'); params.push(status.data) }
    if (eventId.success) { where.push('a.event_id = ?'); params.push(eventId.data) }
    if (q.success && q.data) { where.push('(a.first_name LIKE ? OR a.last_name LIKE ? OR u.email LIKE ? OR a.application_ref LIKE ?)'); const like = `%${q.data}%`; params.push(like, like, like, like) }
    const [applications] = await pool.query<any[]>(
      `SELECT a.id, a.application_ref applicationRef, a.status, a.first_name firstName, a.last_name lastName, a.art_form artForm,
              a.space_category spaceCategory, a.created_at createdAt, a.reviewed_at reviewedAt,
              e.title eventTitle, e.city eventCity, u.email, st.name preferredStallType
       FROM exhibition_applications a
       JOIN events e ON e.id = a.event_id
       JOIN users u ON u.id = a.user_id
       LEFT JOIN stall_types st ON st.id = a.preferred_stall_type_id
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
              e.title eventTitle, e.city eventCity, e.venue, e.starts_at eventStartsAt, u.email, u.email_verified_at emailVerifiedAt,
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
    const where = status.success ? 'WHERE b.status = ?' : ''
    const params = status.success ? [status.data] : []
    const [bookings] = await pool.query<any[]>(
      `SELECT b.id, b.booking_ref bookingRef, b.status, b.total_amount totalAmount, b.currency, b.created_at createdAt,
              a.application_ref applicationRef, a.first_name firstName, a.last_name lastName, a.phone, u.email,
              st.name stallType, (SELECT MAX(h.expires_at) FROM stall_holds h WHERE h.booking_id = b.id AND h.released_at IS NULL) holdExpiresAt,
              e.title eventTitle, s.code stallCode, b.payment_proof_asset_id paymentProofAssetId, pp.mime_type paymentProofMime,
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
       ${where} ORDER BY b.created_at DESC LIMIT 300`, params)
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
const stallInput = z.object({
  eventId: z.string().uuid(),
  stallTypeId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  location: z.string().trim().max(120).default(''),
})

bookingsRouter.post('/admin/stalls', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = stallInput.parse(req.body)
    const id = crypto.randomUUID()
    const [next] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 nextOrder FROM stalls WHERE event_id = ?', [input.eventId])
    const [result] = await pool.query<any>('INSERT INTO stalls(id,event_id,stall_type_id,code,location,sort_order) VALUES (?,?,?,?,?,?)',
      [id, input.eventId, input.stallTypeId, input.code, input.location, next[0].nextOrder])
    await recordAudit(req.user!.id, 'stall.create', 'stall', id, { code: input.code, eventId: input.eventId })
    res.status(201).json({ id, affected: result.affectedRows })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Stall code already exists for this exhibition' })
    next(error)
  }
})

bookingsRouter.put('/admin/stalls/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ code: z.string().trim().min(1).max(20).optional(), location: z.string().trim().max(120).optional(), status: z.enum(['AVAILABLE', 'DISABLED']).optional(), stallTypeId: z.string().uuid().optional() }).parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.code !== undefined) { set.push('code=?'); values.push(input.code) }
    if (input.location !== undefined) { set.push('location=?'); values.push(input.location) }
    if (input.status !== undefined) { set.push('status=?'); values.push(input.status) }
    if (input.stallTypeId !== undefined) { set.push('stall_type_id=?'); values.push(input.stallTypeId) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE stalls SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Stall not found' })
    await recordAudit(req.user!.id, 'stall.update', 'stall', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

bookingsRouter.delete('/admin/stalls/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [used] = await pool.query<any[]>('SELECT id FROM stall_bookings WHERE stall_id = ? LIMIT 1', [req.params.id])
    if (used.length) return res.status(409).json({ error: 'Stall has bookings and cannot be deleted' })
    const [result] = await pool.query<any>('DELETE FROM stalls WHERE id = ?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Stall not found' })
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
     WHERE h.released_at IS NULL AND h.expires_at < NOW() AND b.status = 'PAYMENT_PENDING'`)
  if (!expired.length) {
    await pool.query('UPDATE stall_holds SET released_at = NOW() WHERE released_at IS NULL AND expires_at < NOW()')
    return
  }
  await withTransaction(async (db) => {
    for (const row of expired) {
      await db.query('UPDATE stall_holds SET released_at = NOW() WHERE id = ?', [row.id])
      await db.query(`UPDATE stall_bookings SET status='EXPIRED' WHERE id=? AND status='PAYMENT_PENDING'`, [row.booking_id])
      await db.query(`UPDATE payments SET status='FAILED' WHERE booking_id=? AND status='PENDING'`, [row.booking_id])
    }
  })
}

setInterval(() => { expireHolds().catch((error) => console.error('[hold-expiry]', error instanceof Error ? error.message : error)) }, 30_000).unref()
setTimeout(() => { expireHolds().catch((error) => console.error('[hold-expiry]', error instanceof Error ? error.message : error)) }, 5_000).unref()
