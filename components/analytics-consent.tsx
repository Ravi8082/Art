'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { deleteAnalyticsHistory, readAnalyticsConsent, readMetaAdsConsent, saveAnalyticsConsent, saveMetaAdsConsent, trackAnalytics } from '@/lib/analytics'
import { updateMetaPixelConsent } from '@/lib/meta-pixel'

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`)

export function AnalyticsConsent() {
  const pathname = usePathname()
  const [consent, setConsent] = useState<boolean | null>(null)
  const [metaAdsConsent, setMetaAdsConsent] = useState<boolean | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setConsent(readAnalyticsConsent())
    setMetaAdsConsent(readMetaAdsConsent())
    setReady(true)
  }, [])

  useEffect(() => {
    if (consent) trackAnalytics('page_view', pathname)
  }, [consent, pathname])

  useEffect(() => {
    updateMetaPixelConsent(metaAdsConsent === true, pathname)
  }, [metaAdsConsent, pathname])

  useEffect(() => {
    if (!consent) return
    const onClick = (event: MouseEvent) => {
      const element = event.target
      if (!(element instanceof Element)) return
      const link = element.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) return
      let targetPath: string | null = null
      try {
        const target = new URL(link.href, window.location.href)
        if (target.origin === window.location.origin) targetPath = target.pathname
        else if (hostMatches(target.hostname, 'instagram.com')) targetPath = 'external:instagram'
        else if (hostMatches(target.hostname, 'facebook.com') || target.hostname === 'fb.me') targetPath = 'external:facebook'
        else if (hostMatches(target.hostname, 'youtube.com') || target.hostname === 'youtu.be') targetPath = 'external:youtube'
        else if (hostMatches(target.hostname, 'linkedin.com')) targetPath = 'external:linkedin'
        else if (target.hostname === 'x.com' || hostMatches(target.hostname, 'twitter.com')) targetPath = 'external:x'
        else if (hostMatches(target.hostname, 'whatsapp.com') || target.hostname === 'wa.me') targetPath = 'external:whatsapp'
        else targetPath = 'external:other'
      } catch {
        return
      }
      trackAnalytics('link_click', window.location.pathname, targetPath)
    }
    const onSubmit = (event: SubmitEvent) => {
      if (event.target instanceof HTMLFormElement) trackAnalytics('form_submit', window.location.pathname)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('submit', onSubmit)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('submit', onSubmit)
    }
  }, [consent])

  async function choose(analyticsGranted: boolean, metaAdsGranted: boolean) {
    saveAnalyticsConsent(analyticsGranted)
    saveMetaAdsConsent(metaAdsGranted)
    setConsent(analyticsGranted)
    setMetaAdsConsent(metaAdsGranted)
    setNotice('')
    if (analyticsGranted) {
      setOpen(false)
      return
    }
    const deleted = await deleteAnalyticsHistory()
    setNotice(deleted ? 'Analytics consent is off and saved history was deleted.' : 'Consent is off. Any previous events that could not be deleted will expire within 90 days.')
    setOpen(!deleted)
  }

  if (!ready) return null
  return (
    <>
      <button className="analytics-settings-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        Privacy settings
      </button>
      {open && (
        <aside className="analytics-consent-panel" aria-label="Privacy and analytics settings">
          <strong>Privacy choices</strong>
          <p>Optional first-party analytics records traffic sources, public pages and basic actions with a random browser ID. We do not store raw IP addresses or form contents; analytics history is kept for up to 90 days.</p>
          <p>Meta advertising is separate. If allowed and configured, Meta may receive page-view and lead events plus browser/network information (including IP address) to measure ads and build retargeting audiences. We never send form contents or contact details to Meta.</p>
          {notice && <p role="status">{notice}</p>}
          <a href="/privacy-policy">Read the privacy notice</a>
          <div className="analytics-consent-actions">
            <button type="button" onClick={() => choose(false, false)}>Necessary only</button>
            <button type="button" onClick={() => choose(true, false)}>Analytics only</button>
            <button type="button" onClick={() => choose(false, true)}>Meta ads only</button>
            <button type="button" onClick={() => choose(true, true)}>Analytics &amp; Meta ads</button>
          </div>
        </aside>
      )}
      {!open && (consent === null || metaAdsConsent === null) && (
        <aside className="analytics-consent-panel" aria-label="Analytics and advertising consent">
          <strong>Help us improve the site</strong>
          <p>Optional first-party analytics records traffic sources, public pages and basic actions with a random browser ID. We do not store raw IP addresses or form contents; analytics history is kept for up to 90 days.</p>
          <p>Meta advertising is separate. If allowed and configured, Meta may receive page-view and lead events plus browser/network information (including IP address) to measure ads and build retargeting audiences. We never send form contents or contact details to Meta.</p>
          <a href="/privacy-policy">Read the privacy notice</a>
          <div className="analytics-consent-actions">
            <button type="button" onClick={() => choose(false, false)}>Necessary only</button>
            <button type="button" onClick={() => choose(true, false)}>Analytics only</button>
            <button type="button" onClick={() => choose(false, true)}>Meta ads only</button>
            <button type="button" onClick={() => choose(true, true)}>Analytics &amp; Meta ads</button>
          </div>
        </aside>
      )}
    </>
  )
}
