import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { cachePublic } from '../middleware/cache.js'
import { recordAudit } from '../services/audit.js'

export const siteSettingsRouter = Router()
export const highlightsRouter = Router()
export const contactSettingsRouter = Router()

const manage = [requireAuth, requirePermission('content:manage')] as const
const text = (max: number) => z.string().trim().max(max)
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #ee4b12')
// Links stay on-site or http(s); this blocks javascript: URLs being injected into the navbar or footer.
const href = z.string().trim().min(1).max(300).refine((value) => /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(value), 'Link must start with /, #, http(s)://, mailto: or tel:')
const link = z.object({ label: text(60).min(1), href })
const optionalUrl = z.union([z.literal(''), z.string().trim().max(300).regex(/^https?:\/\//i, 'Use a full https:// link')])
const homepageIcon = z.enum(['calendar', 'users', 'accessibility', 'palette', 'image', 'landmark', 'brush', 'archive'])
const defaultHomepageVisibility = {
  hero: true,
  upcomingExhibitions: true,
  exploreArtSpaces: true,
  featuredArtists: true,
  aboutStory: true,
  leadership: true,
  impact: true,
  invitedGuests: true,
  valueProposition: true,
  eventHighlights: true,
  gallery: true,
  communityTestimonials: true,
  venuePartners: true,
  mediaAlliances: true,
}
const homepageContentSchema = z.object({
  heroFeatures: z.array(z.object({ icon: homepageIcon, title: text(80).min(1), subtitle: text(80) })).length(4),
  categories: z.array(z.object({ icon: homepageIcon, title: text(60).min(1), href })).length(6),
  visibility: z.object({
    hero: z.boolean(),
    upcomingExhibitions: z.boolean(),
    exploreArtSpaces: z.boolean(),
    featuredArtists: z.boolean(),
    aboutStory: z.boolean(),
    leadership: z.boolean(),
    impact: z.boolean(),
    invitedGuests: z.boolean(),
    valueProposition: z.boolean(),
    eventHighlights: z.boolean(),
    gallery: z.boolean(),
    communityTestimonials: z.boolean(),
    venuePartners: z.boolean(),
    mediaAlliances: z.boolean(),
  }).default(defaultHomepageVisibility),
  mentor: z.object({ visible: z.boolean(), name: text(120), title: text(80), bio: text(300) }),
  impact: z.array(z.object({ value: text(40).min(1), label: text(80).min(1) })).max(5),
  highlights: z.array(z.object({ title: text(80).min(1), description: text(240) })).max(5),
  testimonials: z.array(z.object({ authorName: text(120).min(1), authorRole: text(160), message: text(900).min(4) })).max(5),
  venuePartners: z.array(z.object({ name: text(160).min(1) })).max(5),
})
const galleryConfigSchema = z.object({ showCuratedArtworks: z.boolean() }).strict()
const defaultGalleryConfig = { showCuratedArtworks: false }
const defaultContactDetails = {
  address: 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India',
  phones: ['+91 7304645333', '+91 8779798244'],
  email: 'contact@thehaatofart.com',
  hours: 'Mon – Sat: 10:00 AM – 6:00 PM',
}
const contactSocialFields = [
  ['Instagram', 'contactInstagram'],
  ['Facebook', 'contactFacebook'],
  ['LinkedIn', 'contactLinkedin'],
] as const

export const siteSettingsSchema = z.object({
  theme: z.object({ orange: hex, navy: hex, cream: hex, card: hex, muted: hex, line: hex }),
  navbar: z.object({
    links: z.array(link.extend({ visible: z.boolean(), highlight: z.boolean() })).max(14),
    showSearch: z.boolean(),
  }),
  footer: z.object({
    about: text(500),
    script: text(80),
    scriptSub: text(120),
    newsletterTitle: text(120),
    newsletterText: text(240),
    address: text(300),
    phone: text(80),
    email: text(160),
    hours: text(120),
    copyright: text(240),
    partnersTitle: text(120).optional(),
    whatsapp: z.string().trim().regex(/^[0-9]{8,15}$/, 'WhatsApp number must be digits with country code, e.g. 918052696360'),
    social: z.object({ facebook: optionalUrl, instagram: optionalUrl, youtube: optionalUrl, linkedin: optionalUrl, x: optionalUrl }),
    columns: z.array(z.object({ title: text(60).min(1), links: z.array(link).max(12) })).max(5),
    partners: z.array(text(60).min(1)).max(12),
  }),
})

contactSettingsRouter.get('/', async (_req, res, next) => {
  try {
    const keys = ['contactAddress', 'contactPhone', 'contactEmail', 'contactHours', ...contactSocialFields.map(([, key]) => key)]
    const [rows] = await pool.query<any[]>('SELECT content_key keyName, content_value value FROM site_content WHERE content_key IN (?)', [keys])
    const values = Object.fromEntries(rows.map((row) => [row.keyName, String(row.value ?? '').trim()])) as Record<string, string>
    const phones = (values.contactPhone || defaultContactDetails.phones.join(' | '))
      .split(/[|,\n;]+/)
      .map((phone) => phone.trim())
      .filter(Boolean)
    const socialLinks = contactSocialFields.flatMap(([label, key]) => {
      const url = values[key] ?? ''
      return /^https?:\/\/\S+$/i.test(url) ? [{ label, url }] : []
    })

    res.set('Cache-Control', 'no-store')
    res.json({
      contact: {
        address: values.contactAddress || defaultContactDetails.address,
        phones: phones.length ? phones : defaultContactDetails.phones,
        email: values.contactEmail || defaultContactDetails.email,
        hours: values.contactHours || defaultContactDetails.hours,
        socialLinks,
      },
    })
  } catch (error) { next(error) }
})

siteSettingsRouter.get('/', cachePublic(15), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT value_json valueJson, updated_at updatedAt FROM site_settings WHERE setting_key='site'")
    if (!rows[0]) return res.json({ settings: null })
    res.json({ settings: JSON.parse(rows[0].valueJson), updatedAt: rows[0].updatedAt })
  } catch (error) { next(error) }
})

siteSettingsRouter.get('/homepage', cachePublic(15), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT value_json valueJson FROM site_settings WHERE setting_key=?', ['homepage'])
    res.json({ homepage: rows[0] ? homepageContentSchema.parse(JSON.parse(rows[0].valueJson)) : null })
  } catch (error) { next(error) }
})

highlightsRouter.get('/', cachePublic(30), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT value_json valueJson FROM site_settings WHERE setting_key=?', ['homepage'])
    const homepage = rows[0] ? homepageContentSchema.parse(JSON.parse(rows[0].valueJson)) : null
    res.json({ highlights: homepage?.highlights ?? [] })
  } catch (error) { next(error) }
})

siteSettingsRouter.get('/gallery', async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT value_json valueJson FROM site_settings WHERE setting_key=?', ['gallery'])
    const config = rows[0] ? galleryConfigSchema.parse(JSON.parse(rows[0].valueJson)) : defaultGalleryConfig
    res.set('Cache-Control', 'no-store')
    res.json({ config })
  } catch (error) { next(error) }
})

siteSettingsRouter.put('/gallery', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const config = galleryConfigSchema.parse(req.body)
    await pool.query(`INSERT INTO site_settings(setting_key,value_json,updated_by) VALUES ('gallery',?,?)
      ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_by=VALUES(updated_by)`, [JSON.stringify(config), req.user!.id])
    await recordAudit(req.user!.id, 'site.gallery.update', 'site_settings', 'gallery', config)
    res.json({ ok: true })
  } catch (error) { next(error) }
})

siteSettingsRouter.put('/homepage', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const homepage = homepageContentSchema.parse(req.body)
    await pool.query(`INSERT INTO site_settings(setting_key,value_json,updated_by) VALUES ('homepage',?,?)
      ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_by=VALUES(updated_by)`, [JSON.stringify(homepage), req.user!.id])
    await recordAudit(req.user!.id, 'site.homepage.update', 'site_settings', 'homepage', {
      categories: homepage.categories.length,
      highlights: homepage.highlights.length,
    })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

siteSettingsRouter.put('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const settings = siteSettingsSchema.parse(req.body)
    await pool.query(`INSERT INTO site_settings(setting_key,value_json,updated_by) VALUES ('site',?,?)
      ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_by=VALUES(updated_by)`, [JSON.stringify(settings), req.user!.id])
    await recordAudit(req.user!.id, 'site.settings.update', 'site_settings', 'site', { theme: settings.theme })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

siteSettingsRouter.delete('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    await pool.query("DELETE FROM site_settings WHERE setting_key='site'")
    await recordAudit(req.user!.id, 'site.settings.reset', 'site_settings', 'site')
    res.json({ ok: true })
  } catch (error) { next(error) }
})
