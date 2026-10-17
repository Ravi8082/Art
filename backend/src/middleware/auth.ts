import type { NextFunction, Request, Response } from 'express'
import type { RowDataPacket } from 'mysql2'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'

export type AuthRequest = Request & { user?: { id: string; roles: string[] } }
const secret = () => {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters')
  return value
}
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.signedCookies.session as string | undefined
    if (!token) return res.status(401).json({ error: 'Authentication required' })
    const payload = jwt.verify(token, secret()) as { sub: string }
    const [rows] = await pool.query<any[]>('SELECT u.id, u.status, r.name role FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=?', [payload.sub])
    if (!rows.length || rows[0].status !== 'ACTIVE') return res.status(401).json({ error: 'Account unavailable' })
    req.user = { id: rows[0].id, roles: rows.map((row: { role: string }) => row.role) }; next()
  } catch { return res.status(401).json({ error: 'Invalid session' }) }
}
export function requireRole(...roles: string[]) { return (req: AuthRequest, res: Response, next: NextFunction) => req.user?.roles.some((role) => roles.includes(role)) ? next() : res.status(403).json({ error: 'Insufficient permissions' }) }
export function requirePermission(...permissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' })
    if (req.user.roles.includes('SUPER_ADMIN')) return next()
    try {
      const [rows] = await pool.query<(RowDataPacket & { name: string })[]>(
        `SELECT name FROM (
           SELECT p.name
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE ur.user_id = ? AND p.name IN (${permissions.map(() => '?').join(',')})
           UNION
           SELECT p.name
           FROM user_permissions up
           JOIN permissions p ON p.id = up.permission_id
           WHERE up.user_id = ? AND p.name IN (${permissions.map(() => '?').join(',')})
         ) granted_permissions`,
        [req.user.id, ...permissions, req.user.id, ...permissions],
      )
      if (permissions.every((permission) => rows.some((row) => row.name === permission))) return next()
      return res.status(403).json({ error: 'Insufficient permissions' })
    } catch (error) {
      return next(error)
    }
  }
}
