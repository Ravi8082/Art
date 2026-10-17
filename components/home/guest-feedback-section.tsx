'use client'

import { Star } from 'lucide-react'
import { demoGuestFeedback } from '@/lib/demo-guests'
import type { PublicGuestFeedback } from '@/lib/api'

function Stars({ rating }: { rating: number }) {
  const value = Math.max(1, Math.min(5, Math.round(rating)))
  return (
    <div className="gf-stars" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} className={n <= value ? 'is-on' : ''} />)}
    </div>
  )
}

export function GuestFeedbackSection({ items }: { items: PublicGuestFeedback[] }) {
  const feedback = items.length ? items : demoGuestFeedback
  return (
    <section className="th-section gf-section" id="feedback">
      <div className="gf-head">
        <h2>What Our <em>Guests Say</em></h2>
        <p>Feedback left by visitors, collectors and partners after each show.</p>
      </div>
      <div className="gf-grid">
        {feedback.slice(0, 8).map((entry, index) => (
          <article className="gf-card" key={entry.id} style={{ '--gf-delay': `${index * 70}ms` } as React.CSSProperties}>
            <span className="gf-quote" aria-hidden>&ldquo;</span>
            <p className="gf-text">{entry.message}</p>
            <Stars rating={entry.rating} />
            <footer>
              <strong>{entry.authorName}</strong>
              {entry.authorRole && <small>{entry.authorRole}</small>}
              {entry.guestName && <em>About {entry.guestName}</em>}
            </footer>
          </article>
        ))}
      </div>
    </section>
  )
}
