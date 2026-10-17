import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, requireRole, type AuthRequest } from '../middleware/auth.js'
import { hashPassToken, passIdFromToken, passTokenForId } from '../services/pass-token.js'

export const passesRouter = Router()

function signingSecret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}

const visitor = [requireAuth, requireRole('VISITOR'), requirePermission('passes:read')] as const
const checkInStaff = [requireAuth, requireRole('REGISTRATION_MANAGER', 'ADMIN', 'SUPER_ADMIN'), requirePermission('registrations:read')] as const

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
    const { token } = z.object({ token: z.string().trim().min(1).max(160) }).parse(req.body)
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
