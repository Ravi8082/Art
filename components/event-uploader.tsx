'use client'

import { useState } from 'react'
import { useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, ImagePlus, MapPin, ShieldCheck, Store, UploadCloud } from 'lucide-react'
import { indianStates, indianUnionTerritories } from '@/lib/indian-states'
import { citiesByState } from '@/lib/indian-cities'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])
const maxFileBytes = 50 * 1024 * 1024
type AuthStatus = 'checking' | 'signed-out' | 'signed-in'

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return `Request failed (${response.status})`
}

type StallType = { id: string; code: string; name: string; category: string; widthM: string; depthM: string; price: string; taxRate: string; includes: string }
const rupees = (value: string | number) => `₹${Number(value).toLocaleString('en-IN')}`

export function EventUploader() {
  const [files, setFiles] = useState<File[]>([])
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [customCity, setCustomCity] = useState('')
  const [stallTypes, setStallTypes] = useState<StallType[]>([])
  const [slots, setSlots] = useState<Record<string, number>>({})
  const cityOptions = states.flatMap((state) => citiesByState[state] ?? []).filter((city, index, all) => all.indexOf(city) === index && !cities.includes(city))
  const totalSlots = Object.values(slots).reduce((sum, count) => sum + count, 0)
  const potential = stallTypes.reduce((sum, type) => sum + (slots[type.id] ?? 0) * Number(type.price), 0)
  const addCustomCity = () => {
    const value = customCity.trim()
    if (value && !cities.some((city) => city.toLowerCase() === value.toLowerCase())) setCities((current) => [...current, value])
    setCustomCity('')
  }
  const [busy, setBusy] = useState(false)
  const [startValue, setStartValue] = useState('')
  const [endValue, setEndValue] = useState('')
  function changeStart(value: string) {
    setStartValue(value)
    // Keep the end date from sitting before the new start.
    if (value && (!endValue || endValue <= value)) setEndValue(value.slice(0, 11) + '18:00')
  }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) setAuthStatus('signed-out')
          return
        }
        if (!response.ok) throw new Error(await responseError(response))
        if (active) setAuthStatus('signed-in')
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not verify your dashboard session.')
        setAuthStatus('signed-out')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (authStatus !== 'signed-in') return
    fetch(`${apiBaseUrl}/api/bookings/stall-types`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<StallType[]> : [])
      .then(setStallTypes)
      .catch(() => setStallTypes([]))
  }, [authStatus])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim().toLowerCase(), password: adminPassword }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      setAdminPassword('')
      setAuthStatus('signed-in')
      setMessage('Signed in securely. You can now create an exhibition.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setMessage('')
    setError('')

    if (files.length === 0) {
      setError('Event ke saath kam se kam ek image ya video select karein.')
      return
    }
    const invalidFile = files.find((file) => !allowedTypes.has(file.type) || file.size > maxFileBytes)
    if (invalidFile) {
      setError(`${invalidFile.name}: supported image/video format use karein; maximum size 50 MB per file hai.`)
      return
    }

    const form = new FormData(formElement)
    if (!states.length || !cities.length) {
      setError('Kam se kam ek state aur ek city select karein.')
      return
    }
    const startsAt = new Date(String(form.get('startsAt')))
    const endsAt = new Date(String(form.get('endsAt')))
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      setError('End date and time must be later than the event start.')
      return
    }

    setBusy(true)
    let eventId = ''
    try {
      const response = await fetch(`${apiBaseUrl}/api/events`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.get('title'),
          description: form.get('description'),
          venue: form.get('venue'),
          city: cities.join(', '),
          state: states.join(', '),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          stalls: stallTypes.map((type) => ({ stallTypeId: type.id, count: slots[type.id] ?? 0 })).filter((item) => item.count > 0),
        }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const created: unknown = await response.json()
      if (!created || typeof created !== 'object' || !('id' in created) || typeof created.id !== 'string') {
        throw new Error('Event API returned an invalid response.')
      }
      eventId = created.id

      for (const file of files) {
        const upload = await fetch(`${apiBaseUrl}/api/events/${eventId}/media`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': file.type,
            'X-Alt-Text': encodeURIComponent(`${String(form.get('title'))}: ${file.name}`.slice(0, 255)),
          },
          body: file,
        })
        if (!upload.ok) throw new Error(`${file.name}: ${await responseError(upload)}`)
      }

      setMessage(`Event ${eventId}, ${totalSlots} stall slot(s) aur ${files.length} media file(s) save hue. Approval ke baad homepage par dikh sakte hain.`)
      formElement.reset()
      setStartValue(''); setEndValue('')
      setFiles([])
      setStates([])
      setCities([])
      setSlots({})
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Unknown error'
      setError(eventId
        ? `Event ${eventId} create ho gaya, lekin media upload complete nahi hua: ${detail}`
        : detail)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="event-admin dashboard-event-admin">
      <header className="event-admin-header dashboard-event-header">
        <div>
          <p className="eyebrow dashboard-event-brand">The Haat of Art <span aria-hidden="true">·</span> Exhibition management</p>
          <h1>Create an exhibition</h1>
          <p>Add event details and gallery media. New exhibitions are submitted for approval before appearing on the public website.</p>
        </div>
        <div className="dashboard-event-header-actions">
          <Link className="dashboard-event-public-link" href="/exhibitions" target="_blank" rel="noopener noreferrer">View exhibitions <ExternalLink size={14} /></Link>
          <Link className="dashboard-event-back" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link>
        </div>
      </header>

      <div className="dashboard-event-content">
        {authStatus === 'checking' && <p className="dashboard-event-session-loading"><span />Checking your secure dashboard session…</p>}
        {authStatus === 'signed-out' && (
          <form className="event-form dashboard-event-login" onSubmit={signIn}>
            <span className="dashboard-event-login-icon"><ShieldCheck size={21} /></span>
            <div><h2>Sign in to create an exhibition</h2><p>Use your authorized dashboard account. Your password is only sent to the secure sign-in endpoint.</p></div>
            <label>Admin email<input type="email" autoComplete="username" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} /></label>
            <label>Admin password<input type="password" autoComplete="current-password" required value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></label>
            {error && <p className="event-form-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ShieldCheck size={15} /></button>
          </form>
        )}
        {authStatus === 'signed-in' && (
          <form className="event-form dashboard-event-form" onSubmit={submitEvent}>
            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span><CalendarDays size={18} /></span><div><p className="eyebrow">01 · Exhibition details</p><h2>Tell us about the event</h2><p>Use clear information so visitors and artists can find your exhibition.</p></div></div>
              <div className="dashboard-event-fields">
                <label className="dashboard-event-wide">Event title<input name="title" required minLength={2} maxLength={255} placeholder="e.g. Mumbai Art Expo 2026" /></label>
                <label className="dashboard-event-wide">Description<textarea name="description" required minLength={10} rows={4} placeholder="Describe the exhibition, its artists and what visitors can expect." /></label>
                <label>Venue<span className="dashboard-event-input-icon"><MapPin size={15} /><input name="venue" required minLength={2} maxLength={255} placeholder="Venue name" /></span></label>
                <div className="dashboard-event-wide event-places">
                  <span className="event-places-label">States *</span>
                  <select value="" onChange={(change) => { const value = change.target.value; if (value) setStates((current) => current.includes(value) ? current : [...current, value]) }}>
                    <option value="">{states.length ? 'Add another state…' : 'Select a state…'}</option>
                    {[...indianStates, ...indianUnionTerritories].filter((state) => !states.includes(state)).map((state) => <option key={state}>{state}</option>)}
                  </select>
                  {states.length > 0 && <div className="event-chips">{states.map((state) => <button type="button" key={state} onClick={() => { setStates((current) => current.filter((item) => item !== state)); setCities((current) => current.filter((city) => !(citiesByState[state] ?? []).includes(city) || states.some((other) => other !== state && (citiesByState[other] ?? []).includes(city)))) }} aria-label={`Remove ${state}`}>{state} ×</button>)}</div>}
                </div>
                <div className="dashboard-event-wide event-places">
                  <span className="event-places-label">Cities *</span>
                  <select value="" disabled={!states.length} onChange={(change) => { const value = change.target.value; if (value) setCities((current) => [...current, value]) }}>
                    <option value="">{states.length ? 'Select a city…' : 'Select a state first'}</option>
                    {cityOptions.map((city) => <option key={city}>{city}</option>)}
                  </select>
                  <span className="event-city-custom">
                    <input value={customCity} disabled={!states.length} onChange={(change) => setCustomCity(change.target.value)} onKeyDown={(key) => { if (key.key === 'Enter') { key.preventDefault(); addCustomCity() } }} maxLength={80} placeholder="Other city? Type and press Add" />
                    <button type="button" disabled={!customCity.trim()} onClick={addCustomCity}>Add</button>
                  </span>
                  {cities.length > 0 && <div className="event-chips">{cities.map((city) => <button type="button" key={city} onClick={() => setCities((current) => current.filter((item) => item !== city))} aria-label={`Remove ${city}`}>{city} ×</button>)}</div>}
                </div>
                <div className="event-dates dashboard-event-dates">
                  <label>Starts at<span className="dashboard-event-input-icon"><Clock3 size={15} /><input name="startsAt" type="datetime-local" required value={startValue} onChange={(e) => changeStart(e.target.value)} /></span></label>
                  <label>Ends at<span className="dashboard-event-input-icon"><Clock3 size={15} /><input name="endsAt" type="datetime-local" required value={endValue} min={startValue || undefined} onChange={(e) => setEndValue(e.target.value)} /></span>{startValue && endValue && endValue <= startValue && <small role="alert" style={{ color: '#b42318' }}>End date start ke baad honi chahiye.</small>}</label>
                </div>
              </div>
            </section>

            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span className="is-blue"><Store size={18} /></span><div><p className="eyebrow">02 · Stall slots &amp; pricing</p><h2>How many stalls are available?</h2><p>Set the number of slots for each stall type. Prices are the same ones artists see on the Book a Stall page.</p></div></div>
              {stallTypes.length === 0 ? <p className="event-stalls-empty">No stall types found. Add them from the Stalls dashboard first.</p> : (
                <div className="event-stalls">
                  {stallTypes.map((type) => (
                    <label key={type.id} className="event-stall-row">
                      <span><strong>{type.name}</strong><small>{type.widthM}×{type.depthM} m · {type.category.toLowerCase()}{type.includes ? ` · ${type.includes}` : ''}</small></span>
                      <em>{rupees(type.price)}<small>+ {Number(type.taxRate)}% GST</small></em>
                      <input type="number" min={0} max={500} inputMode="numeric" aria-label={`Slots for ${type.name}`} value={slots[type.id] ?? 0} onChange={(change) => setSlots((current) => ({ ...current, [type.id]: Math.max(0, Math.min(500, Number(change.target.value) || 0)) }))} />
                    </label>
                  ))}
                  <p className="event-stalls-total"><b>{totalSlots}</b> slots available · potential stall revenue <b>{rupees(potential)}</b> (before GST)</p>
                </div>
              )}
            </section>

            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span className="is-blue"><ImagePlus size={18} /></span><div><p className="eyebrow">03 · Event gallery</p><h2>Add images and videos</h2><p>Choose files that represent the venue, artworks or exhibition experience.</p></div></div>
              <label className="dashboard-event-upload">
                <UploadCloud size={24} />
                <strong>Choose event images or videos</strong>
                <span>JPG, PNG, WebP, GIF, MP4, WebM or MOV · up to 50 MB per file</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" multiple onChange={(change) => setFiles(Array.from(change.currentTarget.files ?? []))} />
              </label>
              {files.length > 0 && <div className="dashboard-event-selected-files"><div><strong>{files.length} file{files.length === 1 ? '' : 's'} selected</strong><button type="button" onClick={(click) => { const input = click.currentTarget.closest('form')?.querySelector<HTMLInputElement>('input[type="file"]'); if (input) input.value = ''; setFiles([]) }}>Clear selection</button></div><ul>{files.map((file) => <li key={`${file.name}-${file.lastModified}`}><span><ImagePlus size={14} /><strong>{file.name}</strong></span><small>{formatFileSize(file.size)}</small></li>)}</ul></div>}
            </section>

            {error && <p className="event-form-error dashboard-event-feedback" role="alert">{error}</p>}
            {message && <p className="event-form-success dashboard-event-feedback" role="status"><Check size={16} />{message}</p>}
            <div className="dashboard-event-submit-row"><p>After submission, the exhibition will be reviewed before publishing.</p><button type="submit" disabled={busy}>{busy ? 'Saving exhibition and media…' : 'Submit exhibition for approval'} <ArrowLeft size={15} /></button></div>
          </form>
        )}
      </div>
    </main>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
