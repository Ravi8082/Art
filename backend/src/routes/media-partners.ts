import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'
import { recordAudit } from '../services/audit.js'
import { storeAsset } from './about.js'

export const mediaPartnersRouter = Router()
export const adminMediaPartnersRouter = Router()

const manage = [requireAuth, requirePermission('content:manage')] as const
const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const imageBody = raw({ type: imageTypes, limit: '25mb' })
const pageColumns = { home: 'show_on_home', about: 'show_on_about', exhibitions: 'show_on_exhibitions' } as const
const pageSchema = z.enum(['home', 'about', 'exhibitions'])
const selectPartners = `
  SELECT id, name, category, logo_url logoUrl, website_url websiteUrl, sort_order sortOrder,
         is_active isActive, show_on_home showOnHome, show_on_about showOnAbout,
         show_on_exhibitions showOnExhibitions
  FROM media_partners`

function partnerRow(row: Record<string, unknown>) {
  return {
    ...row,
    category: row.category ?? '',
    logoUrl: row.logoUrl ?? null,
    websiteUrl: row.websiteUrl ?? null,
    sortOrder: Number(row.sortOrder),
    isActive: Number(row.isActive) === 1,
    showOnHome: Number(row.showOnHome) === 1,
    showOnAbout: Number(row.showOnAbout) === 1,
    showOnExhibitions: Number(row.showOnExhibitions) === 1,
  }
}

const partnerInput = z.object({
  name: z.string().trim().min(1).max(180),
  category: z.string().trim().max(80).default(''),
  websiteUrl: z.string().trim().max(500).refine((value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
    } catch {
      return false
    }
  }, 'Use a full http:// or https:// URL').default(''),
  sortOrder: z.coerce.number().int().min(0).max(999999).optional(),
  isActive: z.boolean().default(true),
  showOnHome: z.boolean().default(true),
  showOnAbout: z.boolean().default(true),
  showOnExhibitions: z.boolean().default(true),
}).strict()

const partnerPatch = partnerInput.partial().strict()
const partnerColumns = {
  name: 'name',
  category: 'category',
  websiteUrl: 'website_url',
  sortOrder: 'sort_order',
  isActive: 'is_active',
  showOnHome: 'show_on_home',
  showOnAbout: 'show_on_about',
  showOnExhibitions: 'show_on_exhibitions',
} as const

mediaPartnersRouter.get('/', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  const parsedPage = pageSchema.safeParse(req.query.page)
  if (!parsedPage.success) return res.status(400).json({ error: 'A valid page is required.' })
  try {
    const [rows] = await pool.query<any[]>(`
      ${selectPartners}
      WHERE is_active=1 AND ${pageColumns[parsedPage.data]}=1
      ORDER BY sort_order, id
    `)
    res.json(rows.map(partnerRow))
  } catch (error) {
    next(error)
  }
})

adminMediaPartnersRouter.get('/', ...manage, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`${selectPartners} ORDER BY sort_order, id`)
    res.setHeader('Cache-Control', 'no-store')
    res.json(rows.map(partnerRow))
  } catch (error) {
    next(error)
  }
})

adminMediaPartnersRouter.post('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = partnerInput.parse(req.body)
    const id = crypto.randomUUID()
    const [orderRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 sortOrder FROM media_partners')
    await pool.query(`
      INSERT INTO media_partners
        (id,name,category,website_url,sort_order,is_active,show_on_home,show_on_about,show_on_exhibitions)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [
      id, input.name, input.category || null, input.websiteUrl || null, input.sortOrder ?? orderRows[0].sortOrder,
      input.isActive ? 1 : 0, input.showOnHome ? 1 : 0, input.showOnAbout ? 1 : 0, input.showOnExhibitions ? 1 : 0,
    ])
    await recordAudit(req.user!.id, 'media_partner.create', 'media_partner', id, { name: input.name })
    res.status(201).json({ id })
  } catch (error) {
    next(error)
  }
})

adminMediaPartnersRouter.patch('/reorder', ...manage, async (req: AuthRequest, res, next) => {
  const parsed = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).strict().safeParse(req.body)
  if (!parsed.success) return next(parsed.error)
  if (new Set(parsed.data.ids).size !== parsed.data.ids.length) return res.status(400).json({ error: 'Partner IDs must not contain duplicates.' })

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query<any[]>('SELECT id FROM media_partners ORDER BY sort_order, id FOR UPDATE')
    const existingIds = rows.map((row) => String(row.id))
    if (existingIds.length !== parsed.data.ids.length || existingIds.some((id) => !parsed.data.ids.includes(id))) {
      await connection.rollback()
      return res.status(400).json({ error: 'The partner list changed. Reload it and try again.' })
    }
    for (const [index, id] of parsed.data.ids.entries()) {
      await connection.query('UPDATE media_partners SET sort_order=? WHERE id=?', [index + 1, id])
    }
    await connection.commit()
    await recordAudit(req.user!.id, 'media_partner.reorder', 'media_partner', null, { count: parsed.data.ids.length })
    return res.json({ ok: true })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
})

async function updatePartner(req: AuthRequest, res: import('express').Response, next: import('express').NextFunction, partial: boolean) {
  const parsedId = z.string().uuid().safeParse(req.params.id)
  if (!parsedId.success) return res.status(400).json({ error: 'Invalid media partner ID.' })
  const parsedInput = (partial ? partnerPatch : partnerInput).safeParse(req.body)
  if (!parsedInput.success) return next(parsedInput.error)
  const entries = Object.entries(parsedInput.data) as [keyof typeof partnerColumns, unknown][]
  if (!entries.length) return res.status(400).json({ error: 'At least one field is required.' })
  try {
    const values = entries.map(([key, value]) => key === 'websiteUrl'
      ? value || null
      : typeof value === 'boolean' ? (value ? 1 : 0) : key === 'category' ? value || null : value)
    const set = entries.map(([key]) => `${partnerColumns[key]}=?`)
    const [result] = await pool.query<any>(`UPDATE media_partners SET ${set.join(',')} WHERE id=?`, [...values, parsedId.data])
    if (!result.affectedRows && !result.changedRows) {
      const [rows] = await pool.query<any[]>('SELECT id FROM media_partners WHERE id=?', [parsedId.data])
      if (!rows[0]) return res.status(404).json({ error: 'Media partner not found.' })
    }
    await recordAudit(req.user!.id, 'media_partner.update', 'media_partner', parsedId.data, { fields: entries.map(([key]) => key) })
    return res.json({ ok: true })
  } catch (error) {
    return next(error)
  }
}

adminMediaPartnersRouter.put('/:id', ...manage, (req: AuthRequest, res, next) => updatePartner(req, res, next, false))
adminMediaPartnersRouter.patch('/:id', ...manage, (req: AuthRequest, res, next) => updatePartner(req, res, next, true))

adminMediaPartnersRouter.put('/:id/logo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const parsedId = z.string().uuid().safeParse(req.params.id)
    if (!parsedId.success) return res.status(400).json({ error: 'Invalid media partner ID.' })
    const [rows] = await pool.query<any[]>('SELECT id FROM media_partners WHERE id=?', [parsedId.data])
    if (!rows[0]) return res.status(404).json({ error: 'Media partner not found.' })
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    if (!contentType || !imageTypes.includes(contentType)) return res.status(415).json({ error: 'Only JPG, PNG, WebP or GIF images are allowed.' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Choose a logo image to upload.' })
    if (!hasValidMediaSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its media type.' })
    const stored = await storeAsset(pool, req, 'media-partner-logo', req.user!.id)
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const logoUrl = `/api/about/media/${stored.id}`
    await pool.query('UPDATE media_partners SET logo_url=? WHERE id=?', [logoUrl, parsedId.data])
    await recordAudit(req.user!.id, 'media_partner.logo', 'media_partner', parsedId.data, { assetId: stored.id, byteSize: stored.byteSize })
    res.json({ logoUrl })
  } catch (error) {
    next(error)
  }
})

adminMediaPartnersRouter.delete('/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const parsedId = z.string().uuid().safeParse(req.params.id)
    if (!parsedId.success) return res.status(400).json({ error: 'Invalid media partner ID.' })
    const [result] = await pool.query<any>('DELETE FROM media_partners WHERE id=?', [parsedId.data])
    if (!result.affectedRows) return res.status(404).json({ error: 'Media partner not found.' })
    await recordAudit(req.user!.id, 'media_partner.delete', 'media_partner', parsedId.data)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})
