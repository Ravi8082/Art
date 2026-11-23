'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { InvitedGuest, InvitedGuestsPage } from '@/lib/api'

function guestMonogram(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => !/^(dr\.?|mr\.?|mrs\.?|ms\.?|shri|smt\.?)$/i.test(word))
  return words.slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase() || 'TH'
}

function GuestCards({ guests }: { guests: InvitedGuest[] }) {
  return guests.map((guest) => (
    <article className="ig-guest-card" key={guest.id} role="listitem">
      <div className="ig-guest-portrait">
        {guest.photoUrl?.trim()
          ? <img src={guest.photoUrl ?? ''} alt={guest.name} loading="lazy" />
          : <span className="ig-guest-monogram" aria-hidden="true">{guestMonogram(guest.name)}</span>}
        <span className="ig-guest-vignette" aria-hidden="true" />
        {guest.roleBadge && <span className="ig-guest-role">{guest.roleBadge}</span>}
        {guest.editionTag && <span className="ig-guest-edition">{guest.editionTag}</span>}
      </div>
      <div className="ig-guest-caption">
        <h3>{guest.name}</h3>
        {guest.designation && <p className="ig-guest-designation">{guest.designation}</p>}
        {guest.roleSummary && <p className="ig-guest-summary">{guest.roleSummary}</p>}
      </div>
    </article>
  ))
}

export function InvitedGuestsMarquee({ page, guests }: { page: InvitedGuestsPage; guests: InvitedGuest[] }) {
  const [viewportWidth, setViewportWidth] = useState(0)
  useEffect(() => {
    const updateViewportWidth = () => setViewportWidth(window.innerWidth)
    updateViewportWidth()
    window.addEventListener('resize', updateViewportWidth)
    return () => window.removeEventListener('resize', updateViewportWidth)
  }, [])

  const visibleGuests = guests.filter((guest) => {
    const pageVisible = page === 'home' ? guest.showOnHome
      : page === 'about' ? guest.showOnAbout
        : page === 'gallery' ? guest.showOnGallery : guest.showOnExhibitions
    const isPlaceholder = guest.isPlaceholder === true || /\bplaceholder\b/i.test(`${guest.name} ${guest.designation} ${guest.roleSummary}`)
    return guest.isActive && pageVisible && !isPlaceholder
  })
  if (!visibleGuests.length) return null

  const cardWidth = viewportWidth >= 640 ? 280 : 250
  const repeatCount = viewportWidth
    ? Math.max(1, Math.ceil((viewportWidth - 4) / (visibleGuests.length * (cardWidth + 20))))
    : 1
  const trackStyle = { '--ig-marquee-duration': `${Math.max(28, visibleGuests.length * 7)}s` } as CSSProperties

  return (
    <section className="ig-marquee" aria-label="Invited Guests and Luminaries">
      <div className="ig-marquee-container">
        <header className="ig-marquee-heading">
          <p>DISTINGUISHED PRESENCE</p>
          <h2>Invited Guests &amp; Luminaries</h2>
          <span>Chief guests, cultural patrons and celebrated luminaries who have graced our exhibitions.</span>
        </header>
      </div>
      <div className="ig-marquee-viewport" aria-label={`Invited guests featured on the ${page} page`}>
        <div className="ig-marquee-track" style={trackStyle}>
          <div className="ig-marquee-group" role="list">
            <GuestCards guests={visibleGuests} />
            {Array.from({ length: repeatCount - 1 }, (_, index) => (
              <div className="ig-marquee-repeat" aria-hidden="true" key={`repeat-${index}`}>
                <GuestCards guests={visibleGuests} />
              </div>
            ))}
          </div>
          <div className="ig-marquee-group" role="list" aria-hidden="true">
            <GuestCards guests={visibleGuests} />
            {Array.from({ length: repeatCount - 1 }, (_, index) => (
              <div className="ig-marquee-repeat" aria-hidden="true" key={`repeat-${index}`}>
                <GuestCards guests={visibleGuests} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
