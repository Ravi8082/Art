'use client'

import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 50 * 1024 * 1024
const slots = [
  { key: 'film', label: 'Navbar ke neeche video', accept: 'video/mp4,video/webm,video/quicktime' },
  { key: 'filmPoster', label: 'Video poster image', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'logo', label: 'Navbar logo', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'hero', label: 'Hero slide 1', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'hero2', label: 'Hero slide 2', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'hero3', label: 'Hero slide 3', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'glimpse', label: 'Glimpse video thumbnail', accept: 'image/jpeg,image/png,image/webp' },
  { key: 'categoryVisualArt', label: 'Visual Art image', accept: 'image/jpeg,image/png,image/webp,image/gif' },
  { key: 'categoryArtifacts', label: 'Artifacts image', accept: 'image/jpeg,image/png,image/webp,image/gif' },
  { key: 'categoryExperiences', label: 'Live Experiences image', accept: 'image/jpeg,image/png,image/webp,image/gif' },
  { key: 'categoryExhibitions', label: 'Exhibitions image', accept: 'image/jpeg,image/png,image/webp,image/gif' },
] as const

type UploadedMedia = { mimeType: string; altText: string; url: string }
type UploadedMediaMap = Record<string, UploadedMedia>

async function readError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status})`
}

export function HomepageMediaManager() {
  const [uploaded, setUploaded] = useState<UploadedMediaMap>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch(`${apiBaseUrl}/api/homepage/media`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response))
        return response.json() as Promise<UploadedMediaMap>
      })
      .then((media) => { if (active) setUploaded(media) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Homepage media could not be loaded.')
      })
    return () => { active = false }
  }, [])

  async function saveMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    setMessage('')
    setError('')
    const selected = slots.filter((slot) => files[slot.key])
    if (!selected.length) {
      setError('Replace karne ke liye pehle kam se kam ek file select karein.')
      return
    }
    const oversized = selected.find((slot) => files[slot.key].size > maxFileBytes)
    if (oversized) {
      setError(`${oversized.label}: maximum upload size 50 MB hai.`)
      return
    }

    setBusy(true)
    try {
      const form = new FormData(formElement)
      const login = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('adminEmail'), password: form.get('adminPassword') }),
      })
      if (!login.ok) throw new Error(await readError(login))

      const saved: string[] = []
      for (const slot of selected) {
        const file = files[slot.key]
        const response = await fetch(`${apiBaseUrl}/api/homepage/media/${slot.key}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': file.type,
            'X-Alt-Text': slot.label,
          },
          body: file,
        })
        if (!response.ok) throw new Error(`${slot.label}: ${await readError(response)}`)
        saved.push(slot.key)
        setUploaded((current) => ({
          ...current,
          [slot.key]: { mimeType: file.type, altText: slot.label, url: `/api/homepage/media/${slot.key}?v=${Date.now()}` },
        }))
      }

      setMessage(`Updated: ${saved.join(', ')}`)
      setFiles({})
      formElement.reset()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Homepage media upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="event-admin">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Homepage content</p>
          <h1>Video and images</h1>
          <p>Video, logo aur homepage gallery images select karke replace karein. Files database mein save hongi.</p>
        </div>
        <Link className="event-admin-back" href="/dashboard">Dashboard</Link>
      </header>

      <form className="event-form media-manager-form" onSubmit={saveMedia}>
        <p className="event-form-note">Upload ke liye admin sign-in zaroori hai. Password form submit ke baad save nahi hota.</p>
        <label>Admin email<input name="adminEmail" type="email" autoComplete="username" required /></label>
        <label>Admin password<input name="adminPassword" type="password" autoComplete="current-password" required /></label>
        <div className="media-slot-grid">
          {slots.map((slot) => {
            const media = uploaded[slot.key]
            return (
              <label className="media-slot" key={slot.key}>
                <strong>{slot.label}</strong>
                {media && (
                  <span className="media-current">
                    {media.mimeType.startsWith('video/')
                      ? <video src={`${apiBaseUrl}${media.url}`} controls preload="metadata" />
                      : <img src={`${apiBaseUrl}${media.url}`} alt={media.altText} />}
                    <small>Current database media</small>
                  </span>
                )}
                <input
                  type="file"
                  accept={slot.accept}
                  onChange={(change) => {
                    const file = change.currentTarget.files?.[0]
                    if (file) setFiles((current) => ({ ...current, [slot.key]: file }))
                  }}
                />
                <small>{files[slot.key]?.name ?? `Allowed: ${slot.accept.replaceAll(',', ', ')}`}</small>
              </label>
            )
          })}
        </div>
        {error && <p className="event-form-error" role="alert">{error}</p>}
        {message && <p className="event-form-success" role="status">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Uploading selected media…' : 'Save selected media'}</button>
      </form>
    </main>
  )
}
