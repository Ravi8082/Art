'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, Trash2 } from 'lucide-react'
import { indianStates, indianUnionTerritories } from '@/lib/indian-states'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type Profile = {
  email: string; fullName: string; phone: string; organization: string; jobTitle: string
  city: string; state: string; bio: string; avatarUrl: string | null
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Request failed (${response.status})`)
  return data as T
}

function squarePhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const size = Math.min(side, 600)
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Photo could not be processed')); return }
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Photo could not be processed')), 'image/jpeg', 0.9)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image file')) }
    img.src = url
  })
}

const initialsOf = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HA'

export function AccountProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'signed-out'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ profile: Profile; roles: string[] }>('/api/account/profile')
      .then((data) => { setProfile(data.profile); setRoles(data.roles); setState('ready') })
      .catch(() => setState('signed-out'))
  }, [])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError('')
    try { await action(); setMessage(success) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.') }
    finally { setBusy(false) }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(['fullName', 'phone', 'organization', 'jobTitle', 'city', 'state', 'bio'].map((key) => [key, String(form.get(key) ?? '')]))
    void run(async () => {
      const data = await api<{ profile: Profile }>('/api/account/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      setProfile(data.profile)
    }, 'Profile saved.')
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    void run(async () => {
      await api('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: form.get('currentPassword'), newPassword: form.get('newPassword') }) })
      element.reset()
    }, 'Password updated.')
  }

  function upload(file: File) {
    void run(async () => {
      const blob = await squarePhoto(file)
      const data = await api<{ profile: Profile }>('/api/account/avatar', { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob })
      setProfile(data.profile)
    }, 'Photo updated.')
  }

  function removePhoto() {
    void run(async () => {
      const data = await api<{ profile: Profile }>('/api/account/avatar', { method: 'DELETE' })
      setProfile(data.profile)
    }, 'Photo removed.')
  }

  if (state === 'loading') return <main className="account-page"><p className="account-note">Loading your profile…</p></main>
  if (state === 'signed-out' || !profile) {
    return <main className="account-page"><section className="account-card"><h1>Sign in required</h1><p className="account-note">Please sign in to edit your profile.</p><Link className="account-primary" href="/dashboard">Go to sign in</Link></section></main>
  }

  return (
    <main className="account-page">
      <Link href="/dashboard" className="account-back"><ArrowLeft size={15} /> Back to dashboard</Link>
      {message && <p className="account-banner account-ok" role="status">{message}</p>}
      {error && <p className="account-banner account-err" role="alert">{error}</p>}
      <section className="account-card">
        <header className="account-head">
          <div className="account-avatar-wrap">
            {profile.avatarUrl
              ? <img className="account-avatar" src={`${apiBaseUrl}${profile.avatarUrl}`} alt="Your profile photo" />
              : <span className="account-avatar account-avatar-initials">{initialsOf(profile.fullName)}</span>}
          </div>
          <div>
            <h1>{profile.fullName}</h1>
            <p className="account-note">{profile.email}{roles.length > 0 && ` · ${roles.map((role) => role.replace(/_/g, ' ').toLowerCase()).join(', ')}`}</p>
            <div className="account-photo-actions">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) upload(file) }} />
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><Camera size={15} /> {profile.avatarUrl ? 'Change photo' : 'Upload photo'}</button>
              {profile.avatarUrl && <button type="button" className="account-ghost" disabled={busy} onClick={removePhoto}><Trash2 size={15} /> Remove</button>}
            </div>
          </div>
        </header>
        <form className="account-form" onSubmit={save}>
          <label>Full name<input name="fullName" required minLength={2} maxLength={160} defaultValue={profile.fullName} /></label>
          <label>Email<input value={profile.email} disabled readOnly /></label>
          <label>Phone<input name="phone" type="tel" maxLength={30} defaultValue={profile.phone} placeholder="+91 98765 43210" /></label>
          <label>Organization<input name="organization" maxLength={160} defaultValue={profile.organization} placeholder="Studio, gallery or company" /></label>
          <label>Designation<input name="jobTitle" maxLength={120} defaultValue={profile.jobTitle} placeholder="e.g. Event coordinator" /></label>
          <label>City<input name="city" maxLength={120} defaultValue={profile.city} /></label>
          <label>State
            <select name="state" defaultValue={profile.state}>
              <option value="">Select a state…</option>
              {[...indianStates, ...indianUnionTerritories].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="account-wide">About you<textarea name="bio" rows={4} maxLength={1000} defaultValue={profile.bio} placeholder="A short introduction" /></label>
          <div className="account-wide account-submit">
            <button className="account-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      </section>
      <section className="account-card">
        <h2>Change password</h2>
        <form className="account-form" onSubmit={changePassword}>
          <label>Current password<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
          <label>New password (min 12 characters)<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
          <div className="account-wide account-submit">
            <button className="account-primary" type="submit" disabled={busy}>Update password</button>
          </div>
        </form>
      </section>
    </main>
  )
}
