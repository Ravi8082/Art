import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import rateLimit from 'express-rate-limit'
import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { saveStaffAssignment, staffAssignment } from './dashboard.js'

export const teamRouter = Router()

const teamRoles = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'REGISTRATION_MANAGER'] as const
const privilegedRoles = new Set(['SUPER_ADMIN', 'ADMIN'])
const guard = [requireAuth, requirePermission('users:manage')] as const
const writeLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })

function generatePassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', lower = 'abcdefghijkmnpqrstuvwxyz', digits = '23456789', symbols = '@#$%&*'
  const pick = (set: string) => set[crypto.randomInt(set.length)]
  const chars = [pick(upper), pick(upper), pick(lower), pick(lower), pick(lower), pick(lower), pick(digits), pick(digits), pick(digits), pick(symbols),
    ...Array.from({ length: 6 }, () => pick(upper + lower + digits))]
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] }
  return chars.join('')
}

const isSuper = (req: AuthRequest) => req.user!.roles.includes('SUPER_ADMIN')

teamRouter.get('/', ...guard, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT u.id, u.full_name fullName, u.email, u.status, u.created_at createdAt,
              GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') roles,
              (SELECT GROUP_CONCAT(s.state ORDER BY s.state SEPARATOR '|') FROM staff_state_access s WHERE s.user_id=u.id) states,
              (SELECT COUNT(*) FROM staff_event_access a WHERE a.user_id=u.id) eventCount
       FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
       WHERE u.id IN (SELECT ur2.user_id FROM user_roles ur2 JOIN roles r2 ON r2.id=ur2.role_id WHERE r2.name IN (?))
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT 300`, [[...teamRoles]])
    const [events] = await pool.query<any[]>(`SELECT id,title,city,state FROM events
      WHERE status IN ('APPROVED','PUBLISHED') AND ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ORDER BY starts_at LIMIT 200`)
    res.json({
      members: rows.map((row) => ({ ...row, roles: String(row.roles ?? '').split(',').filter(Boolean), states: row.states ? String(row.states).split('|') : [], eventCount: Number(row.eventCount) })),
      events,
      canManageAdmins: isSuper(req),
    })
  } catch (error) { next(error) }
})

teamRouter.post('/', ...guard, writeLimit, async (req: AuthRequest, res, next) => {
  try {
    const input = staffAssignment.extend({
      fullName: z.string().trim().min(2).max(160),
      email: z.string().trim().toLowerCase().email().max(255),
      role: z.enum(teamRoles),
      password: z.string().min(12).max(128).optional(),
    }).parse(req.body)
    if (privilegedRoles.has(input.role) && !isSuper(req)) return res.status(403).json({ error: 'Only a Super Admin can add Admins or Super Admins' })
    if (input.role === 'REGISTRATION_MANAGER' && !input.states.length && !input.eventIds.length) {
      return res.status(400).json({ error: 'Assign at least one state or event to event staff' })
    }
    const password = input.password ?? generatePassword()
    const passwordHash = await bcrypt.hash(password, 12)
    const userId = crypto.randomUUID()
    const created = await withTransaction(async (connection) => {
      const [taken] = await connection.query<any[]>('SELECT id FROM users WHERE email=?', [input.email])
      if (taken.length) return false
      const [roleRows] = await connection.query<any[]>('SELECT id FROM roles WHERE name=?', [input.role])
      if (!roleRows.length) throw new Error(`Dashboard role is not configured: ${input.role}`)
      await connection.query("INSERT INTO users(id,email,password_hash,full_name,status,email_verified_at) VALUES (?,?,?,?,'ACTIVE',NOW())", [userId, input.email, passwordHash, input.fullName])
      await connection.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [userId, roleRows[0].id])
      if (input.role === 'REGISTRATION_MANAGER') await saveStaffAssignment(connection, userId, req.user!.id, input)
      await connection.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
        [req.user!.id, 'team.member.created', 'user', userId, JSON.stringify({ role: input.role, email: input.email })])
      return true
    })
    if (!created) return res.status(409).json({ error: 'An account already uses this email address' })
    res.status(201).json({ userId, email: input.email, role: input.role, password })
  } catch (error) { next(error) }
})

type Target = { error: string; status: number } | { error?: undefined; roles: string[] }

async function loadTarget(req: AuthRequest): Promise<Target> {
  const [rows] = await pool.query<any[]>(
    `SELECT u.id, u.status, GROUP_CONCAT(r.name) roles FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
     WHERE u.id=? GROUP BY u.id`, [req.params.id])
  const target = rows[0]
  if (!target) return { status: 404, error: 'Team member not found' }
  const roles = String(target.roles).split(',')
  if (!roles.some((role) => (teamRoles as readonly string[]).includes(role))) return { status: 404, error: 'Team member not found' }
  if (roles.some((role) => privilegedRoles.has(role)) && !isSuper(req)) return { status: 403, error: 'Only a Super Admin can manage Admin accounts' }
  return { roles }
}

teamRouter.post('/:id/reset-password', ...guard, writeLimit, async (req: AuthRequest, res, next) => {
  try {
    const found = await loadTarget(req)
    if (found.error !== undefined) return res.status(found.status).json({ error: found.error })
    const password = generatePassword()
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [await bcrypt.hash(password, 12), req.params.id])
    await pool.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [req.params.id])
    await pool.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
      [req.user!.id, 'team.member.password_reset', 'user', req.params.id, JSON.stringify({})])
    res.json({ password })
  } catch (error) { next(error) }
})

teamRouter.patch('/:id/status', ...guard, writeLimit, async (req: AuthRequest, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body)
    if (req.params.id === req.user!.id) return res.status(400).json({ error: 'You cannot change your own status' })
    const found = await loadTarget(req)
    if (found.error !== undefined) return res.status(found.status).json({ error: found.error })
    if (status === 'SUSPENDED' && found.roles.includes('SUPER_ADMIN')) {
      const [roots] = await pool.query<any[]>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.name='SUPER_ADMIN' AND u.status='ACTIVE'`)
      if (roots.length <= 1) return res.status(409).json({ error: 'At least one active Super Admin must remain' })
    }
    await pool.query('UPDATE users SET status=? WHERE id=?', [status, req.params.id])
    if (status === 'SUSPENDED') await pool.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [req.params.id])
    await pool.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
      [req.user!.id, 'team.member.status_changed', 'user', req.params.id, JSON.stringify({ status })])
    res.json({ status })
  } catch (error) { next(error) }
})
