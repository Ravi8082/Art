import crypto from 'node:crypto'
import { raw, Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { supportedMediaTypes } from '../services/media-validation.js'
import { recordAudit } from '../services/audit.js'
import { storeAsset } from './about.js'

export const invitedGuestsRouter = Router()
export const adminInvitedGuestsRouter = Router()

const manage = [requireAuth, requirePermission('content:manage')] as const
const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const imageBody = raw({ type: imageTypes, limit: '25mb' })
const pageColumns = {
  home: 'show_on_home',
  about: 'show_on_about',
  gallery: 'show_on_gallery',
  exhibitions: 'show_on_exhibitions',
} as const
const pageSchema = z.enum(['home', 'about', 'gallery', 'exhibitions'])
const guestSelect = `
  SELECT id, name, role_badge roleBadge, designation, role_summary roleSummary,
         edition_tag editionTag, photo_url photoUrl, sort_order sortOrder,
         is_active isActive, show_on_home showOnHome, show_on_about showOnAbout,
         show_on_gallery showOnGallery, show_on_exhibitions showOnExhibitions
  FROM invited_guests`

function guestRow(row: Record<string, unknown>) {
  return {
    ...row,
    isActive: Number(row.isActive) === 1,
    showOnHome: Number(row.showOnHome) === 1,
    showOnAbout: Number(row.showOnAbout) === 1,
    showOnGallery: Number(row.showOnGallery) === 1,
    showOnExhibitions: Number(row.showOnExhibitions) === 1,
    sortOrder: Number(row.sortOrder),
  }
}

const createGuest = z.object({
  name: z.string().trim().min(1).max(180),
  roleBadge: z.string().trim().min(1).max(80).default('Special Invitee'),
  designation: z.string().trim().max(200).default(''),
  roleSummary: z.string().trim().max(500).default(''),
  editionTag: z.string().trim().max(120).default(''),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
  isActive: z.boolean().default(true),
  showOnHome: z.boolean().default(true),
  showOnAbout: z.boolean().default(true),
  showOnGallery: z.boolean().default(true),
  showOnExhibitions: z.boolean().default(true),
}).strict()

const updateGuest = createGuest.partial().strict()

const guestColumns = {
  name: 'name',
  roleBadge: 'role_badge',
  designation: 'designation',
  roleSummary: 'role_summary',
  editionTag: 'edition_tag',
  sortOrder: 'sort_order',
  isActive: 'is_active',
  showOnHome: 'show_on_home',
  showOnAbout: 'show_on_about',
  showOnGallery: 'show_on_gallery',
  showOnExhibitions: 'show_on_exhibitions',
} as const

invitedGuestsRouter.get('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const parsedPage = pageSchema.safeParse(req.query.page)
    if (!parsedPage.success) return res.status(400).json({ error: 'A valid page is required.' })
    const pageColumn = pageColumns[parsedPage.data]
    const [rows] = await pool.query<any[]>(`
      ${guestSelect}
      WHERE is_active=1 AND ${pageColumn}=1
      ORDER BY sort_order, id
    `)
    res.json(rows.map(guestRow))
  } catch (error) {
    next(error)
  }
})

adminInvitedGuestsRouter.get('/', ...manage, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`${guestSelect} ORDER BY sort_order, id`)
    res.set('Cache-Control', 'no-store')
    res.json(rows.map(guestRow))
  } catch (error) {
    next(error)
  }
})

adminInvitedGuestsRouter.post('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = createGuest.parse(req.body)
    const id = crypto.randomUUID()
    const [orderRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 sortOrder FROM invited_guests')
    await pool.query(`
      INSERT INTO invited_guests
        (id,name,role_badge,designation,role_summary,edition_tag,sort_order,is_active,show_on_home,show_on_about,show_on_gallery,show_on_exhibitions)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `, [
      id, input.name, input.roleBadge, input.designation, input.roleSummary, input.editionTag, input.sortOrder ?? orderRows[0].sortOrder,
      input.isActive ? 1 : 0, input.showOnHome ? 1 : 0, input.showOnAbout ? 1 : 0,
      input.showOnGallery ? 1 : 0, input.showOnExhibitions ? 1 : 0,
    ])
    await recordAudit(req.user!.id, 'invited_guest.create', 'invited_guest', id, { name: input.name })
    res.status(201).json({ id })
  } catch (error) {
    next(error)
  }
})

adminInvitedGuestsRouter.patch('/reorder', ...manage, async (req: AuthRequest, res, next) => {
  const parsedIds = z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
  }).strict().safeParse(req.body)
  if (!parsedIds.success) return next(parsedIds.error)
  if (new Set(parsedIds.data.ids).size !== parsedIds.data.ids.length) {
    return res.status(400).json({ error: 'Guest IDs must not contain duplicates.' })
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query<any[]>('SELECT id FROM invited_guests ORDER BY sort_order, id FOR UPDATE')
    const existingIds = rows.map((row) => String(row.id))
    if (existingIds.length !== parsedIds.data.ids.length || existingIds.some((id) => !parsedIds.data.ids.includes(id))) {
      await connection.rollback()
      return res.status(400).json({ error: 'The guest list changed. Reload it and try again.' })
    }

    for (const [index, id] of parsedIds.data.ids.entries()) {
      await connection.query('UPDATE invited_guests SET sort_order=? WHERE id=?', [index + 1, id])
    }
    await connection.commit()
    await recordAudit(req.user!.id, 'invited_guest.reorder', 'invited_guest', null, { count: parsedIds.data.ids.length })
    return res.json({ ok: true })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

async function updateInvitedGuest(req: AuthRequest, res: Response, next: NextFunction, partial: boolean) {
  const parsedId = z.string().uuid().safeParse(req.params.id)
  if (!parsedId.success) return res.status(400).json({ error: 'Invalid invited guest ID.' })
  const parsedInput = (partial ? updateGuest : createGuest).safeParse(req.body)
  if (!parsedInput.success) return next(parsedInput.error)
  const input = parsedInput.data
  const entries = Object.entries(input) as [keyof typeof guestColumns, unknown][]
  if (!entries.length) return res.status(400).json({ error: 'At least one field is required.' })
  const values = entries.map(([key, value]) => typeof value === 'boolean' ? (value ? 1 : 0) : value)
  const set = entries.map(([key]) => `${guestColumns[key]}=?`)
  try {
    const [result] = await pool.query<any>(`UPDATE invited_guests SET ${set.join(',')} WHERE id=?`, [...values, parsedId.data])
    if (!result.affectedRows && !result.changedRows) {
      const [rows] = await pool.query<any[]>('SELECT id FROM invited_guests WHERE id=?', [parsedId.data])
      if (!rows[0]) return res.status(404).json({ error: 'Invited guest not found.' })
    }
    await recordAudit(req.user!.id, 'invited_guest.update', 'invited_guest', parsedId.data, { fields: entries.map(([key]) => key) })
    return res.json({ ok: true })
  } catch (error) {
    return next(error)
  }
}

adminInvitedGuestsRouter.put('/:id', ...manage, (req: AuthRequest, res, next) => updateInvitedGuest(req, res, next, false))
adminInvitedGuestsRouter.patch('/:id', ...manage, (req: AuthRequest, res, next) => updateInvitedGuest(req, res, next, true))

adminInvitedGuestsRouter.put('/:id/photo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const parsedId = z.string().uuid().safeParse(req.params.id)
    if (!parsedId.success) return res.status(400).json({ error: 'Invalid invited guest ID.' })
    const [rows] = await pool.query<any[]>('SELECT id FROM invited_guests WHERE id=?', [parsedId.data])
    if (!rows[0]) return res.status(404).json({ error: 'Invited guest not found.' })
    const stored = await storeAsset(pool, req, 'invited-guest-photo', req.user!.id)
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const photoUrl = `/api/about/media/${stored.id}`
    await pool.query('UPDATE invited_guests SET photo_url=? WHERE id=?', [photoUrl, parsedId.data])
    await recordAudit(req.user!.id, 'invited_guest.photo', 'invited_guest', parsedId.data, { assetId: stored.id })
    res.json({ photoUrl })
  } catch (error) {
    next(error)
  }
})

adminInvitedGuestsRouter.delete('/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const parsedId = z.string().uuid().safeParse(req.params.id)
    if (!parsedId.success) return res.status(400).json({ error: 'Invalid invited guest ID.' })
    const [result] = await pool.query<any>('DELETE FROM invited_guests WHERE id=?', [parsedId.data])
    if (!result.affectedRows) return res.status(404).json({ error: 'Invited guest not found.' })
    await recordAudit(req.user!.id, 'invited_guest.delete', 'invited_guest', parsedId.data)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
