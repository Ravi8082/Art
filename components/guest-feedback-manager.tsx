'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import type { PublicGuest, PublicGuestFeedback } from '@/lib/api'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif'

async function readError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status})`
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

function fileToCroppedBlob(file: File, aspect: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const sourceRatio = img.naturalWidth / img.naturalHeight
      let cropWidth = img.naturalWidth
      let cropHeight = img.naturalHeight
      if (sourceRatio > aspect) cropWidth = img.naturalHeight * aspect
      else cropHeight = img.naturalWidth / aspect
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(cropWidth)
      canvas.height = Math.round(cropHeight)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Crop is not supported in this browser')); return }
      ctx.drawImage(img, (img.naturalWidth - cropWidth) / 2, (img.naturalHeight - cropHeight) / 2, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Crop failed')), file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image file')) }
    img.src = url
  })
}

export function GuestFeedbackManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [guests, setGuests] = useState<PublicGuest[]>([])
  const [feedback, setFeedback] = useState<PublicGuestFeedback[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await api('/api/guests/manage', { cache: 'no-store' })
    const data = await response.json() as { guests: PublicGuest[]; feedback: PublicGuestFeedback[] }
    setGuests([...data.guests].sort((a, b) => a.sortOrder - b.sortOrder))
    setFeedback([...data.feedback].sort((a, b) => a.sortOrder - b.sortOrder))
  }, [])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        setChecked(true)
        if (response.ok) { setSignedIn(true); await load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Guests could not be loaded.')) }
      })
      .catch(() => setChecked(true))
  }, [load])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError('')
    try { await action(); await load(); setMessage(success) }
    catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Request failed.'
      setError(text)
      if (/auth|login|forbidden|session/i.test(text)) setSignedIn(false)
    } finally { setBusy(false) }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      setSignedIn(true)
    }, 'Signed in.')
  }

  function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    void run(async () => {
      await api('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: form.get('name'), role: form.get('role'), eventName: form.get('eventName'), bio: form.get('bio'),
      }) })
      element.reset()
    }, 'Guest added to the homepage.')
  }

  function updateGuest(guest: PublicGuest, patch: Partial<PublicGuest>, success = 'Guest updated.') {
    void run(async () => {
      await api(`/api/guests/${guest.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    }, success)
  }

  function uploadGuestPhoto(guest: PublicGuest, file: File) {
    void run(async () => {
      const blob = await fileToCroppedBlob(file, 3 / 4)
      await api(`/api/guests/${guest.id}/photo`, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })
    }, 'Guest photo updated.')
  }

  function move(list: PublicGuest[], index: number, direction: -1 | 1) {
    const target = list[index + direction]
    if (!target) return
    const ids = list.map((item) => item.id)
    ;[ids[index], ids[index + direction]] = [ids[index + direction], ids[index]]
    void run(async () => { await api('/api/guests/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'guests', ids }) }) }, 'Order updated.')
  }

  function removeGuest(guest: PublicGuest) {
    if (!window.confirm('Pakka delete karna hai? Feedback linked to this guest stays but loses the link.')) return
    void run(async () => { await api(`/api/guests/${guest.id}`, { method: 'DELETE' }) }, 'Guest deleted.')
  }

  function addFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const guestId = String(form.get('guestId') ?? '')
    void run(async () => {
      await api('/api/guests/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        authorName: form.get('authorName'), authorRole: form.get('authorRole'), message: form.get('message'),
        rating: form.get('rating'), guestId: guestId || null,
      }) })
      element.reset()
    }, 'Feedback added to the homepage.')
  }

  function updateFeedback(entry: PublicGuestFeedback, patch: Partial<PublicGuestFeedback>, success = 'Feedback updated.') {
    void run(async () => {
      await api(`/api/guests/feedback/${entry.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    }, success)
  }

  function moveFeedback(index: number, direction: -1 | 1) {
    const ids = feedback.map((item) => item.id)
    const target = index + direction
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    void run(async () => { await api('/api/guests/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'guest_feedback', ids }) }) }, 'Order updated.')
  }

  function removeFeedback(entry: PublicGuestFeedback) {
    if (!window.confirm('Pakka delete karna hai?')) return
    void run(async () => { await api(`/api/guests/feedback/${entry.id}`, { method: 'DELETE' }) }, 'Feedback deleted.')
  }

  if (checked && !signedIn) {
    return (
      <main className="event-admin">
        <header className="event-admin-header">
          <div><p className="eyebrow">The Haat of Art · Content Management</p><h1>Guests &amp; Feedback Manager</h1><p>Manage karne ke liye admin sign-in zaroori hai.</p></div>
          <Link className="event-admin-back" href="/dashboard">Dashboard</Link>
        </header>
        <form className="event-form" onSubmit={signIn}>
          <label>Admin email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Admin password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button disabled={busy} type="submit">Sign in</button>
        </form>
        {error && <p className="event-form-error" role="alert">{error}</p>}
      </main>
    )
  }

  return (
    <main className="event-admin apm">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Content Management · Home Page</p>
          <h1>Guests &amp; Feedback Manager</h1>
          <p>Guests appear in the &ldquo;All Guests So Far&rdquo; strip and their feedback below it. Changes are live immediately.</p>
        </div>
        <div className="apm-header-actions">
          <Link className="apm-secondary" href="/" target="_blank">View on Website</Link>
        </div>
      </header>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      {message && <p className="event-form-success" role="status">{message}</p>}
      {!guests.length && !error && signedIn && <p className="event-form-note">Loading…</p>}

      <section className="event-form">
        <h2>1. Guests So Far</h2>
        <form className="apm-add-row gfm-guests-add" onSubmit={addGuest}>
          <input name="name" placeholder="Guest name *" maxLength={120} required />
          <input name="role" placeholder="Role (Actor, Collector…)" maxLength={160} />
          <input name="eventName" placeholder="Event they attended" maxLength={160} />
          <input name="bio" placeholder="Short bio shown on hover (optional)" maxLength={1200} />
          <button disabled={busy} type="submit">+ Add Guest</button>
        </form>
        <table className="apm-table">
          <thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Role</th><th>Event</th><th>Bio</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {guests.map((guest, index) => (
              <tr key={guest.id}>
                <td>{index + 1}</td>
                <td>
                  <label className="apm-photo">
                    {guest.photoUrl ? <img src={`${apiBaseUrl}${guest.photoUrl}`} alt={guest.name} /> : <i>{guest.name.slice(0, 1)}</i>}
                    <input type="file" accept={imageAccept} hidden disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadGuestPhoto(guest, file) }} />
                  </label>
                </td>
                <td><input defaultValue={guest.name} maxLength={120} onBlur={(e) => { if (e.target.value !== guest.name) updateGuest(guest, { name: e.target.value }) }} /></td>
                <td><input defaultValue={guest.role} maxLength={160} onBlur={(e) => { if (e.target.value !== guest.role) updateGuest(guest, { role: e.target.value }) }} /></td>
                <td><input defaultValue={guest.eventName} maxLength={160} onBlur={(e) => { if (e.target.value !== guest.eventName) updateGuest(guest, { eventName: e.target.value }) }} /></td>
                <td><textarea defaultValue={guest.bio} maxLength={1200} rows={2} onBlur={(e) => { if (e.target.value !== guest.bio) updateGuest(guest, { bio: e.target.value }) }} /></td>
                <td><button type="button" className={guest.active ? 'apm-status is-active' : 'apm-status'} disabled={busy} onClick={() => updateGuest(guest, { active: !guest.active }, 'Visibility updated.')}>{guest.active ? 'Active' : 'Hidden'}</button></td>
                <td className="apm-actions">
                  <button type="button" disabled={busy || index === 0} onClick={() => move(guests, index, -1)} aria-label="Move up">↑</button>
                  <button type="button" disabled={busy || index === guests.length - 1} onClick={() => move(guests, index, 1)} aria-label="Move down">↓</button>
                  <button type="button" disabled={busy} onClick={() => removeGuest(guest)}>Delete</button>
                </td>
              </tr>
            ))}
            {!guests.length && <tr><td colSpan={8} className="apm-empty">No guests yet. Add them above.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="event-form">
        <h2>2. Guest Feedback</h2>
        <form className="apm-add-row gfm-feedback-add" onSubmit={addFeedback}>
          <input name="authorName" placeholder="Visitor name *" maxLength={120} required />
          <input name="authorRole" placeholder="Who they are (Collector, Pune)" maxLength={160} />
          <input name="message" placeholder="Feedback message *" maxLength={900} required />
          <select name="rating" defaultValue="5" aria-label="Rating">
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={String(n)}>{n} star{n === 1 ? '' : 's'}</option>)}
          </select>
          <select name="guestId" defaultValue="" aria-label="Linked guest">
            <option value="">Not linked to a guest</option>
            {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
          </select>
          <button disabled={busy} type="submit">+ Add Feedback</button>
        </form>
        <table className="apm-table">
          <thead><tr><th>#</th><th>Visitor</th><th>Feedback</th><th>Rating</th><th>Linked guest</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {feedback.map((entry, index) => (
              <tr key={entry.id}>
                <td>{index + 1}</td>
                <td>
                  <input defaultValue={entry.authorName} maxLength={120} onBlur={(e) => { if (e.target.value !== entry.authorName) updateFeedback(entry, { authorName: e.target.value }) }} />
                  <input defaultValue={entry.authorRole} maxLength={160} placeholder="Role" onBlur={(e) => { if (e.target.value !== entry.authorRole) updateFeedback(entry, { authorRole: e.target.value }) }} />
                </td>
                <td><textarea defaultValue={entry.message} maxLength={900} rows={3} onBlur={(e) => { if (e.target.value !== entry.message) updateFeedback(entry, { message: e.target.value }) }} /></td>
                <td>
                  <select defaultValue={String(entry.rating)} onChange={(e) => updateFeedback(entry, { rating: Number(e.target.value) }, 'Rating updated.')}>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={String(n)}>{n}</option>)}
                  </select>
                </td>
                <td>
                  <select defaultValue={entry.guestId ?? ''} onChange={(e) => updateFeedback(entry, { guestId: e.target.value || null }, 'Linked guest updated.')}>
                    <option value="">None</option>
                    {guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
                  </select>
                </td>
                <td><button type="button" className={entry.active ? 'apm-status is-active' : 'apm-status'} disabled={busy} onClick={() => updateFeedback(entry, { active: !entry.active }, 'Visibility updated.')}>{entry.active ? 'Active' : 'Hidden'}</button></td>
                <td className="apm-actions">
                  <button type="button" disabled={busy || index === 0} onClick={() => moveFeedback(index, -1)} aria-label="Move up">↑</button>
                  <button type="button" disabled={busy || index === feedback.length - 1} onClick={() => moveFeedback(index, 1)} aria-label="Move down">↓</button>
                  <button type="button" disabled={busy} onClick={() => removeFeedback(entry)}>Delete</button>
                </td>
              </tr>
            ))}
            {!feedback.length && <tr><td colSpan={7} className="apm-empty">No feedback yet. Add it above.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  )
}

export default GuestFeedbackManager
