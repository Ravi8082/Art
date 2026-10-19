'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Mail, Users, Palette, Send } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type Summary = { subscribers: number; visitors: number; artists: number; whatsapp?: number } | null
type TourEvent = {
  id: string; title: string; venue: string; status: string; startsAt: string; endsAt: string
  announcedAt: string | null; announceSummary: Summary
  registrations: number; applications: number; totalStalls: number; availableStalls: number
  cities: string[]; states: string[]; visitorCities: { city: string; total: number }[]
}
type Overview = {
  audience: { subscribers: number; visitors: number; artists: number }
  artistStates: { state: string; total: number }[]
  events: TourEvent[]
}

const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function EventTourOverview() {
  const [data, setData] = useState<Overview | null>(null)
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/events/admin/overview`, { credentials: 'include' }).catch(() => null)
    if (response?.ok) setData(await response.json() as Overview)
  }, [])
  useEffect(() => { void load() }, [load])

  async function act(event: TourEvent, action: 'approve' | 'publish' | 'announce') {
    setBusyId(event.id)
    setNote('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/events/${event.id}/${action}`, { method: action === 'announce' ? 'POST' : 'PATCH', credentials: 'include' })
      const body = await response.json().catch(() => ({})) as { error?: string; queued?: number }
      if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`)
      setNote(action === 'approve' ? 'Event approved. Ab Publish karein.' : action === 'publish' ? 'Event published. Artists, visitors aur subscribers ko mail queue ho gayi.' : `Mail queue hui: ${body.queued ?? 0} recipients.`)
      await load()
    } catch (cause) {
      setNote(cause instanceof Error ? cause.message : 'Action failed.')
    } finally {
      setBusyId('')
      void load()
    }
  }

  if (!data) return null
  const { audience } = data
  return (
    <section className="tour-overview" aria-labelledby="tour-overview-title">
      <header>
        <p className="eyebrow">Tour overview</p>
        <h2 id="tour-overview-title">Exhibitions, states &amp; audience</h2>
        <p>Publish karte hi har artist, subscriber aur consent dene wale visitor ko mail automatic queue ho jati hai.</p>
      </header>
      <div className="tour-audience">
        <div><Palette size={16} /><b>{audience.artists}</b><small>Artists</small></div>
        <div><Users size={16} /><b>{audience.visitors}</b><small>Past visitors (consented)</small></div>
        <div><Mail size={16} /><b>{audience.subscribers}</b><small>Newsletter subscribers</small></div>
      </div>
      {note && <p className="tour-note" role="status">{note}</p>}
      <div className="tour-events">
        {data.events.map((event) => (
          <article key={event.id} className="tour-card">
            <div className="tour-card-head">
              <div><strong>{event.title}</strong><small>{dateLabel(event.startsAt)} – {dateLabel(event.endsAt)} · {event.venue}</small></div>
              <span className={`tour-status tour-${event.status.toLowerCase()}`}>{event.status.replace('_', ' ')}</span>
            </div>
            <div className="tour-places"><span><MapPin size={13} /> States</span>{(event.states.length ? event.states : ['—']).map((state) => <i key={state}>{state}</i>)}</div>
            <div className="tour-places"><span><MapPin size={13} /> Cities</span>{(event.cities.length ? event.cities : ['—']).map((city) => <i key={city}>{city}</i>)}</div>
            <div className="tour-stats">
              <span><b>{event.registrations}</b> visitor registrations</span>
              <span><b>{event.applications}</b> artist applications</span>
              {event.totalStalls > 0
                ? <span><b>{event.availableStalls}</b> of {event.totalStalls} stall slots available</span>
                : <span>No stall slots added yet — <a href="/dashboard/stalls">add them in Stalls</a></span>}
              {event.visitorCities.map((row) => <span key={row.city}><b>{row.total}</b> from {row.city}</span>)}
            </div>
            <p className="tour-mail">
              {event.announcedAt && event.announceSummary
                ? `Mail bhej di gayi (${dateLabel(event.announcedAt)}): ${event.announceSummary.artists} artists, ${event.announceSummary.visitors} visitors, ${event.announceSummary.subscribers} subscribers.`
                : event.announcedAt ? `Mail bhej di gayi (${dateLabel(event.announcedAt)}).` : event.status === 'PUBLISHED' ? 'Mail abhi nahi gayi — "Send mail now" dabayein.' : 'Mail abhi nahi gayi — publish karte hi jayegi.'}
            </p>
            <div className="tour-actions">
              {event.status === 'PENDING_APPROVAL' && <button type="button" disabled={busyId === event.id} onClick={() => void act(event, 'approve')}>Approve</button>}
              {event.status === 'APPROVED' && <button type="button" disabled={busyId === event.id} onClick={() => void act(event, 'publish')}>Publish &amp; send mail</button>}
              {(event.status === 'APPROVED' || event.status === 'PUBLISHED') && (event.announcedAt || event.status === 'PUBLISHED') && <button type="button" className="is-ghost" disabled={busyId === event.id} onClick={() => void act(event, 'announce')}><Send size={13} /> {event.announcedAt ? 'Resend mail' : 'Send mail now'}</button>}
            </div>
          </article>
        ))}
      </div>
      {data.artistStates.length > 0 && (
        <div className="tour-artist-states">
          <h3>Artists by state</h3>
          <div>{data.artistStates.map((row) => <i key={row.state}>{row.state} · {row.total}</i>)}</div>
        </div>
      )}
    </section>
  )
}
