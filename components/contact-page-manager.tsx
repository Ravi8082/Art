'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { contactTextFields } from '@/lib/site-content'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 50 * 1024 * 1024

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

type Values = Record<string, string>
const emptyValues: Values = Object.fromEntries(contactTextFields.map((field) => [field.key, field.fallback]))

export function ContactPageManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [values, setValues] = useState<Values>(emptyValues)
  const [saved, setSaved] = useState<Values>(emptyValues)
  const [banner, setBanner] = useState<{ url: string; altText: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const content = await (await fetch(`${apiBaseUrl}/api/content`, { cache: 'no-store' })).json() as { text: Record<string, string> }
    const next: Values = { ...emptyValues }
    for (const field of contactTextFields) if (content.text?.[field.key]) next[field.key] = content.text[field.key]
    setValues(next)
    setSaved(next)
    const media = await (await fetch(`${apiBaseUrl}/api/homepage/media`, { cache: 'no-store' })).json() as Record<string, { url: string; altText: string }>
    setBanner(media.contactHero ? { url: `${apiBaseUrl}${media.contactHero.url}`, altText: media.contactHero.altText } : null)
  }, [])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' }).then(async (response) => {
      setChecked(true)
      if (!response.ok) return
      setSignedIn(true)
      await load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Content could not be loaded.'))
    }).catch(() => setChecked(true))
  }, [load])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError('')
    try { await action(); await load(); setMessage(success) }
    catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Request failed.'
      setError(text)
      if (/auth|login|forbidden|session|permission/i.test(text)) setSignedIn(false)
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

  function save() {
    const changed: Values = {}
    for (const field of contactTextFields) if (values[field.key] !== saved[field.key]) changed[field.key] = values[field.key]
    if (!Object.keys(changed).length) { setMessage('Nothing changed since the last save.'); return }
    void run(async () => { await api('/api/content/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changed) }) }, 'Contact page content saved and live.')
  }

  function uploadBanner(file: File) {
    if (file.size > maxFileBytes) { setError('Banner image must be 50 MB or smaller.'); return }
    void run(async () => {
      await api('/api/homepage/media/contactHero', { method: 'PUT', headers: { 'Content-Type': file.type, 'X-Alt-Text': encodeURIComponent(values.contactHeroIntro.slice(0, 120) || 'Contact page banner') }, body: file })
    }, 'Banner image replaced on the live site.')
  }

  if (checked && !signedIn) {
    return (
      <main className="event-admin">
        <header className="event-admin-header">
          <div><p className="eyebrow">The Haat of Art · Content Management</p><h1>Contact Page Manager</h1><p>Sign in with an admin account to edit the contact page.</p></div>
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

  const group = (keys: string[]) => contactTextFields.filter((field) => keys.includes(field.key))
  const fieldInput = (key: string, label: string, multiline: boolean) => (
    <label key={key}>{label}
      {multiline
        ? <textarea rows={3} value={values[key] ?? ''} maxLength={1000} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
        : <input value={values[key] ?? ''} maxLength={key.includes('Url') || key.includes('url') ? 1000 : 255} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />}
    </label>
  )

  return (
    <main className="event-admin apm cpm">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Content Management · Contact Page</p>
          <h1>Contact Page Manager</h1>
          <p>Everything here is what visitors see on /contact. Clearing a field restores the built-in default text.</p>
        </div>
        <div className="apm-header-actions">
          <Link className="apm-secondary" href="/dashboard/enquiries">Contact Enquiries</Link>
          <Link className="apm-secondary" href="/contact" target="_blank">View on Website</Link>
          <button type="button" className="apm-publish" disabled={busy} onClick={save}>Save &amp; Publish</button>
        </div>
      </header>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      {message && <p className="event-form-success" role="status">{message}</p>}

      <section className="event-form">
        <h2>1. Hero</h2>
        <div className="apm-grid">
          <div className="apm-fields">
            {group(['contactHeroTitle', 'contactHeroAccent', 'contactHeroIntro']).map((field) => fieldInput(field.key, field.label, field.multiline))}
          </div>
          <div>
            <p className="apm-label">Banner image</p>
            <div className="apm-image-slot">
              {banner ? <img src={banner.url} alt={banner.altText} /> : <span className="apm-image-empty">Using the built-in demo banner</span>}
              <div className="apm-image-actions">
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) uploadBanner(file) }} />
              </div>
              <small>Recommended 1400 × 900 px · JPG / PNG / WebP · max 50 MB</small>
            </div>
            <div className="apm-hero-preview" style={banner ? { backgroundImage: `url(${banner.url})` } : undefined}>
              <h3>{values.contactHeroTitle} <em>{values.contactHeroAccent}</em></h3>
              <p>{values.contactHeroIntro}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="event-form">
        <h2>2. Office details</h2>
        <div className="apm-fields">
          {group(['contactAddress', 'contactPhone', 'contactEmail', 'contactHours', 'contactMapUrl']).map((field) => fieldInput(field.key, field.label, field.multiline))}
          <p className="event-form-note">Use a Google Maps link with <code>output=embed</code> in the URL to show the live map instead of the directions card.</p>
        </div>
      </section>

      <section className="event-form">
        <h2>3. Social links</h2>
        <div className="apm-fields">
          {group(['contactInstagram', 'contactFacebook', 'contactLinkedin']).map((field) => fieldInput(field.key, field.label, false))}
        </div>
      </section>

      <section className="event-form">
        <h2>4. Mentors &amp; partners section</h2>
        <div className="apm-fields">
          {group(['contactPartnersTitle', 'contactPartnersText']).map((field) => fieldInput(field.key, field.label, field.multiline))}
          <p className="event-form-note">The section is hidden on the public page while the partners text is empty.</p>
        </div>
      </section>

      <section className="event-form">
        <h2>5. Privacy notice</h2>
        <div className="apm-fields">
          {group(['contactNotice']).map((field) => fieldInput(field.key, field.label, true))}
        </div>
      </section>
    </main>
  )
}
