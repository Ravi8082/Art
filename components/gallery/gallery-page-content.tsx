'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BadgeCheck, Eye, EyeOff, MessageCircle, PackageCheck, ShoppingBag, Video } from 'lucide-react'
import { ExhibitionArchive } from '@/components/gallery/exhibition-archive'
import { FeaturedArtists, GalleryGrid, type FeaturedRosterArtist } from '@/components/gallery/gallery-grid'
import { UpcomingEditions } from '@/components/gallery/upcoming-editions'
import { InvitedGuestsMarquee } from '@/components/invited-guests-marquee'
import type { CuratedGalleryArtwork, ExhibitionArchiveEdition, GalleryUpcomingEdition } from '@/lib/booking-server'
import type { InvitedGuest } from '@/lib/api'
import { formatScheduleYearRange, isUpcomingEditionActive } from '@/lib/exhibitions-schedule'

type GalleryView = 'artworks' | 'archive'
const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function GalleryPageContent({
  artworks,
  editions,
  upcomingEditions,
  featuredArtists,
  invitedGuests,
  showCuratedArtworks: initialShowCuratedArtworks,
}: {
  artworks: CuratedGalleryArtwork[]
  editions: ExhibitionArchiveEdition[]
  upcomingEditions: GalleryUpcomingEdition[]
  featuredArtists: FeaturedRosterArtist[]
  invitedGuests: InvitedGuest[]
  showCuratedArtworks: boolean
}) {
  const [view, setView] = useState<GalleryView>(initialShowCuratedArtworks ? 'artworks' : 'archive')
  const [showCuratedArtworks, setShowCuratedArtworks] = useState(initialShowCuratedArtworks)
  const [canManage, setCanManage] = useState(false)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [visibilityError, setVisibilityError] = useState('')
  const [now, setNow] = useState(Date.now())
  const activeUpcomingEditions = useMemo(
    () => upcomingEditions.filter((edition) => isUpcomingEditionActive(edition, now)),
    [now, upcomingEditions],
  )
  const activeScheduleYears = formatScheduleYearRange(activeUpcomingEditions)

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401) return
        if (!response.ok) throw new Error(`Admin permissions could not be checked (${response.status}).`)
        const payload: unknown = await response.json()
        if (!payload || typeof payload !== 'object' || !('user' in payload) || !payload.user || typeof payload.user !== 'object') {
          throw new Error('Admin permissions returned an invalid response.')
        }
        if (!active) return
        const permissions = 'permissions' in payload.user && Array.isArray(payload.user.permissions) ? payload.user.permissions : []
        setCanManage(permissions.includes('content:manage'))
      })
      .catch((error: unknown) => {
        if (active) console.error('Gallery admin visibility control could not be loaded.', error)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const nextExpiry = activeUpcomingEditions.reduce((nearest, edition) => {
      const endTime = Date.parse(edition.endDate ?? '')
      return Number.isFinite(endTime) && endTime < nearest ? endTime : nearest
    }, Number.POSITIVE_INFINITY)
    if (!Number.isFinite(nextExpiry)) return
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextExpiry - Date.now() + 1), 2_147_483_647),
    )
    return () => window.clearTimeout(timeout)
  }, [activeUpcomingEditions, now])

  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.gallery-page')
    if (!page) return
    const updateDockVisibility = () => {
      const dock = document.querySelector<HTMLElement>('.public-floating-actions')
      if (!dock) return
      const dockRect = dock.getBoundingClientRect()
      const controls = page.querySelectorAll<HTMLElement>(
        '.ga-edition-filter-bar, .ga-upcoming-ctas, .ga-upcoming-edition-actions, .ga-edition-meta > button, .gc-gallery-admin-control, .gc-primary-switcher-inner',
      )
      const overlapsControl = [...controls].some((control) => {
        const rect = control.getBoundingClientRect()
        return rect.width > 0
          && rect.height > 0
          && rect.bottom > 0
          && rect.top < window.innerHeight
          && rect.right > dockRect.left
          && rect.left < dockRect.right
          && rect.top < dockRect.bottom
          && rect.bottom > dockRect.top
      })
      dock.classList.toggle('is-covering-gallery-control', overlapsControl)
    }
    const resizeObserver = new ResizeObserver(updateDockVisibility)
    const mutationObserver = new MutationObserver(updateDockVisibility)
    resizeObserver.observe(page)
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('scroll', updateDockVisibility, { passive: true })
    window.addEventListener('resize', updateDockVisibility)
    updateDockVisibility()
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', updateDockVisibility)
      window.removeEventListener('resize', updateDockVisibility)
      document.querySelector('.public-floating-actions')?.classList.remove('is-covering-gallery-control')
    }
  }, [])
  async function updateCuratedVisibility() {
    if (savingVisibility) return
    setSavingVisibility(true)
    setVisibilityError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/site-settings/gallery`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showCuratedArtworks: !showCuratedArtworks }),
      })
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null)
        const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
          ? payload.error
          : `Visibility setting could not be saved (${response.status}).`
        throw new Error(message)
      }
      const nextValue = !showCuratedArtworks
      setShowCuratedArtworks(nextValue)
      if (!nextValue) setView('archive')
    } catch (error) {
      setVisibilityError(error instanceof Error ? error.message : 'Visibility setting could not be saved.')
    } finally {
      setSavingVisibility(false)
    }
  }

  return (
    <>
      <UpcomingEditions initialEditions={upcomingEditions} canManage={canManage} />
      <section className="gc-primary-switcher" id="highlights" aria-label="Gallery collections">
        {canManage && (
          <div className="gc-gallery-admin-control">
            <span><strong>Curated Artworks visibility</strong><small>{showCuratedArtworks ? 'Visible to visitors' : 'Hidden from visitors'}</small></span>
            <button type="button" className="gc-gallery-visibility-toggle" aria-pressed={showCuratedArtworks} disabled={savingVisibility} onClick={updateCuratedVisibility}>
              {showCuratedArtworks ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
              {savingVisibility ? 'Saving…' : showCuratedArtworks ? 'Hide artworks' : 'Show artworks'}
            </button>
            {visibilityError && <p role="alert">{visibilityError}</p>}
          </div>
        )}
        {showCuratedArtworks && <>
          <div className="gc-primary-switcher-inner" role="tablist" aria-label="Choose gallery collection">
            <button type="button" role="tab" id="gc-tab-artworks" aria-controls="gc-panel-artworks" aria-selected={view === 'artworks'} className={view === 'artworks' ? 'is-active' : ''} onClick={() => setView('artworks')}>
            <ShoppingBag size={18} aria-hidden="true" /><span><strong>Curated Artworks ({artworks.length})</strong><small>Original works available to collect</small></span>
            </button>
            <button type="button" role="tab" id="gc-tab-archive" aria-controls="gc-panel-archive" aria-selected={view === 'archive'} className={view === 'archive' ? 'is-active' : ''} onClick={() => setView('archive')}>
              <Video size={18} aria-hidden="true" /><span><strong>Exhibition Editions &amp; Archive</strong><small>Photography and films from past events</small></span>
            </button>
          </div>
          <div id="gc-panel-artworks" role="tabpanel" aria-labelledby="gc-tab-artworks" hidden={view !== 'artworks'}>
            <GalleryGrid artworks={artworks} />
          </div>
          <div id="gc-panel-archive" role="tabpanel" aria-labelledby="gc-tab-archive" hidden={view !== 'archive'}>
            <ExhibitionArchive initialEditions={editions} />
          </div>
        </>}
        {!showCuratedArtworks && <ExhibitionArchive initialEditions={editions} />}
      </section>

      {showCuratedArtworks && <section className="gc-assurance" aria-label="Collector assurance and pan-India delivery">
        <article className="gc-assurance-item">
          <div className="gc-assurance-mark"><span>01 ·</span><BadgeCheck size={21} strokeWidth={1.6} aria-hidden="true" /></div>
          <h2>Signed Certificate of Authenticity</h2>
          <p>Every artwork ships directly from the artist’s studio with a hand-signed provenance certificate.</p>
        </article>
        <article className="gc-assurance-item">
          <div className="gc-assurance-mark"><span>02 ·</span><PackageCheck size={21} strokeWidth={1.6} aria-hidden="true" /></div>
          <h2>Museum-Grade Insured Shipping</h2>
          <p>Custom archival crating and insured doorstep delivery across India.</p>
        </article>
        <article className="gc-assurance-item">
          <div className="gc-assurance-mark"><span>03 ·</span><MessageCircle size={21} strokeWidth={1.6} aria-hidden="true" /></div>
          <h2>Complimentary Art Advisory</h2>
          <p>Need help sizing or framing for your space?</p>
          <Link href="/contact">Request a 1-on-1 curator consultation <span aria-hidden="true">→</span></Link>
        </article>
      </section>}
      <InvitedGuestsMarquee page="gallery" guests={invitedGuests} />
      <FeaturedArtists artists={featuredArtists} />
      <section className="ga-closing-invitation" aria-labelledby="ga-closing-title">
        <p className="ga-upcoming-kicker">Your place in the archive</p>
        <h2 id="ga-closing-title">{activeScheduleYears === 'Dates to be announced' ? 'Ready to see your work in the Exhibition Archive?' : `Ready to see your work in our ${activeScheduleYears} Exhibition Archive?`}</h2>
        <p>Bring your practice to the next edition and make a lasting impression on collectors and art lovers.</p>
        <div className="ga-upcoming-ctas">
          <Link className="ga-upcoming-primary" href="/book-your-stall">Apply for a Stall{activeScheduleYears === 'Dates to be announced' ? '' : ` for ${activeScheduleYears}`} <span aria-hidden="true">→</span></Link>
          <Link className="ga-upcoming-secondary" href="/exhibitions">Explore Upcoming Exhibitions <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  )
}
