import Link from 'next/link'
import { SafeImage } from './safe-image'

export type HighlightCard = { id: string; title: string; image?: string; alt: string; fallback: string }

export function PastHighlights({ items }: { items: HighlightCard[] }) {
  if (!items.length) return null

  return (
    <section className="th-section th-past-section" id="past-exhibitions">
      <div className="th-heading">
        <h2>Highlights from <em>our previous editions</em></h2>
        <Link className="th-btn-outline" href="/exhibitions/events">View All Events</Link>
      </div>
      <div className="th-past-grid">
        {items.slice(0, 4).map((item) => (
          <Link className="th-past-card" href="/exhibitions/events" key={item.id}>
            <SafeImage src={item.image} alt={item.alt} fallback={item.fallback} />
            <span>{item.title}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
