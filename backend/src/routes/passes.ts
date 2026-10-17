import crypto from 'node:crypto'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, requireRole, type AuthRequest } from '../middleware/auth.js'
import { hashOtp, otpCode, otpExpiry, queueEmail } from '../services/mailer.js'
import { hashPassToken, passIdFromToken, passTokenForId, tokenFromScannedValue } from '../services/pass-token.js'

export const passesRouter = Router()

function signingSecret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}

const visitor = [requireAuth, requireRole('VISITOR'), requirePermission('passes:read')] as const
const checkInStaff = [requireAuth, requireRole('REGISTRATION_MANAGER', 'ADMIN', 'SUPER_ADMIN'), requirePermission('registrations:read')] as const
const publicPassLookupLimit = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })
const publicRegistrationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const publicVerificationLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const indoreEventSlug = 'the-haat-of-art-indore-2026'

passesRouter.post('/public/indore/register', publicRegistrationLimit, async (req, res, next) => {
  try {
    const input = z.object({
      fullName: z.string().trim().min(2).max(160),
      email: z.string().email().max(255),
      phone: z.string().trim().regex(/^[0-9+ ]{10,14}$/),
      city: z.enum(['Indore', 'Bhopal', 'Ujjain', 'Dewas', 'Other']),
      attendingAs: z.enum(['Visitor', 'Art Lover / Collector', 'Artist', 'Student', 'Interior Designer / Architect']),
      marketingConsent: z.boolean(),
    }).parse(req.body)
    const email = input.email.toLowerCase()
    const [[event]] = await pool.query<any[]>(`SELECT id,title FROM events
      WHERE slug=? AND status IN ('APPROVED','PUBLISHED') AND ends_at>=NOW()
        AND (registration_deadline IS NULL OR registration_deadline>NOW()) LIMIT 1`, [indoreEventSlug])
    if (!event) return res.status(409).json({ error: 'Free entry registration is not open for this exhibition right now.' })
    const [[recent]] = await pool.query<any[]>(`SELECT id FROM visitor_registration_challenges
      WHERE email=? AND event_id=? AND consumed_at IS NULL AND created_at>DATE_SUB(NOW(),INTERVAL 1 MINUTE)
      LIMIT 1`, [email, event.id])
    if (recent) return res.status(429).json({ error: 'A verification code was already requested. Please wait a minute before trying again.' })

    await pool.query('DELETE FROM visitor_registration_challenges WHERE expires_at<DATE_SUB(NOW(),INTERVAL 1 DAY) LIMIT 500')
    const code = otpCode()
    const challengeId = crypto.randomUUID()
    const expiresAt = otpExpiry()
    await pool.query(`INSERT INTO visitor_registration_challenges
      (id,event_id,email,full_name,phone,city,attending_as,marketing_consent,code_hash,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [challengeId, event.id, email, input.fullName, input.phone, input.city, input.attendingAs, input.marketingConsent, hashOtp(code), expiresAt])

    const delivery = await queueEmail(email, 'Verify your free Haat of Art entry pass',
      `Your verification code is ${code}. It expires in 5 minutes. Use it on the registration page to confirm your free entry pass.`)
    if (!delivery.delivered) {
      await pool.query('DELETE FROM visitor_registration_challenges WHERE id=?', [challengeId])
      console.error('Visitor entry-pass verification email could not be delivered', { reason: delivery.reason })
      return res.status(503).json({ error: 'We could not send the verification code. Please try again later.' })
    }
    res.status(202).json({ email, eventTitle: event.title, message: `A 6-digit verification code was sent to ${email}.` })
  } catch (error) {
    next(error)
  }
})

passesRouter.post('/public/indore/verify', publicVerificationLimit, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(255),
      code: z.string().regex(/^\d{6}$/),
    }).parse(req.body)
    const email = input.email.toLowerCase()
    const result = await withTransaction(async (connection) => {
      const [challengeRows] = await connection.query<any[]>(`SELECT id,event_id eventId,full_name fullName,phone,city,
        attending_as attendingAs,marketing_consent marketingConsent,code_hash codeHash,attempts,expires_at expiresAt
        FROM visitor_registration_challenges
        WHERE email=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [email])
      const challenge = challengeRows[0]
      if (!challenge || challenge.attempts >= 5 || new Date(challenge.expiresAt).getTime() <= Date.now()) {
        return { status: 400 as const, error: 'This verification code is invalid or has expired. Request a new code and try again.' }
      }
      const submittedHash = Buffer.from(hashOtp(input.code), 'hex')
      const storedHash = Buffer.from(challenge.codeHash, 'hex')
      if (submittedHash.length !== storedHash.length || !crypto.timingSafeEqual(submittedHash, storedHash)) {
        await connection.query('UPDATE visitor_registration_challenges SET attempts=attempts+1 WHERE id=?', [challenge.id])
        return { status: 400 as const, error: 'This verification code is invalid or has expired. Request a new code and try again.' }
      }
      const [eventRows] = await connection.query<any[]>(`SELECT id,title,starts_at startsAt,ends_at endsAt,city,venue FROM events
        WHERE id=? AND status IN ('APPROVED','PUBLISHED') AND ends_at>=NOW()
          AND (registration_deadline IS NULL OR registration_deadline>NOW()) FOR UPDATE`, [challenge.eventId])
      if (!eventRows.length) {
        await connection.query('UPDATE visitor_registration_challenges SET consumed_at=NOW() WHERE id=?', [challenge.id])
        return { status: 409 as const, error: 'Free entry registration is not open for this exhibition right now.' }
      }
      await connection.query('UPDATE visitor_registration_challenges SET consumed_at=NOW() WHERE id=?', [challenge.id])
      const [profileRows] = await connection.query<any[]>('SELECT id FROM visitor_profiles WHERE email=? FOR UPDATE', [email])
      const profileId = profileRows[0]?.id ?? crypto.randomUUID()
      if (profileRows.length) {
        await connection.query(`UPDATE visitor_profiles SET full_name=?,phone=?,city=?,attending_as=?,
          marketing_consent=?,email_verified_at=COALESCE(email_verified_at,NOW()) WHERE id=?`,
        [challenge.fullName, challenge.phone, challenge.city, challenge.attendingAs, challenge.marketingConsent, profileId])
      } else {
        await connection.query(`INSERT INTO visitor_profiles
          (id,email,full_name,phone,city,attending_as,marketing_consent,email_verified_at)
          VALUES (?,?,?,?,?,?,?,NOW())`,
        [profileId, email, challenge.fullName, challenge.phone, challenge.city, challenge.attendingAs, challenge.marketingConsent])
      }
      const [registrationRows] = await connection.query<any[]>(`SELECT r.id registrationId,r.status,q.id passId,q.revoked_at revokedAt
        FROM event_registrations r LEFT JOIN qr_passes q ON q.registration_id=r.id
        WHERE r.event_id=? AND r.visitor_id=? FOR UPDATE`, [challenge.eventId, profileId])
      let registration = registrationRows[0]
      if (registration?.status === 'REGISTERED' && registration.revokedAt) {
        return { status: 409 as const, error: 'Your previous pass was revoked. Please contact the event team for help.' }
      }
      if (registration?.status === 'CANCELLED') {
        const [checkIns] = await connection.query<any[]>('SELECT id FROM check_ins WHERE pass_id=? LIMIT 1', [registration.passId])
        if (checkIns.length) return { status: 409 as const, error: 'This registration was already used. Please contact the event team for help.' }
        await connection.query("UPDATE event_registrations SET status='REGISTERED' WHERE id=?", [registration.registrationId])
        registration.status = 'REGISTERED'
      }
      if (!registration) {
        const registrationId = crypto.randomUUID()
        await connection.query(`INSERT INTO event_registrations(id,event_id,visitor_id,status)
          VALUES (?,?,?,'REGISTERED')`, [registrationId, challenge.eventId, profileId])
        registration = { registrationId, status: 'REGISTERED', passId: null, revokedAt: null }
      }
      const passId = registration.passId ?? crypto.randomUUID()
      const qrData = passTokenForId(passId, signingSecret())
      if (registration.passId) {
        await connection.query('UPDATE qr_passes SET token_hash=?,revoked_at=NULL WHERE id=?', [hashPassToken(qrData), passId])
      } else {
        await connection.query('INSERT INTO qr_passes(id,registration_id,token_hash) VALUES (?,?,?)',
          [passId, registration.registrationId, hashPassToken(qrData)])
      }
      await connection.query(
        'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (NULL,?,?,?,?)',
        ['visitor.pass.issued', 'event_registration', registration.registrationId,
          JSON.stringify({ eventId: challenge.eventId, source: 'public_email_otp' })],
      )
      return {
        status: 200 as const,
        pass: {
          passId,
          qrData,
          eventTitle: eventRows[0].title,
          startsAt: eventRows[0].startsAt,
          endsAt: eventRows[0].endsAt,
          city: eventRows[0].city,
          venue: eventRows[0].venue,
          status: 'Active',
        },
      }
    })
    if (!result.pass) return res.status(result.status).json({ error: result.error })
    const emailDelivery = await queueEmail(email, 'Your Haat of Art free entry pass',
      `Your free entry pass for ${result.pass.eventTitle} is confirmed. Open this link to view your pass: ${process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000'}/visitor/pass/${encodeURIComponent(result.pass.qrData)}`)
    if (!emailDelivery.delivered) {
      console.error('Visitor entry-pass confirmation email could not be delivered', { reason: emailDelivery.reason })
    }
    res.json({
      pass: result.pass,
      emailSent: emailDelivery.delivered,
      message: emailDelivery.delivered
        ? 'Your free entry pass is ready. We also emailed a copy to you.'
        : 'Your free entry pass is ready. Keep or download the QR code below; the confirmation email could not be sent.',
    })
  } catch (error) {
    next(error)
  }
})

passesRouter.get('/public/:token', publicPassLookupLimit, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    const token = z.string().min(1).max(160).parse(req.params.token)
    const passId = passIdFromToken(token, signingSecret())
    if (!passId) return res.status(404).json({ error: 'This visitor pass could not be found' })
    const [rows] = await pool.query<any[]>(`SELECT q.id,q.token_hash,q.revoked_at,
      r.status registrationStatus,e.title eventTitle,e.city,e.venue,e.starts_at startsAt,e.ends_at endsAt,
      v.full_name visitorName,c.checked_in_at checkedInAt
      FROM qr_passes q JOIN event_registrations r ON r.id=q.registration_id
      JOIN events e ON e.id=r.event_id JOIN visitor_profiles v ON v.id=r.visitor_id
      LEFT JOIN check_ins c ON c.pass_id=q.id WHERE q.id=? LIMIT 1`, [passId])
    const pass = rows[0]
    if (!pass || pass.token_hash !== hashPassToken(token)) {
      return res.status(404).json({ error: 'This visitor pass could not be found' })
    }
    const status = pass.revoked_at
      ? 'Revoked'
      : pass.registrationStatus !== 'REGISTERED'
        ? 'Cancelled'
        : new Date(pass.endsAt).getTime() < Date.now()
          ? 'Expired'
          : pass.checkedInAt
            ? 'Checked in'
            : 'Valid'
    res.json({
      attendee: pass.visitorName,
      event: pass.eventTitle,
      city: pass.city,
      venue: pass.venue,
      startsAt: pass.startsAt,
      endsAt: pass.endsAt,
      status,
      checkedInAt: pass.checkedInAt,
    })
  } catch (error) {
    next(error)
  }
})

passesRouter.get('/visitor/events', ...visitor, async (_req, res, next) => {
  try {
    const [events] = await pool.query<any[]>(`SELECT e.id, e.title, e.city, e.venue,
      e.starts_at startsAt, e.ends_at endsAt, e.registration_deadline registrationDeadline,
      e.description, e.status
      FROM events e
      WHERE e.status IN ('APPROVED','PUBLISHED') AND e.ends_at >= NOW()
      ORDER BY e.starts_at LIMIT 50`)
    res.json({ events })
  } catch (error) {
    next(error)
  }
})

passesRouter.get('/visitor/passes', ...visitor, async (req: AuthRequest, res, next) => {
  try {
    const [[users]] = await pool.query<any[]>('SELECT email FROM users WHERE id=?', [req.user!.id])
    if (!users) return res.status(404).json({ error: 'Visitor account not found' })
    const [[profiles]] = await pool.query<any[]>('SELECT id FROM visitor_profiles WHERE email=?', [users.email])
    if (!profiles) return res.json({ passes: [] })
    const [passes] = await pool.query<any[]>(`SELECT q.id passId, e.id eventId, e.title, e.city,
      e.venue, e.starts_at startsAt, e.ends_at endsAt, q.revoked_at revokedAt,
      c.checked_in_at checkedInAt
      FROM event_registrations r JOIN events e ON e.id=r.event_id
      JOIN qr_passes q ON q.registration_id=r.id
      LEFT JOIN check_ins c ON c.pass_id=q.id
      WHERE r.visitor_id=? AND r.status='REGISTERED'
      ORDER BY e.starts_at DESC`, [profiles.id])
    res.json({
      passes: passes.map((pass: any) => ({
        ...pass,
        qrData: pass.revokedAt ? null : passTokenForId(pass.passId, signingSecret()),
        status: pass.revokedAt ? 'Revoked' : pass.checkedInAt ? 'Checked in' : 'Active',
      })),
    })
  } catch (error) {
    next(error)
  }
})

passesRouter.get('/visitor/preferences', ...visitor, async (req: AuthRequest, res, next) => {
  try {
    const [[user]] = await pool.query<any[]>('SELECT email FROM users WHERE id=?', [req.user!.id])
    if (!user) return res.status(404).json({ error: 'Visitor account not found' })
    const [[profile]] = await pool.query<any[]>('SELECT id FROM visitor_profiles WHERE email=?', [user.email])
    if (!profile) return res.status(404).json({ error: 'Visitor profile not found' })
    const [[preferences]] = await pool.query<any[]>(
      'SELECT announcements,transactional FROM email_notification_preferences WHERE visitor_id=?',
      [profile.id],
    )
    res.json({
      announcements: Boolean(preferences?.announcements ?? false),
      transactional: Boolean(preferences?.transactional ?? true),
    })
  } catch (error) {
    next(error)
  }
})

passesRouter.put('/visitor/preferences', ...visitor, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ announcements: z.boolean(), transactional: z.boolean() }).parse(req.body)
    const [[user]] = await pool.query<any[]>('SELECT email FROM users WHERE id=?', [req.user!.id])
    if (!user) return res.status(404).json({ error: 'Visitor account not found' })
    const [[profile]] = await pool.query<any[]>('SELECT id FROM visitor_profiles WHERE email=?', [user.email])
    if (!profile) return res.status(404).json({ error: 'Visitor profile not found' })
    await pool.query(`INSERT INTO email_notification_preferences(visitor_id,announcements,transactional)
      VALUES (?,?,?) ON DUPLICATE KEY UPDATE announcements=VALUES(announcements),transactional=VALUES(transactional)`,
    [profile.id, input.announcements, input.transactional])
    res.json(input)
  } catch (error) {
    next(error)
  }
})

passesRouter.get('/attendees', ...checkInStaff, async (req, res, next) => {
  try {
    const eventInput = req.query.eventId === undefined ? undefined : z.string().uuid().safeParse(req.query.eventId)
    const searchInput = z.string().trim().max(120).safeParse(req.query.q ?? '')
    if (eventInput && !eventInput.success) return res.status(400).json({ error: 'Invalid exhibition selection' })
    if (!searchInput.success) return res.status(400).json({ error: 'Search must be 120 characters or fewer' })
    const conditions = ["e.ends_at >= DATE_SUB(NOW(),INTERVAL 30 DAY)", "r.status='REGISTERED'"]
    const params: unknown[] = []
    if (eventInput?.success) { conditions.push('e.id=?'); params.push(eventInput.data) }
    if (searchInput.data) {
      conditions.push('(v.full_name LIKE ? OR v.email LIKE ?)')
      params.push(`%${searchInput.data}%`, `%${searchInput.data}%`)
    }
    const [events] = await pool.query<any[]>(`SELECT id,title,city,starts_at startsAt
      FROM events WHERE ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)
      ORDER BY starts_at DESC LIMIT 100`)
    const [attendees] = await pool.query<any[]>(`SELECT r.id registrationId,v.full_name fullName,v.email,
      e.id eventId,e.title eventTitle,e.city,e.starts_at startsAt,r.created_at registeredAt,
      c.checked_in_at checkedInAt
      FROM event_registrations r JOIN visitor_profiles v ON v.id=r.visitor_id
      JOIN events e ON e.id=r.event_id
      LEFT JOIN qr_passes q ON q.registration_id=r.id AND q.revoked_at IS NULL
      LEFT JOIN check_ins c ON c.pass_id=q.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY e.starts_at DESC,r.created_at DESC LIMIT 100`, params)
    res.json({ events, attendees })
  } catch (error) {
    next(error)
  }
})

passesRouter.post('/visitor/events/:eventId/register', ...visitor, async (req: AuthRequest, res, next) => {
  try {
    const eventId = z.string().uuid().parse(req.params.eventId)
    const result = await withTransaction(async (connection) => {
      const [userRows] = await connection.query<any[]>('SELECT email,full_name FROM users WHERE id=? FOR UPDATE', [req.user!.id])
      const account = userRows[0]
      if (!account) return { status: 404 as const, error: 'Visitor account not found' }

      const [eventRows] = await connection.query<any[]>(`SELECT id FROM events
        WHERE id=? AND status IN ('APPROVED','PUBLISHED') AND ends_at>=NOW()
          AND (registration_deadline IS NULL OR registration_deadline>NOW()) FOR UPDATE`, [eventId])
      if (!eventRows.length) return { status: 409 as const, error: 'This exhibition is not open for registration' }

      await connection.query(`INSERT INTO visitor_profiles(id,email,full_name)
        VALUES (?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email)`,
      [crypto.randomUUID(), account.email, account.full_name])
      const [profileRows] = await connection.query<any[]>('SELECT id FROM visitor_profiles WHERE email=? FOR UPDATE', [account.email])
      const profileId = profileRows[0].id as string
      const [existingRows] = await connection.query<any[]>(`SELECT r.id,q.id passId FROM event_registrations r
        LEFT JOIN qr_passes q ON q.registration_id=r.id
        WHERE r.event_id=? AND r.visitor_id=? AND r.status='REGISTERED' FOR UPDATE`, [eventId, profileId])
      if (existingRows.length) return { status: 409 as const, error: 'You are already registered for this exhibition' }

      const registrationId = crypto.randomUUID()
      const passId = crypto.randomUUID()
      const qrData = passTokenForId(passId, signingSecret())
      await connection.query('INSERT INTO event_registrations(id,event_id,visitor_id,status) VALUES (?,?,?,\'REGISTERED\')',
        [registrationId, eventId, profileId])
      await connection.query('INSERT INTO qr_passes(id,registration_id,token_hash) VALUES (?,?,?)',
        [passId, registrationId, hashPassToken(qrData)])
      await connection.query(
        'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
        [req.user!.id, 'visitor.pass.issued', 'event_registration', registrationId, JSON.stringify({ eventId })],
      )
      const [[event]] = await connection.query<any[]>('SELECT title FROM events WHERE id=?', [eventId])
      return { status: 201 as const, pass: { passId, eventId, title: event.title, qrData, status: 'Active' } }
    })
    if (result.status !== 201) return res.status(result.status).json({ error: result.error })
    res.status(201).json(result)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'You are already registered for this exhibition' })
    }
    next(error)
  }
})

passesRouter.post('/check-in', requireAuth, requirePermission('passes:scan'), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ token: z.string().trim().min(1).max(512) }).parse(req.body)
    const token = tokenFromScannedValue(input.token)
    const passId = passIdFromToken(token, signingSecret())
    if (!passId) return res.status(400).json({ error: 'This QR pass is invalid' })

    const result = await withTransaction(async (connection) => {
      const [passRows] = await connection.query<any[]>(`SELECT q.id,q.token_hash,q.revoked_at,
        r.status registrationStatus,e.title eventTitle,e.ends_at eventEndsAt,
        v.full_name visitorName,v.email visitorEmail,c.checked_in_at checkedInAt
        FROM qr_passes q JOIN event_registrations r ON r.id=q.registration_id
        JOIN events e ON e.id=r.event_id JOIN visitor_profiles v ON v.id=r.visitor_id
        LEFT JOIN check_ins c ON c.pass_id=q.id WHERE q.id=? FOR UPDATE`, [passId])
      const pass = passRows[0]
      if (!pass || pass.revoked_at || pass.token_hash !== hashPassToken(token)) {
        return { status: 404 as const, error: 'This pass is not active' }
      }
      if (pass.registrationStatus !== 'REGISTERED') return { status: 409 as const, error: 'This registration is cancelled' }
      if (new Date(pass.eventEndsAt).getTime() < Date.now()) return { status: 410 as const, error: 'This exhibition has ended' }
      if (pass.checkedInAt) {
        return { status: 409 as const, error: 'This pass has already been checked in', checkedInAt: pass.checkedInAt }
      }
      await connection.query('INSERT INTO check_ins(id,pass_id,checked_in_by) VALUES (?,?,?)',
        [crypto.randomUUID(), passId, req.user!.id])
      await connection.query(
        'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
        [req.user!.id, 'visitor.pass.checked_in', 'qr_pass', passId, JSON.stringify({ eventTitle: pass.eventTitle })],
      )
      return {
        status: 200 as const,
        attendee: { name: pass.visitorName, email: pass.visitorEmail, event: pass.eventTitle },
        checkedInAt: new Date().toISOString(),
      }
    })
    if (result.status !== 200) return res.status(result.status).json(result)
    res.json(result)
  } catch (error) {
    next(error)
  }
})
