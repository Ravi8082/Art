import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature } from '../services/media-validation.js'

export const artistProfileRouter = Router()

const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const imageBody = raw({ type: imageTypes, limit: '8mb' })
const publicKinds = ['profile-photo', 'profile-cover', 'portfolio-image']
const MAX_ITEMS = 60

const text = (max: number) => z.string().trim().max(max).default('')
const url = z.string().trim().max(512).default('').refine((value) => !value || /^https?:\/\//i.test(value), 'Links must start with http:// or https://')
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  headline: text(160), city: text(120), state: text(120), artStyle: text(160),
  phone: z.string().trim().max(30).default('').refine((value) => !value || /^[+\d][\d\s-]{6,}$/.test(value), 'Enter a valid phone number'),
  bio: text(2000), websiteUrl: url, instagramUrl: url, facebookUrl: url,
})
const itemSchema = z.object({
  title: z.string().trim().min(1).max(160),
  medium: text(160), dimensions: text(80), description: text(1000),
  year: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
  price: z.coerce.number().min(0).max(100000000).nullable().optional(),
  imageAssetId: z.string().uuid(),
})

function readImage(req: AuthRequest) {
  const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType || !imageTypes.includes(contentType)) return { error: 'Only JPG, PNG, WebP or GIF images are allowed', status: 415 as const }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return { error: 'Image file is required', status: 400 as const }
  if (!hasValidMediaSignature(contentType, req.body)) return { error: 'File content does not match its media type', status: 415 as const }
  return { contentType, data: req.body as Buffer }
}

async function storeImage(req: AuthRequest, kind: string): Promise<{ id: string } | { error: string; status: number }> {
  const image = readImage(req)
  if ('error' in image) return { error: image.error ?? 'Invalid image', status: image.status ?? 400 }
  const id = crypto.randomUUID()
  await pool.query('INSERT INTO media_assets(id,kind,mime_type,media_type,byte_size,alt_text,data,uploaded_by) VALUES (?,?,?,?,?,?,?,?)',
    [id, kind, image.contentType, 'IMAGE', image.data.length, '', image.data, req.user!.id])
  return { id }
}

const imageUrl = (id: string | null) => id ? `/api/artist-profile/image/${id}` : null

async function loadProfile(userId: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT display_name displayName, headline, city, state, phone, art_style artStyle, bio, website_url websiteUrl,
            instagram_url instagramUrl, facebook_url facebookUrl, photo_asset_id photoAssetId, cover_asset_id coverAssetId,
            status, review_note reviewNote
     FROM artist_profiles WHERE user_id = ?`, [userId])
  const [items] = await pool.query<any[]>(
    `SELECT id, title, medium, dimensions, year_made year, price_inr price, description, image_asset_id imageAssetId, created_at createdAt
     FROM artist_portfolio_items WHERE user_id = ? ORDER BY created_at DESC`, [userId])
  const p = rows[0]
  return {
    profile: p ? { ...p, photoUrl: imageUrl(p.photoAssetId), coverUrl: imageUrl(p.coverAssetId), photoAssetId: undefined, coverAssetId: undefined } : null,
    artworks: items.map((item) => ({ ...item, price: item.price === null ? null : Number(item.price), imageUrl: imageUrl(item.imageAssetId), imageAssetId: undefined })),
  }
}

artistProfileRouter.get('/admin', requireAuth, requirePermission('content:publish'), async (req, res, next) => {
  try {
    const status = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).default('PENDING').parse(req.query.status)
    const [rows] = await pool.query<any[]>(
      `SELECT p.user_id userId, p.display_name displayName, p.headline, p.city, p.state, p.art_style artStyle, p.bio, p.status, p.review_note reviewNote,
              p.photo_asset_id photoAssetId, p.updated_at updatedAt, u.email,
              (SELECT COUNT(*) FROM artist_portfolio_items i WHERE i.user_id = p.user_id) artworkCount
       FROM artist_profiles p JOIN users u ON u.id = p.user_id
       WHERE p.display_name <> '' ${status === 'ALL' ? '' : 'AND p.status = ?'}
       ORDER BY (p.status = 'PENDING') DESC, p.updated_at DESC LIMIT 200`, status === 'ALL' ? [] : [status])
    res.json({ artists: rows.map((r) => ({ ...r, photoUrl: imageUrl(r.photoAssetId), photoAssetId: undefined })) })
  } catch (error) { next(error) }
})

artistProfileRouter.patch('/admin/:userId/review', requireAuth, requirePermission('content:publish'), async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reviewNote: z.string().trim().max(1000).default('') }).parse(req.body)
    const [result] = await pool.query<any>(
      'UPDATE artist_profiles SET status=?, review_note=?, reviewed_by=?, reviewed_at=NOW() WHERE user_id=?',
      [input.decision, input.decision === 'REJECTED' ? input.reviewNote : null, req.user!.id, req.params.userId])
    if (!result.affectedRows) return res.status(404).json({ error: 'Artist profile not found' })
    res.json({ userId: req.params.userId, status: input.decision })
  } catch (error) { next(error) }
})

artistProfileRouter.get('/public', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT p.user_id userId, p.display_name displayName, p.headline, p.city, p.state, p.art_style artStyle, p.photo_asset_id photoAssetId,
              (SELECT image_asset_id FROM artist_portfolio_items i WHERE i.user_id = p.user_id ORDER BY created_at DESC LIMIT 1) latestArt
       FROM artist_profiles p WHERE p.display_name <> '' AND p.status = 'APPROVED' ORDER BY p.updated_at DESC LIMIT 200`)
    res.json(rows.map((r) => ({
      userId: r.userId, displayName: r.displayName, headline: r.headline, city: r.city, state: r.state, artStyle: r.artStyle,
      imageUrl: imageUrl(r.photoAssetId ?? r.latestArt),
    })))
  } catch (error) { next(error) }
})

artistProfileRouter.get('/public/gallery', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      `SELECT i.id, i.title, i.medium, i.dimensions, i.year_made year, i.price_inr price, i.description, i.image_asset_id imageAssetId,
              p.user_id artistId, p.display_name artistName, p.city, p.photo_asset_id photoAssetId
       FROM artist_portfolio_items i JOIN artist_profiles p ON p.user_id = i.user_id
       WHERE p.status = 'APPROVED' AND p.display_name <> '' ORDER BY i.created_at DESC LIMIT 300`)
    res.json(rows.map((r) => ({
      id: r.id, title: r.title, medium: r.medium, size: r.dimensions, year: r.year, price: r.price === null ? null : Number(r.price),
      description: r.description, artistId: r.artistId, artistName: r.artistName, city: r.city,
      url: imageUrl(r.imageAssetId), avatarUrl: imageUrl(r.photoAssetId),
    })))
  } catch (error) { next(error) }
})

artistProfileRouter.get('/public/:userId', async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.userId).success) return res.status(404).json({ error: 'Not found' })
    const data = await loadProfile(req.params.userId)
    if (!data.profile || !data.profile.displayName || data.profile.status !== 'APPROVED') return res.status(404).json({ error: 'Not found' })
    const { phone: _phone, status: _status, reviewNote: _note, ...profile } = data.profile
    res.json({ profile, artworks: data.artworks })
  } catch (error) { next(error) }
})

artistProfileRouter.get('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try { res.json(await loadProfile(req.user!.id)) } catch (error) { next(error) }
})

artistProfileRouter.put('/me', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile' })
    const d = parsed.data
    await pool.query(
      `INSERT INTO artist_profiles(user_id,display_name,headline,city,state,phone,art_style,bio,website_url,instagram_url,facebook_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE display_name=VALUES(display_name), headline=VALUES(headline), city=VALUES(city), state=VALUES(state),
         phone=VALUES(phone), art_style=VALUES(art_style), bio=VALUES(bio), website_url=VALUES(website_url),
         instagram_url=VALUES(instagram_url), facebook_url=VALUES(facebook_url), status=IF(status='REJECTED','PENDING',status)`,
      [req.user!.id, d.displayName, d.headline, d.city, d.state, d.phone, d.artStyle, d.bio, d.websiteUrl, d.instagramUrl, d.facebookUrl])
    res.json(await loadProfile(req.user!.id))
  } catch (error) { next(error) }
})

// Upload a profile photo or cover image. Replaces (and removes) the previous one.
artistProfileRouter.post('/me/image/:slot', requireAuth, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const slot = req.params.slot
    if (slot !== 'photo' && slot !== 'cover') return res.status(400).json({ error: 'Slot must be photo or cover' })
    const stored = await storeImage(req, slot === 'photo' ? 'profile-photo' : 'profile-cover')
    if ('error' in stored) return res.status(stored.status).json({ error: stored.error })
    const column = slot === 'photo' ? 'photo_asset_id' : 'cover_asset_id'
    const [old] = await pool.query<any[]>(`SELECT ${column} id FROM artist_profiles WHERE user_id = ?`, [req.user!.id])
    const [[user]] = await pool.query<any[]>('SELECT full_name FROM users WHERE id = ?', [req.user!.id])
    await pool.query(
      `INSERT INTO artist_profiles(user_id, display_name, ${column}) VALUES (?,?,?) ON DUPLICATE KEY UPDATE ${column}=VALUES(${column})`,
      [req.user!.id, user?.full_name ?? '', stored.id])
    if (old[0]?.id) await pool.query('DELETE FROM media_assets WHERE id = ? AND uploaded_by = ?', [old[0].id, req.user!.id])
    res.status(201).json(await loadProfile(req.user!.id))
  } catch (error) { next(error) }
})

artistProfileRouter.post('/me/artworks/image', requireAuth, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const [[count]] = await pool.query<any[]>('SELECT COUNT(*) n FROM artist_portfolio_items WHERE user_id = ?', [req.user!.id])
    if (Number(count.n) >= MAX_ITEMS) return res.status(400).json({ error: `You can add up to ${MAX_ITEMS} artworks` })
    const stored = await storeImage(req, 'portfolio-image')
    if ('error' in stored) return res.status(stored.status).json({ error: stored.error })
    res.status(201).json({ assetId: stored.id, url: imageUrl(stored.id) })
  } catch (error) { next(error) }
})

artistProfileRouter.post('/me/artworks', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const parsed = itemSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid artwork' })
    const d = parsed.data
    const [owned] = await pool.query<any[]>("SELECT id FROM media_assets WHERE id = ? AND uploaded_by = ? AND kind = 'portfolio-image'", [d.imageAssetId, req.user!.id])
    if (!owned.length) return res.status(400).json({ error: 'Upload an image for this artwork first' })
    await pool.query(
      'INSERT INTO artist_portfolio_items(id,user_id,title,medium,dimensions,year_made,price_inr,description,image_asset_id) VALUES (?,?,?,?,?,?,?,?,?)',
      [crypto.randomUUID(), req.user!.id, d.title, d.medium, d.dimensions, d.year ?? null, d.price ?? null, d.description, d.imageAssetId])
    res.status(201).json(await loadProfile(req.user!.id))
  } catch (error) { next(error) }
})

artistProfileRouter.delete('/me/artworks/:id', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT image_asset_id id FROM artist_portfolio_items WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id])
    if (!rows.length) return res.status(404).json({ error: 'Artwork not found' })
    await pool.query('DELETE FROM artist_portfolio_items WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id])
    await pool.query('DELETE FROM media_assets WHERE id = ? AND uploaded_by = ?', [rows[0].id, req.user!.id])
    res.json(await loadProfile(req.user!.id))
  } catch (error) { next(error) }
})

// Profile imagery is public so artist pages can show it; ids are unguessable UUIDs.
artistProfileRouter.get('/image/:assetId', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`SELECT data, mime_type FROM media_assets WHERE id = ? AND kind IN (${publicKinds.map(() => '?').join(',')})`, [req.params.assetId, ...publicKinds])
    if (!rows[0]?.data) return res.status(404).json({ error: 'Image not found' })
    res.set('Content-Type', rows[0].mime_type)
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'public, max-age=86400, immutable')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})
