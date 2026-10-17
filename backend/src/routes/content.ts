import crypto from 'node:crypto'
import { raw, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature, supportedMediaTypes } from '../services/media-validation.js'
import { queueEmail } from '../services/mailer.js'
import { insertEnquiry, notifyEnquiryCreation } from './enquiries.js'
import { notifyNewsletterSubscribers } from './newsletter.js'

export const contentRouter = Router()

const textKeys = [
  'heroKicker', 'heroLine1', 'heroAccent', 'heroIntro',
  'featuredKicker', 'featuredLine1', 'featuredAccent',
  'statementLine1', 'statementAccent', 'statementText',
  'footerLocations',
  'contactHeroTitle', 'contactHeroAccent', 'contactHeroIntro',
  'contactAddress', 'contactPhone', 'contactEmail', 'contactHours',
  'contactMapUrl', 'contactInstagram', 'contactFacebook', 'contactLinkedin',
  'contactPartnersTitle', 'contactPartnersText', 'contactNotice',
] as const

const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const manage = [requireAuth, requirePermission('content:manage')] as const
const blogPublish = [requireAuth, requirePermission('content:publish')] as const
const imageBody = raw({ type: imageTypes, limit: '50mb' })
const blogSubmissionLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false })

function readImage(req: AuthRequest) {
  const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType || !imageTypes.includes(contentType)) return { error: 'Only JPG, PNG, WebP or GIF images are allowed', status: 415 }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return { error: 'Image file is required', status: 400 }
  if (!hasValidMediaSignature(contentType, req.body)) return { error: 'File content does not match its media type', status: 415 }
  return { contentType, data: req.body as Buffer }
}

function header(req: AuthRequest, name: string) {
  const value = req.get(name)
  if (!value) return ''
  try { return decodeURIComponent(value) } catch { return value }
}

contentRouter.get('/', async (_req, res, next) => {
  try {
    const [textRows] = await pool.query<any[]>('SELECT content_key k, content_value v FROM site_content')
    const [artists] = await pool.query<any[]>('SELECT id, name, city, bio, photo_mime IS NOT NULL hasPhoto FROM artists ORDER BY created_at, id')
    const [artworks] = await pool.query<any[]>('SELECT id, title, description, artist_name artistName, artist_id artistId FROM artworks ORDER BY created_at DESC, id')
    res.json({
      text: Object.fromEntries(textRows.map((row) => [row.k, row.v])),
      artists: artists.map((a) => ({ id: a.id, name: a.name, city: a.city, bio: a.bio, photoUrl: a.hasPhoto ? `/api/content/artists/${a.id}/photo` : null })),
      artworks: artworks.map((a) => ({ id: a.id, title: a.title, description: a.description, artistName: a.artistName, artistId: a.artistId, url: `/api/content/artworks/${a.id}/image` })),
    })
  } catch (error) { next(error) }
})

contentRouter.put('/text', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const shape = Object.fromEntries(textKeys.map((key) => [key, z.string().trim().max(1000).optional()]))
    const input = z.object(shape).strict().parse(req.body) as Record<string, string | undefined>
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue
      if (value === '') await pool.query('DELETE FROM site_content WHERE content_key=?', [key])
      else await pool.query('INSERT INTO site_content(content_key,content_value) VALUES (?,?) ON DUPLICATE KEY UPDATE content_value=VALUES(content_value)', [key, value])
    }
    res.status(204).end()
  } catch (error) { next(error) }
})

contentRouter.post('/artists', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(1).max(120),
      city: z.string().trim().max(120).default(''),
      bio: z.string().trim().max(500).default(''),
    }).parse(req.body)
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO artists(id,name,city,bio) VALUES (?,?,?,?)', [id, input.name, input.city, input.bio])
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

contentRouter.put('/artists/:id/photo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const image = readImage(req)
    if ('error' in image) return res.status(image.status ?? 400).json({ error: image.error })
    const [result] = await pool.query<any>('UPDATE artists SET photo_mime=?, photo_data=? WHERE id=?', [image.contentType, image.data, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Artist not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

contentRouter.get('/artists/:id/photo', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT photo_mime mime, photo_data data FROM artists WHERE id=? AND photo_data IS NOT NULL', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Photo not found' })
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'public, max-age=300')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})

contentRouter.delete('/artists/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM artists WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Artist not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

contentRouter.post('/artworks', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const image = readImage(req)
    if ('error' in image) return res.status(image.status ?? 400).json({ error: image.error })
    const meta = z.object({
      title: z.string().trim().min(1).max(160),
      artistName: z.string().trim().max(120),
      artistId: z.string().uuid().nullable(),
      description: z.string().trim().max(500),
    }).safeParse({ title: header(req, 'x-title'), artistName: header(req, 'x-artist'), artistId: header(req, 'x-artist-id') || null, description: header(req, 'x-description') })
    if (!meta.success) return res.status(400).json({ error: 'x-title header is required' })
    let artistName = meta.data.artistName
    if (meta.data.artistId) {
      const [artists] = await pool.query<any[]>('SELECT name FROM artists WHERE id=?', [meta.data.artistId])
      if (!artists[0]) return res.status(400).json({ error: 'Artist not found' })
      artistName = artists[0].name
    }
    const id = crypto.randomUUID()
    await pool.query('INSERT INTO artworks(id,title,description,artist_name,artist_id,mime_type,data,byte_size) VALUES (?,?,?,?,?,?,?,?)', [id, meta.data.title, meta.data.description, artistName, meta.data.artistId, image.contentType, image.data, image.data.length])
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

contentRouter.get('/artworks/:id/image', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT mime_type mime, data FROM artworks WHERE id=?', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Artwork not found' })
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'public, max-age=300')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})

contentRouter.delete('/artworks/:id', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM artworks WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Artwork not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

contentRouter.get('/blog', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT id, title, excerpt, author, cover_mime IS NOT NULL hasCover, published_at publishedAt FROM blog_posts WHERE status='APPROVED' ORDER BY published_at DESC, id")
    res.json({ posts: rows.map(blogSummary) })
  } catch (error) { next(error) }
})

contentRouter.get('/blog/admin', ...blogPublish, async (req, res, next) => {
  try {
    const status = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL']).default('PENDING').parse(req.query.status)
    const [rows] = await pool.query<any[]>(
      `SELECT id, title, excerpt, body, author, submitter_email email, status, review_note reviewNote,
              submitted_at submittedAt, reviewed_at reviewedAt
       FROM blog_posts ${status === 'ALL' ? '' : 'WHERE status=?'}
       ORDER BY CASE WHEN status='PENDING' THEN 0 ELSE 1 END, submitted_at DESC`,
      status === 'ALL' ? [] : [status],
    )
    res.json({ posts: rows })
  } catch (error) { next(error) }
})

contentRouter.get('/blog/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT id, title, excerpt, body, author, cover_mime IS NOT NULL hasCover, published_at publishedAt FROM blog_posts WHERE id=? AND status='APPROVED'", [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Post not found' })
    res.json({ ...blogSummary(rows[0]), body: rows[0].body })
  } catch (error) { next(error) }
})

contentRouter.get('/blog/:id/cover', async (req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT cover_mime mime, cover_data data FROM blog_posts WHERE id=? AND status='APPROVED' AND cover_data IS NOT NULL", [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Cover not found' })
    res.set('Content-Type', rows[0].mime)
    res.set('Cache-Control', 'public, max-age=300')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})

contentRouter.post('/blog/submissions', blogSubmissionLimit, async (req, res, next) => {
  try {
    const input = z.object({
      title: z.string().trim().min(1).max(200),
      excerpt: z.string().trim().max(400).default(''),
      body: z.string().trim().min(1).max(20000),
      author: z.string().trim().min(1).max(120),
      email: z.string().trim().toLowerCase().email().max(255),
    }).strict().parse(req.body)
    const id = crypto.randomUUID()
    await pool.query(
      "INSERT INTO blog_posts(id,title,excerpt,body,author,submitter_email,status) VALUES (?,?,?,?,?,?,'PENDING')",
      [id, input.title, input.excerpt, input.body, input.author, input.email],
    )
    res.status(201).json({ id, status: 'PENDING' })
  } catch (error) { next(error) }
})

contentRouter.patch('/blog/:id/review', ...blogPublish, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      decision: z.enum(['APPROVED', 'REJECTED']),
      reviewNote: z.string().trim().max(1000).default(''),
    }).strict().parse(req.body)
    const [result] = await pool.query<any>(
      `UPDATE blog_posts
       SET status=?, review_note=?, reviewed_by=?, reviewed_at=NOW(),
           published_at=IF(?='APPROVED',NOW(),published_at)
       WHERE id=? AND status='PENDING'`,
      [input.decision, input.reviewNote || null, req.user!.id, input.decision, req.params.id],
    )
    if (!result.affectedRows) {
      const [posts] = await pool.query<any[]>('SELECT id FROM blog_posts WHERE id=?', [req.params.id])
      return res.status(posts.length ? 409 : 404).json({ error: posts.length ? 'This blog has already been reviewed' : 'Blog post not found' })
    }

    const [rows] = await pool.query<any[]>(
      'SELECT id, title, author, submitter_email email, excerpt FROM blog_posts WHERE id=?',
      [req.params.id],
    )
    const post = rows[0]
    let emailStatus: 'SENT' | 'NOT_CONFIGURED' | 'FAILED' = 'FAILED'
    try {
      const articleUrl = new URL(`/blog/${encodeURIComponent(post.id)}`, process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').toString()
      const approved = input.decision === 'APPROVED'
      const text = approved
        ? `Hi ${post.author},\n\nYour blog post "${post.title}" has been approved and is now published on The Haat of Art.\n\nRead it here: ${articleUrl}\n\nThank you for sharing your story with our community.`
        : `Hi ${post.author},\n\nThank you for submitting "${post.title}" to The Haat of Art. Unfortunately, this post was not approved for publication.${input.reviewNote ? `\n\nReview note: ${input.reviewNote}` : ''}\n\nYou are welcome to revise it and submit it again.`
      const delivery = await queueEmail(
        post.email,
        approved ? 'Your Haat of Art blog is approved' : 'An update about your Haat of Art blog',
        text,
      )
      emailStatus = delivery.delivered ? 'SENT' : delivery.reason === 'SMTP not configured' ? 'NOT_CONFIGURED' : 'FAILED'
    } catch (error) {
      console.error('Blog moderation email failed', { postId: post.id, error })
    }

    if (input.decision === 'APPROVED') {
      void notifyNewsletterSubscribers({ id: post.id, title: post.title, excerpt: post.excerpt })
        .catch((error) => console.error('Newsletter dispatch failed for approved blog post', { postId: post.id, error }))
    }
    res.json({ id: post.id, status: input.decision, emailStatus })
  } catch (error) { next(error) }
})

contentRouter.post('/blog', ...blogPublish, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      title: z.string().trim().min(1).max(200),
      excerpt: z.string().trim().max(400).default(''),
      body: z.string().trim().min(1).max(20000),
      author: z.string().trim().max(120).default(''),
    }).parse(req.body)
    const id = crypto.randomUUID()
    await pool.query("INSERT INTO blog_posts(id,title,excerpt,body,author,status,published_at) VALUES (?,?,?,?,?,'APPROVED',NOW())", [id, input.title, input.excerpt, input.body, input.author])
    void notifyNewsletterSubscribers({ id, title: input.title, excerpt: input.excerpt })
      .catch((error) => console.error('Newsletter dispatch failed for published blog post', { postId: id, error }))
    res.status(201).json({ id })
  } catch (error) { next(error) }
})

contentRouter.put('/blog/:id/cover', ...blogPublish, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const image = readImage(req)
    if ('error' in image) return res.status(image.status ?? 400).json({ error: image.error })
    const [result] = await pool.query<any>('UPDATE blog_posts SET cover_mime=?, cover_data=? WHERE id=?', [image.contentType, image.data, req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Post not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

contentRouter.delete('/blog/:id', ...blogPublish, async (req: AuthRequest, res, next) => {
  try {
    const [result] = await pool.query<any>('DELETE FROM blog_posts WHERE id=?', [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ error: 'Post not found' })
    res.status(204).end()
  } catch (error) { next(error) }
})

function blogSummary(row: any) {
  return { id: row.id, title: row.title, excerpt: row.excerpt, author: row.author, publishedAt: row.publishedAt, coverUrl: row.hasCover ? `/api/content/blog/${row.id}/cover` : null }
}

const contactLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false })

contentRouter.post('/contact', contactLimit, async (req, res, next) => {
  try {
    const input = z.object({
      name: z.string().trim().min(1).max(160),
      email: z.string().trim().toLowerCase().email().max(255),
      message: z.string().trim().min(5).max(3000),
    }).parse(req.body)
    const subject = input.message.slice(0, 200)
    const [duplicates] = await pool.query<any[]>(
      "SELECT ref_code refCode FROM contact_enquiries WHERE email=? AND subject=? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1",
      [input.email, subject])
    if (duplicates[0]) return res.status(200).json({ ok: true, refCode: duplicates[0].refCode })
    const enquiry = await insertEnquiry({ name: input.name, email: input.email, subject, message: input.message })
    notifyEnquiryCreation(enquiry.refCode, { name: input.name, email: input.email, subject })
    res.status(201).json({ ok: true, refCode: enquiry.refCode })
  } catch (error) { next(error) }
})
