'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type Announcement = {
  id: string
  title: string
  description: string
  state: string
  city: string
  venue: string
  startsAt: string | null
  endsAt: string | null
  isFirstInState: boolean
  imageKey: 'exhibition1' | 'exhibition2' | 'exhibition3' | null
  status: 'DRAFT' | 'PUBLISHED'
  sortOrder: number
}

type AnnouncementForm = Omit<Announcement, 'id' | 'sortOrder'>

const emptyForm = (): AnnouncementForm => ({
  title: '',
  description: '',
  state: '',
  city: '',
  venue: '',
  startsAt: null,
  endsAt: null,
  isFirstInState: false,
  imageKey: null,
  status: 'PUBLISHED',
})

function localDateTime(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function displayDateRange(item: Announcement) {
  if (!item.startsAt || !item.endsAt) return 'Coming Soon'
  const start = new Date(item.startsAt)
  const end = new Date(item.endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Coming Soon'
  const format = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${format(start)} – ${format(end)}`
}

async function errorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
    ? body.error
    : `Request failed (${response.status})`
}

function isNetworkFailure(cause: unknown) {
  return cause instanceof Error && /failed to fetch|fetch failed|network error|network request failed|load failed/i.test(cause.message)
}

export function HomepageExhibitionsManager() {
  const [items, setItems] = useState<Announcement[]>([])
  const [form, setForm] = useState<AnnouncementForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const retryAction = useRef<(() => void) | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/homepage/exhibitions/admin`, {
      credentials: 'include',
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(await errorMessage(response))
    const data: unknown = await response.json()
    if (!Array.isArray(data)) throw new Error('Homepage exhibitions returned an invalid response.')
    setItems(data as Announcement[])
  }, [])

  const reportError = useCallback((cause: unknown, fallback: string, retry?: () => void) => {
    const networkFailure = isNetworkFailure(cause)
    setError(networkFailure
      ? 'Network/server se data load ya save nahi ho paya — kripya dobara koshish karein. / Could not load or save data right now — please try again.'
      : cause instanceof Error ? cause.message : fallback)
    retryAction.current = networkFailure ? retry ?? null : null
  }, [])

  const loadWithRetry = useCallback(function attempt() {
    void load().catch((cause: unknown) => reportError(cause, 'Homepage exhibitions could not be loaded.', attempt))
  }, [load, reportError])

  useEffect(() => {
    loadWithRetry()
  }, [loadWithRetry])

  function resetForm() {
    setEditingId('')
    setForm(emptyForm())
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveAnnouncement()
  }

  async function saveAnnouncement() {
    setBusy(true)
    setError('')
    setMessage('')
    retryAction.current = null
    try {
      const start = form.startsAt ? new Date(form.startsAt) : null
      const end = form.endsAt ? new Date(form.endsAt) : null
      if ((start === null) !== (end === null)) throw new Error('Add both exhibition dates or leave both blank to show Coming Soon.')
      if (start && end && (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)) {
        throw new Error('The exhibition end date must be after its start date.')
      }

      const response = await fetch(`${apiBaseUrl}/api/homepage/exhibitions${editingId ? `/${encodeURIComponent(editingId)}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          startsAt: start?.toISOString() ?? null,
          endsAt: end?.toISOString() ?? null,
        }),
      })
      if (!response.ok) throw new Error(await errorMessage(response))
      await load()
      setMessage(form.status === 'PUBLISHED' ? 'Homepage exhibition published.' : 'Homepage exhibition saved as a draft.')
      resetForm()
    } catch (cause) {
      reportError(cause, 'Homepage exhibition could not be saved.', () => { void saveAnnouncement() })
    } finally {
      setBusy(false)
    }
  }

  function edit(item: Announcement) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description,
      state: item.state,
      city: item.city,
      venue: item.venue,
      startsAt: localDateTime(item.startsAt),
      endsAt: localDateTime(item.endsAt),
      isFirstInState: item.isFirstInState,
      imageKey: item.imageKey,
      status: item.status,
    })
    setError('')
    setMessage('')
  }

  async function remove(item: Announcement, confirmRemoval = true) {
    if (confirmRemoval && !window.confirm(`Remove "${item.title}" from the homepage?`)) return
    setBusy(true)
    setError('')
    setMessage('')
    retryAction.current = null
    try {
      const response = await fetch(`${apiBaseUrl}/api/homepage/exhibitions/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) throw new Error(await errorMessage(response))
      await load()
      if (editingId === item.id) resetForm()
      setMessage('Homepage exhibition removed.')
    } catch (cause) {
      reportError(cause, 'Homepage exhibition could not be removed.', () => { void remove(item, false) })
    } finally {
      setBusy(false)
    }
  }

  function retryFailedRequest() {
    const retry = retryAction.current
    if (!retry) return
    retryAction.current = null
    setError('')
    retry()
  }

  return (
    <section className="event-form site-content-section homepage-exhibition-manager" aria-labelledby="homepage-exhibitions-title">
      <div className="site-content-section-heading">
        <span className="site-content-section-icon"><MapPin size={19} /></span>
        <div>
          <p className="eyebrow">Homepage exhibition announcements</p>
          <h2 id="homepage-exhibitions-title">New cities &amp; states</h2>
          <p>Add a real destination now; leave dates empty to publish a clear Coming Soon announcement.</p>
        </div>
      </div>

      {error && <div className="event-form-error homepage-exhibition-error" role="alert">
        <span>{error}</span>
        {retryAction.current && <button type="button" onClick={retryFailedRequest}>Retry</button>}
      </div>}
      {message && <p className="event-form-success" role="status">{message}</p>}

      <form className="homepage-exhibition-form" onSubmit={save}>
        <div className="site-content-add-grid">
          <label>Exhibition title<input required minLength={2} maxLength={180} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="The Haat of Art — [City] Edition" /></label>
          <label>State<input required minLength={2} maxLength={80} value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} placeholder="State or union territory" /></label>
          <label>City<input required minLength={2} maxLength={120} value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} placeholder="City" /></label>
          <label>Venue (if confirmed)<input maxLength={180} value={form.venue} onChange={(event) => setForm((current) => ({ ...current, venue: event.target.value }))} placeholder="Venue or leave blank" /></label>
          <label className="is-wide">What visitors can expect<textarea required minLength={10} maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A concise, verified description of the upcoming exhibition." /></label>
          <label>Start date (optional)<input type="datetime-local" value={form.startsAt ?? ''} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value || null }))} /></label>
          <label>End date (optional)<input type="datetime-local" value={form.endsAt ?? ''} min={form.startsAt ?? undefined} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value || null }))} /></label>
          <label>Homepage image<select value={form.imageKey ?? ''} onChange={(event) => setForm((current) => ({ ...current, imageKey: event.target.value ? event.target.value as AnnouncementForm['imageKey'] : null }))}>
            <option value="">Use event image / fallback</option>
            <option value="exhibition1">Exhibition image 1</option>
            <option value="exhibition2">Exhibition image 2</option>
            <option value="exhibition3">Exhibition image 3</option>
          </select></label>
          <label>Visibility<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as AnnouncementForm['status'] }))}>
            <option value="PUBLISHED">Publish on homepage</option>
            <option value="DRAFT">Save as draft</option>
          </select></label>
          <label className="site-content-check homepage-exhibition-debut">
            <input type="checkbox" checked={form.isFirstInState} onChange={(event) => setForm((current) => ({ ...current, isFirstInState: event.target.checked }))} />
            First Haat of Art exhibition in this state
          </label>
        </div>
        <div className="site-content-form-actions">
          <span><CalendarDays size={15} /> Leave both dates blank to show “Coming Soon”.</span>
          <div>
            {editingId && <button type="button" className="homepage-exhibition-cancel" disabled={busy} onClick={resetForm}>Cancel edit</button>}
            <button type="submit" disabled={busy}><Plus size={15} />{busy ? 'Saving…' : editingId ? 'Update announcement' : 'Add homepage exhibition'}</button>
          </div>
        </div>
      </form>

      <div className="homepage-exhibition-list" aria-live="polite">
        {items.length === 0
          ? <p className="blog-moderation-empty">No homepage exhibitions yet. Add a verified city and state above to publish a professional announcement.</p>
          : items.map((item) => (
            <article key={item.id} className="homepage-exhibition-card">
              <div>
                <p className="eyebrow">{item.isFirstInState ? `First visit · ${item.state}` : item.state}</p>
                <h3>{item.title}</h3>
                <p>{item.city}{item.venue ? ` · ${item.venue}` : ''} · {displayDateRange(item)}</p>
              </div>
              <span className={`homepage-exhibition-status is-${item.status.toLowerCase()}`}>{item.status === 'PUBLISHED' ? 'On homepage' : 'Draft'}</span>
              <div className="homepage-exhibition-actions">
                <button type="button" disabled={busy} onClick={() => edit(item)} aria-label={`Edit ${item.title}`}><Pencil size={15} /> Edit</button>
                <button type="button" disabled={busy} onClick={() => void remove(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /> Delete</button>
              </div>
            </article>
          ))}
      </div>
    </section>
  )
}
