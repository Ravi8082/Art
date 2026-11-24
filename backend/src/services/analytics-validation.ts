import { z } from 'zod'

export const analyticsEventSchema = z.object({
  visitorId: z.string().uuid(),
  type: z.enum(['page_view', 'link_click', 'form_submit']),
  pagePath: z.string().min(1).max(512),
  targetPath: z.string().max(512).nullable().optional(),
  source: z.enum(['direct', 'instagram', 'facebook', 'google', 'whatsapp', 'newsletter', 'referral', 'other']),
  medium: z.enum(['social', 'email', 'messaging', 'paid', 'referral', 'organic', 'other']).nullable().optional(),
  campaign: z.enum(['reel', 'exhibition', 'newsletter', 'blog', 'artist', 'other']).nullable().optional(),
}).strict()

const privatePrefixes = ['/dashboard', '/admin', '/login', '/password-reset', '/account', '/api', '/visitor/pass', '/artist/dashboard', '/artist/profile-setup']
const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi

export function normalizeAnalyticsPath(value: string): string | null {
  const rawPath = value.trim().split(/[?#]/, 1)[0] ?? ''
  if (!rawPath.startsWith('/') || rawPath.startsWith('//') || rawPath.includes('\\') || /[\u0000-\u001f]/.test(rawPath)) return null
  const path = rawPath.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/'
  const lowerPath = path.toLowerCase()
  if (privatePrefixes.some((prefix) => lowerPath === prefix || lowerPath.startsWith(`${prefix}/`))) return null
  const normalized = path.replace(uuidPattern, ':id')
  return normalized.length <= 255 ? normalized : null
}

export function normalizeAnalyticsTarget(value: string | null | undefined): string | null | undefined {
  if (value == null) return value
  if (/^external:(instagram|facebook|youtube|linkedin|x|whatsapp|other)$/i.test(value)) return value.toLowerCase()
  return normalizeAnalyticsPath(value)
}
