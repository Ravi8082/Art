import { Router, type Request } from 'express'
import type { Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import rateLimit, { ipKeyGenerator } from '../services/rate-limit.js'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { sessionCookieOptions } from '../middleware/session-cookie.js'
import { createOtp, verifyOtp } from '../services/mailer.js'
import { recordAudit } from '../services/audit.js'
import { sessionVersionMatches } from '../services/session-version.js'
import { createMobileSession, revokeMobileSession, rotateMobileSession } from '../services/mobile-session.js'

export const authRouter = Router()
const registerSchema = z.object({ email: z.string().email().max(255), password: z.string().min(12).max(128), fullName: z.string().trim().min(2).max(160) })
// SECURITY: Compare unknown accounts against a cost-12 dummy hash to reduce email-enumeration timing differences.
const dummyPasswordHash = bcrypt.hash(crypto.randomUUID(), 12)
const secret = () => {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}
const issue = (id: string, sessionVersion: number) => jwt.sign({ sub: id, sessionVersion }, secret(), { algorithm: 'HS256', expiresIn: '15m' })
// SECURITY: Hash normalized email together with the normalized IP so Redis throttles account-specific abuse without retaining plaintext addresses.
const emailRateLimitKey = (req: Request) =>
  `${ipKeyGenerator(req.ip ?? '0.0.0.0')}|${crypto.createHash('sha256').update(String(req.body?.email ?? '').toLowerCase().slice(0, 255)).digest('hex')}`
const registrationLimit = rateLimit({ windowMs: 60 * 1000, limit: 3, standardHeaders: true, legacyHeaders: false })
const otpRequestLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: emailRateLimitKey,
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
})
const otpVerifyLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => {
    const mfaToken = req.body?.mfaToken
    if (typeof mfaToken === 'string') {
      try {
        const payload = jwt.verify(mfaToken, secret(), { algorithms: ['HS256'] }) as { sub?: string; purpose?: string }
        if (payload.purpose === 'mfa' && payload.sub) return `user:${payload.sub}`
      } catch {
        return emailRateLimitKey(req)
      }
    }
    return emailRateLimitKey(req)
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
})
const visitorResumeLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const loginIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })
// Brute-force guard: counted per client IP and email, failed and successful attempts alike.
const loginLimit = rateLimit({
  windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
  keyGenerator: emailRateLimitKey,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
})
const mobileRefreshLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })
const setSession = (res: Response, id: string, sessionVersion: number) => {
  res.cookie('session', issue(id, sessionVersion), sessionCookieOptions())
}

authRouter.post('/register', registrationLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    const id = crypto.randomUUID()
    const email = input.email.toLowerCase()
    const passwordHash = await bcrypt.hash(input.password, 12)
    await withTransaction(async (db) => {
      await db.query('INSERT INTO users(id,email,password_hash,full_name) VALUES (?,?,?,?)', [id, email, passwordHash, input.fullName])
      const [roles] = await db.query<any[]>('SELECT id FROM roles WHERE name=?', ['VISITOR'])
      if (!roles.length) throw new Error('Visitor role is not configured')
      await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [id, roles[0].id])
    })
    const mail = await createOtp(id, 'VERIFY_EMAIL', email)
    res.status(201).json({
      id,
      email,
      otpRequired: true,
      otpSent: mail.delivered,
      message: mail.delivered ? 'Enter the verification code sent to your email.' : 'Your account was created, but the code could not be sent. You can request it again shortly.',
    })
  } catch (error) { next(error) }
})

const issueMfaToken = (id: string, sessionVersion: number) => jwt.sign({ sub: id, sessionVersion, purpose: 'mfa' }, secret(), { algorithm: 'HS256', expiresIn: '5m' })

const MAX_FAILED_LOGINS = 5
const LOGIN_FAILURE_WINDOW_MINUTES = 15
export const LOGIN_OTP_MESSAGE = "We've sent a 6-digit code to your email. Enter it here."

// Failed attempts are kept in audit_logs (no schema change). A LOGIN_RESET row, written after a successful
// code verification, starts a fresh count.
async function recentFailedLogins(userId: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT COUNT(*) AS c FROM audit_logs
     WHERE entity_type='user' AND entity_id=? AND action='LOGIN_FAILED'
       AND created_at > NOW() - INTERVAL ${LOGIN_FAILURE_WINDOW_MINUTES} MINUTE
       AND id > COALESCE((SELECT MAX(id) FROM audit_logs WHERE entity_type='user' AND entity_id=? AND action='LOGIN_RESET'), 0)`,
    [userId, userId],
  )
  return Number(rows[0]?.c ?? 0)
}

async function requireLoginOtp(res: Response, user: { id: string; email: string; session_version: number | string }, mobile = false) {
  // A code requested moments ago is still valid, so a cooldown error is not fatal.
  const mail = await createOtp(user.id, 'LOGIN', user.email).catch((error: { status?: number }) => {
    if (error.status === 429) return { delivered: true }
    throw error
  })
  if (!mail.delivered) return res.status(503).json({ error: 'We could not send the verification code. Please try again shortly.' })
  return res.status(403).json({
    error: `${LOGIN_OTP_MESSAGE} Please complete sign-in ${mobile ? 'in the app' : 'on the /login page'}.`,
    message: LOGIN_OTP_MESSAGE,
    mfaRequired: true,
    mfaToken: issueMfaToken(user.id, Number(user.session_version)),
  })
}

  authRouter.post('/mobile/login', loginIpLimit, loginLimit, async (req, res, next) => {
    try {
      const input = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) }).parse(req.body)
      const [rows] = await pool.query<any[]>(
        'SELECT id,email,password_hash,status,email_verified_at,session_version FROM users WHERE email=?',
        [input.email.toLowerCase()],
      )
      const user = rows[0]
      const passwordHash = user?.password_hash ?? await dummyPasswordHash
      const passwordOk = await bcrypt.compare(input.password, passwordHash)
      const eligible = Boolean(user) && user.status === 'ACTIVE' && Boolean(user.email_verified_at)
      if (!user || !passwordOk || !eligible) {
        if (user && eligible && !passwordOk) await recordAudit(user.id, 'LOGIN_FAILED', 'user', user.id)
        return res.status(401).json({ error: 'Invalid email or password' })
      }
      const failures = await recentFailedLogins(user.id)
      if (failures >= MAX_FAILED_LOGINS) return requireLoginOtp(res, user, true)
      res.json(await createMobileSession(user.id, Number(user.session_version)))
    } catch (error) { next(error) }
  })

  authRouter.post('/mobile/login/verify', otpVerifyLimit, async (req, res, next) => {
    try {
      const input = z.object({ mfaToken: z.string().min(20).max(2000), code: z.string().regex(/^\d{6}$/) }).parse(req.body)
      let userId: string
      let sessionVersion: number
      try {
        const payload = jwt.verify(input.mfaToken, secret(), { algorithms: ['HS256'] }) as { sub?: string; purpose?: string; sessionVersion?: number }
        if (payload.purpose !== 'mfa' || !payload.sub) throw new Error('wrong token')
        userId = payload.sub
        sessionVersion = payload.sessionVersion ?? 0
      } catch { return res.status(401).json({ error: 'Verification expired. Please sign in again.' }) }
      const [rows] = await pool.query<any[]>(
        "SELECT id,session_version FROM users WHERE id=? AND status='ACTIVE' AND email_verified_at IS NOT NULL",
        [userId],
      )
      if (!rows[0] || !sessionVersionMatches(sessionVersion, rows[0].session_version)) {
        return res.status(401).json({ error: 'Verification expired. Please sign in again.' })
      }
      if (!(await verifyOtp(userId, 'LOGIN', input.code))) return res.status(400).json({ error: 'Invalid or expired verification code.' })
      await recordAudit(userId, 'LOGIN_RESET', 'user', userId)
      res.json(await createMobileSession(userId, Number(rows[0].session_version)))
    } catch (error) { next(error) }
  })

  authRouter.post('/mobile/verify-email', otpVerifyLimit, async (req, res, next) => {
    try {
      const input = z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/) }).parse(req.body)
      const email = input.email.toLowerCase()
      const [users] = await pool.query<any[]>(
        'SELECT id,status,email_verified_at,session_version FROM users WHERE email=?',
        [email],
      )
      const user = users[0]
      if (!user || user.status === 'SUSPENDED') return res.status(400).json({ error: 'Invalid or expired verification code.' })
      if (user.email_verified_at) return res.status(409).json({ error: 'This email address is already verified. Please sign in.' })
      if (!(await verifyOtp(user.id, 'VERIFY_EMAIL', input.code))) {
        return res.status(400).json({ error: 'Invalid or expired verification code.' })
      }
      await pool.query("UPDATE users SET email_verified_at=NOW(),status='ACTIVE' WHERE id=?", [user.id])
      await pool.query('UPDATE visitor_profiles SET email_verified_at=NOW() WHERE email=?', [email])
      res.json(await createMobileSession(user.id, Number(user.session_version)))
    } catch (error) { next(error) }
  })

  authRouter.post('/mobile/refresh', mobileRefreshLimit, async (req, res, next) => {
    try {
      const input = z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(req.body)
      const tokens = await rotateMobileSession(input.refreshToken)
      if (!tokens) return res.status(401).json({ error: 'Mobile session expired. Please sign in again.' })
      res.json(tokens)
    } catch (error) { next(error) }
  })

  authRouter.post('/mobile/logout', async (req, res, next) => {
    try {
      const input = z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).parse(req.body)
      await revokeMobileSession(input.refreshToken)
      res.status(204).end()
    } catch (error) { next(error) }
  })

authRouter.post('/login', loginIpLimit, loginLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255), password: z.string().min(1).max(128) }).parse(req.body)
    const [rows] = await pool.query<any[]>('SELECT id,email,password_hash,status,email_verified_at,session_version FROM users WHERE email=?', [input.email.toLowerCase()])
    const user = rows[0]
    const passwordHash = user?.password_hash ?? await dummyPasswordHash
    const passwordOk = await bcrypt.compare(input.password, passwordHash)
    const eligible = Boolean(user) && user.status === 'ACTIVE' && Boolean(user.email_verified_at)
    if (!user || !passwordOk || !eligible) {
      if (user && eligible && !passwordOk) await recordAudit(user.id, 'LOGIN_FAILED', 'user', user.id)
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    const failures = await recentFailedLogins(user.id)
    if (failures >= MAX_FAILED_LOGINS) return requireLoginOtp(res, user)
    setSession(res, user.id, Number(user.session_version))
    res.json({ userId: user.id })
  } catch (error) { next(error) }
})

authRouter.post('/login/verify', otpVerifyLimit, async (req, res, next) => {
  try {
    const input = z.object({ mfaToken: z.string().min(20).max(2000), code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    let userId: string
    let sessionVersion: number
    try {
      const payload = jwt.verify(input.mfaToken, secret(), { algorithms: ['HS256'] }) as { sub?: string; purpose?: string; sessionVersion?: number }
      if (payload.purpose !== 'mfa' || !payload.sub) throw new Error('wrong token')
      userId = payload.sub
      sessionVersion = payload.sessionVersion ?? 0
    } catch { return res.status(401).json({ error: 'Verification expired. Please sign in again.' }) }
    const [rows] = await pool.query<any[]>("SELECT id, session_version FROM users WHERE id=? AND status='ACTIVE'", [userId])
    if (!rows[0] || !sessionVersionMatches(sessionVersion, rows[0].session_version)) return res.status(401).json({ error: 'Verification expired. Please sign in again.' })
    if (!(await verifyOtp(userId, 'LOGIN', input.code))) return res.status(400).json({ error: 'Invalid or expired verification code.' })
    await recordAudit(userId, 'LOGIN_RESET', 'user', userId)
    setSession(res, userId, Number(rows[0].session_version))
    res.json({ userId })
  } catch (error) { next(error) }
})

authRouter.post('/verify-email', otpVerifyLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const [users] = await pool.query<any[]>('SELECT id,status,email_verified_at,session_version FROM users WHERE email=?', [input.email.toLowerCase()])
    const user = users[0]
    if (!user || user.status === 'SUSPENDED') return res.status(400).json({ error: 'Invalid or expired verification code.' })
    if (user.email_verified_at) return res.status(409).json({ error: 'This email address is already verified.' })
    if (!(await verifyOtp(user.id, 'VERIFY_EMAIL', input.code))) return res.status(400).json({ error: 'Invalid or expired verification code.' })
    await pool.query("UPDATE users SET email_verified_at=NOW(),status='ACTIVE' WHERE id=?", [user.id])
    await pool.query('UPDATE visitor_profiles SET email_verified_at=NOW() WHERE email=?', [input.email.toLowerCase()])
    setSession(res, user.id, Number(user.session_version))
    res.json({ userId: user.id, verified: true })
  } catch (error) { next(error) }
})

authRouter.post('/resend-verification', otpRequestLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255) }).parse(req.body)
    const [users] = await pool.query<any[]>('SELECT id,status,email_verified_at FROM users WHERE email=?', [input.email.toLowerCase()])
    const user = users[0]
    if (!user || user.email_verified_at || user.status === 'SUSPENDED') {
      return res.json({ ok: true, message: 'If the account needs verification, a new code will be sent shortly.' })
    }
    const mail = await createOtp(user.id, 'VERIFY_EMAIL', input.email.toLowerCase())
    if (!mail.delivered) return res.status(503).json({ error: 'The verification email could not be sent. Please try again shortly.' })
    res.json({ ok: true, message: 'A new verification code has been sent.' })
  } catch (error) { next(error) }
})

authRouter.post('/password-reset/request', otpRequestLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255) }).parse(req.body)
    const email = input.email.toLowerCase()
    const [users] = await pool.query<any[]>('SELECT id,status FROM users WHERE email=?', [email])
    const user = users[0]
    // SECURITY: Return the same status and message for every valid email to prevent account enumeration.
    if (user?.status === 'ACTIVE') {
      const mail = await createOtp(user.id, 'RESET_PASSWORD', email)
      if (!mail.delivered) console.error('Password reset OTP email could not be delivered', { reason: mail.reason })
    }
    res.status(202).json({ ok: true, message: 'If an active account uses this email, a password reset code will be sent.' })
  } catch (error) { next(error) }
})

authRouter.post('/password-reset/confirm', otpVerifyLimit, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(255),
      code: z.string().regex(/^\d{6}$/),
      password: z.string().min(12).max(128),
    }).parse(req.body)
    const [users] = await pool.query<any[]>('SELECT id,status FROM users WHERE email=?', [input.email.toLowerCase()])
    const user = users[0]
    if (!user || user.status !== 'ACTIVE' || !(await verifyOtp(user.id, 'RESET_PASSWORD', input.code))) {
      return res.status(400).json({ error: 'Invalid or expired password reset code.' })
    }
    const passwordHash = await bcrypt.hash(input.password, 12)
    await withTransaction(async (db) => {
      await db.query("UPDATE users SET password_hash=?, session_version=session_version+1 WHERE id=? AND status='ACTIVE'", [passwordHash, user.id])
      await db.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [user.id])
    })
    res.clearCookie('session', sessionCookieOptions())
    res.json({ ok: true, message: 'Your password has been reset. You can now sign in.' })
  } catch (error) { next(error) }
})

// Exhibitor accounts remain unusable until their email verification code is confirmed.
authRouter.post('/register-exhibitor', registrationLimit, async (req, res, next) => {
  try {
    const input = z.object({
      email: z.string().email().max(255),
      password: z.string().min(12).max(128),
      fullName: z.string().trim().min(2).max(160),
    }).parse(req.body)
    const email = input.email.toLowerCase()
    const [taken] = await pool.query<any[]>('SELECT id FROM users WHERE email=?', [email])
    if (taken.length) return res.status(409).json({ error: 'An account already uses this email address' })
    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(input.password, 12)
    await withTransaction(async (db) => {
      await db.query('INSERT INTO users(id,email,password_hash,full_name,status,email_verified_at) VALUES (?,?,?,? ,\'ACTIVE\',NULL)', [id, email, passwordHash, input.fullName])
      const [role] = await db.query<any[]>('SELECT id FROM roles WHERE name=?', ['ARTIST_EXHIBITOR'])
      await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [id, role[0].id])
    })
    const mail = await createOtp(id, 'VERIFY_EMAIL', email)
    res.status(201).json({
      email,
      otpRequired: true,
      otpSent: mail.delivered,
      message: mail.delivered ? 'Enter the verification code sent to your email.' : 'Your account was created, but the code could not be sent. You can request it again shortly.',
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account already uses this email address' })
    }
    next(error)
  }
})

authRouter.post('/register-visitor', registrationLimit, async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body)
    const email = input.email.toLowerCase()
    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(input.password, 12)
    await withTransaction(async (db) => {
      await db.query(
        'INSERT INTO users(id,email,password_hash,full_name,status,email_verified_at) VALUES (?,?,?, ?,\'ACTIVE\',NULL)',
        [id, email, passwordHash, input.fullName],
      )
      const [roles] = await db.query<any[]>('SELECT id FROM roles WHERE name=?', ['VISITOR'])
      if (!roles.length) throw new Error('Visitor role is not configured')
      await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [id, roles[0].id])
      const [profiles] = await db.query<any[]>('SELECT id FROM visitor_profiles WHERE email=? FOR UPDATE', [email])
      if (profiles.length) {
        await db.query('UPDATE visitor_profiles SET full_name=? WHERE id=?', [input.fullName, profiles[0].id])
      } else {
        await db.query('INSERT INTO visitor_profiles(id,email,full_name) VALUES (?,?,?)', [crypto.randomUUID(), email, input.fullName])
      }
    })
    const mail = await createOtp(id, 'VERIFY_EMAIL', email)
    res.status(201).json({
      email,
      otpRequired: true,
      otpSent: mail.delivered,
      message: mail.delivered ? 'Enter the verification code sent to your email.' : 'Your account was created, but the code could not be sent. You can request it again shortly.',
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An account already uses this email address' })
    }
    next(error)
  }
})

authRouter.post('/resume-visitor-registration', visitorResumeLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255) }).parse(req.body)
    const email = input.email.toLowerCase()
    const [users] = await pool.query<any[]>(`SELECT u.id,u.status,u.email_verified_at emailVerifiedAt
      FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.email=? AND r.name='VISITOR' LIMIT 1`, [email])
    const user = users[0]
    if (!user || user.status === 'SUSPENDED') {
      return res.status(404).json({ error: 'No active visitor account was found for this email. Create an account or check the address.' })
    }
    if (user.emailVerifiedAt) {
      return res.json({ verified: true, message: 'Your visitor account is verified. Sign in with the password you created.' })
    }

    const [challenges] = await pool.query<any[]>(`SELECT id FROM otp_challenges
      WHERE user_id=? AND purpose='VERIFY_EMAIL' AND consumed_at IS NULL AND expires_at>NOW() AND attempts<5
      ORDER BY created_at DESC LIMIT 1`, [user.id])
    if (challenges.length) {
      return res.json({ verified: false, otpSent: false, message: 'Your verification code is still active. Enter the code already sent to your email.' })
    }

    await pool.query(`UPDATE otp_challenges SET consumed_at=NOW()
      WHERE user_id=? AND purpose='VERIFY_EMAIL' AND consumed_at IS NULL AND attempts>=5`, [user.id])
    const delivery = await createOtp(user.id, 'VERIFY_EMAIL', email)
    if (!delivery.delivered) {
      return res.status(503).json({ error: 'We could not send the verification code. Please try again later.' })
    }
    res.json({ verified: false, otpSent: true, message: 'A new verification code has been sent to your email.' })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', (_req, res) => { res.clearCookie('session'); res.status(204).end() })
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => { try { const [[rows], [permissions]] = await Promise.all([
  pool.query<any[]>("SELECT u.email, u.full_name fullName, IF(p.avatar_data IS NULL, NULL, CONCAT('/api/account/avatar?v=', p.avatar_version)) avatarUrl FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.id=?", [req.user!.id]),
  pool.query<any[]>(`SELECT name FROM (
    SELECT p.name FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?
    UNION
    SELECT p.name FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=?
  ) granted_permissions ORDER BY name`, [req.user!.id, req.user!.id]),
]); res.json({ user: { ...req.user, isAdmin: req.user!.roles.some((role) => role === 'ADMIN' || role === 'SUPER_ADMIN'), email: rows[0]?.email ?? '', fullName: rows[0]?.fullName ?? '', avatarUrl: rows[0]?.avatarUrl ?? null, permissions: permissions.map((entry: { name: string }) => entry.name) } }) } catch (error) { next(error) } })
authRouter.post('/revoke-sessions', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await withTransaction(async (db) => {
      await db.query('UPDATE users SET session_version=session_version+1 WHERE id=?', [req.user!.id])
      await db.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [req.user!.id])
    })
    res.clearCookie('session', sessionCookieOptions())
    res.status(204).end()
  } catch (error) { next(error) }
})
