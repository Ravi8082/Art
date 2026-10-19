'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowLeft, CalendarDays, Check, MapPin, QrCode, TicketCheck } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type EventOption = {
  id: string
  title: string
  city: string
  venue: string
  startsAt: string
  endsAt: string
  registrationDeadline: string | null
  description: string
}
type VisitorPass = {
  passId: string
  eventId: string
  title: string
  city: string
  venue: string
  startsAt: string
  endsAt: string
  checkedInAt: string | null
  qrData: string | null
  status: string
}
type NotificationPreferences = { announcements: boolean; transactional: boolean }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: { accept: 'application/json', ...init?.headers },
  })
  const data = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function DashboardVisitorPasses() {
  const [events, setEvents] = useState<EventOption[]>([])
  const [passes, setPasses] = useState<VisitorPass[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences>({ announcements: false, transactional: true })
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [eventData, passData, preferenceData] = await Promise.all([
        request<{ events: EventOption[] }>('/api/passes/visitor/events'),
        request<{ passes: VisitorPass[] }>('/api/passes/visitor/passes'),
        request<NotificationPreferences>('/api/passes/visitor/preferences'),
      ])
      setEvents(eventData.events)
      setPasses(passData.passes)
      setPreferences(preferenceData)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load visitor passes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function registerForEvent(eventId: string) {
    setRegistering(eventId)
    setError('')
    setNotice('')
    try {
      await request(`/api/passes/visitor/events/${encodeURIComponent(eventId)}/register`, { method: 'POST' })
      setNotice('Your entry pass is ready. Keep its QR code available for event check-in.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not register for this exhibition.')
    } finally {
      setRegistering('')
    }
  }

  async function savePreferences() {
    setSavingPreferences(true)
    setError('')
    setNotice('')
    try {
      const saved = await request<NotificationPreferences>('/api/passes/visitor/preferences', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      setPreferences(saved)
      setNotice('Your notification preferences have been saved.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your preferences.')
    } finally {
      setSavingPreferences(false)
    }
  }

  const registeredEvents = new Set(passes.map((pass) => pass.eventId))

  return (
    <main className="role-access-page">
      <header className="role-access-header">
        <Link href="/dashboard" className="role-access-back"><ArrowLeft size={15} /> Visitor dashboard</Link>
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span className="role-access-secure"><TicketCheck size={14} /> Visitor entry passes</span>
      </header>
      <div className="role-access-content visitor-pass-content">
        <div className="role-access-title"><span className="role-access-icon"><QrCode size={22} /></span><div><p className="role-eyebrow">Your event access</p><h1>Visitor Passes</h1><p>Register for an upcoming exhibition and show its QR pass at the entrance.</p></div></div>
        {notice && <p className="role-access-success" role="status"><Check size={15} /> {notice}</p>}
        {error && <p className="role-error" role="alert">{error}</p>}
        {loading ? <p className="role-access-empty">Loading events and passes…</p> : (
          <>
            <section className="visitor-pass-section">
              <div className="visitor-section-heading"><div><p className="role-eyebrow">Your tickets</p><h2>My entry passes</h2></div><span>{passes.length} total</span></div>
              {passes.length ? <div className="visitor-pass-grid">{passes.map((pass) => <VisitorPassCard key={pass.passId} pass={pass} />)}</div> : <p className="role-access-empty visitor-empty">No passes yet. Choose an upcoming exhibition below to register.</p>}
            </section>
            <section className="visitor-pass-section">
              <div className="visitor-section-heading"><div><p className="role-eyebrow">Discover</p><h2>Upcoming exhibitions</h2></div><span>{events.length} open</span></div>
              {events.length ? <div className="visitor-event-grid">{events.map((event) => {
                const registered = registeredEvents.has(event.id)
                return <article className="visitor-event-card" key={event.id}>
                  <span className="visitor-event-date"><CalendarDays size={15} /> {dateLabel(event.startsAt)}</span>
                  <h3>{event.title}</h3>
                  <p className="visitor-event-location"><MapPin size={14} /> {[event.venue, event.city].filter(Boolean).join(' · ') || 'Venue to be announced'}</p>
                  {event.description && <p className="visitor-event-description">{event.description}</p>}
                  <button className="role-save-button" type="button" disabled={registered || registering === event.id} onClick={() => void registerForEvent(event.id)}>
                    {registered ? <><Check size={15} /> Registered</> : registering === event.id ? 'Creating your pass…' : <><QrCode size={15} /> Register &amp; get pass</>}
                  </button>
                </article>
              })}</div> : <p className="role-access-empty visitor-empty">There are no upcoming exhibitions open for registration right now.</p>}
            </section>
            <section className="visitor-pass-section">
              <div className="visitor-section-heading"><div><p className="role-eyebrow">Stay in the loop</p><h2>Email preferences</h2></div></div>
              <label className="visitor-preference-row"><span><strong>Event announcements &amp; reminders</strong><small>Receive exhibition announcements and event reminder emails when available.</small></span><input type="checkbox" checked={preferences.announcements} onChange={(event) => setPreferences((current) => ({ ...current, announcements: event.target.checked }))} /></label>
              <label className="visitor-preference-row"><span><strong>Pass and registration updates</strong><small>Keep essential registration and visitor-pass messages enabled.</small></span><input type="checkbox" checked={preferences.transactional} onChange={(event) => setPreferences((current) => ({ ...current, transactional: event.target.checked }))} /></label>
              <button className="role-save-button visitor-preference-save" type="button" onClick={() => void savePreferences()} disabled={savingPreferences}>{savingPreferences ? 'Saving…' : 'Save email preferences'}</button>
              <p className="visitor-preference-disclaimer">Preference storage is active. Email delivery depends on the platform email service being configured.</p>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function VisitorPassCard({ pass }: { pass: VisitorPass }) {
  const [qrImage, setQrImage] = useState('')
  const [qrError, setQrError] = useState('')

  useEffect(() => {
    if (!pass.qrData) return
    let active = true
    void QRCode.toDataURL(pass.qrData, { errorCorrectionLevel: 'M', margin: 1, width: 200 })
      .then((image) => { if (active) setQrImage(image) })
      .catch(() => { if (active) setQrError('QR code could not be displayed. Please reload this page.') })
    return () => { active = false }
  }, [pass.qrData])

  return (
    <article className="visitor-pass-card">
      <div className="visitor-pass-card-title"><div><p className="role-eyebrow">The Haat of Art</p><h3>{pass.title}</h3><span>{dateLabel(pass.startsAt)}{pass.city ? ` · ${pass.city}` : ''}</span></div><span className={`visitor-pass-status ${pass.status === 'Active' ? 'active' : ''}`}>{pass.status}</span></div>
      <div className="visitor-pass-body">
        <div className="visitor-qr-frame">{qrImage ? <img src={qrImage} alt={`QR entry pass for ${pass.title}`} /> : pass.qrData ? <span className="role-spinner" /> : <span>Pass unavailable</span>}</div>
        <div><p><CalendarDays size={14} /> {dateLabel(pass.startsAt)}</p><p><MapPin size={14} /> {[pass.venue, pass.city].filter(Boolean).join(' · ') || 'Venue to be announced'}</p>{pass.checkedInAt && <p><Check size={14} /> Checked in {dateLabel(pass.checkedInAt)}</p>}<small>Scan with Google Lens or the website check-in scanner. It can only be checked in once.</small>{pass.qrData && <Link href={`/visitor/pass/${encodeURIComponent(pass.qrData)}`} className="visitor-pass-info-link" target="_blank">View pass details</Link>}{qrError && <p className="role-access-validation" role="alert">{qrError}</p>}</div>
      </div>
    </article>
  )
}
