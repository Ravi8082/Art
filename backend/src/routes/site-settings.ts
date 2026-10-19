import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { cachePublic } from '../middleware/cache.js'
import { recordAudit } from '../services/audit.js'

export const siteSettingsRouter = Router()

const manage = [requireAuth, requirePermission('content:manage')] as const
const text = (max: number) => z.string().trim().max(max)
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #ee4b12')
// Links stay on-site or http(s); this blocks javascript: URLs being injected into the navbar or footer.
const href = z.string().trim().min(1).max(300).refine((value) => /^(\/|#|https?:\/\/|mailto:|tel:)/i.test(value), 'Link must start with /, #, http(s)://, mailto: or tel:')
const link = z.object({ label: text(60).min(1), href })
const optionalUrl = z.union([z.literal(''), z.string().trim().max(300).regex(/^https?:\/\//i, 'Use a full https:// link')])

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

siteSettingsRouter.get('/', cachePublic(15), async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>("SELECT value_json valueJson, updated_at updatedAt FROM site_settings WHERE setting_key='site'")
    if (!rows[0]) return res.json({ settings: null })
    res.json({ settings: JSON.parse(rows[0].valueJson), updatedAt: rows[0].updatedAt })
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
