import Link from 'next/link'
import { ArrowDown, ArrowRight, Clock3 } from 'lucide-react'
import type { EventFlowContent, InvitedGuest } from '@/lib/api'
import { apiBaseUrl } from '@/lib/api'

const jumpLabels = ['Spatial Setup', 'VIP Preview', 'Live Art', 'Award Gala', 'Grand Closing']

function imageSource(path: string) {
  if (/^https?:\/\//i.test(path)) return path
  return path.startsWith('/api/') ? `${apiBaseUrl}${path}` : path
}

function guestInitials(name: string) {
  return name
    .replace(/^Dr\.\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function guestCeremonies(guest: InvitedGuest) {
  const summary = `${guest.roleSummary} ${guest.designation}`.toLowerCase()
  const ceremonies: string[] = []
  if (/inaugur|lamp-light|chief guest|collector preview/.test(summary)) {
    ceremonies.push('Day 1 · Red-Carpet Inauguration')
  }
  if (/certificate|closing|felicit|award|memento/.test(summary)) {
    ceremonies.push('Day 3 · Grand Award Gala')
  }
  return ceremonies.length ? ceremonies : ['Day 1 · Collector Preview']
}

function isPublishableGuest(guest: InvitedGuest) {
  return guest.isActive
    && guest.showOnExhibitions
    && !guest.isPlaceholder
    && !/placeholder/i.test(`${guest.name} ${guest.designation} ${guest.roleSummary}`)
}

export function EventFlowPage({ content, guests }: { content: EventFlowContent; guests: InvitedGuest[] }) {
  const featuredGuests = guests.filter(isPublishableGuest)
  const heroImage = imageSource(content.phases.find((phase) => phase.id === 'inauguration')?.imageUrl ?? '/media/exhibition-gallery.jpeg')

  return (
    <div className="event-flow-page">
      <section className="event-flow-hero event-flow-grand-hero">
        <img className="event-flow-hero-backdrop" src={heroImage} alt="" aria-hidden="true" fetchPriority="high" />
        <div className="event-flow-hero-inner">
          <p className="event-flow-kicker">{content.kicker}</p>
          <h1>{content.title}</h1>
          <p className="event-flow-intro">{content.subtitle}</p>
          <div className="event-flow-scale-strip" aria-label="The scale of our flagship art fair">
            <div><strong>500+ Artists</strong><span>Curated Pan-India Showcase</span></div>
            <div><strong>Star Inauguration</strong><span>Celebrities &amp; Chief Guests</span></div>
            <div><strong>Live Galleries</strong><span>Painting · Sculpture · 3D Art</span></div>
            <div><strong>Grand Gala Night</strong><span>Awards &amp; National Recognition</span></div>
          </div>
          <div className="event-flow-actions">
            <Link className="event-flow-button is-primary" href="/book-your-stall">Book Your Stall <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link className="event-flow-button is-secondary" href="/indore">Reserve Visitor Pass <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>

      {featuredGuests.length > 0 && (
        <section className="event-flow-guests" id="event-flow-guests" aria-labelledby="event-flow-guests-title">
          <div className="event-flow-section-heading">
            <p className="event-flow-kicker">DISTINGUISHED PRESENCE</p>
            <h2 id="event-flow-guests-title">Celebrities, Chief Guests &amp; Dignitaries</h2>
            <p>Meet the cultural patrons and luminaries who bring each edition into the national spotlight.</p>
          </div>
          <div className="event-flow-guest-grid">
            {featuredGuests.map((guest) => {
              const photoUrl = guest.photoUrl?.trim()
              return (
                <article className="event-flow-guest-card" key={guest.id}>
                  <div className="event-flow-guest-portrait">
                    {photoUrl
                      ? <img src={imageSource(photoUrl)} alt={guest.name} loading="lazy" />
                      : <div className="event-flow-guest-monogram" role="img" aria-label={`${guest.name} portrait not yet uploaded`}>{guestInitials(guest.name)}</div>}
                    <span className="event-flow-guest-role">{guest.roleBadge}</span>
                    <span className="event-flow-guest-edition">{guest.editionTag}</span>
                  </div>
                  <div className="event-flow-guest-copy">
                    <h3>{guest.name}</h3>
                    <p className="event-flow-guest-designation">{guest.designation}</p>
                    <p className="event-flow-guest-edition-caption">{guest.editionTag}</p>
                    {guest.roleSummary && <p className="event-flow-guest-summary">{guest.roleSummary}</p>}
                    <div className="event-flow-guest-ceremonies">
                      {guestCeremonies(guest).map((ceremony) => <span key={ceremony}>{ceremony}</span>)}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      <section className="event-flow-journey" aria-label="Five phases of the exhibition">
        <div className="event-flow-phase-nav-wrap">
          <nav className="event-flow-phase-tabs" aria-label="Jump to exhibition phase">
            {content.phases.map((phase, index) => (
              <a href={`#${phase.id}`} key={phase.id}>
                <span>{phase.number}</span>{jumpLabels[index] ?? phase.title}<ArrowDown size={13} aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
        <div className="event-flow-section-heading">
          <p className="event-flow-kicker">THE THREE-DAY GRAND PRODUCTION</p>
          <h2>A national showcase, shaped in five acts</h2>
          <p>From the first lighting check to the final collector handover, each phase brings artists, audiences and partners together.</p>
        </div>
        <div className="event-flow-phase-list">
          {content.phases.map((phase, index) => (
            <article className={`event-flow-phase${index % 2 === 1 ? ' is-reversed' : ''}`} id={phase.id} key={phase.id}>
              <div className="event-flow-phase-card">
                <div className="event-flow-phase-image">
                  <img src={imageSource(phase.imageUrl)} alt={`${phase.title} at The Haat of Art`} loading="lazy" />
                  <span className="event-flow-phase-badge">{phase.number} / 05</span>
                </div>
                <div className="event-flow-phase-copy">
                  <p className="event-flow-phase-index">PHASE {phase.number} <span>·</span> THE HAAT OF ART</p>
                  <span className="event-flow-time"><Clock3 size={15} aria-hidden="true" />{phase.timeframe}</span>
                  <h2>{phase.title}</h2>
                  <p>{phase.introduction}</p>
                  <ul>{phase.activities.map((activity) => <li key={activity}>{activity}</li>)}</ul>
                  {featuredGuests.length > 0 && (phase.id === 'inauguration' || phase.id === 'felicitation') && (
                    <Link className="event-flow-guest-reference" href="#event-flow-guests">
                      Meet our featured guests <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="event-flow-schedule">
        <div className="event-flow-section-heading">
          <p className="event-flow-kicker">A TYPICAL THREE-DAY EDITION</p>
          <h2>The programme, at a glance</h2>
          <p>Timings may be refined for each city edition; the exhibition team shares confirmed details with participants.</p>
        </div>
        <div className="event-flow-day-grid">
          {content.schedule.map((day) => (
            <article className="event-flow-day-card" key={day.day}>
              <header>
                <p>{day.day}</p>
                <h3>{day.title}</h3>
              </header>
              <ul>
                {day.items.map((item, index) => (
                  <li key={`${item.time}-${index}`}>
                    <span className="event-flow-period">{item.period}</span>
                    <time>{item.time}</time>
                    <p>{item.activity}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="event-flow-cta">
        <p className="event-flow-kicker">THE NEXT EDITION STARTS WITH YOU</p>
        <h2>{content.ctaTitle}</h2>
        <p>Bring your work, your curiosity and your community to a thoughtfully curated celebration of Indian art.</p>
        <div className="event-flow-actions">
          <Link className="event-flow-button is-light" href="/book-your-stall">Book Your Stall <ArrowRight size={17} aria-hidden="true" /></Link>
          <Link className="event-flow-button is-outline" href="/exhibitions">Explore Upcoming Editions <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>
    </div>
  )
}
