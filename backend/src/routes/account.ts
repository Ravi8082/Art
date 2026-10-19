import { raw, Router } from 'express'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature } from '../services/media-validation.js'

export const accountRouter = Router()

const imageTypes = ['image/jpeg', 'image/png', 'image/webp']
const imageBody = raw({ type: imageTypes, limit: '3mb' })
const text = (max: number) => z.string().trim().max(max).default('')
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).default('').refine((value) => !value || /^[+\d][\d\s-]{6,}$/.test(value), 'Enter a valid phone number'),
  organization: text(160), jobTitle: text(120), city: text(120), state: text(120), bio: text(1000),
})

async function loadProfile(userId: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT u.email, u.full_name fullName, p.phone, p.organization, p.job_title jobTitle, p.city, p.state, p.bio,
            p.avatar_data IS NOT NULL hasAvatar, p.avatar_version avatarVersion
     FROM users u LEFT JOIN account_profiles p ON p.user_id=u.id WHERE u.id=?`, [userId])
  const row = rows[0]
  if (!row) return null
  return {
    email: row.email, fullName: row.fullName, phone: row.phone ?? '', organization: row.organization ?? '', jobTitle: row.jobTitle ?? '',
    city: row.city ?? '', state: row.state ?? '', bio: row.bio ?? '',
    avatarUrl: row.hasAvatar ? `/api/account/avatar?v=${row.avatarVersion}` : null,
  }
}

accountRouter.get('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const profile = await loadProfile(req.user!.id)
    if (!profile) return res.status(404).json({ error: 'Account not found' })
    res.json({ profile, roles: req.user!.roles })
  } catch (error) { next(error) }
})

accountRouter.put('/profile', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const input = profileSchema.parse(req.body)
    await pool.query('UPDATE users SET full_name=? WHERE id=?', [input.fullName, req.user!.id])
    await pool.query(
      `INSERT INTO account_profiles(user_id,phone,organization,job_title,city,state,bio) VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE phone=VALUES(phone), organization=VALUES(organization), job_title=VALUES(job_title), city=VALUES(city), state=VALUES(state), bio=VALUES(bio)`,
      [req.user!.id, input.phone, input.organization, input.jobTitle, input.city, input.state, input.bio])
    res.json({ profile: await loadProfile(req.user!.id) })
  } catch (error) { next(error) }
})

accountRouter.put('/avatar', requireAuth, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (!contentType || !imageTypes.includes(contentType)) return res.status(415).json({ error: 'Only JPG, PNG or WebP photos are allowed' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Photo file is required' })
    if (!hasValidMediaSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its media type' })
    await pool.query(
      `INSERT INTO account_profiles(user_id,avatar_mime,avatar_data,avatar_version) VALUES (?,?,?,1)
       ON DUPLICATE KEY UPDATE avatar_mime=VALUES(avatar_mime), avatar_data=VALUES(avatar_data), avatar_version=avatar_version+1`,
      [req.user!.id, contentType, req.body])
    res.json({ profile: await loadProfile(req.user!.id) })
  } catch (error) { next(error) }
})

accountRouter.delete('/avatar', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await pool.query('UPDATE account_profiles SET avatar_mime=NULL, avatar_data=NULL, avatar_version=avatar_version+1 WHERE user_id=?', [req.user!.id])
    res.json({ profile: await loadProfile(req.user!.id) })
  } catch (error) { next(error) }
})

accountRouter.post('/password', requireAuth, rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).parse(req.body)
    const [rows] = await pool.query<any[]>('SELECT password_hash hash FROM users WHERE id=?', [req.user!.id])
    if (!rows[0] || !(await bcrypt.compare(input.currentPassword, rows[0].hash))) return res.status(400).json({ error: 'Current password is incorrect' })
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(input.newPassword, 12), req.user!.id])
    res.status(204).end()
  } catch (error) { next(error) }
})

accountRouter.get('/avatar', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT avatar_mime mime, avatar_data data FROM account_profiles WHERE user_id=? AND avatar_data IS NOT NULL', [req.user!.id])
    if (!rows[0]) return res.status(404).json({ error: 'No photo' })
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'private, max-age=3600')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})
