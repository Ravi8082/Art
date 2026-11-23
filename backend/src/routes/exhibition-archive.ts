import crypto from 'node:crypto'
import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, requireRole, type AuthRequest } from '../middleware/auth.js'
import { recordAudit } from '../services/audit.js'
import { currentIndiaSqlDateTime, toIndiaSqlDateTime } from '../services/exhibition-schedule.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'

export const exhibitionArchiveRouter = Router()
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const uploadTypes = new Map([...supportedMediaTypes].filter(([type]) => imageTypes.has(type) || type === 'video/mp4'))
const uploadBody = raw({ type: [...uploadTypes.keys()], limit: '50mb' })
const manageArchive = [requireAuth, requireRole('ADMIN', 'SUPER_ADMIN'), requirePermission('content:manage')] as const

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Enter a valid edition date.')

const indiaDateTime = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/, 'Use an exact date and time in India Standard Time.')
  .refine((value) => {
    const dateTime = value.slice(0, 19)
    const parsed = new Date(`${dateTime}Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 19) === dateTime
  }, 'Enter a valid schedule date and time.')

const editionInput = z.object({
  title: z.string().trim().min(2).max(180),
  editionNumber: z.string().trim().max(40).default(''),
  city: z.string().trim().min(2).max(120),
  monthLabel: z.string().trim().min(2).max(80),
  startDate: dateOnly,
  endDate: dateOnly.nullable().default(null),
  venue: z.string().trim().min(2).max(220),
  artistCount: z.coerce.number().int().min(0).max(5000).default(0),
}).strict().refine((value) => !value.endDate || value.endDate >= value.startDate, {
  message: 'The edition end date cannot be before its start date.',
  path: ['endDate'],
})

const upcomingEditionInput = z.object({
  title: z.string().trim().min(2).max(180),
  scheduleLabel: z.string().trim().min(2).max(100),
  cityLabel: z.string().trim().min(2).max(180),
  venue: z.string().trim().max(220).default(''),
  startDate: indiaDateTime,
  endDate: indiaDateTime.nullable(),
  statusLabel: z.string().trim().min(2).max(100),
  published: z.boolean().default(true),
  showOnGallery: z.boolean().default(true),
}).strict().refine((value) => !value.endDate || Date.parse(value.endDate) >= Date.parse(value.startDate), {
  message: 'The end date and time cannot be before the start date and time.',
  path: ['endDate'],
})

const mediaInput = z.object({
  caption: z.string().trim().min(2).max(240),
  artistName: z.string().trim().max(140).default(''),
  stallName: z.string().trim().max(80).default(''),
  altText: z.string().trim().max(255).default(''),
}).strict()

const youtubeInput = mediaInput.extend({
  url: z.string().trim().url().max(1024),
  durationSeconds: z.number().int().min(0).max(3600).nullable().default(null),
}).strict()

function decodeHeader(req: AuthRequest, name: string) {
  const value = req.get(name) ?? ''
  try { return decodeURIComponent(value) } catch { return value }
}

function youtubeEmbedUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let videoId = ''
    if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? ''
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      videoId = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1] ?? ''
    }
    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
  } catch {
    return null
  }
}

async function archiveExpiredUpcomingEditions() {
  const connection = await pool.getConnection()
  const now = currentIndiaSqlDateTime()
  try {
    await connection.beginTransaction()
    const [expired] = await connection.query<any[]>(`
      SELECT id, edition_key editionKey, title, city_label city, venue,
             DATE_FORMAT(start_date, '%Y-%m-%d') startDate,
             DATE_FORMAT(end_date, '%Y-%m-%d') endDate
      FROM gallery_upcoming_editions
      WHERE published=1 AND show_on_gallery=1 AND end_date IS NOT NULL
        AND end_date < ? AND archive_edition_id IS NULL
      ORDER BY id
      FOR UPDATE`, [now])

    for (const edition of expired) {
      const [existing] = await connection.query<any[]>(
        'SELECT id FROM exhibition_archive_editions WHERE city=? AND start_date=? LIMIT 1',
        [edition.city, edition.startDate],
      )
      let archiveId: string
      if (existing[0]) {
        archiveId = existing[0].id
      } else {
        archiveId = crypto.randomUUID()
        const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(`${edition.startDate}T00:00:00Z`))
        const editionKey = `upcoming-${String(edition.editionKey).slice(0, 78)}-${String(edition.id).slice(0, 8)}`
        await connection.query(`
          INSERT INTO exhibition_archive_editions
            (id, edition_key, title, edition_number, city, month_label, start_date, end_date,
             date_is_exact, venue, artist_count, sort_order, published)
          VALUES (?, ?, ?, '', ?, ?, ?, ?, 1, ?, 0, 0, 1)`,
        [archiveId, editionKey, edition.title, edition.city, monthLabel, edition.startDate, edition.endDate, edition.venue || edition.city])
      }

      await connection.query(
        'UPDATE gallery_upcoming_editions SET archive_edition_id=? WHERE id=? AND archive_edition_id IS NULL',
        [archiveId, edition.id],
      )
    }

    const [expiredEvents] = await connection.query<any[]>(`
      SELECT e.id, e.title, e.city, e.venue,
             DATE_FORMAT(e.starts_at, '%Y-%m-%d') startDate,
             DATE_FORMAT(e.ends_at, '%Y-%m-%d') endDate
      FROM events e
      WHERE e.status IN ('PUBLISHED','APPROVED') AND e.ends_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM exhibition_archive_editions archived
          WHERE archived.edition_key=CONCAT('event-', e.id)
        )
      ORDER BY e.ends_at ASC, e.id ASC
      FOR UPDATE`, [now])

    for (const event of expiredEvents) {
      const eventCity = String(event.city ?? '').trim()
      const firstCity = eventCity.split(/[,;/]|\band\b/i)[0]?.trim()
      const city = (/^(?:pan )?india\b/i.test(eventCity)
        ? 'India'
        : firstCity) || 'India'
      const startDate = String(event.startDate)
      const endDate = String(event.endDate)
      const [existing] = await connection.query<any[]>(
        'SELECT id FROM exhibition_archive_editions WHERE edition_key=? OR (city=? AND start_date=?) LIMIT 1',
        [`event-${event.id}`, city.slice(0, 120), startDate],
      )
      let archiveId: string
      if (existing[0]) {
        archiveId = existing[0].id
      } else {
        archiveId = crypto.randomUUID()
        const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(`${startDate}T00:00:00Z`))
        await connection.query(`
          INSERT INTO exhibition_archive_editions
            (id, edition_key, title, edition_number, city, month_label, start_date, end_date,
             date_is_exact, venue, artist_count, sort_order, published)
          VALUES (?, ?, ?, '', ?, ?, ?, ?, 1, ?, 0, 0, 1)`,
        [archiveId, `event-${event.id}`, String(event.title).slice(0, 180), city.slice(0, 120), monthLabel,
          startDate, endDate, String(event.venue || city).slice(0, 220)])
      }

      const [mediaRows] = await connection.query<any[]>(`
        SELECT id, url, alt_text altText, media_type mediaType, mime_type mimeType,
               byte_size byteSize, data, sort_order sortOrder
        FROM event_media
        WHERE event_id=?
        ORDER BY sort_order ASC, id ASC`, [event.id])
      for (const media of mediaRows) {
        const sourceType = media.data ? 'UPLOAD' : media.url ? 'ASSET' : null
        if (!sourceType) continue
        await connection.query(`
          INSERT INTO exhibition_archive_media
            (id, media_key, edition_id, media_type, source_type, source_url, mime_type,
             file_size, file_data, caption, alt_text, sort_order, published)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE media_key=VALUES(media_key)`,
        [crypto.randomUUID(), `event-${event.id}-${media.id}`, archiveId, media.mediaType, sourceType,
          sourceType === 'ASSET' ? media.url : null, media.mimeType || null, media.byteSize || null,
          sourceType === 'UPLOAD' ? media.data : null, String(media.altText || event.title).slice(0, 240),
          String(media.altText || event.title).slice(0, 255), Number(media.sortOrder) || 0])
      }
    }

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function archivePayload() {
  await archiveExpiredUpcomingEditions()
  const [editionRows] = await pool.query<any[]>(`
    SELECT id, edition_key editionKey, title, edition_number editionNumber, city, month_label monthLabel,
           DATE_FORMAT(start_date, '%Y-%m-%d') startDate, DATE_FORMAT(end_date, '%Y-%m-%d') endDate,
           date_is_exact dateIsExact, venue,
           artist_count artistCount
    FROM exhibition_archive_editions
    WHERE published = 1
    ORDER BY start_date IS NULL, start_date DESC, city ASC, id ASC`)
  if (!editionRows.length) return []

  const [mediaRows] = await pool.query<any[]>(`
    SELECT id, edition_id editionId, media_type mediaType, source_type sourceType,
           source_url sourceUrl, mime_type mimeType, caption, artist_name artistName,
           stall_name stallName, alt_text altText, duration_seconds durationSeconds,
           sort_order sortOrder
    FROM exhibition_archive_media
    WHERE published = 1 AND edition_id IN (${editionRows.map(() => '?').join(',')})
    ORDER BY sort_order, created_at DESC`, editionRows.map((edition) => edition.id))

  const mediaByEdition = new Map<string, any[]>()
  for (const media of mediaRows) {
    const items = mediaByEdition.get(media.editionId) ?? []
    items.push({
      ...media,
      durationSeconds: media.durationSeconds === null ? null : Number(media.durationSeconds),
      url: media.sourceType === 'ASSET' ? media.sourceUrl : `/api/exhibition-archive/media/${media.id}`,
      embedUrl: media.sourceType === 'YOUTUBE' ? media.sourceUrl : null,
    })
    mediaByEdition.set(media.editionId, items)
  }

  return editionRows.map((edition) => ({
    ...edition,
    artistCount: Number(edition.artistCount),
    dateIsExact: Boolean(Number(edition.dateIsExact)),
    media: mediaByEdition.get(edition.id) ?? [],
  }))
}

async function upcomingEditionsPayload(includeUnpublished = false) {
  if (!includeUnpublished) await archiveExpiredUpcomingEditions()
  const [rows] = await pool.query<any[]>(`
    SELECT id, edition_key editionKey, title, schedule_label scheduleLabel, city_label cityLabel,
           venue,
           CONCAT(DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s'), '+05:30') startDate,
           IF(end_date IS NULL, NULL, CONCAT(DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s'), '+05:30')) endDate,
           status_label statusLabel, published, show_on_gallery showOnGallery
    FROM gallery_upcoming_editions
    ${includeUnpublished ? '' : 'WHERE published=1 AND show_on_gallery=1 AND end_date IS NOT NULL AND end_date >= ?'}
    ORDER BY start_date ASC, sort_order ASC, created_at ASC`,
  includeUnpublished ? [] : [currentIndiaSqlDateTime()])
  return rows.map((row) => ({
    ...row,
    published: Boolean(Number(row.published)),
    showOnGallery: Boolean(Number(row.showOnGallery)),
  }))
}

exhibitionArchiveRouter.get('/', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await archivePayload())
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.get('/upcoming', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await upcomingEditionsPayload())
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.get('/upcoming/manage', ...manageArchive, async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store')
    res.json(await upcomingEditionsPayload(true))
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.post('/upcoming', ...manageArchive, async (req: AuthRequest, res, next) => {
  try {
    const input = upcomingEditionInput.parse(req.body)
    const id = crypto.randomUUID()
    const titleKey = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
    const editionKey = `${titleKey}-${id.slice(0, 8)}`
    const [orderRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM gallery_upcoming_editions')
    await pool.query(`
      INSERT INTO gallery_upcoming_editions
        (id, edition_key, title, schedule_label, city_label, venue, start_date, end_date, status_label, sort_order, published, show_on_gallery, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, editionKey, input.title, input.scheduleLabel, input.cityLabel, input.venue, toIndiaSqlDateTime(input.startDate),
      input.endDate ? toIndiaSqlDateTime(input.endDate) : null, input.statusLabel,
      Number(orderRows[0].maxOrder) + 1, input.published ? 1 : 0, input.showOnGallery ? 1 : 0, req.user!.id])
    await recordAudit(req.user!.id, 'gallery.upcoming.create', 'gallery_upcoming_edition', id, { editionKey, startDate: input.startDate })
    const [rows] = await pool.query<any[]>(`
      SELECT id, edition_key editionKey, title, schedule_label scheduleLabel, city_label cityLabel,
             venue,
             CONCAT(DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s'), '+05:30') startDate,
             IF(end_date IS NULL, NULL, CONCAT(DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s'), '+05:30')) endDate,
             status_label statusLabel, published, show_on_gallery showOnGallery
      FROM gallery_upcoming_editions WHERE id=?`, [id])
    res.status(201).json({
      ...rows[0],
      published: Boolean(Number(rows[0].published)),
      showOnGallery: Boolean(Number(rows[0].showOnGallery)),
    })
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.put('/upcoming/:id', ...manageArchive, async (req: AuthRequest, res, next) => {
  try {
    const input = upcomingEditionInput.parse(req.body)
    const [existing] = await pool.query<any[]>(`
      SELECT id, archive_edition_id archiveEditionId,
             DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s') startLocal,
             DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s') endLocal
      FROM gallery_upcoming_editions WHERE id=? LIMIT 1`, [req.params.id])
    if (!existing[0]) return res.status(404).json({ error: 'Upcoming edition not found.' })
    if (
      existing[0].archiveEditionId
      && (existing[0].startLocal !== input.startDate.slice(0, 19)
        || existing[0].endLocal !== (input.endDate?.slice(0, 19) ?? null))
    ) return res.status(409).json({ error: 'This edition has moved to the archive; its schedule dates can no longer be changed.' })
    await pool.query(`
      UPDATE gallery_upcoming_editions
      SET title=?, schedule_label=?, city_label=?, venue=?, start_date=?, end_date=?, status_label=?, published=?, show_on_gallery=?
      WHERE id=?`,
    [input.title, input.scheduleLabel, input.cityLabel, input.venue, toIndiaSqlDateTime(input.startDate),
      input.endDate ? toIndiaSqlDateTime(input.endDate) : null, input.statusLabel,
      input.published ? 1 : 0, input.showOnGallery ? 1 : 0, req.params.id])
    await recordAudit(req.user!.id, 'gallery.upcoming.update', 'gallery_upcoming_edition', req.params.id, { startDate: input.startDate, published: input.published })
    const [rows] = await pool.query<any[]>(`
      SELECT id, edition_key editionKey, title, schedule_label scheduleLabel, city_label cityLabel,
             venue,
             CONCAT(DATE_FORMAT(start_date, '%Y-%m-%dT%H:%i:%s'), '+05:30') startDate,
             IF(end_date IS NULL, NULL, CONCAT(DATE_FORMAT(end_date, '%Y-%m-%dT%H:%i:%s'), '+05:30')) endDate,
             status_label statusLabel, published, show_on_gallery showOnGallery
      FROM gallery_upcoming_editions WHERE id=?`, [req.params.id])
    res.json({
      ...rows[0],
      published: Boolean(Number(rows[0].published)),
      showOnGallery: Boolean(Number(rows[0].showOnGallery)),
    })
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.get('/media/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT media.mime_type mimeType, media.file_data fileData
      FROM exhibition_archive_media media
      JOIN exhibition_archive_editions edition ON edition.id=media.edition_id
      WHERE media.id=? AND media.published=1 AND edition.published=1
        AND media.source_type='UPLOAD'`, [req.params.id])
    if (!rows[0]?.fileData) return res.status(404).json({ error: 'Exhibition media not found' })
    res.set('Content-Type', rows[0].mimeType)
    res.set('Cache-Control', 'public, max-age=3600')
    res.set('X-Content-Type-Options', 'nosniff')
    res.send(rows[0].fileData)
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.post('/editions', ...manageArchive, async (req: AuthRequest, res, next) => {
  try {
    const input = editionInput.parse(req.body)
    const id = crypto.randomUUID()
    const editionKey = `${input.city}-${input.startDate}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const [existing] = await pool.query<any[]>('SELECT id FROM exhibition_archive_editions WHERE city=? AND start_date=? LIMIT 1', [input.city, input.startDate])
    if (existing[0]) return res.status(409).json({ error: 'An edition with this city and start date already exists.' })
    const [orderRows] = await pool.query<any[]>('SELECT COALESCE(MAX(sort_order),0) maxOrder FROM exhibition_archive_editions')
    await pool.query(`
      INSERT INTO exhibition_archive_editions
        (id, edition_key, title, edition_number, city, month_label, start_date, end_date, date_is_exact, venue, artist_count, sort_order, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)`,
    [id, editionKey, input.title, input.editionNumber, input.city, input.monthLabel, input.startDate, input.endDate, input.venue, input.artistCount, Number(orderRows[0].maxOrder) + 1])
    await recordAudit(req.user!.id, 'exhibition_archive.edition.create', 'exhibition_archive_edition', id, { editionKey, title: input.title, startDate: input.startDate })
    res.status(201).json({ id, editionKey, ...input, media: [] })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An edition with this city and start date already exists.' })
    }
    next(error)
  }
})

exhibitionArchiveRouter.post('/editions/:id/media', ...manageArchive, uploadBody, async (req: AuthRequest, res, next) => {
  try {
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
    const mediaType = contentType ? uploadTypes.get(contentType) : undefined
    if (!contentType || !mediaType) return res.status(415).json({ error: 'Use a JPG, PNG, WebP image or MP4 video.' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Choose a media file to upload.' })
    if (!hasValidMediaSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its media type.' })
    const input = mediaInput.parse({
      caption: decodeHeader(req, 'x-caption'),
      artistName: decodeHeader(req, 'x-artist-name'),
      stallName: decodeHeader(req, 'x-stall-name'),
      altText: decodeHeader(req, 'x-alt-text'),
    })
    const rawDuration = decodeHeader(req, 'x-duration-seconds')
    const durationSeconds = rawDuration
      ? z.coerce.number().int().min(0).max(3600).parse(rawDuration)
      : null
    const [editions] = await pool.query<any[]>('SELECT id FROM exhibition_archive_editions WHERE id=? AND published=1 LIMIT 1', [req.params.id])
    if (!editions[0]) return res.status(404).json({ error: 'Exhibition edition not found.' })

    const id = crypto.randomUUID()
    const mediaKey = `upload-${id}`
    await pool.query(`
      INSERT INTO exhibition_archive_media
        (id, media_key, edition_id, media_type, source_type, mime_type, file_size, file_data,
         caption, artist_name, stall_name, alt_text, duration_seconds, uploaded_by, published)
      VALUES (?, ?, ?, ?, 'UPLOAD', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, mediaKey, req.params.id, mediaType, contentType, req.body.length, req.body,
      input.caption, input.artistName, input.stallName, input.altText, durationSeconds, req.user!.id])
    await recordAudit(req.user!.id, 'exhibition_archive.media.upload', 'exhibition_archive_media', id, { mediaType, byteSize: req.body.length })
    res.status(201).json({
      id, editionId: req.params.id, mediaType, sourceType: 'UPLOAD',
      mimeType: contentType, ...input, durationSeconds,
      url: `/api/exhibition-archive/media/${id}`, embedUrl: null,
    })
  } catch (error) {
    next(error)
  }
})

exhibitionArchiveRouter.post('/editions/:id/videos', ...manageArchive, async (req: AuthRequest, res, next) => {
  try {
    const input = youtubeInput.parse(req.body)
    const embedUrl = youtubeEmbedUrl(input.url)
    if (!embedUrl) return res.status(400).json({ error: 'Enter a valid YouTube video or Shorts URL.' })
    const [editions] = await pool.query<any[]>('SELECT id FROM exhibition_archive_editions WHERE id=? AND published=1 LIMIT 1', [req.params.id])
    if (!editions[0]) return res.status(404).json({ error: 'Exhibition edition not found.' })
    const id = crypto.randomUUID()
    await pool.query(`
      INSERT INTO exhibition_archive_media
        (id, media_key, edition_id, media_type, source_type, source_url, caption, artist_name,
         stall_name, alt_text, duration_seconds, uploaded_by, published)
      VALUES (?, ?, ?, 'VIDEO', 'YOUTUBE', ?, ?, ?, ?, ?, ?, ?, 1)`,
    [id, `youtube-${id}`, req.params.id, embedUrl, input.caption, input.artistName, input.stallName,
      input.altText, input.durationSeconds, req.user!.id])
    await recordAudit(req.user!.id, 'exhibition_archive.video.add', 'exhibition_archive_media', id, { provider: 'youtube' })
    res.status(201).json({
      id, editionId: req.params.id, mediaType: 'VIDEO', sourceType: 'YOUTUBE',
      sourceUrl: embedUrl, caption: input.caption, artistName: input.artistName,
      stallName: input.stallName, altText: input.altText,
      durationSeconds: input.durationSeconds, url: null, embedUrl,
    })
  } catch (error) {
    next(error)
  }
})
