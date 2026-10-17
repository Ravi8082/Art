import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { supportedMediaTypes } from '../services/media-validation.js'
import { recordAudit } from '../services/audit.js'
import { storeAsset } from './about.js'

export const guestsRouter = Router()

const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const imageBody = raw({ type: imageTypes, limit: '25mb' })
const manage = [requireAuth, requirePermission('content:manage')] as const

const mediaUrl = (id: string | null) => (id ? `/api/about/media/${id}` : null)

function guestRow(row: any) {
  return {
    id: row.id, name: row.name, role: row.role, eventName: row.event_name, bio: row.bio,
    photoAssetId: row.photo_asset_id, photoUrl: mediaUrl(row.photo_asset_id),
    instagramUrl: row.instagram_url, websiteUrl: row.website_url,
    sortOrder: row.sort_order, active: Boolean(row.active),
  }
}

function feedbackRow(row: any) {
  return {
    id: row.id, guestId: row.guest_id, guestName: row.guest_name ?? null, authorName: row.author_name,
    authorRole: row.author_role, message: row.message, rating: row.rating,
    sortOrder: row.sort_order, active: Boolean(row.active),
  }
}

const guestSelect = `
  SELECT g.id, g.name, g.role, g.event_name, g.bio, g.photo_asset_id, g.instagram_url, g.website_url,
         g.sort_order, g.active
  FROM guests g`
// When `nameHiddenGuests` is false the join ignores inactive guests, so a guest an
// admin hid can never leak its name into a public feedback card.
const feedbackSelect = (nameHiddenGuests: boolean) => `
  SELECT f.id, f.guest_id, g.name guest_name, f.author_name, f.author_role, f.message, f.rating,
         f.sort_order, f.active
  FROM guest_feedback f LEFT JOIN guests g ON g.id = f.guest_id${nameHiddenGuests ? '' : ' AND g.active = 1'}`

guestsRouter.get('/', async (_req, res, next) => {
  try {
    const [guests] = await pool.query<any[]>(`${guestSelect} WHERE g.active = 1 ORDER BY g.sort_order, g.name`)
    const [feedback] = await pool.query<any[]>(`${feedbackSelect(false)} WHERE f.active = 1 ORDER BY f.sort_order, f.id`)
    res.json({ guests: guests.map(guestRow), feedback: feedback.map(feedbackRow) })
  } catch (error) { next(error) }
})

guestsRouter.get('/manage', ...manage, async (_req, res, next) => {
  try {
    const [guests] = await pool.query<any[]>(`${guestSelect} ORDER BY g.sort_order, g.name`)
    const [feedback] = await pool.query<any[]>(`${feedbackSelect(true)} ORDER BY f.sort_order, f.id`)
    res.json({ guests: guests.map(guestRow), feedback: feedback.map(feedbackRow) })
  } catch (error) { next(error) }
})

const guestCreate = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(160).default(''),
  eventName: z.string().trim().max(160).default(''),
  bio: z.string().trim().max(1200).default(''),
})

const guestUpdate = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().max(160).optional(),
  eventName: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(1200).optional(),
  instagramUrl: z.string().trim().url().max(500).nullable().optional(),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  active: z.coerce.boolean().optional(),
}).strict()

guestsRouter.post('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = guestCreate.parse(req.body)
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM guests')
    await pool.query('INSERT INTO guests(id,name,role,event_name,bio,sort_order) VALUES (?,?,?,?,?,?)',
      [id, input.name, input.role, input.eventName, input.bio, maxRows[0].maxOrder + 1])
    await recordAudit(req.user!.id, 'guest.create', 'guest', id, { name: input.name })
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

guestsRouter.put('/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = guestUpdate.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.name !== undefined) { set.push('name=?'); values.push(input.name) }
    if (input.role !== undefined) { set.push('role=?'); values.push(input.role) }
    if (input.eventName !== undefined) { set.push('event_name=?'); values.push(input.eventName) }
    if (input.bio !== undefined) { set.push('bio=?'); values.push(input.bio) }
    if (input.instagramUrl !== undefined) { set.push('instagram_url=?'); values.push(input.instagramUrl) }
    if (input.websiteUrl !== undefined) { set.push('website_url=?'); values.push(input.websiteUrl) }
    if (input.active !== undefined) { set.push('active=?'); values.push(input.active ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE guests SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Guest not found' })
    await recordAudit(req.user!.id, 'guest.update', 'guest', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

guestsRouter.put('/:id/photo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const stored = await storeAsset(pool, req, 'guest-photo')
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const [result] = await pool.query<any>('UPDATE guests SET photo_asset_id=? WHERE id=?', [stored.id, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Guest not found' })
    await recordAudit(req.user!.id, 'guest.photo', 'guest', req.params.id, { assetId: stored.id })
    res.json({ assetId: stored.id, photoUrl: mediaUrl(stored.id) })
  } catch (error) { next(error) }
})

guestsRouter.delete('/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM guests WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Guest not found' })
    await recordAudit(req.user!.id, 'guest.delete', 'guest', req.params.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const feedbackCreate = z.object({
  authorName: z.string().trim().min(1).max(120),
  authorRole: z.string().trim().max(160).default(''),
  message: z.string().trim().min(4).max(900),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  guestId: z.string().uuid().nullable().default(null),
})

const feedbackUpdate = z.object({
  authorName: z.string().trim().min(1).max(120).optional(),
  authorRole: z.string().trim().max(160).optional(),
  message: z.string().trim().min(4).max(900).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  guestId: z.string().uuid().nullable().optional(),
  active: z.coerce.boolean().optional(),
}).strict()

guestsRouter.post('/feedback', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = feedbackCreate.parse(req.body)
    if (input.guestId) {
      const [found] = await pool.query<any[]>('SELECT id FROM guests WHERE id=?', [input.guestId])
      if (!found[0]) return res.status(400).json({ error: 'Guest not found' })
    }
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM guest_feedback')
    await pool.query('INSERT INTO guest_feedback(id,guest_id,author_name,author_role,message,rating,sort_order) VALUES (?,?,?,?,?,?,?)',
      [id, input.guestId, input.authorName, input.authorRole, input.message, input.rating, maxRows[0].maxOrder + 1])
    await recordAudit(req.user!.id, 'guest.feedback.create', 'guest_feedback', id, { authorName: input.authorName })
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

guestsRouter.put('/feedback/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = feedbackUpdate.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.authorName !== undefined) { set.push('author_name=?'); values.push(input.authorName) }
    if (input.authorRole !== undefined) { set.push('author_role=?'); values.push(input.authorRole) }
    if (input.message !== undefined) { set.push('message=?'); values.push(input.message) }
    if (input.rating !== undefined) { set.push('rating=?'); values.push(input.rating) }
    if (input.guestId !== undefined) {
      if (input.guestId !== null) {
        const [found] = await pool.query<any[]>('SELECT id FROM guests WHERE id=?', [input.guestId])
        if (!found[0]) return res.status(400).json({ error: 'Guest not found' })
      }
      set.push('guest_id=?'); values.push(input.guestId)
    }
    if (input.active !== undefined) { set.push('active=?'); values.push(input.active ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE guest_feedback SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Feedback not found' })
    await recordAudit(req.user!.id, 'guest.feedback.update', 'guest_feedback', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

guestsRouter.delete('/feedback/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM guest_feedback WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Feedback not found' })
    await recordAudit(req.user!.id, 'guest.feedback.delete', 'guest_feedback', req.params.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const orderInput = z.object({
  kind: z.enum(['guests', 'guest_feedback']),
  ids: z.array(z.string().uuid()).min(1).max(200),
}).strict()

guestsRouter.post('/order', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = orderInput.parse(req.body)
    const table = input.kind === 'guests' ? 'guests' : 'guest_feedback'
    await withTransaction(async (db) => {
      for (const [index, id] of input.ids.entries()) {
        await db.query(`UPDATE ${table} SET sort_order=? WHERE id=?`, [index + 1, id])
      }
    })
    await recordAudit(req.user!.id, 'guest.order', table, null, { count: input.ids.length })
    res.json({ ok: true })
  } catch (error) { next(error) }
})
