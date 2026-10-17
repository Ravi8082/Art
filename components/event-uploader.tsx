'use client'

import { useState } from 'react'
import { useEffect, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, ImagePlus, MapPin, ShieldCheck, UploadCloud } from 'lucide-react'

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

export function EventUploader() {
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
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
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
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
            'X-Alt-Text': `${String(form.get('title'))}: ${file.name}`.slice(0, 255),
          },
          body: file,
        })
        if (!upload.ok) throw new Error(`${file.name}: ${await responseError(upload)}`)
      }

      setMessage(`Event ${eventId} aur ${files.length} media file(s) save hue. Approval ke baad homepage par dikh sakte hain.`)
      formElement.reset()
      setFiles([])
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
                <label>Venue / city<span className="dashboard-event-input-icon"><MapPin size={15} /><input name="venue" required minLength={2} maxLength={255} placeholder="Venue, city" /></span></label>
                <div className="event-dates dashboard-event-dates">
                  <label>Starts at<span className="dashboard-event-input-icon"><Clock3 size={15} /><input name="startsAt" type="datetime-local" required /></span></label>
                  <label>Ends at<span className="dashboard-event-input-icon"><Clock3 size={15} /><input name="endsAt" type="datetime-local" required /></span></label>
                </div>
              </div>
            </section>

            <section className="dashboard-event-form-section">
              <div className="dashboard-event-section-heading"><span className="is-blue"><ImagePlus size={18} /></span><div><p className="eyebrow">02 · Event gallery</p><h2>Add images and videos</h2><p>Choose files that represent the venue, artworks or exhibition experience.</p></div></div>
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
