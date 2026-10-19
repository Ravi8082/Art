'use client'

import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { formatEventDates, splitPlaces, type LiveEvent } from '@/lib/indore-live'

export type UpcomingEvent = Pick<LiveEvent, 'slug' | 'title' | 'city' | 'state' | 'venue' | 'startsAt' | 'endsAt'>
export const PICK_EVENT = 'haat:pick-event'

// Hands the chosen exhibition to the registration form on this same page.
function pick(event: UpcomingEvent) {
  window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: { slug: event.slug, state: splitPlaces(event.state)[0] ?? '' } }))
  document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function UpcomingExhibitions({ events }: { events: UpcomingEvent[] }) {
  if (!events.length) return null
  return (
    <section className="in-upcoming" id="upcoming" aria-labelledby="in-upcoming-title">
      <div className="in-upcoming-head">
        <p className="th-eyebrow">Upcoming exhibitions</p>
        <h2 id="in-upcoming-title">Find a Haat of Art near you</h2>
        <p>Every exhibition open for free visitor registration, with the states and cities it visits.</p>
      </div>
      <div className="in-upcoming-grid">
        {events.map((event) => {
          const states = splitPlaces(event.state)
          const cities = splitPlaces(event.city)
          return (
            <article key={event.slug} className="in-upcoming-card">
              <h3>{event.title}</h3>
              <p><CalendarDays size={14} />{formatEventDates(event.startsAt, event.endsAt)}</p>
              <p><MapPin size={14} />{event.venue}</p>
              {states.length > 0 && <div className="in-upcoming-tags"><b>States</b>{states.map((state) => <i key={state}>{state}</i>)}</div>}
              {cities.length > 0 && <div className="in-upcoming-tags"><b>Cities</b>{cities.map((city) => <i key={city}>{city}</i>)}</div>}
              <button type="button" onClick={() => pick(event)}>Get free pass <ArrowRight size={14} /></button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
