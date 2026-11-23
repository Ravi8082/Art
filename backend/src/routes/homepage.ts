import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'
import { cachePublic } from '../middleware/cache.js'
import { recordAudit } from '../services/audit.js'
import { getHomepageHeroMedia } from '../services/homepage-hero-media.js'

export const homepageRouter = Router()
const manageHomepage = [requireAuth, requirePermission('content:manage')] as const
const optionalDate = z.preprocess((value) => value === '' || value === undefined ? null : value, z.coerce.date().nullable())
export const exhibitionAnnouncementInput = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().min(10).max(2000),
  state: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(120),
  venue: z.string().trim().max(180).default(''),
  startsAt: optionalDate,
  endsAt: optionalDate,
  isFirstInState: z.boolean(),
  imageKey: z.enum(['exhibition1', 'exhibition2', 'exhibition3']).nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED']),
}).strict().superRefine((value, context) => {
  if ((value.startsAt === null) !== (value.endsAt === null)) {
    context.addIssue({ code: 'custom', message: 'Provide both exhibition dates or leave both blank for Coming Soon.' })
  } else if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
    context.addIssue({ code: 'custom', message: 'End date must be after the start date.' })
  }
})

const mediaSlots = {
  logo: { label: 'Site logo', types: ['image/jpeg', 'image/png', 'image/webp'] },
  film: { label: 'Header video', types: ['video/mp4', 'video/webm', 'video/quicktime'] },
  filmPoster: { label: 'Header video poster', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero: { label: 'Hero slide 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero2: { label: 'Hero slide 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero3: { label: 'Hero slide 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  exhibition1: { label: 'Upcoming exhibition image 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  exhibition2: { label: 'Upcoming exhibition image 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  exhibition3: { label: 'Upcoming exhibition image 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  glimpse: { label: 'Glimpse video thumbnail', types: ['image/jpeg', 'image/png', 'image/webp'] },
  mentor: { label: 'Mentor portrait', types: ['image/jpeg', 'image/png', 'image/webp'] },
  highlight1: { label: 'Event highlight — exhibitions', types: ['image/jpeg', 'image/png', 'image/webp'] },
  highlight2: { label: 'Event highlight — live painting', types: ['image/jpeg', 'image/png', 'image/webp'] },
  highlight3: { label: 'Event highlight — sculpture', types: ['image/jpeg', 'image/png', 'image/webp'] },
  highlight4: { label: 'Event highlight — workshops', types: ['image/jpeg', 'image/png', 'image/webp'] },
  highlight5: { label: 'Event highlight — collector previews', types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery1: { label: 'Gallery image 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery2: { label: 'Gallery image 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery3: { label: 'Gallery image 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery4: { label: 'Gallery image 4', types: ['image/jpeg', 'image/png', 'image/webp'] },
  gallery5: { label: 'Gallery image 5', types: ['image/jpeg', 'image/png', 'image/webp'] },
  venuePartner1: { label: 'Venue partner logo 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  venuePartner2: { label: 'Venue partner logo 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  venuePartner3: { label: 'Venue partner logo 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  venuePartner4: { label: 'Venue partner logo 4', types: ['image/jpeg', 'image/png', 'image/webp'] },
  venuePartner5: { label: 'Venue partner logo 5', types: ['image/jpeg', 'image/png', 'image/webp'] },
  testimonial1: { label: 'Testimonial portrait 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  testimonial2: { label: 'Testimonial portrait 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  testimonial3: { label: 'Testimonial portrait 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  testimonial4: { label: 'Testimonial portrait 4', types: ['image/jpeg', 'image/png', 'image/webp'] },
  testimonial5: { label: 'Testimonial portrait 5', types: ['image/jpeg', 'image/png', 'image/webp'] },
  categoryVisualArt: { label: 'Visual Art card', types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  categoryArtifacts: { label: 'Artifacts card', types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  categoryExperiences: { label: 'Live Experiences card', types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  categoryExhibitions: { label: 'Exhibitions card', types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] },
  contactHero: { label: 'Contact page banner', types: ['image/jpeg', 'image/png', 'image/webp'] },
} as const

type MediaSlot = keyof typeof mediaSlots
const mediaSlotNames = Object.keys(mediaSlots) as MediaSlot[]

function isMediaSlot(value: string): value is MediaSlot {
  return mediaSlotNames.includes(value as MediaSlot)
}

homepageRouter.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await getHomepageHeroMedia())
  } catch (error) {
    next(error)
  }
})

homepageRouter.get('/uploads/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) return res.status(404).json({ error: 'Homepage media not found' })
    const [rows] = await pool.query<any[]>(
      'SELECT mime_type mimeType, data FROM homepage_media_uploads WHERE id=?',
      [id.data],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Homepage media not found' })
    res.set('Content-Type', rows[0].mimeType)
    res.set('Cache-Control', 'public, max-age=31536000, immutable')
    res.send(rows[0].data)
  } catch (error) {
    next(error)
  }
})

homepageRouter.get('/exhibitions', cachePublic(30), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT id, title, description, state, city, venue, starts_at startsAt, ends_at endsAt,
        is_first_in_state isFirstInState, image_key imageKey
      FROM homepage_exhibition_announcements
      WHERE status='PUBLISHED' AND (ends_at IS NULL OR ends_at >= NOW())
      ORDER BY is_first_in_state DESC, sort_order, created_at DESC
    `)
    res.json(rows.map((row) => ({ ...row, isFirstInState: Boolean(row.isFirstInState) })))
  } catch (error) {
    next(error)
  }
})

homepageRouter.get('/exhibitions/admin', ...manageHomepage, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT id, title, description, state, city, venue, starts_at startsAt, ends_at endsAt,
        is_first_in_state isFirstInState, image_key imageKey, status, sort_order sortOrder
      FROM homepage_exhibition_announcements
      ORDER BY sort_order, created_at DESC
    `)
    res.json(rows.map((row) => ({ ...row, isFirstInState: Boolean(row.isFirstInState) })))
  } catch (error) {
    next(error)
  }
})

homepageRouter.post('/exhibitions', ...manageHomepage, async (req: AuthRequest, res, next) => {
  try {
    const input = exhibitionAnnouncementInput.parse(req.body)
    const id = crypto.randomUUID()
    const [orderRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0)+1 sortOrder FROM homepage_exhibition_announcements')
    await pool.query(`
      INSERT INTO homepage_exhibition_announcements
        (id,title,description,state,city,venue,starts_at,ends_at,is_first_in_state,image_key,status,sort_order,created_by,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `, [id, input.title, input.description, input.state, input.city, input.venue, input.startsAt, input.endsAt,
      input.isFirstInState, input.imageKey, input.status, orderRows[0].sortOrder, req.user!.id, req.user!.id])
    await recordAudit(req.user!.id, 'homepage.exhibition.create', 'homepage_exhibition', id, {
      state: input.state,
      status: input.status,
      dateAnnounced: input.startsAt !== null,
    })
    res.status(201).json({ id })
  } catch (error) {
    next(error)
  }
})

homepageRouter.put('/exhibitions/:id', ...manageHomepage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Invalid exhibition ID' })
    const input = exhibitionAnnouncementInput.parse(req.body)
    const [result] = await pool.query<any>(`
      UPDATE homepage_exhibition_announcements
      SET title=?,description=?,state=?,city=?,venue=?,starts_at=?,ends_at=?,is_first_in_state=?,image_key=?,status=?,updated_by=?
      WHERE id=?
    `, [input.title, input.description, input.state, input.city, input.venue, input.startsAt, input.endsAt,
      input.isFirstInState, input.imageKey, input.status, req.user!.id, id.data])
    if (!result.affectedRows && !result.changedRows) {
      const [rows] = await pool.query<any[]>('SELECT id FROM homepage_exhibition_announcements WHERE id=?', [id.data])
      if (!rows[0]) return res.status(404).json({ error: 'Homepage exhibition not found' })
    }
    await recordAudit(req.user!.id, 'homepage.exhibition.update', 'homepage_exhibition', id.data, {
      state: input.state,
      status: input.status,
      dateAnnounced: input.startsAt !== null,
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

homepageRouter.delete('/exhibitions/:id', ...manageHomepage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Invalid exhibition ID' })
    const [result] = await pool.query<any>('DELETE FROM homepage_exhibition_announcements WHERE id=?', [id.data])
    if (!result.affectedRows) return res.status(404).json({ error: 'Homepage exhibition not found' })
    await recordAudit(req.user!.id, 'homepage.exhibition.delete', 'homepage_exhibition', id.data)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

homepageRouter.get('/media', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT media_key mediaKey, mime_type mimeType, alt_text altText, updated_at updatedAt FROM homepage_media')
    res.json(Object.fromEntries(rows.map((row) => [
      row.mediaKey,
      {
        mimeType: row.mimeType,
        altText: row.altText,
        url: `/api/homepage/media/${row.mediaKey}?v=${encodeURIComponent(String(row.updatedAt))}`,
      },
    ])))
  } catch (error) {
    next(error)
  }
})

homepageRouter.get('/media/:key', async (req, res, next) => {
  try {
    if (!isMediaSlot(req.params.key)) return res.status(404).json({ error: 'Homepage media not found' })
    const [rows] = await pool.query<any[]>('SELECT mime_type mimeType, data FROM homepage_media WHERE media_key=?', [req.params.key])
    if (!rows[0]) return res.status(404).json({ error: 'Homepage media not found' })
    res.set('Content-Type', rows[0].mimeType)
    res.set('Cache-Control', 'public, max-age=300')
    res.send(rows[0].data)
  } catch (error) {
    next(error)
  }
})

homepageRouter.put('/media/:key', requireAuth, requirePermission('content:manage'), raw({
  type: [...supportedMediaTypes.keys()],
  limit: '50mb',
}), async (req: AuthRequest, res, next) => {
  try {
    const key = String(req.params.key)
    if (!isMediaSlot(key)) return res.status(404).json({ error: 'Unknown homepage media slot' })
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    const allowedTypes: readonly string[] = mediaSlots[key].types
    if (!contentType || !allowedTypes.includes(contentType)) return res.status(415).json({ error: 'Unsupported media type for this slot' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Media file is required' })
    if (!hasValidMediaSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its media type' })
    const altText = z.string().trim().min(1).max(255).safeParse(req.get('x-alt-text') ?? mediaSlots[key].label)
    if (!altText.success) return res.status(400).json({ error: 'Invalid alt text' })

    await pool.query(`
      INSERT INTO homepage_media(media_key,mime_type,alt_text,data,byte_size)
      VALUES (?,?,?,?,?)
      ON DUPLICATE KEY UPDATE mime_type=VALUES(mime_type), alt_text=VALUES(alt_text),
        data=VALUES(data), byte_size=VALUES(byte_size)
    `, [key, contentType, altText.data, req.body, req.body.length])

    res.json({ key, mimeType: contentType, byteSize: req.body.length, message: 'Homepage media updated' })
  } catch (error) {
    next(error)
  }
})

export { mediaSlots }
