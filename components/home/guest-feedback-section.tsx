'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'
import type { PublicGuestFeedback } from '@/lib/api'
import type { HomepageContent } from '@/lib/homepage-content'

function Stars({ rating }: { rating: number }) {
  const value = Math.max(1, Math.min(5, Math.round(rating)))
  return (
    <div className="gf-stars" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} className={n <= value ? 'is-on' : ''} />)}
    </div>
  )
}

function GuestAvatar({ image, name }: { image?: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const normalizedName = name.trim().replace(/\s+/g, ' ').toLowerCase()
  const monogramOnly = ['meera nair', 'rajiv malhotra', 'anjali verma', 'vikramaditya rathore', 'kavita joshi'].includes(normalizedName)
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return (
    <span className={`gf-author-image${monogramOnly ? ' is-monogram' : ''}`} aria-label={`${name} initials`}>
      {image && !imageFailed && !monogramOnly
        ? <img src={image} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        : <span aria-hidden="true">{initials}</span>}
    </span>
  )
}

export function GuestFeedbackSection({
  items,
  fallbackItems,
  images,
}: {
  items: PublicGuestFeedback[]
  fallbackItems: HomepageContent['testimonials']
  images: (string | undefined)[]
}) {
  const configuredFeedback = fallbackItems.map((item, index) => ({
      id: `homepage-feedback-${index}`,
      guestId: null,
      guestName: null,
      authorName: item.authorName,
      authorRole: item.authorRole,
      message: item.message,
      rating: 5,
      sortOrder: index,
      active: true,
    }))
  const activeItems = items.filter((item) => item.active)
  const feedback = [...activeItems, ...configuredFeedback.filter((item) =>
    !activeItems.some((entry) => entry.authorName.trim().toLowerCase() === item.authorName.trim().toLowerCase()))]
  const renderFeedback = (duplicate = false) => feedback.map((entry, index) => (
    <article
      className="gf-card"
      role="listitem"
      aria-hidden={duplicate ? true : undefined}
      key={`${duplicate ? 'duplicate-' : ''}${entry.id}`}
      style={{ '--gf-delay': `${index * 70}ms` } as React.CSSProperties}
    >
      <span className="gf-quote" aria-hidden>&ldquo;</span>
      <p className="gf-text">{entry.message}</p>
      <Stars rating={entry.rating} />
      <footer>
        <GuestAvatar image={images[index]} name={entry.authorName} />
        <span className="gf-author-copy">
          <strong>{entry.authorName}</strong>
          {entry.authorRole && <small className="gf-role-tag">{entry.authorName.trim().toLowerCase() === 'anjali verma' ? 'Collector' : entry.authorRole}</small>}
          {entry.guestName && <em>About {entry.guestName}</em>}
        </span>
      </footer>
    </article>
  ))

  if (!feedback.length) return null
  return (
    <section className="th-section gf-section" id="feedback">
      <div className="gf-head">
        <h2>What Our <em>Community Says</em></h2>
      </div>
      <div
        className="gf-grid"
        role="region"
        aria-label="Guest testimonials"
        tabIndex={0}
        style={{ '--homepage-feedback-duration': `${Math.max(32, feedback.length * 8)}s` } as React.CSSProperties}
      >
        <div className="gf-track">
          <div className="gf-group" role="list" aria-label="Guest testimonials">
            {renderFeedback()}
          </div>
          <div className="gf-group" role="list" aria-hidden="true" inert>
            {renderFeedback(true)}
          </div>
        </div>
      </div>
    </section>
  )
}
