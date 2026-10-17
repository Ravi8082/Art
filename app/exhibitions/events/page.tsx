import Link from 'next/link'
import { ArrowRight, CalendarDays, MapPin, Sparkles, TicketCheck } from 'lucide-react'
import { PublicShell } from '@/components/public-shell'
import { apiBaseUrl, getEvents, getShell, type PublicEvent } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibitions & Events · The Haat of Art' }

function dateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates to be announced'
  const sameYear = start.getFullYear() === end.getFullYear()
  const startLabel = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(end)
  return `${startLabel} – ${endLabel}`
}

function ExhibitionCard({ event, index }: {
  event: PublicEvent
  index: number
}) {
  const cover = event.media.find((item) => item.mediaType === 'IMAGE') ?? event.media[0]
  const isIndore = event.city.toLowerCase().includes('indore') || event.slug.includes('indore')
  const venue = event.city && !event.venue.toLowerCase().includes(event.city.toLowerCase())
    ? `${event.venue} · ${event.city}`
    : event.venue
  const action = isIndore
    ? { href: '/indore#register', label: 'Get a free entry pass' }
    : { href: '/visitor/register', label: 'Create visitor account' }

  return (
    <article className="exhibition-card">
      <div className={`exhibition-card-cover cover-tone-${(index % 3) + 1}`}>
        {cover?.mediaType === 'VIDEO'
          ? <video src={`${apiBaseUrl}${cover.url}`} aria-label={cover.altText} muted playsInline preload="metadata" />
          : <img
            src={cover ? `${apiBaseUrl}${cover.url}` : '/media/exhibition-events-hero.svg'}
            alt={cover?.altText ?? `${event.title} exhibition artwork`}
            loading="lazy"
          />}
        <span className="exhibition-card-type"><Sparkles size={12} /> Exhibition</span>
      </div>
      <div className="exhibition-card-content">
        <p className="exhibition-card-date"><CalendarDays size={14} /> {dateRange(event.startsAt, event.endsAt)}</p>
        <h2>{event.title}</h2>
        <p className="exhibition-card-description">{event.description}</p>
        <p className="exhibition-card-venue"><MapPin size={15} /><span>{venue}</span></p>
        <Link className="exhibition-card-action" href={action.href}>
          {action.label}<ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}

export default async function ExhibitionsEventsPage() {
  const [{ shell }, events] = await Promise.all([getShell(), getEvents()])
  return (
    <PublicShell {...shell}>
      <section className="events-page-hero">
        <div className="events-page-hero-copy">
          <p className="public-kicker">The Haat of Art · What&apos;s on</p>
          <h1>Meet us where <em>art happens.</em></h1>
          <p className="events-page-intro">Discover exhibitions, meet the artists and find your next favourite work of art.</p>
          <a className="events-page-hero-link" href="#event-calendar">Explore the calendar <ArrowRight size={15} /></a>
          <div className="events-page-count">
            <span>{events === null ? '—' : String(events.length).padStart(2, '0')}</span>
            <small>{events?.length === 1 ? 'exhibition to discover' : 'exhibitions to discover'}</small>
          </div>
        </div>
        <div className="events-page-hero-art">
          <img src="/media/exhibition-events-hero.svg" alt="Original illustration of a colourful contemporary art exhibition" />
          <span>Art brings us together</span>
        </div>
      </section>

      <section className="events-page-list" id="event-calendar">
        <div className="events-page-heading">
          <div><p className="public-kicker">Save the date</p><h2>Exhibitions &amp; events</h2></div>
          <p>Good art is even better in person.<br />We&apos;ll see you there.</p>
        </div>
        {events === null
          ? <p className="events-message" role="status">Events are temporarily unavailable. Please try again later.</p>
          : events.length === 0
            ? <div className="events-page-empty"><CalendarDays size={24} /><h2>New dates are on the way</h2><p>There are no published exhibitions right now. Check back soon for the next gathering.</p></div>
            : <div className="exhibition-card-grid">{events.map((event, index) => <ExhibitionCard key={event.id} event={event} index={index} />)}</div>}
        <div className="events-page-note"><TicketCheck size={16} /><span>Visitor entry is free. Get an Indore pass here, or create an account to register for other exhibitions.</span></div>
      </section>
    </PublicShell>
  )
}
