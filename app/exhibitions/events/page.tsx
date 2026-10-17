import { apiBaseUrl, formatDate, getEvents, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibitions · The Haat of Art' }

export default async function ExhibitionsPage() {
  const [{ shell }, events] = await Promise.all([getShell(), getEvents()])
  return (
    <PublicShell {...shell}>
      <section className="page-hero"><p className="public-kicker">What&apos;s on</p><h1>Exhibitions<br /><em>&amp; events.</em></h1><p>Upcoming shows, workshops and conversations at The Haat of Art.</p></section>
      <section className="page-section">
        {events === null ? <p className="events-message" role="status">Events are temporarily unavailable. Please try again later.</p>
          : events.length === 0 ? <p className="events-message">New events will be announced soon.</p>
          : <div className="event-grid">{events.map((event, index) => <article className={`event-card event-${(index % 3) + 1}`} key={event.id}>
            {event.media.length > 0 && <div className="event-card-media">{event.media.map((media) => media.mediaType === 'VIDEO' ? <video key={media.id} src={`${apiBaseUrl}${media.url}`} aria-label={media.altText} controls playsInline preload="metadata" /> : <img key={media.id} src={`${apiBaseUrl}${media.url}`} alt={media.altText} loading="lazy" />)}</div>}
            <div className="event-overlay"><div><p>{event.venue} &nbsp;·&nbsp; {formatDate(event.startsAt)} — {formatDate(event.endsAt)}</p><h3>{event.title}</h3><span className="event-description">{event.description}</span></div></div>
          </article>)}</div>}
      </section>
    </PublicShell>
  )
}
