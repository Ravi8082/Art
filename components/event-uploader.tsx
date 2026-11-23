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

type StallType = { id: string; code: string; name: string; category: string; widthM: string; depthM: string; includes: string }
type StallRate = { price: string; slots: number }
const gstRate = 18
const rupees = (value: string | number) => `₹${Number(value).toLocaleString('en-IN')}`

export function EventUploader() {
  const [files, setFiles] = useState<File[]>([])
  const [states, setStates] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [customCity, setCustomCity] = useState('')
  const [stallTypes, setStallTypes] = useState<StallType[]>([])
  const [stallTypesError, setStallTypesError] = useState('')
  const [stallTypesLoading, setStallTypesLoading] = useState(false)
  const [stallTypesRetry, setStallTypesRetry] = useState(0)
  const [stateRates, setStateRates] = useState<Record<string, Record<string, StallRate>>>({})
  const [templateRates, setTemplateRates] = useState<Record<string, StallRate>>({})
  const cityOptions = states.flatMap((state) => citiesByState[state] ?? []).filter((city, index, all) => all.indexOf(city) === index && !cities.includes(city))
  const totalSlots = states.reduce((sum, state) => sum + stallTypes.reduce((stateSum, type) => stateSum + (stateRates[state]?.[type.id]?.slots ?? 0), 0), 0)
  const potential = states.reduce((sum, state) => sum + stallTypes.reduce((stateSum, type) => {
    const rate = stateRates[state]?.[type.id]
    return stateSum + (rate?.slots ?? 0) * (Number(rate?.price) || 0)
  }, 0), 0)
  const potentialGst = potential * gstRate / 100
  const potentialWithGst = potential + potentialGst
  const stateTotalSlots = (state: string) => stallTypes.reduce((sum, type) => sum + (stateRates[state]?.[type.id]?.slots ?? 0), 0)
  const statePotential = (state: string) => stallTypes.reduce((sum, type) => {
    const rate = stateRates[state]?.[type.id]
    return sum + (rate?.slots ?? 0) * (Number(rate?.price) || 0)
  }, 0)
  function updateStateRate(state: string, typeId: string, patch: Partial<StallRate>) {
    setStateRates((current) => {
      const currentState = current[state] ?? {}
      return {
        ...current,
        [state]: {
          ...currentState,
          [typeId]: { ...(currentState[typeId] ?? { price: '', slots: 0 }), ...patch },
        },
      }
    })
  }
  function updateTemplateRate(typeId: string, patch: Partial<StallRate>) {
    setTemplateRates((current) => ({
      ...current,
      [typeId]: { ...(current[typeId] ?? { price: '', slots: 0 }), ...patch },
    }))
  }
  function applyTemplateToStates() {
    setStateRates(Object.fromEntries(states.map((state) => [
      state,
      Object.fromEntries(stallTypes.map((type) => [type.id, { price: templateRates[type.id]?.price ?? '', slots: templateRates[type.id]?.slots ?? 0 }])),
    ])))
  }
  const addCustomCity = () => {
    const value = customCity.trim()
    if (value && !cities.some((city) => city.toLowerCase() === value.toLowerCase())) setCities((current) => [...current, value])
    setCustomCity('')
  }
  const addState = (state: string) => {
    if (state) setStates((current) => current.includes(state) ? current : [...current, state])
  }
  const removeState = (state: string) => {
    setStates((current) => current.filter((item) => item !== state))
    setCities((current) => current.filter((city) => !(citiesByState[state] ?? []).includes(city)
      || states.some((other) => other !== state && (citiesByState[other] ?? []).includes(city))))
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
    let active = true
    setStallTypesError('')
    setStallTypesLoading(true)
    fetch(`${apiBaseUrl}/api/bookings/stall-types`, { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response))
        const types: unknown = await response.json()
        if (!Array.isArray(types)) throw new Error('The stall category list was not in the expected format.')
        return types as StallType[]
      })
      .then((types) => {
        if (!active) return
        setStallTypes(types)
        setTemplateRates((current) => Object.fromEntries(types.map((type) => [type.id, current[type.id] ?? { price: '', slots: 0 }])))
      })
      .catch((cause: unknown) => {
        if (!active) return
        setStallTypes([])
        setStallTypesError(cause instanceof Error ? cause.message : 'Stall categories could not be loaded.')
      })
      .finally(() => { if (active) setStallTypesLoading(false) })
    return () => { active = false }
  }, [authStatus, stallTypesRetry])

  useEffect(() => {
    setStateRates((current) => Object.fromEntries(states.map((state) => [
      state,
      Object.fromEntries(stallTypes.map((type) => [type.id, current[state]?.[type.id] ?? { price: '', slots: 0 }])),
    ])))
  }, [states, stallTypes])

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
      setError('Select at least one image or video for the event.')
      return
    }
    const invalidFile = files.find((file) => !allowedTypes.has(file.type) || file.size > maxFileBytes)
    if (invalidFile) {
      setError(`${invalidFile.name}: use a supported image/video format; the maximum size is 50 MB per file.`)
      return
    }

    const form = new FormData(formElement)
    if (!states.length || !cities.length) {
      setError('Select at least one state and one city.')
      return
    }
    const missingRate = states.flatMap((state) => stallTypes.map((type) => ({
      state,
      type,
      rate: stateRates[state]?.[type.id] ?? { price: '', slots: 0 },
    }))).find(({ rate }) => rate.slots > 0 && (!rate.price.trim() || !Number.isFinite(Number(rate.price)) || Number(rate.price) < 0 || Number(rate.price) > 10000000))
    if (missingRate) {
      setError(`Enter a valid base price for ${missingRate.type.name} in ${missingRate.state} before setting available slots.`)
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
          statePricing: states.flatMap((state) => stallTypes.map((type) => {
            const rate = stateRates[state]?.[type.id] ?? { price: '', slots: 0 }
            return rate.price.trim() || rate.slots > 0
              ? { state, stallTypeId: type.id, price: Number(rate.price), taxRate: gstRate, slots: rate.slots }
              : null
          }).filter((rate): rate is NonNullable<typeof rate> => rate !== null)),
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

      setMessage(`Event ${eventId}, ${totalSlots} stall slot(s) and ${files.length} media file(s) saved. They can appear on the homepage after approval.`)
      formElement.reset()
      setStartValue(''); setEndValue('')
      setFiles([])
      setStates([])
      setCities([])
      setCustomCity('')
      setStateRates({})
      setTemplateRates((current) => Object.fromEntries(stallTypes.map((type) => [type.id, { price: '', slots: 0 }])))
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Unknown error'
      setError(eventId
        ? `Event ${eventId} was created, but the media upload did not complete: ${detail}`
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
              <div className="dashboard-event-section-heading"><span><CalendarDays size={18} /></span><div><p className="eyebrow">Exhibition setup</p><h2>01 · Exhibition Details</h2><p>Add clear information so visitors and artists can find your exhibition.</p></div></div>
              <div className="dashboard-event-fields">
                <label className="dashboard-event-wide">Event title<input name="title" required minLength={2} maxLength={255} placeholder="e.g. Mumbai Art Expo 2026" /></label>
                <label className="dashboard-event-wide">Description<textarea name="description" required minLength={10} rows={4} placeholder="Describe the exhibition, its artists and what visitors can expect." /></label>
                <label>Venue<span className="dashboard-event-input-icon"><MapPin size={15} /><input name="venue" required minLength={2} maxLength={255} placeholder="Venue name" /></span></label>
                <div className="dashboard-event-wide event-places">
                  <span className="event-places-label">States *</span>
                  <select value="" onChange={(change) => addState(change.target.value)}>
                    <option value="">{states.length ? 'Add another state…' : 'Select a state…'}</option>
                    {[...indianStates, ...indianUnionTerritories].filter((state) => !states.includes(state)).map((state) => <option key={state}>{state}</option>)}
                  </select>
                  {states.length > 0 && <div className="event-chips">{states.map((state) => <button type="button" key={state} onClick={() => removeState(state)} aria-label={`Remove ${state}`}>{state} ×</button>)}</div>}
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
                  <label>Ends at<span className="dashboard-event-input-icon"><Clock3 size={15} /><input name="endsAt" type="datetime-local" required value={endValue} min={startValue || undefined} onChange={(e) => setEndValue(e.target.value)} /></span>{startValue && endValue && endValue <= startValue && <small role="alert" style={{ color: '#b42318' }}>End date must be after the start date.</small>}</label>
                </div>
              </div>
            </section>

            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span className="is-blue"><Store size={18} /></span><div><p className="eyebrow">State-wise pricing</p><h2>02 · Stall Slots &amp; State-Wise Pricing</h2><p>Enter a different base price and slot count for each selected state. GST is calculated at 18%.</p></div></div>
              {stallTypesLoading ? <p className="event-stalls-empty" role="status">Loading available stall categories…</p> : stallTypesError ? (
                <div className="event-stalls-load-error" role="alert"><span>Could not load stall categories: {stallTypesError}</span><button type="button" onClick={() => setStallTypesRetry((current) => current + 1)}>Retry</button></div>
              ) : stallTypes.length === 0 ? <p className="event-stalls-empty">No stall types found. Add them from the Stalls dashboard first.</p> : (
                <div className="event-stalls-studio">
                  <div className="dashboard-event-template">
                    <div className="dashboard-event-template-heading">
                      <div><h3>Default template <span>Optional</span></h3><p>Enter a starting price and slot count, then copy them to every selected state. You can still change each state below.</p></div>
                      <button type="button" disabled={!states.length} onClick={applyTemplateToStates}>Apply to selected states</button>
                    </div>
                    <div className="dashboard-event-template-grid">
                      {stallTypes.map((type) => (
                        <article key={type.id} className="dashboard-event-template-row">
                          <div><strong>{type.name}</strong><small>{type.widthM} × {type.depthM} m · {type.category.toLowerCase()}</small></div>
                          <label>Base price (₹)<input type="number" min={0} max={10000000} step={1} value={templateRates[type.id]?.price ?? ''} onChange={(change) => updateTemplateRate(type.id, { price: change.target.value })} placeholder="Enter price" /></label>
                          <label>Slots<input type="number" min={0} max={500} step={1} value={templateRates[type.id]?.slots ?? 0} onChange={(change) => updateTemplateRate(type.id, { slots: Math.max(0, Math.min(500, Number(change.target.value) || 0)) })} /></label>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="dashboard-event-rate-summary" aria-live="polite">
                    <div><span>States</span><strong>{states.length}</strong></div>
                    <div><span>Total slots</span><strong>{totalSlots}</strong></div>
                    <div><span>Potential revenue before GST</span><strong>{rupees(potential)}</strong></div>
                    <div><span>Estimated GST (18%)</span><strong>{rupees(potentialGst)}</strong></div>
                    <div><span>Potential total including GST</span><strong>{rupees(potentialWithGst)}</strong></div>
                  </div>

                  {states.length === 0 ? (
                    <p className="event-stalls-empty">Select one or more states in Exhibition Details to add state-wise rates and stall slots.</p>
                  ) : (
                    <div className="dashboard-event-state-list">
                      {states.map((state) => (
                        <article className="dashboard-event-state-card" key={state}>
                          <header><h3>{state}</h3><span>{stateTotalSlots(state)} slots · {rupees(statePotential(state))} before GST</span></header>
                          <div className="dashboard-event-state-rates">
                            {stallTypes.map((type) => {
                              const rate = stateRates[state]?.[type.id] ?? { price: '', slots: 0 }
                              const basePrice = Number(rate.price) || 0
                              const tax = basePrice * gstRate / 100
                              return (
                                <article className="dashboard-event-rate-card" key={type.id}>
                                  <div className="dashboard-event-rate-title"><strong>{type.name}</strong><small>{type.widthM} × {type.depthM} m · {type.category.toLowerCase()}{type.includes ? ` · ${type.includes}` : ''}</small></div>
                                  <label>Base price (₹)<input type="number" min={0} max={10000000} step={1} inputMode="numeric" aria-label={`${type.name} base price in ${state}`} value={rate.price} onChange={(change) => updateStateRate(state, type.id, { price: change.target.value })} placeholder="Enter price" /></label>
                                  {rate.price.trim()
                                    ? <p className="dashboard-event-gst-preview"><span>GST (18%) <b>{rupees(tax)}</b></span><span>Total <b>{rupees(basePrice + tax)}</b></span></p>
                                    : <p className="dashboard-event-gst-empty">GST and total will appear after you enter a base price.</p>}
                                  <label>Available slots<input type="number" min={0} max={500} step={1} inputMode="numeric" aria-label={`${type.name} available slots in ${state}`} value={rate.slots} onChange={(change) => updateStateRate(state, type.id, { slots: Math.max(0, Math.min(500, Number(change.target.value) || 0)) })} /></label>
                                </article>
                              )
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span className="is-blue"><ImagePlus size={18} /></span><div><p className="eyebrow">Media</p><h2>03 · Event Gallery</h2><p>Choose files that represent the venue, artworks or exhibition experience.</p></div></div>
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
