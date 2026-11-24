const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const CONSENT_KEY = 'haat.analytics-consent.v1'
export const META_AD_CONSENT_KEY = 'haat.meta-ads-consent.v1'
const VISITOR_KEY = 'haat.analytics-visitor.v1'
const ATTRIBUTION_KEY = 'haat.analytics-attribution.v1'
const VISITOR_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
let analyticsConsentOverride: boolean | null = null
let metaAdsConsentOverride: boolean | null = null

export type AnalyticsEventType = 'page_view' | 'link_click' | 'form_submit'

type Attribution = {
  source: 'direct' | 'instagram' | 'facebook' | 'google' | 'whatsapp' | 'newsletter' | 'referral' | 'other'
  medium: 'social' | 'email' | 'messaging' | 'paid' | 'referral' | 'organic' | 'other'
  campaign: 'reel' | 'exhibition' | 'newsletter' | 'blog' | 'artist' | 'other'
  mediumLabel: string | null
  campaignLabel: string | null
}

const privatePrefixes = ['/dashboard', '/admin', '/login', '/password-reset', '/account', '/api', '/visitor/pass', '/artist/dashboard', '/artist/profile-setup', '/newsletter/unsubscribe']
const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

export function isAnalyticsTrackablePath(value: string) {
  const path = value.split(/[?#]/, 1)[0] || '/'
  return !privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function analyticsSource(value: string | null, referrer: string): Attribution['source'] {
  const candidate = (value ?? '').trim().toLowerCase()
  if (['instagram', 'instagram.com', 'ig'].includes(candidate) || candidate.startsWith('instagram_')) return 'instagram'
  if (['facebook', 'facebook.com', 'fb', 'meta'].includes(candidate) || candidate.startsWith('facebook_')) return 'facebook'
  if (candidate === 'google' || candidate.startsWith('google_')) return 'google'
  if (candidate === 'whatsapp' || candidate.startsWith('whatsapp_')) return 'whatsapp'
  if (['newsletter', 'email'].includes(candidate) || candidate.startsWith('newsletter_')) return 'newsletter'
  if (candidate) return 'other'
  if (!referrer) return 'direct'
  try {
    const referrerHost = new URL(referrer).hostname.toLowerCase()
    if (referrerHost === window.location.hostname.toLowerCase()) return 'direct'
    if (hostMatches(referrerHost, 'instagram.com')) return 'instagram'
    if (hostMatches(referrerHost, 'facebook.com') || referrerHost === 'fb.me') return 'facebook'
    if (hostMatches(referrerHost, 'google.com')) return 'google'
    if (hostMatches(referrerHost, 'whatsapp.com')) return 'whatsapp'
    return 'referral'
  } catch {
    return 'other'
  }
}

function analyticsMedium(value: string | null, source: Attribution['source']): Attribution['medium'] {
  const candidate = (value ?? '').trim().toLowerCase()
  if (['social', 'email', 'messaging', 'paid', 'referral', 'organic'].includes(candidate)) return candidate as Attribution['medium']
  if (source === 'instagram' || source === 'facebook') return 'social'
  if (source === 'newsletter') return 'email'
  if (source === 'whatsapp') return 'messaging'
  if (source === 'google') return 'organic'
  return source === 'direct' ? 'other' : 'referral'
}

function analyticsCampaign(value: string | null): Attribution['campaign'] {
  const candidate = (value ?? '').toLowerCase()
  if (candidate.includes('reel')) return 'reel'
  if (candidate.includes('exhibit')) return 'exhibition'
  if (candidate.includes('newsletter') || candidate.includes('email')) return 'newsletter'
  if (candidate.includes('blog') || candidate.includes('story')) return 'blog'
  if (candidate.includes('artist')) return 'artist'
  return 'other'
}

function safeCampaignLabel(value: string | null, maxLength: number): string | null {
  const candidate = (value ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  return /^[a-z0-9][a-z0-9._-]*$/.test(candidate) && candidate.length <= maxLength ? candidate : null
}

function getAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search)
  const sourceParam = params.get('utm_source')
  const referrer = document.referrer
  let saved: Attribution | null = null
  try {
    saved = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) ?? 'null') as Attribution | null
  } catch {
    console.warn('[analytics] Could not read campaign attribution')
  }

  let internalReferrer = false
  if (referrer) {
    try {
      internalReferrer = new URL(referrer, window.location.href).hostname === window.location.hostname
    } catch {
      console.warn('[analytics] Referrer could not be classified')
    }
  }
  if (!sourceParam && saved && (!referrer || internalReferrer)) {
    return {
      source: saved.source,
      medium: saved.medium,
      campaign: saved.campaign,
      mediumLabel: safeCampaignLabel(saved.mediumLabel, 40),
      campaignLabel: safeCampaignLabel(saved.campaignLabel, 80),
    }
  }
  const source = analyticsSource(sourceParam, referrer)
  const attribution: Attribution = {
    source,
    medium: analyticsMedium(params.get('utm_medium'), source),
    campaign: analyticsCampaign(params.get('utm_campaign')),
    mediumLabel: safeCampaignLabel(params.get('utm_medium'), 40),
    campaignLabel: safeCampaignLabel(params.get('utm_campaign'), 80),
  }
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  } catch {
    console.warn('[analytics] Could not save campaign attribution')
  }
  return attribution
}

export function readLeadAttribution() {
  if (readAnalyticsConsent() !== true) {
    return { source: 'direct' as const, medium: null, campaign: null }
  }
  const attribution = getAttribution()
  return {
    source: attribution.source,
    medium: attribution.mediumLabel ?? attribution.medium,
    campaign: attribution.campaignLabel ?? attribution.campaign,
  }
}

function getVisitorId(): string | null {
  type StoredVisitor = { id?: string; createdAt?: number }
  let saved: StoredVisitor | null = null
  try {
    const stored = localStorage.getItem(VISITOR_KEY)
    saved = stored ? JSON.parse(stored) as StoredVisitor : null
  } catch {
    console.warn('[analytics] Could not read analytics browser ID')
  }
  if (saved?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.id)
    && typeof saved.createdAt === 'number' && Date.now() - saved.createdAt < VISITOR_MAX_AGE_MS) return saved.id

  const id = crypto.randomUUID()
  try {
    localStorage.setItem(VISITOR_KEY, JSON.stringify({ id, createdAt: Date.now() }))
  } catch {
    console.warn('[analytics] Could not save analytics browser ID')
    return null
  }
  return id
}

export function trackAnalytics(type: AnalyticsEventType, pagePath: string, targetPath?: string | null) {
  if (typeof window === 'undefined' || !isAnalyticsTrackablePath(pagePath)) return
  if (!readAnalyticsConsent()) return
  const visitorId = getVisitorId()
  if (!visitorId) return
  const attribution = getAttribution()
  const payload = {
    visitorId,
    type,
    pagePath,
    targetPath: targetPath ?? null,
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
  }
  void fetch(`${apiBase}/api/analytics/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) console.warn('[analytics] Event could not be recorded')
  }).catch(() => console.warn('[analytics] Analytics service is unavailable'))
}

export async function deleteAnalyticsHistory() {
  let deleted = true
  try {
    const saved = localStorage.getItem(VISITOR_KEY)
    if (saved) {
      const { id } = JSON.parse(saved) as { id?: string }
      if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        const response = await fetch(`${apiBase}/api/analytics/consent`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId: id }),
        })
        if (!response.ok) {
          deleted = false
          console.warn('[analytics] Could not delete previous analytics events')
        }
      }
    }
  } catch {
    deleted = false
    console.warn('[analytics] Could not delete previous analytics events')
  } finally {
    try {
      localStorage.removeItem(VISITOR_KEY)
      sessionStorage.removeItem(ATTRIBUTION_KEY)
    } catch {
      console.warn('[analytics] Could not clear local analytics data')
    }
  }
  return deleted
}

export function saveMetaAdsConsent(granted: boolean) {
  try {
    localStorage.setItem(META_AD_CONSENT_KEY, granted ? 'granted' : 'denied')
    metaAdsConsentOverride = null
  } catch {
    metaAdsConsentOverride = granted
    console.warn('[analytics] Advertising consent could not be saved; using the choice for this page session only')
  }
}

export function readMetaAdsConsent(): boolean | null {
  if (metaAdsConsentOverride !== null) return metaAdsConsentOverride
  try {
    const consent = localStorage.getItem(META_AD_CONSENT_KEY)
    return consent === 'granted' ? true : consent === 'denied' ? false : null
  } catch {
    console.warn('[analytics] Advertising consent could not be read; Meta tracking is disabled')
    return false
  }
}

export function saveAnalyticsConsent(granted: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
    analyticsConsentOverride = null
  } catch {
    analyticsConsentOverride = granted
    console.warn('[analytics] Consent could not be saved; tracking remains disabled')
  }
}

export function readAnalyticsConsent(): boolean | null {
  if (analyticsConsentOverride !== null) return analyticsConsentOverride
  try {
    const consent = localStorage.getItem(CONSENT_KEY)
    return consent === 'granted' ? true : consent === 'denied' ? false : null
  } catch {
    console.warn('[analytics] Consent could not be read; tracking is disabled')
    return null
  }
}
