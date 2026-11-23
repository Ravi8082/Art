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
export const adminAboutRouter = Router()

const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const manage = [requireAuth, requirePermission('content:manage')] as const
const publishOnly = [requireAuth, requirePermission('content:publish')] as const
const imageBody = raw({ type: imageTypes, limit: '50mb' })
const sectionKeys = ['hero', 'foundation', 'company', 'vision', 'mission', 'features', 'team', 'partners', 'cta'] as const

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
           image_position imagePosition, link_url linkUrl, button_label buttonLabel, visible, sort_order sortOrder
    FROM about_sections ORDER BY sort_order, section_key`)
  const [team] = await db.query<any[]>(`
    SELECT id, name, designation, role, badge_label badgeLabel, is_featured_mentor isFeaturedMentor,
           bio, photo_asset_id photoAssetId, facebook_url facebookUrl, linkedin_url linkedinUrl,
           instagram_url instagramUrl, sort_order sortOrder, active
    FROM team_members ORDER BY sort_order, name`)
  const [partners] = await db.query<any[]>(`
    SELECT id, name, short_code shortCode, category, website_url websiteUrl, logo_asset_id logoAssetId,
           sort_order sortOrder, active
    FROM event_partners ORDER BY sort_order, name`)
  const [settingsRows] = await db.query<any[]>(`
    SELECT id, hero_kicker heroKicker, hero_title heroTitle, hero_subtitle heroSubtitle,
           hero_image_asset_id heroImageAssetId, hero_visible heroVisible,
           story_kicker storyKicker, story_heading storyHeading, story_body_html storyBodyHtml,
           story_image_asset_id storyImageAssetId, story_image_position storyImagePosition,
           story_tags storyTags, story_visible storyVisible,
           journey_kicker journeyKicker, journey_heading journeyHeading, journey_visible journeyVisible,
           ecosystem_kicker ecosystemKicker, ecosystem_heading ecosystemHeading,
           ecosystem_subtitle ecosystemSubtitle
    FROM about_settings WHERE id=1`)
  const [metrics] = await db.query<any[]>(`
    SELECT id, metric_key metricKey, value, label, sublabel, sort_order sortOrder, is_visible isVisible
    FROM about_metrics ORDER BY sort_order, id`)
  const [milestones] = await db.query<any[]>(`
    SELECT id, milestone_key milestoneKey, year_range yearRange, title, description,
           sort_order sortOrder, is_visible isVisible
    FROM about_milestones ORDER BY sort_order, id`)
  const [visionMission] = await db.query<any[]>(`
    SELECT section_key sectionKey, title, body_html bodyHtml, sort_order sortOrder, is_visible isVisible
    FROM about_vision_mission ORDER BY sort_order, section_key`)
  const [ecosystemCards] = await db.query<any[]>(`
    SELECT id, card_key cardKey, title, \`lead\` AS \`lead\`, body_html bodyHtml, sort_order sortOrder, is_visible isVisible
    FROM about_ecosystem_cards ORDER BY sort_order, id`)
  const settings = settingsRows[0] ?? null
  const storyTags = settings?.storyTags
    ? (typeof settings.storyTags === 'string' ? JSON.parse(settings.storyTags) : settings.storyTags)
    : []
  return {
    sections: sections.map((s) => ({ ...s, imageUrl: s.imageAssetId ? `/api/about/media/${s.imageAssetId}` : null })),
    team: team.map((t) => ({
      ...t,
      role: t.role || t.designation,
      badgeLabel: t.badgeLabel || t.role || t.designation,
      isFeaturedMentor: Number(t.isFeaturedMentor) === 1,
      isActive: Number(t.active) === 1,
      photoUrl: t.photoAssetId ? `/api/about/media/${t.photoAssetId}` : null,
    })),
    partners: partners.map((p) => ({
      ...p,
      isActive: Number(p.active) === 1,
      logoUrl: p.logoAssetId ? `/api/about/media/${p.logoAssetId}` : null,
    })),
    settings: settings ? {
      ...settings,
      storyTags,
      heroVisible: Number(settings.heroVisible) === 1,
      storyVisible: Number(settings.storyVisible) === 1,
      journeyVisible: Number(settings.journeyVisible) === 1,
      heroImageUrl: settings.heroImageAssetId ? `/api/about/media/${settings.heroImageAssetId}` : null,
      storyImageUrl: settings.storyImageAssetId ? `/api/about/media/${settings.storyImageAssetId}` : null,
    } : null,
    metrics: metrics.map((item) => ({ ...item, isVisible: Number(item.isVisible) === 1 })),
    milestones: milestones.map((item) => ({ ...item, isVisible: Number(item.isVisible) === 1 })),
    visionMission: visionMission.map((item) => ({ ...item, isVisible: Number(item.isVisible) === 1 })),
    ecosystemCards: ecosystemCards.map((item) => ({ ...item, isVisible: Number(item.isVisible) === 1 })),
  }
}

aboutRouter.get('/', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT snapshot, published_by_name publishedBy, created_at publishedAt FROM about_publish_history ORDER BY id DESC LIMIT 1')
    const snapshot = rows[0]
      ? (typeof rows[0].snapshot === 'string' ? JSON.parse(rows[0].snapshot) : rows[0].snapshot)
      : null
    const liveState = await buildState(pool)
    res.set('Cache-Control', 'no-store')
    res.json({
      published: {
        publishedAt: rows[0]?.publishedAt ?? null,
        publishedBy: rows[0]?.publishedBy ?? null,
        state: { ...liveState, sections: snapshot?.sections ?? liveState.sections },
      },
    })
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

adminAboutRouter.get('/', ...manage, async (_req, res, next) => {
  try {
    const state = await buildState(pool)
    const [latest] = await pool.query<any[]>('SELECT created_at publishedAt FROM about_publish_history ORDER BY id DESC LIMIT 1')
    res.set('Cache-Control', 'no-store')
    res.json({ state, publishedAt: latest[0]?.publishedAt ?? null })
  } catch (error) { next(error) }
})

const metricInput = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(160),
  sublabel: z.string().trim().max(200).default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isVisible: z.coerce.boolean().optional(),
}).strict()
const metricUpdate = metricInput.partial()

aboutRouter.post('/metrics', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = metricInput.parse(req.body)
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM about_metrics')
    const [result] = await pool.query<any>(
      'INSERT INTO about_metrics(metric_key,value,label,sublabel,sort_order,is_visible) VALUES (?,?,?,?,?,?)',
      [`custom-${crypto.randomUUID()}`, input.value, input.label, input.sublabel, input.sortOrder ?? maxRows[0].maxOrder + 1, input.isVisible === false ? 0 : 1],
    )
    await recordAudit(req.user!.id, 'about.metric.create', 'about_metric', String(result.insertId), { label: input.label })
    await publishCurrentState(req.user!.id)
    res.status(201).json({ id: result.insertId })
  } catch (error) { next(error) }
})

aboutRouter.put('/metrics/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const input = metricUpdate.parse(req.body)
    const columns: string[] = []
    const values: unknown[] = []
    if (input.value !== undefined) { columns.push('value=?'); values.push(input.value) }
    if (input.label !== undefined) { columns.push('label=?'); values.push(input.label) }
    if (input.sublabel !== undefined) { columns.push('sublabel=?'); values.push(input.sublabel) }
    if (input.sortOrder !== undefined) { columns.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.isVisible !== undefined) { columns.push('is_visible=?'); values.push(input.isVisible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_metrics SET ${columns.join(',')} WHERE id=?`, [...values, id])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Metric not found' })
    await recordAudit(req.user!.id, 'about.metric.update', 'about_metric', String(id), { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.delete('/metrics/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const [result] = await pool.query<any>('DELETE FROM about_metrics WHERE id=?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Metric not found' })
    await recordAudit(req.user!.id, 'about.metric.delete', 'about_metric', String(id))
    await publishCurrentState(req.user!.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const milestoneInput = z.object({
  yearRange: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000).default(''),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isVisible: z.coerce.boolean().optional(),
}).strict()
const milestoneUpdate = milestoneInput.partial()

aboutRouter.post('/milestones', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = milestoneInput.parse(req.body)
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM about_milestones')
    const [result] = await pool.query<any>(
      'INSERT INTO about_milestones(milestone_key,year_range,title,description,sort_order,is_visible) VALUES (?,?,?,?,?,?)',
      [`custom-${crypto.randomUUID()}`, input.yearRange, input.title, input.description, input.sortOrder ?? maxRows[0].maxOrder + 1, input.isVisible === false ? 0 : 1],
    )
    await recordAudit(req.user!.id, 'about.milestone.create', 'about_milestone', String(result.insertId), { yearRange: input.yearRange })
    await publishCurrentState(req.user!.id)
    res.status(201).json({ id: result.insertId })
  } catch (error) { next(error) }
})

aboutRouter.put('/milestones/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const input = milestoneUpdate.parse(req.body)
    const columns: string[] = []
    const values: unknown[] = []
    if (input.yearRange !== undefined) { columns.push('year_range=?'); values.push(input.yearRange) }
    if (input.title !== undefined) { columns.push('title=?'); values.push(input.title) }
    if (input.description !== undefined) { columns.push('description=?'); values.push(input.description) }
    if (input.sortOrder !== undefined) { columns.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.isVisible !== undefined) { columns.push('is_visible=?'); values.push(input.isVisible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_milestones SET ${columns.join(',')} WHERE id=?`, [...values, id])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Milestone not found' })
    await recordAudit(req.user!.id, 'about.milestone.update', 'about_milestone', String(id), { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.delete('/milestones/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const [result] = await pool.query<any>('DELETE FROM about_milestones WHERE id=?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Milestone not found' })
    await recordAudit(req.user!.id, 'about.milestone.delete', 'about_milestone', String(id))
    await publishCurrentState(req.user!.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const visionMissionInput = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  bodyHtml: z.string().max(50000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isVisible: z.coerce.boolean().optional(),
}).strict()

aboutRouter.put('/vision-mission/:key', ...manage, async (req: AuthRequest, res, next) => {
  try {
    if (req.params.key !== 'vision' && req.params.key !== 'mission') return res.status(404).json({ error: 'Unknown vision or mission section' })
    const input = visionMissionInput.parse(req.body)
    const columns: string[] = []
    const values: unknown[] = []
    if (input.title !== undefined) { columns.push('title=?'); values.push(input.title) }
    if (input.bodyHtml !== undefined) {
      columns.push('body_html=?')
      values.push(input.bodyHtml === null ? null : sanitizeHtml(input.bodyHtml) || null)
    }
    if (input.sortOrder !== undefined) { columns.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.isVisible !== undefined) { columns.push('is_visible=?'); values.push(input.isVisible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_vision_mission SET ${columns.join(',')} WHERE section_key=?`, [...values, req.params.key])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Vision or mission section not found' })
    await recordAudit(req.user!.id, 'about.vision_mission.update', 'about_vision_mission', req.params.key, { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

const ecosystemCardInput = z.object({
  title: z.string().trim().min(1).max(160),
  lead: z.string().trim().max(240).default(''),
  bodyHtml: z.string().max(50000).nullable().default(null),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isVisible: z.coerce.boolean().optional(),
}).strict()
const ecosystemCardUpdate = ecosystemCardInput.partial()

aboutRouter.post('/ecosystem-cards', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = ecosystemCardInput.parse(req.body)
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM about_ecosystem_cards')
    const [result] = await pool.query<any>(
      'INSERT INTO about_ecosystem_cards(card_key,title,`lead`,body_html,sort_order,is_visible) VALUES (?,?,?,?,?,?)',
      [
        `custom-${crypto.randomUUID()}`, input.title, input.lead,
        input.bodyHtml === null ? null : sanitizeHtml(input.bodyHtml) || null,
        input.sortOrder ?? maxRows[0].maxOrder + 1, input.isVisible === false ? 0 : 1,
      ],
    )
    await recordAudit(req.user!.id, 'about.ecosystem_card.create', 'about_ecosystem_card', String(result.insertId), { title: input.title })
    await publishCurrentState(req.user!.id)
    res.status(201).json({ id: result.insertId })
  } catch (error) { next(error) }
})

aboutRouter.put('/ecosystem-cards/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const input = ecosystemCardUpdate.parse(req.body)
    const columns: string[] = []
    const values: unknown[] = []
    if (input.title !== undefined) { columns.push('title=?'); values.push(input.title) }
    if (input.lead !== undefined) { columns.push('`lead`=?'); values.push(input.lead) }
    if (input.bodyHtml !== undefined) {
      columns.push('body_html=?')
      values.push(input.bodyHtml === null ? null : sanitizeHtml(input.bodyHtml) || null)
    }
    if (input.sortOrder !== undefined) { columns.push('sort_order=?'); values.push(input.sortOrder) }
    if (input.isVisible !== undefined) { columns.push('is_visible=?'); values.push(input.isVisible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_ecosystem_cards SET ${columns.join(',')} WHERE id=?`, [...values, id])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Ecosystem card not found' })
    await recordAudit(req.user!.id, 'about.ecosystem_card.update', 'about_ecosystem_card', String(id), { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

aboutRouter.delete('/ecosystem-cards/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.id)
    const [result] = await pool.query<any>('DELETE FROM about_ecosystem_cards WHERE id=?', [id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Ecosystem card not found' })
    await recordAudit(req.user!.id, 'about.ecosystem_card.delete', 'about_ecosystem_card', String(id))
    await publishCurrentState(req.user!.id)
    res.status(204).end()
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
  linkUrl: z.string().trim().max(500).regex(/^(\/(?!\/)|https?:\/\/)/).nullable().optional(),
  buttonLabel: z.string().trim().max(120).nullable().optional(),
  visible: z.boolean().optional(),
}).strict()

const aboutSettingsInput = z.object({
  heroKicker: z.string().trim().max(100).optional(),
  heroTitle: z.string().trim().min(1).max(160).optional(),
  heroSubtitle: z.string().trim().max(500).optional(),
  heroImageAssetId: z.string().uuid().nullable().optional(),
  heroVisible: z.coerce.boolean().optional(),
  storyKicker: z.string().trim().max(100).optional(),
  storyHeading: z.string().trim().min(1).max(160).optional(),
  storyBodyHtml: z.string().max(50000).nullable().optional(),
  storyImageAssetId: z.string().uuid().nullable().optional(),
  storyImagePosition: z.enum(['left', 'right']).optional(),
  storyTags: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
  storyVisible: z.coerce.boolean().optional(),
  journeyKicker: z.string().trim().max(100).optional(),
  journeyHeading: z.string().trim().max(160).optional(),
  journeyVisible: z.coerce.boolean().optional(),
  ecosystemKicker: z.string().trim().max(100).optional(),
  ecosystemHeading: z.string().trim().max(160).optional(),
  ecosystemSubtitle: z.string().trim().max(500).optional(),
}).strict()

aboutRouter.put('/settings', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = aboutSettingsInput.parse(req.body)
    const assetIds = [input.heroImageAssetId, input.storyImageAssetId].filter((id): id is string => !!id)
    if (assetIds.length) {
      const placeholders = assetIds.map(() => '?').join(',')
      const [assets] = await pool.query<any[]>(`SELECT id FROM media_assets WHERE id IN (${placeholders})`, assetIds)
      if (assets.length !== new Set(assetIds).size) return res.status(400).json({ error: 'Media asset not found' })
    }

    const columns: string[] = []
    const values: unknown[] = []
    const fields: Record<string, [string, unknown]> = {
      heroKicker: ['hero_kicker', input.heroKicker],
      heroTitle: ['hero_title', input.heroTitle],
      heroSubtitle: ['hero_subtitle', input.heroSubtitle],
      heroImageAssetId: ['hero_image_asset_id', input.heroImageAssetId],
      heroVisible: ['hero_visible', input.heroVisible === undefined ? undefined : input.heroVisible ? 1 : 0],
      storyKicker: ['story_kicker', input.storyKicker],
      storyHeading: ['story_heading', input.storyHeading],
      storyBodyHtml: ['story_body_html', input.storyBodyHtml === null ? null : input.storyBodyHtml === undefined ? undefined : sanitizeHtml(input.storyBodyHtml) || null],
      storyImageAssetId: ['story_image_asset_id', input.storyImageAssetId],
      storyImagePosition: ['story_image_position', input.storyImagePosition],
      storyTags: ['story_tags', input.storyTags === undefined ? undefined : JSON.stringify(input.storyTags)],
      storyVisible: ['story_visible', input.storyVisible === undefined ? undefined : input.storyVisible ? 1 : 0],
      journeyKicker: ['journey_kicker', input.journeyKicker],
      journeyHeading: ['journey_heading', input.journeyHeading],
      journeyVisible: ['journey_visible', input.journeyVisible === undefined ? undefined : input.journeyVisible ? 1 : 0],
      ecosystemKicker: ['ecosystem_kicker', input.ecosystemKicker],
      ecosystemHeading: ['ecosystem_heading', input.ecosystemHeading],
      ecosystemSubtitle: ['ecosystem_subtitle', input.ecosystemSubtitle],
    }
    for (const [field, [column, value]] of Object.entries(fields)) {
      if (value !== undefined) { columns.push(`${column}=?`); values.push(value) }
    }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    await pool.query(`UPDATE about_settings SET ${columns.join(',')} WHERE id=1`, values)
    await recordAudit(req.user!.id, 'about.settings.update', 'about_settings', '1', { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

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
    if (input.linkUrl !== undefined) { columns.push('link_url=?'); values.push(input.linkUrl) }
    if (input.buttonLabel !== undefined) { columns.push('button_label=?'); values.push(input.buttonLabel) }
    if (input.visible !== undefined) { columns.push('visible=?'); values.push(input.visible ? 1 : 0) }
    if (!columns.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE about_sections SET ${columns.join(',')} WHERE section_key=?`, [...values, req.params.key])
    if (!result.affectedRows && !result.changedRows) return res.status(404).json({ error: 'Section not found' })

    if (req.params.key === 'hero' || req.params.key === 'foundation') {
      const settingsColumns: string[] = []
      const settingsValues: unknown[] = []
      const mapping = req.params.key === 'hero'
        ? [
          ['title', 'hero_title', input.title],
          ['subtitle', 'hero_subtitle', input.subtitle],
          ['visible', 'hero_visible', input.visible === undefined ? undefined : input.visible ? 1 : 0],
          ['imageAssetId', 'hero_image_asset_id', input.imageAssetId],
        ] as const
        : [
          ['title', 'story_heading', input.title],
          ['subtitle', 'story_kicker', input.subtitle],
          ['bodyHtml', 'story_body_html', input.bodyHtml === null ? null : input.bodyHtml === undefined ? undefined : sanitizeHtml(input.bodyHtml) || null],
          ['visible', 'story_visible', input.visible === undefined ? undefined : input.visible ? 1 : 0],
          ['imageAssetId', 'story_image_asset_id', input.imageAssetId],
          ['imagePosition', 'story_image_position', input.imagePosition],
        ] as const
      for (const [, column, value] of mapping) {
        if (value !== undefined) { settingsColumns.push(`${column}=?`); settingsValues.push(value) }
      }
      if (settingsColumns.length) await pool.query(`UPDATE about_settings SET ${settingsColumns.join(',')} WHERE id=1`, settingsValues)
    } else if (req.params.key === 'features' && input.subtitle !== undefined) {
      const tags = input.subtitle.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean)
      await pool.query('UPDATE about_settings SET story_tags=? WHERE id=1', [JSON.stringify(tags)])
    } else if ((req.params.key === 'vision' || req.params.key === 'mission') && (
      input.title !== undefined || input.bodyHtml !== undefined || input.visible !== undefined
    )) {
      const columns: string[] = []
      const values: unknown[] = []
      if (input.title !== undefined) { columns.push('title=?'); values.push(input.title) }
      if (input.bodyHtml !== undefined) {
        columns.push('body_html=?')
        values.push(input.bodyHtml === null ? null : sanitizeHtml(input.bodyHtml) || null)
      }
      if (input.visible !== undefined) { columns.push('is_visible=?'); values.push(input.visible ? 1 : 0) }
      values.push(req.params.key)
      await pool.query(`UPDATE about_vision_mission SET ${columns.join(',')} WHERE section_key=?`, values)
    }

    await recordAudit(req.user!.id, 'about.section.update', 'about_section', req.params.key, { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
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
  role: z.string().trim().max(160).optional(),
  badgeLabel: z.string().trim().max(120).optional(),
  isFeaturedMentor: z.coerce.boolean().optional(),
  bio: z.string().trim().max(1000).optional(),
  facebookUrl: z.string().trim().url().max(500).nullable().optional(),
  linkedinUrl: z.string().trim().url().max(500).nullable().optional(),
  instagramUrl: z.string().trim().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
}).strict()

const teamCreate = z.object({
  name: z.string().trim().min(1).max(120),
  designation: z.string().trim().max(120).default(''),
  role: z.string().trim().max(160).optional(),
  badgeLabel: z.string().trim().max(120).optional(),
  isFeaturedMentor: z.coerce.boolean().default(false),
  bio: z.string().trim().max(1000).default(''),
})

aboutRouter.post('/team', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = teamCreate.parse(req.body)
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM team_members')
    const role = input.role ?? input.designation
    await pool.query(
      'INSERT INTO team_members(id,name,designation,role,badge_label,bio,is_featured_mentor,sort_order) VALUES (?,?,?,?,?,?,?,?)',
      [id, input.name, role, role, input.badgeLabel ?? role, input.bio, input.isFeaturedMentor ? 1 : 0, maxRows[0].maxOrder + 1],
    )
    await recordAudit(req.user!.id, 'about.team.create', 'team_member', id, { name: input.name })
    await publishCurrentState(req.user!.id)
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

aboutRouter.put('/team/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = teamInput.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.name !== undefined) { set.push('name=?'); values.push(input.name) }
    if (input.role !== undefined || input.designation !== undefined) {
      const role = input.role ?? input.designation!
      set.push('role=?'); values.push(role)
      set.push('designation=?'); values.push(role)
    }
    if (input.badgeLabel !== undefined) { set.push('badge_label=?'); values.push(input.badgeLabel) }
    if (input.isFeaturedMentor !== undefined) { set.push('is_featured_mentor=?'); values.push(input.isFeaturedMentor ? 1 : 0) }
    if (input.bio !== undefined) { set.push('bio=?'); values.push(input.bio) }
    if (input.facebookUrl !== undefined) { set.push('facebook_url=?'); values.push(input.facebookUrl) }
    if (input.linkedinUrl !== undefined) { set.push('linkedin_url=?'); values.push(input.linkedinUrl) }
    if (input.instagramUrl !== undefined) { set.push('instagram_url=?'); values.push(input.instagramUrl) }
    if (input.sortOrder !== undefined) { set.push('sort_order=?'); values.push(input.sortOrder) }
    const isActive = input.isActive ?? input.active
    if (isActive !== undefined) { set.push('active=?'); values.push(isActive ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE team_members SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Team member not found' })
    await recordAudit(req.user!.id, 'about.team.update', 'team_member', req.params.id, { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
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
    await publishCurrentState(req.user!.id)
    res.json({ assetId: stored.id })
  } catch (error) { next(error) }
})

aboutRouter.delete('/team/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM team_members WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Team member not found' })
    await recordAudit(req.user!.id, 'about.team.delete', 'team_member', req.params.id)
    await publishCurrentState(req.user!.id)
    res.status(204).end()
  } catch (error) { next(error) }
})

const partnerInput = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  shortCode: z.string().trim().max(24).optional(),
  category: z.string().trim().max(120).optional(),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
}).strict()

const partnerCreate = z.object({
  name: z.string().trim().min(1).max(160),
  shortCode: z.string().trim().max(24).default(''),
  category: z.string().trim().max(120).default(''),
  websiteUrl: z.string().trim().url().max(500).nullable().default(null),
})

aboutRouter.post('/partners', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = partnerCreate.parse(req.body)
    const id = crypto.randomUUID()
    const [maxRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM event_partners')
    const shortCode = input.shortCode || input.name.match(/[A-Za-z0-9]+/g)?.slice(0, 3).map((part) => part[0]).join('').toUpperCase() || ''
    await pool.query('INSERT INTO event_partners(id,name,short_code,category,website_url,sort_order) VALUES (?,?,?,?,?,?)',
      [id, input.name, shortCode, input.category, input.websiteUrl, maxRows[0].maxOrder + 1])
    await recordAudit(req.user!.id, 'about.partner.create', 'event_partner', id, { name: input.name })
    await publishCurrentState(req.user!.id)
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

aboutRouter.put('/partners/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = partnerInput.parse(req.body)
    const set: string[] = []
    const values: unknown[] = []
    if (input.name !== undefined) { set.push('name=?'); values.push(input.name) }
    if (input.shortCode !== undefined) { set.push('short_code=?'); values.push(input.shortCode) }
    if (input.category !== undefined) { set.push('category=?'); values.push(input.category) }
    if (input.websiteUrl !== undefined) { set.push('website_url=?'); values.push(input.websiteUrl) }
    if (input.sortOrder !== undefined) { set.push('sort_order=?'); values.push(input.sortOrder) }
    const isActive = input.isActive ?? input.active
    if (isActive !== undefined) { set.push('active=?'); values.push(isActive ? 1 : 0) }
    if (!set.length) return res.status(400).json({ error: 'At least one field is required' })
    const [result] = await pool.query<any>(`UPDATE event_partners SET ${set.join(',')} WHERE id=?`, [...values, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Partner not found' })
    await recordAudit(req.user!.id, 'about.partner.update', 'event_partner', req.params.id, { fields: Object.keys(input) })
    await publishCurrentState(req.user!.id)
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
    await publishCurrentState(req.user!.id)
    res.json({ assetId: stored.id })
  } catch (error) { next(error) }
})

aboutRouter.delete('/partners/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM event_partners WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Partner not found' })
    await recordAudit(req.user!.id, 'about.partner.delete', 'event_partner', req.params.id)
    await publishCurrentState(req.user!.id)
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

async function publishCurrentState(actorId: string) {
  return withTransaction((db) => publishSnapshot(db, actorId))
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

adminAboutRouter.use(aboutRouter)
