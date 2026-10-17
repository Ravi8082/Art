import { Router } from 'express'
import type { Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { createOtp, verifyOtp } from '../services/mailer.js'

export const authRouter = Router()
const registerSchema = z.object({ email: z.string().email().max(255), password: z.string().min(12).max(128), fullName: z.string().trim().min(2).max(160) })
const secret = () => {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}
const issue = (id: string) => jwt.sign({ sub: id }, secret(), { expiresIn: '15m' })
const otpRequestLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false })
const otpVerifyLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const setSession = (res: Response, id: string) => {
  res.cookie('session', issue(id), { httpOnly: true, signed: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 })
}

authRouter.post('/register', otpRequestLimit, async (req, res, next) => {
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

authRouter.post('/login', async (req, res, next) => { try { const input = z.object({ email: z.string().email(), password: z.string() }).parse(req.body); const [rows] = await pool.query<any[]>('SELECT id,password_hash,status,email_verified_at FROM users WHERE email=?', [input.email.toLowerCase()]); const user = rows[0]; if (!user || !(await bcrypt.compare(input.password, user.password_hash)) || user.status !== 'ACTIVE' || !user.email_verified_at) return res.status(401).json({ error: 'Invalid credentials or unverified account' }); setSession(res, user.id); res.json({ userId: user.id }) } catch (error) { next(error) } })

authRouter.post('/verify-email', otpVerifyLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/) }).parse(req.body)
    const [users] = await pool.query<any[]>('SELECT id,status,email_verified_at FROM users WHERE email=?', [input.email.toLowerCase()])
    const user = users[0]
    if (!user || user.status === 'SUSPENDED') return res.status(400).json({ error: 'Invalid or expired verification code.' })
    if (user.email_verified_at) return res.status(409).json({ error: 'This email address is already verified.' })
    if (!(await verifyOtp(user.id, 'VERIFY_EMAIL', input.code))) return res.status(400).json({ error: 'Invalid or expired verification code.' })
    await pool.query("UPDATE users SET email_verified_at=NOW(),status='ACTIVE' WHERE id=?", [user.id])
    await pool.query('UPDATE visitor_profiles SET email_verified_at=NOW() WHERE email=?', [input.email.toLowerCase()])
    setSession(res, user.id)
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
    if (user && user.status === 'ACTIVE') {
      const mail = await createOtp(user.id, 'RESET_PASSWORD', email)
      if (!mail.delivered) console.error('Password reset OTP email could not be delivered', { reason: mail.reason })
    }
    res.status(202).json({ ok: true, message: 'If an active account uses that email, a password reset code will be sent.' })
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
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [passwordHash, user.id])
    await pool.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [user.id])
    res.json({ ok: true, message: 'Your password has been reset. You can now sign in.' })
  } catch (error) { next(error) }
})

// Exhibitor accounts remain unusable until their email verification code is confirmed.
authRouter.post('/register-exhibitor', otpRequestLimit, async (req, res, next) => {
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

authRouter.post('/register-visitor', otpRequestLimit, async (req, res, next) => {
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
      await db.query('INSERT INTO visitor_profiles(id,email,full_name) VALUES (?,?,?)', [crypto.randomUUID(), email, input.fullName])
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

authRouter.post('/logout', (_req, res) => { res.clearCookie('session'); res.status(204).end() })
authRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => { try { const [[rows], [permissions]] = await Promise.all([
  pool.query<any[]>('SELECT email, full_name fullName FROM users WHERE id=?', [req.user!.id]),
  pool.query<any[]>(`SELECT name FROM (
    SELECT p.name FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id
      JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=?
    UNION
    SELECT p.name FROM user_permissions up JOIN permissions p ON p.id=up.permission_id WHERE up.user_id=?
  ) granted_permissions ORDER BY name`, [req.user!.id, req.user!.id]),
]); res.json({ user: { ...req.user, email: rows[0]?.email ?? '', fullName: rows[0]?.fullName ?? '', permissions: permissions.map((entry: { name: string }) => entry.name) } }) } catch (error) { next(error) } })
authRouter.post('/revoke-sessions', requireAuth, async (req: AuthRequest, res, next) => { try { await pool.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [req.user!.id]); res.status(204).end() } catch (error) { next(error) } })
