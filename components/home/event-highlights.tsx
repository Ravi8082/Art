import type { HomepageContent } from '@/lib/homepage-content'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from './safe-image'

export type EventHighlightCard = HomepageContent['highlights'][number] & {
  id: string
  image?: string
}

export function EventHighlights({ items }: { items: EventHighlightCard[] }) {
  if (!items.length) return null
  return (
    <section className="th-section th-event-highlights" id="highlights">
      <header className="th-highlight-heading">
        <h2>Event <em>Highlights</em></h2>
        <Link href="/gallery#highlights">View More Highlights <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="th-highlight-grid">
        {items.map((item) => (
          <article className="th-highlight-card" key={item.id}>
            {item.image && <SafeImage src={item.image} alt={item.title} fallback="/media/exhibition-gallery.jpeg" />}
            <div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link href="/gallery#highlights">Explore Highlight <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </article>
        ))}
      </div>
      <Link className="th-event-flow-link" href="/event-flow">Explore Full Event Flow <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  )
}
