import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { demoExhibitions } from '@/lib/demo-home-content'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'

export type ExhibitionCard = { id: string; title: string; venue: string; startsAt: string; image?: string; alt?: string }

function dateParts(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { day: '--', month: 'TBC', year: '' }
  return {
    day: d.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' }),
    month: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
    year: d.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'UTC' }),
  }
}

export function UpcomingExhibitions({ items }: { items: ExhibitionCard[] }) {
  const cards: ExhibitionCard[] = items.length ? items : demoExhibitions
  return (
    <section className="th-section" id="exhibitions">
      <SectionHeading before="Upcoming" accent="Art Exhibitions" subtitle="Explore our upcoming and past exhibitions across India." cta={{ label: 'View All Events', href: '/exhibitions/events' }} />
      <div className="th-events">
        {cards.slice(0, 3).map((event, i) => {
          const d = dateParts(event.startsAt)
          return (
            <article className="th-event" key={event.id}>
              <div className="th-event-img">
                <SafeImage src={event.image} alt={event.alt || event.title} fallback={demoExhibitions[i % 3].image} />
                <div className="th-date"><b>{d.day}</b><span>{d.month}</span><em>{d.year}</em></div>
              </div>
              <div className="th-event-body">
                <h3>{event.title}</h3>
                <p><MapPin size={12} /> {event.venue}</p>
                <div className="th-event-actions">
                  <Link className="th-btn th-btn-sm" href="/book-your-stall">Book Your Stall</Link>
                  <Link className="th-btn-outline th-btn-sm" href="/indore">Visitor Pass</Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}


