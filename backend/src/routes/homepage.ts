import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'

export const homepageRouter = Router()

const mediaSlots = {
  logo: { label: 'Site logo', types: ['image/jpeg', 'image/png', 'image/webp'] },
  film: { label: 'Header video', types: ['video/mp4', 'video/webm', 'video/quicktime'] },
  filmPoster: { label: 'Header video poster', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero: { label: 'Hero slide 1', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero2: { label: 'Hero slide 2', types: ['image/jpeg', 'image/png', 'image/webp'] },
  hero3: { label: 'Hero slide 3', types: ['image/jpeg', 'image/png', 'image/webp'] },
  glimpse: { label: 'Glimpse video thumbnail', types: ['image/jpeg', 'image/png', 'image/webp'] },
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

homepageRouter.get('/media', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT media_key mediaKey, mime_type mimeType, alt_text altText FROM homepage_media')
    res.json(Object.fromEntries(rows.map((row) => [
      row.mediaKey,
      { mimeType: row.mimeType, altText: row.altText, url: `/api/homepage/media/${row.mediaKey}` },
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
