import { isAnalyticsTrackablePath, readMetaAdsConsent } from './analytics'

type MetaPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    fbq?: MetaPixel
    _fbq?: MetaPixel
  }
}

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? ''
const safeUtmValue = /^[a-z0-9][a-z0-9._-]{0,79}$/i
let lastPageViewPath: string | null = null
let initializedPixelId: string | null = null

function canSendCurrentPage(pathname: string) {
  if (!isAnalyticsTrackablePath(pathname) || window.location.hash) return false
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of params) {
    if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].includes(key)) {
      if (!safeUtmValue.test(value)) return false
    } else if (key === 'fbclid') {
      if (!/^[a-z0-9._-]{1,256}$/i.test(value)) return false
    } else {
      return false
    }
  }
  if (document.referrer) {
    try {
      const referrer = new URL(document.referrer)
      if (referrer.search || referrer.hash || referrer.pathname.includes('@') || /[0-9a-f]{8}-[0-9a-f-]{27}/i.test(referrer.pathname)) return false
      if (referrer.origin === window.location.origin && !isAnalyticsTrackablePath(referrer.pathname)) return false
    } catch {
      return false
    }
  }
  return true
}

function initializePixel() {
  if (!/^\d{6,20}$/.test(pixelId)) return null
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    }) as MetaPixel
    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    script.onerror = () => console.warn('[meta-pixel] Meta script could not be loaded')
    document.head.appendChild(script)
  }
  if (initializedPixelId !== pixelId) {
    window.fbq('consent', 'grant')
    window.fbq('init', pixelId)
    initializedPixelId = pixelId
  } else {
    window.fbq('consent', 'grant')
  }
  return window.fbq
}

export function updateMetaPixelConsent(enabled: boolean, pathname: string) {
  if (!enabled || !canSendCurrentPage(pathname)) {
    window.fbq?.('consent', 'revoke')
    if (!enabled) lastPageViewPath = null
    return
  }
  const fbq = initializePixel()
  if (fbq && lastPageViewPath !== pathname) {
    lastPageViewPath = pathname
    fbq('track', 'PageView')
  }
}

export function trackMetaLead() {
  if (!readMetaAdsConsent() || !canSendCurrentPage(window.location.pathname)) return
  const fbq = window.fbq ?? initializePixel()
  fbq?.('track', 'Lead')
}
