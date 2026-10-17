import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import type { Pool, PoolConnection } from 'mysql2/promise'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'
import { sanitizeHtml } from '../services/html-sanitize.js'
import { recordAudit } from '../services/audit.js'

export const aboutRouter = Router()

const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const manage = [requireAuth, requirePermission('content:manage')] as const
const publishOnly = [requireAuth, requirePermission('content:publish')] as const
const imageBody = raw({ type: imageTypes, limit: '50mb' })
const sectionKeys = ['hero', 'foundation', 'company'] as const

function readImage(req: AuthRequest) {
  const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType || !imageTypes.includes(contentType)) return { error: 'Only JPG, PNG, WebP or GIF images are allowed', status: 415 }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return { error: 'Image file is required', status: 400 }
  if (!hasValidMediaSignature(contentType, req.body)) return { error: 'File content does not match its media type', status: 415 }
  return { contentType, data: req.body as Buffer }
}

function header(req: AuthRequest, name: string, fallback = '') {
  const value = req.get(name)
  if (!value) return fallback
  try { return decodeURIComponent(value) } catch { return value }
}

// MySQL normalises stored JSON (sorted keys), so compare drafts against snapshots canonically.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(',')}}`
}

type Queryable = Pool | PoolConnection
type StoredAsset = { ok: true; id: string; contentType: string; byteSize: number } | { ok: false; error: string; status: number }

export async function storeAsset(db: Queryable, req: AuthRequest, kind: string, uploadedBy?: string): Promise<StoredAsset> {
  const image = readImage(req)
  if ('error' in image) return { ok: false, error: image.error ?? 'Invalid image', status: image.status ?? 400 }
  const altText = z.string().trim().max(255).safeParse(header(req, 'x-alt-text')).data ?? ''
  const id = crypto.randomUUID()
  await db.query('INSERT INTO media_assets(id,kind,mime_type,media_type,byte_size,alt_text,data,uploaded_by) VALUES (?,?,?,?,?,?,?,?)',
    [id, kind, image.contentType, 'IMAGE', image.data.length, altText, image.data, uploadedBy ?? null])
  return { ok: true, id, contentType: image.contentType, byteSize: image.data.length }
}

async function buildState(db: Queryable) {
  const [sections] = await db.query<any[]>(`
    SELECT section_key sectionKey, title, subtitle, body_html bodyHtml, image_asset_id imageAssetId,
           image_position imagePosition, visible, sort_order sortOrder
    FROM about_sections ORDER BY sort_order, section_key`)
  const [team] = await db.query<any[]>(`
    SELECT id, name, designation, bio, photo_asset_id photoAssetId, facebook_url facebookUrl,
           linkedin_url linkedinUrl, instagram_url instagramUrl, sort_order sortOrder, active
    FROM team_members ORDER BY sort_order, name`)
  const [partners] = await db.query<any[]>(`
    SELECT id, name, category, website_url websiteUrl, logo_asset_id logoAssetId, sort_order sortOrder, active
    FROM event_partners ORDER BY sort_order, name`)
  return {
    sections: sections.map((s) => ({ ...s, imageUrl: s.imageAssetId ? `/api/about/media/${s.imageAssetId}` : null })),
    team: team.map((t) => ({ ...t, photoUrl: t.photoAssetId ? `/api/about/media/${t.photoAssetId}` : null })),
    partners: partners.map((p) => ({ ...p, logoUrl: p.logoAssetId ? `/api/about/media/${p.logoAssetId}` : null })),
  }
}

aboutRouter.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT snapshot, published_by_name publishedBy, created_at publishedAt FROM about_publish_history ORDER BY id DESC LIMIT 1')
    if (!rows[0]) return res.json({ published: null })
    const snapshot = typeof rows[0].snapshot === 'string' ? JSON.parse(rows[0].snapshot) : rows[0].snapshot
    res.json({ published: { publishedAt: rows[0].publishedAt, publishedBy: rows[0].publishedBy, state: snapshot } })
  } catch (error) { next(error) }
})

aboutRouter.get('/draft', ...manage, async (_req, res, next) => {
  try {
    const state = await buildState(pool)
    const [latest] = await pool.query<any[]>('SELECT snapshot, created_at publishedAt FROM about_publish_history ORDER BY id DESC LIMIT 1')
    if (!latest[0]) return res.json({ state, publishedAt: null, dirty: true })
    const published = typeof latest[0].snapshot === 'string' ? JSON.parse(latest[0].snapshot) : latest[0].snapshot
    res.json({ state, publishedAt: latest[0].publishedAt, dirty: stableStringify(state) !== stableStringify(published) })
  } catch (error) { next(error) }
})

aboutRouter.get('/media/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT mime_type mime, data FROM media_assets WHERE id=? AND kind NOT LIKE 'application-%'", [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Media not found' })
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'public, max-age=300')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})

const sectionInput = z.object({
  title: z.string().trim().max(160).optional(),
  subtitle: z.string().trim().max(500).optional(),
  bodyHtml: z.string().max(50000).nullable().optional(),
  imageAssetId: z.string().uuid().nullable().optional(),
  imagePosition: z.enum(['left', 'right']).optional(),
  visible: z.boolean().optional(),
}).strict()

aboutRouter.put('/sections/:key', ...manage, async (req: AuthRequest, res, next) => {
  try {
    if (!sectionKeys.includes(req.params.key as typeof sectionKeys[number])) return res.status(404).json({ error: 'Unknown section' })
    const input = sectionInput.parse(req.body)
    const columns: string[] = []
    const values: unknown[] = []
    if (input.title !== undefined) { columns.push('title=?'); values.push(input.title) }
    if (input.subtitle !== undefined) { columns.push('subtitle=?'); values.push(input.subtitle) }
    if (input.bodyHtml !== undefined) { columns.push('body_html=?'); values.push(input.bodyHtml === null ? null : sanitizeHtml(input.bodyHtml) || null) }
    if (input.imageAssetId !== undefined) {
      if (input.imageAssetId !== null) {
        const [assets] = await pool.query<any[]>('SELECT id FROM media_assets WHERE id=?', [input.imageAssetId])
        if (!assets[0]) return res.status(400).json({ error: 'Media asset not found' })
      }
      columns.push('image_asset_id=?'); values.push(input.imageAssetId)
    }
    if (input.imagePosition !== undefined) { columns.push('image_position=?'); values.push(input.imagePosition) }
    if (input.visible !== undefined) { columns.push('visible=?'); values.push(input.visible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_sections SET ${columns.join(',')} WHERE section_key=?`, [...values, req.params.key])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Section not found' })
    await recordAudit(req.user!.id, 'about.section.update', 'about_section', req.params.key, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.post('/media', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const kind = z.string().trim().max(40).safeParse(header(req, 'x-kind', 'about')).data ?? 'about'
    const stored = await storeAsset(pool, req, kind)
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    await recordAudit(req.user!.id, 'about.media.upload', 'media_asset', stored.id, { kind, byteSize: stored.byteSize })
    res.status(201).json(stored)
  } catch (error) { next(error) }
})

const teamInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  designation: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
  facebookUrl: z.string().trim().url().max(500).nullable().optional(),
  linkedinUrl: z.string().trim().url().max(500).nullable().optional(),
  instagramUrl: z.string().trim().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.coerce.boolean().optional(),
}).strict()

const teamCreate = z.object({
  name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120).default(''),
  bio: z.string().trim().max(1000).default(''),
})

aboutRouter.post('/team', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = teamCreate.parse(req.body)
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM team_members')
    await pool.query('INSERT INTO team_members(id,name,designation,bio,sort_order) VALUES (?,?,?,?,?)', [id, input.name, input.designation, input.bio, maxRows[0].maxOrder + 1])
    await recordAudit(req.user!.id, 'about.team.create', 'team_member', id, { name: input.name })
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

aboutRouter.put('/team/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = teamInput.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.name !== undefined) { set.push('name=?'); values.push(input.name) }
    if (input.designation !== undefined) { set.push('designation=?'); values.push(input.designation) }
    if (input.bio !== undefined) { set.push('bio=?'); values.push(input.bio) }
    if (input.facebookUrl !== undefined) { set.push('facebook_url=?'); values.push(input.facebookUrl) }
    if (input.linkedinUrl !== undefined) { set.push('linkedin_url=?'); values.push(input.linkedinUrl) }
    if (input.instagramUrl !== undefined) { set.push('instagram_url=?'); values.push(input.instagramUrl) }
    if (input.sortOrder !== undefined) { set.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.active !== undefined) { set.push('active=?'); values.push(input.active ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE team_members SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Team member not found' })
    await recordAudit(req.user!.id, 'about.team.update', 'team_member', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.put('/team/:id/photo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const stored = await storeAsset(pool, req, 'team-photo')
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const [result] = await pool.query<any>('UPDATE team_members SET photo_asset_id=? WHERE id=?', [stored.id, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Team member not found' })
    await recordAudit(req.user!.id, 'about.team.photo', 'team_member', req.params.id)
    res.json({ assetId: stored.id })
  } catch (error) { next(error) }
})

aboutRouter.delete('/team/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM team_members WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Team member not found' })
    await recordAudit(req.user!.id, 'about.team.delete', 'team_member', req.params.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const partnerInput = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(120).optional(),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.coerce.boolean().optional(),
}).strict()

const partnerCreate = z.object({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(120).default(''),
  websiteUrl: z.string().trim().url().max(500).nullable().default(null),
})

aboutRouter.post('/partners', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = partnerCreate.parse(req.body)
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM event_partners')
    await pool.query('INSERT INTO event_partners(id,name,category,website_url,sort_order) VALUES (?,?,?,?,?)', [id, input.name, input.category, input.websiteUrl, maxRows[0].maxOrder + 1])
    await recordAudit(req.user!.id, 'about.partner.create', 'event_partner', id, { name: input.name })
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

aboutRouter.put('/partners/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = partnerInput.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.name !== undefined) { set.push('name=?'); values.push(input.name) }
    if (input.category !== undefined) { set.push('category=?'); values.push(input.category) }
    if (input.websiteUrl !== undefined) { set.push('website_url=?'); values.push(input.websiteUrl) }
    if (input.sortOrder !== undefined) { set.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.active !== undefined) { set.push('active=?'); values.push(input.active ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE event_partners SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Partner not found' })
    await recordAudit(req.user!.id, 'about.partner.update', 'event_partner', req.params.id, { fields: Object.keys(input) })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.put('/partners/:id/logo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const stored = await storeAsset(pool, req, 'partner-logo')
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const [result] = await pool.query<any>('UPDATE event_partners SET logo_asset_id=? WHERE id=?', [stored.id, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Partner not found' })
    await recordAudit(req.user!.id, 'about.partner.logo', 'event_partner', req.params.id)
    res.json({ assetId: stored.id })
  } catch (error) { next(error) }
})

aboutRouter.delete('/partners/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM event_partners WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Partner not found' })
    await recordAudit(req.user!.id, 'about.partner.delete', 'event_partner', req.params.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

async function publishSnapshot(db: PoolConnection, actorId: string) {
  const state = await buildState(db)
  const [users] = await db.query<any[]>('SELECT full_name fullName FROM users WHERE id=?', [actorId])
  const [result] = await db.query<any>('INSERT INTO about_publish_history(snapshot,published_by,published_by_name) VALUES (?,?,?)',
    [JSON.stringify(state), actorId, users[0]?.fullName ?? ''])
  return { state, historyId: result.insertId as number }
}

async function cleanupOrphanAssets(keepAssetIds: Set<string>) {
  const [referenced] = await pool.query<any[]>(`
    SELECT image_asset_id id FROM about_sections WHERE image_asset_id IS NOT NULL
    UNION SELECT photo_asset_id FROM team_members WHERE photo_asset_id IS NOT NULL
    UNION SELECT logo_asset_id FROM event_partners WHERE logo_asset_id IS NOT NULL`)
  for (const row of referenced) keepAssetIds.add(row.id)
  if (keepAssetIds.size === 0) { await pool.query('DELETE FROM media_assets WHERE kind IN (?, ?, ?, ?)', ['about', 'about-hero', 'team-photo', 'partner-logo']); return }
  const placeholders = [...keepAssetIds].map(() => '?').join(',')
  await pool.query(`DELETE FROM media_assets WHERE kind IN (?, ?, ?, ?) AND id NOT IN (${placeholders})`,
    ['about', 'about-hero', 'team-photo', 'partner-logo', ...keepAssetIds])
}

aboutRouter.post('/publish', ...publishOnly, async (req: AuthRequest, res, next) => {
  try {
    const published = await withTransaction((db) => publishSnapshot(db, req.user!.id))
    const assetIds = new Set<string>()
    for (const item of [...published.state.sections, ...published.state.team, ...published.state.partners]) {
      const url = (item as Record<string, string | null>).imageUrl ?? (item as Record<string, string | null>).photoUrl ?? (item as Record<string, string | null>).logoUrl
      const id = url?.match(/\/api\/about\/media\/(.+)$/)?.[1]
      if (id) assetIds.add(id)
    }
    await cleanupOrphanAssets(assetIds).catch((cause) => console.error('[about] asset cleanup failed', cause))
    await recordAudit(req.user!.id, 'about.publish', 'about_page', String(published.historyId))
    res.json({ ok: true, historyId: published.historyId, publishedAt: new Date().toISOString() })
  } catch (error) { next(error) }
})

aboutRouter.get('/history', ...manage, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT id, published_by_name publishedBy, created_at createdAt FROM about_publish_history ORDER BY id DESC LIMIT 20')
    res.json({ history: rows })
  } catch (error) { next(error) }
})

aboutRouter.post('/restore/:historyId', ...publishOnly, async (req: AuthRequest, res, next) => {
  try {
    const historyId = z.coerce.number().int().positive().parse(req.params.historyId)
    const [rows] = await pool.query<any[]>('SELECT snapshot FROM about_publish_history WHERE id=?', [historyId])
    if (!rows[0]) return res.status(404).json({ error: 'History entry not found' })
    const snapshot = typeof rows[0].snapshot === 'string' ? JSON.parse(rows[0].snapshot) : rows[0].snapshot
    const [users] = await pool.query<any[]>('SELECT full_name fullName FROM users WHERE id=?', [req.user!.id])
    const [result] = await pool.query<any>('INSERT INTO about_publish_history(snapshot,published_by,published_by_name) VALUES (?,?,?)',
      [JSON.stringify(snapshot), req.user!.id, users[0]?.fullName ?? ''])
    await recordAudit(req.user!.id, 'about.restore', 'about_page', String(result.insertId), { restoredFrom: historyId })
    res.json({ ok: true, historyId: result.insertId })
  } catch (error) { next(error) }
})
