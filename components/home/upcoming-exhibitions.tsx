'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, MapPin } from 'lucide-react'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'
import { ScrollReveal } from '@/components/motion/scroll-reveal'
import { hasNotExpired } from '@/lib/exhibitions-schedule'

export type ExhibitionCard = {
  id: string
  title: string
  description: string
  venue: string
  startsAt: string | null
  endsAt: string | null
  image?: string
  alt?: string
  fallback: string
  dateLabel?: string
  bookingLabel?: string
  isFirstInState?: boolean
  state?: string
}

const featuredEditions: ExhibitionCard[] = [
  {
    id: 'bengaluru-art-collective-2026',
    title: 'The Haat of Art — Bengaluru Art Collective',
    description: 'A gathering of contemporary and traditional artists with workshops and stalls.',
    venue: 'Palace Grounds, Bengaluru, Karnataka',
    startsAt: '2026-12-05T00:00:00.000Z',
    endsAt: '2026-12-07T23:59:59.000Z',
    dateLabel: '05–07 Dec 2026',
    bookingLabel: 'Booking Open',
    image: '/media/exhibition-gallery.jpeg',
    alt: 'Contemporary artworks at an Indian art exhibition',
    fallback: '/media/exhibition-gallery.jpeg',
  },
  {
    id: 'india-art-exhibition-tour-2027',
    title: 'The Haat of Art — India Art Exhibition Tour 2027',
    description: 'A multi-city celebration of Indian art, traditional crafts and contemporary creativity—bringing artists, collectors and art lovers together across India.',
    venue: 'Multiple Exhibition Venues — India Tour',
    startsAt: '2027-01-15T00:00:00.000Z',
    endsAt: '2027-01-17T23:59:59.000Z',
    dateLabel: '15–17 Jan 2027',
    bookingLabel: 'Booking Open',
    image: '/media/installation.jpeg',
    alt: 'An art installation presented at an exhibition',
    fallback: '/media/exhibition-gallery.jpeg',
  },
  {
    id: 'spring-grand-edition-2027',
    title: 'The Haat of Art — Spring Grand Edition 2027',
    description: 'An expansive showcase uniting emerging creators, master sculptors, and collectors across premier exhibition halls.',
    venue: 'NESCO Centre, Mumbai & New Delhi',
    startsAt: '2027-02-01T00:00:00.000Z',
    endsAt: '2027-02-28T23:59:59.000Z',
    dateLabel: 'Feb 2027',
    bookingLabel: 'Early Access Open',
    image: '/media/sculpture.jpeg',
    alt: 'Sculptures displayed in a gallery',
    fallback: '/media/exhibition-gallery.jpeg',
  },
]

function dateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt || !endsAt) return 'Coming Soon'
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Coming Soon'

  const parts = (date: Date) => ({
    day: date.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' }),
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    year: date.toLocaleDateString('en-GB', { year: 'numeric', timeZone: 'UTC' }),
  })
  const first = parts(start)
  const last = parts(end)

  if (first.year === last.year && first.month === last.month) return `${first.day}–${last.day} ${first.month} ${first.year}`
  if (first.year === last.year) return `${first.day} ${first.month}–${last.day} ${last.month} ${first.year}`
  return `${first.day} ${first.month} ${first.year}–${last.day} ${last.month} ${last.year}`
}

function displayDescription(event: ExhibitionCard) {
  const isTourAnnouncement = /india art exhibition tour 2027/i.test(event.title)
  const containsRegistrationCopy = /categories:|registration:|demo configuration/i.test(event.description)
  if (isTourAnnouncement && containsRegistrationCopy) {
    return 'A multi-city celebration of Indian art, traditional crafts and contemporary creativity—bringing artists, collectors and art lovers together across India.'
  }
  return event.description
}

export function UpcomingExhibitions({ items, unavailable }: { items: ExhibitionCard[]; unavailable: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const activeItems = useMemo(
    () => featuredEditions
      .map((featured) => {
        const liveMatch = items.find((item) => item.title.trim().toLowerCase() === featured.title.toLowerCase())
        return liveMatch
          ? { ...featured, image: liveMatch.image || featured.image, alt: liveMatch.alt || featured.alt }
          : featured
      })
      .filter((item) => hasNotExpired(item.endsAt, now))
      .sort((a, b) => Date.parse(a.startsAt ?? '') - Date.parse(b.startsAt ?? '')),
    [items, now],
  )

  useEffect(() => {
    const nextExpiry = activeItems.reduce((nearest, item) => {
      const endTime = Date.parse(item.endsAt ?? '')
      return Number.isFinite(endTime) && endTime < nearest ? endTime : nearest
    }, Number.POSITIVE_INFINITY)
    if (!Number.isFinite(nextExpiry)) return
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextExpiry - Date.now() + 1), 2_147_483_647),
    )
    return () => window.clearTimeout(timeout)
  }, [activeItems])

  return (
    <section className="th-section th-upcoming home-flow-section" id="exhibitions">
      <SectionHeading before="Upcoming" accent="Exhibitions" subtitle="Be a part of our next editions across major Indian cities." />
      {activeItems.length > 0
        ? <div className="th-events" aria-label="Upcoming art exhibitions">
          {activeItems.map((event, index) => (
            <ScrollReveal className="th-event-reveal" key={event.id} delay={index * 0.08}>
              <article className="th-event" data-exhibition-title={event.title}>
                <div className="th-event-img">
                  <SafeImage src={event.image} alt={event.alt || event.title} fallback={event.fallback} />
                  <span className="th-event-status">{event.bookingLabel || 'Booking Open'}</span>
                  {event.isFirstInState && event.state && <span className="th-first-state-badge">First time in {event.state}</span>}
                </div>
                <div className="th-event-body">
                  {index === 0 && <span className="th-event-next-badge">Next Nearest Edition</span>}
                  <div className="th-event-meta">
                    <p className="th-event-date"><CalendarDays size={14} /> {event.dateLabel || dateRange(event.startsAt, event.endsAt)}</p>
                    <p className="th-event-venue"><MapPin size={14} /> {event.venue}</p>
                  </div>
                  <h3 className="th-event-title">{event.title}</h3>
                  <p className="th-event-description line-clamp-3">{displayDescription(event)}</p>
                  <div className="th-event-actions">
                    <Link className="th-btn th-btn-sm" href="/book-your-stall">Book Stall</Link>
                    <Link className="th-btn-outline th-btn-sm" href="/indore">Visitor Pass</Link>
                  </div>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
        : <p className="th-events-empty" role="status">{unavailable ? 'Exhibition dates are temporarily unavailable. Please check back soon.' : 'Our next exhibitions are being planned. New dates will be announced here.'}</p>}
    </section>
  )
}
