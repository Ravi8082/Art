'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import { formatEventDates, splitPlaces, type LiveEvent } from '@/lib/indore-live'
import { hasNotExpired } from '@/lib/exhibitions-schedule'

export type UpcomingEvent = Pick<LiveEvent, 'slug' | 'title' | 'city' | 'state' | 'venue' | 'startsAt' | 'endsAt'>
export const PICK_EVENT = 'haat:pick-event'

// Hands the chosen exhibition to the registration form on this same page.
function pick(event: UpcomingEvent) {
  window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: { slug: event.slug, state: splitPlaces(event.state)[0] ?? '' } }))
  document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function UpcomingExhibitions({ events }: { events: UpcomingEvent[] }) {
  const [now, setNow] = useState(() => Date.now())
  const activeEvents = useMemo(
    () => events
      .filter((event) => hasNotExpired(event.endsAt, now))
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [events, now],
  )

  useEffect(() => {
    const nextExpiry = activeEvents.reduce((nearest, event) => {
      const endTime = Date.parse(event.endsAt)
      return Number.isFinite(endTime) && endTime < nearest ? endTime : nearest
    }, Number.POSITIVE_INFINITY)
    if (!Number.isFinite(nextExpiry)) return
    const timeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(Math.max(0, nextExpiry - Date.now() + 1), 2_147_483_647),
    )
    return () => window.clearTimeout(timeout)
  }, [activeEvents])

  if (!activeEvents.length) return null
  return (
    <section className="in-upcoming" id="upcoming" aria-labelledby="in-upcoming-title">
      <div className="in-upcoming-head">
        <p className="th-eyebrow">Other upcoming exhibitions across India</p>
        <h2 id="in-upcoming-title">Find a Haat of Art near you</h2>
        <p>Browse announced shows by date, city, and venue, then choose the visitor pass that suits your visit.</p>
      </div>
      <div className="in-upcoming-grid">
        {activeEvents.map((event) => {
          const states = splitPlaces(event.state)
          const cities = splitPlaces(event.city)
          return (
            <article key={event.slug} className="in-upcoming-card">
              <h3>
                <Link href={`/pass/${encodeURIComponent(event.slug)}`} aria-label={`${event.title} event details`}>
                  {event.title}<ArrowRight size={14} aria-hidden="true" />
                </Link>
              </h3>
              <p><CalendarDays size={14} />{formatEventDates(event.startsAt, event.endsAt)}</p>
              <p><MapPin size={14} />{event.venue}</p>
              {states.length > 0 && <div className="in-upcoming-tags"><b>States</b>{states.slice(0, 3).map((state) => <i key={state}>{state}</i>)}{states.length > 3 && <i title={states.slice(3).join(', ')} aria-label={`${states.length - 3} more states`}>+{states.length - 3} more</i>}</div>}
              {cities.length > 0 && <div className="in-upcoming-tags"><b>Cities</b>{cities.slice(0, 3).map((city) => <i key={city}>{city}</i>)}{cities.length > 3 && <i title={cities.slice(3).join(', ')} aria-label={`${cities.length - 3} more cities`}>+{cities.length - 3} more</i>}</div>}
              <button type="button" onClick={() => pick(event)}>Choose exhibition &amp; pass <ArrowRight size={14} /></button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
