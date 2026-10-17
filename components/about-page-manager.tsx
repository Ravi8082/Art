'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import type { AboutPartner, AboutSection, AboutState, AboutTeamMember } from '@/lib/api'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 50 * 1024 * 1024
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

async function uploadImage(file: File, kind: string, altText: string, aspect: number | null) {
  const blob = aspect ? await fileToCroppedBlob(file, aspect) : file
  const response = await api('/api/about/media', {
    method: 'POST',
    headers: { 'Content-Type': blob.type, 'X-Kind': kind, 'X-Alt-Text': encodeURIComponent(altText || file.name) },
    body: blob,
  })
  return await response.json() as { id: string }
}

function RichText({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html
  }, [html])
  const exec = (command: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, value)
    if (ref.current) onChange(ref.current.innerHTML)
  }
  const buttons: [string, string, () => void][] = [
    ['bold', 'B', () => exec('bold')], ['italic', 'I', () => exec('italic')], ['underline', 'U', () => exec('underline')],
    ['ul', '• List', () => exec('insertUnorderedList')], ['ol', '1. List', () => exec('insertOrderedList')],
    ['left', '⯇', () => exec('justifyLeft')], ['center', '≡', () => exec('justifyCenter')], ['right', '⯈', () => exec('justifyRight')],
    ['link', '🔗', () => {
      const url = window.prompt('Link URL (https://…)')
      if (url) exec('createLink', url)
    }],
    ['clear', '⌫', () => exec('removeFormat')],
  ]
  return (
    <div className="apm-rich">
      <div className="apm-rich-toolbar">
        {buttons.map(([key, label, handler]) => <button key={key} type="button" onMouseDown={(event) => { event.preventDefault(); handler() }}>{label}</button>)}
      </div>
      <div className="apm-rich-body" ref={ref} contentEditable role="textbox" aria-multiline="true" onBlur={() => ref.current && onChange(ref.current.innerHTML)} suppressContentEditableWarning />
    </div>
  )
}

function ImageSlot({ url, alt, busy, onPick, onRemove }: { url: string | null; alt: string; busy: boolean; onPick: (file: File) => void; onRemove?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="apm-image-slot">
      {url ? <img src={url} alt={alt} /> : <span className="apm-image-empty">No image yet</span>}
      <div className="apm-image-actions">
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>Change Image</button>
        {onRemove && url && <button type="button" disabled={busy} className="apm-remove" onClick={onRemove}>Remove</button>}
      </div>
      <small>Recommended: 1000 × 700 px · JPG / PNG / WebP · auto centre-cropped</small>
      <input ref={inputRef} type="file" accept={imageAccept} hidden onChange={(event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) {
          if (file.size > maxFileBytes) { window.alert('Image maximum 50 MB ki ho sakti hai.'); return }
          onPick(file)
        }
      }} />
    </div>
  )
}

type SectionForm = { title: string; subtitle: string; bodyHtml: string; visible: boolean; imagePosition: 'left' | 'right'; imageUrl: string | null }

function sectionForm(section?: AboutSection): SectionForm {
  return {
    title: section?.title ?? '', subtitle: section?.subtitle ?? '', bodyHtml: section?.bodyHtml ?? '',
    visible: section ? Number(section.visible) === 1 : true, imagePosition: section?.imagePosition ?? 'right', imageUrl: section?.imageUrl ?? null,
  }
}

export function AboutPageManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [state, setState] = useState<AboutState | null>(null)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [history, setHistory] = useState<{ id: number; publishedBy: string; createdAt: string }[]>([])
  const [forms, setForms] = useState<Record<string, SectionForm>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await api('/api/about/draft', { cache: 'no-store' })
    const data = await response.json() as { state: AboutState; publishedAt: string | null; dirty: boolean }
    setState(data.state)
    setPublishedAt(data.publishedAt)
    setDirty(data.dirty)
    setForms(Object.fromEntries(data.state.sections.map((section) => [section.sectionKey, sectionForm(section)])))
    const historyResponse = await api('/api/about/history', { cache: 'no-store' })
    setHistory((await historyResponse.json() as { history: typeof history }).history)
  }, [])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' }).then(async (response) => {
      setChecked(true)
      if (response.ok) { setSignedIn(true); await load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Draft could not be loaded.')) }
    }).catch(() => setChecked(true))
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

  const setForm = (key: string, patch: Partial<SectionForm>) => setForms((current) => ({ ...current, [key]: { ...current[key], ...patch } }))

  function saveSection(key: string) {
    const form = forms[key]
    void run(async () => {
      await api(`/api/about/sections/${key}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(key === 'hero'
          ? { title: form.title, subtitle: form.subtitle, visible: form.visible }
          : { title: form.title, bodyHtml: form.bodyHtml || null, visible: form.visible, imagePosition: form.imagePosition }),
      })
    }, `${key[0].toUpperCase()}${key.slice(1)} section saved as draft.`)
  }

  function attachSectionImage(key: string, file: File) {
    void run(async () => {
      const { id } = await uploadImage(file, `about-${key}`, forms[key]?.title || key, key === 'hero' ? 16 / 10 : 4 / 3)
      await api(`/api/about/sections/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageAssetId: id }) })
    }, 'Image uploaded. Publish to show it on the website.')
  }

  function detachSectionImage(key: string) {
    void run(async () => {
      await api(`/api/about/sections/${key}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageAssetId: null }) })
    }, 'Image removed from the draft.')
  }

  function addTeamMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    void run(async () => {
      await api('/api/about/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), designation: form.get('designation'), bio: form.get('bio') }) })
      element.reset()
    }, 'Team member added to the draft.')
  }

  function updateTeamMember(member: AboutTeamMember, patch: Partial<AboutTeamMember>, success = 'Team member updated.') {
    void run(async () => {
      await api(`/api/about/team/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    }, success)
  }

  function uploadTeamPhoto(member: AboutTeamMember, file: File) {
    void run(async () => {
      const blob = await fileToCroppedBlob(file, 1)
      await api(`/api/about/team/${member.id}/photo`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
    }, 'Team photo updated.')
  }

  function moveTeam(member: AboutTeamMember, direction: -1 | 1) {
    if (!state) return
    const sorted = [...state.team].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sorted.findIndex((m) => m.id === member.id)
    const other = sorted[index + direction]
    if (!other) return
    void run(async () => {
      await api(`/api/about/team/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: other.sortOrder }) })
      await api(`/api/about/team/${other.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: member.sortOrder }) })
    }, 'Order updated.')
  }

  function addPartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const website = String(form.get('websiteUrl') ?? '').trim()
    void run(async () => {
      await api('/api/about/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.get('name'), category: form.get('category'), websiteUrl: website || null }) })
      element.reset()
    }, 'Partner added to the draft.')
  }

  function updatePartner(partner: AboutPartner, patch: Partial<AboutPartner>, success = 'Partner updated.') {
    void run(async () => {
      await api(`/api/about/partners/${partner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    }, success)
  }

  function uploadPartnerLogo(partner: AboutPartner, file: File) {
    void run(async () => {
      const blob = await fileToCroppedBlob(file, 16 / 7)
      await api(`/api/about/partners/${partner.id}/logo`, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
    }, 'Partner logo updated.')
  }

  function movePartner(partner: AboutPartner, direction: -1 | 1) {
    if (!state) return
    const sorted = [...state.partners].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = sorted.findIndex((p) => p.id === partner.id)
    const other = sorted[index + direction]
    if (!other) return
    void run(async () => {
      await api(`/api/about/partners/${partner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: other.sortOrder }) })
      await api(`/api/about/partners/${other.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sortOrder: partner.sortOrder }) })
    }, 'Order updated.')
  }

  function publish() {
    void run(async () => { await api('/api/about/publish', { method: 'POST' }) }, 'About page published. The public page now shows this content.')
  }

  function restore(id: number) {
    if (!window.confirm('Publish this older version again? Current draft stays unchanged.')) return
    void run(async () => { await api(`/api/about/restore/${id}`, { method: 'POST' }) }, 'Previous published version restored.')
  }

  function remove(kind: 'team' | 'partners', id: string, success: string) {
    if (!window.confirm('Pakka delete karna hai?')) return
    void run(async () => { await api(`/api/about/${kind}/${id}`, { method: 'DELETE' }) }, success)
  }

  if (checked && !signedIn) {
    return (
      <main className="event-admin">
        <header className="event-admin-header">
          <div><p className="eyebrow">The Haat of Art · Content Management</p><h1>About Page Manager</h1><p>Edit karne ke liye admin sign-in zaroori hai.</p></div>
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

  const heroForm = forms.hero
  const foundationForm = forms.foundation
  const companyForm = forms.company
  const heroWords = (heroForm?.title || 'About Us').trim().split(' ')
  const heroAccent = heroWords.length > 1 ? heroWords.pop() : ''

  return (
    <main className="event-admin apm">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Content Management · About Page</p>
          <h1>About Page Manager</h1>
          <p>{publishedAt ? `Published on ${new Date(publishedAt).toLocaleString('en-GB')} by last admin. ` : 'Never published yet. '}
            {dirty ? 'You have unpublished draft changes.' : 'Draft and published content are in sync.'}</p>
        </div>
        <div className="apm-header-actions">
          <Link className="apm-secondary" href="/about" target="_blank">View on Website</Link>
          <button type="button" className="apm-publish" disabled={busy || !dirty} onClick={publish}>Publish Changes</button>
        </div>
      </header>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      {message && <p className="event-form-success" role="status">{message}</p>}

      {!state && !error && <p className="event-form-note">Loading draft…</p>}

      {state && (
        <>
          <section className="event-form">
            <h2>1. Hero Section</h2>
            <div className="apm-grid">
              <div className="apm-fields">
                <label>Title *<input value={heroForm?.title ?? ''} maxLength={160} onChange={(e) => setForm('hero', { title: e.target.value })} placeholder="About Us" /></label>
                <label>Subtitle<input value={heroForm?.subtitle ?? ''} maxLength={500} onChange={(e) => setForm('hero', { subtitle: e.target.value })} placeholder="A platform where artists, art lovers and opportunities come together." /></label>
                <label className="apm-check"><input type="checkbox" checked={heroForm?.visible ?? true} onChange={(e) => setForm('hero', { visible: e.target.checked })} /> Show hero section</label>
                <button type="button" disabled={busy} onClick={() => saveSection('hero')}>Save hero</button>
              </div>
              <div>
                <p className="apm-label">Banner Image</p>
                <ImageSlot url={heroForm?.imageUrl ? `${apiBaseUrl}${heroForm.imageUrl}` : null} alt="Hero banner" busy={busy} onPick={(file) => attachSectionImage('hero', file)} onRemove={() => detachSectionImage('hero')} />
                <p className="apm-label">Preview</p>
                <div className="apm-hero-preview" style={heroForm?.imageUrl ? { backgroundImage: `url(${apiBaseUrl}${heroForm.imageUrl})` } : undefined}>
                  <h3>{heroWords.join(' ')} {heroAccent && <em>{heroAccent}</em>}</h3>
                  <p>{heroForm?.subtitle || 'A platform where artists, art lovers and opportunities come together.'}</p>
                </div>
              </div>
            </div>
          </section>

          {([['foundation', '2. Foundation Section', foundationForm], ['company', '3. Company Section', companyForm]] as const).map(([key, heading, form]) => (
            <section className="event-form" key={key}>
              <h2>{heading}</h2>
              {form && (
                <div className="apm-grid">
                  <div className="apm-fields">
                    <label>Title *<input value={form.title} maxLength={160} onChange={(e) => setForm(key, { title: e.target.value })} /></label>
                    <label>Content *<RichText html={form.bodyHtml} onChange={(html) => setForm(key, { bodyHtml: html })} /></label>
                    <div className="apm-row">
                      <label className="apm-check"><input type="checkbox" checked={form.visible} onChange={(e) => setForm(key, { visible: e.target.checked })} /> Show section</label>
                      <label>Image position
                        <select value={form.imagePosition} onChange={(e) => setForm(key, { imagePosition: e.target.value as 'left' | 'right' })}>
                          <option value="right">Right of text</option><option value="left">Left of text</option>
                        </select>
                      </label>
                    </div>
                    <button type="button" disabled={busy} onClick={() => saveSection(key)}>Save {key}</button>
                  </div>
                  <div>
                    <p className="apm-label">Section Image</p>
                    <ImageSlot url={form.imageUrl ? `${apiBaseUrl}${form.imageUrl}` : null} alt={`${key} image`} busy={busy} onPick={(file) => attachSectionImage(key, file)} onRemove={() => detachSectionImage(key)} />
                  </div>
                </div>
              )}
            </section>
          ))}

          <section className="event-form">
            <h2>4. Our Team</h2>
            <form className="apm-add-row" onSubmit={addTeamMember}>
              <input name="name" placeholder="Name *" maxLength={120} required />
              <input name="designation" placeholder="Designation" maxLength={120} />
              <input name="bio" placeholder="Short bio (optional)" maxLength={1000} />
              <button disabled={busy} type="submit">+ Add Team Member</button>
            </form>
            <table className="apm-table">
              <thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Designation</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[...state.team].sort((a, b) => a.sortOrder - b.sortOrder).map((member, index) => (
                  <tr key={member.id}>
                    <td>{index + 1}</td>
                    <td>
                      <label className="apm-photo">
                        {member.photoUrl ? <img src={`${apiBaseUrl}${member.photoUrl}`} alt={member.name} /> : <i>{member.name.slice(0, 1)}</i>}
                        <input type="file" accept={imageAccept} hidden disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadTeamPhoto(member, file) }} />
                      </label>
                    </td>
                    <td><input defaultValue={member.name} maxLength={120} onBlur={(e) => { if (e.target.value !== member.name) updateTeamMember(member, { name: e.target.value }) }} /></td>
                    <td><input defaultValue={member.designation} maxLength={120} onBlur={(e) => { if (e.target.value !== member.designation) updateTeamMember(member, { designation: e.target.value }) }} /></td>
                    <td><button type="button" className={Number(member.active) ? 'apm-status is-active' : 'apm-status'} disabled={busy} onClick={() => updateTeamMember(member, { active: Number(member.active) ? 0 : 1 }, 'Visibility updated.')}>{Number(member.active) ? 'Active' : 'Hidden'}</button></td>
                    <td className="apm-actions">
                      <button type="button" disabled={busy || index === 0} onClick={() => moveTeam(member, -1)} aria-label="Move up">↑</button>
                      <button type="button" disabled={busy || index === state.team.length - 1} onClick={() => moveTeam(member, 1)} aria-label="Move down">↓</button>
                      <button type="button" disabled={busy} onClick={() => remove('team', member.id, 'Team member deleted.')}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!state.team.length && <tr><td colSpan={6} className="apm-empty">No team members yet. Add them above.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="event-form">
            <h2>5. Event Partners</h2>
            <form className="apm-add-row" onSubmit={addPartner}>
              <input name="name" placeholder="Partner name *" maxLength={160} required />
              <input name="category" placeholder="Category (Organizer, Media Partner…)" maxLength={120} />
              <input name="websiteUrl" placeholder="Website URL (optional)" maxLength={500} />
              <button disabled={busy} type="submit">+ Add Partner</button>
            </form>
            <table className="apm-table">
              <thead><tr><th>#</th><th>Logo</th><th>Name</th><th>Category</th><th>Website</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[...state.partners].sort((a, b) => a.sortOrder - b.sortOrder).map((partner, index) => (
                  <tr key={partner.id}>
                    <td>{index + 1}</td>
                    <td>
                      <label className="apm-photo is-wide">
                        {partner.logoUrl ? <img src={`${apiBaseUrl}${partner.logoUrl}`} alt={partner.name} /> : <i>{partner.name.slice(0, 2)}</i>}
                        <input type="file" accept={imageAccept} hidden disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadPartnerLogo(partner, file) }} />
                      </label>
                    </td>
                    <td><input defaultValue={partner.name} maxLength={160} onBlur={(e) => { if (e.target.value !== partner.name) updatePartner(partner, { name: e.target.value }) }} /></td>
                    <td><input defaultValue={partner.category} maxLength={120} onBlur={(e) => { if (e.target.value !== partner.category) updatePartner(partner, { category: e.target.value }) }} /></td>
                    <td><input defaultValue={partner.websiteUrl ?? ''} maxLength={500} placeholder="https://…" onBlur={(e) => { const value = e.target.value.trim(); if (value !== (partner.websiteUrl ?? '')) updatePartner(partner, { websiteUrl: value || null }) }} /></td>
                    <td><button type="button" className={Number(partner.active) ? 'apm-status is-active' : 'apm-status'} disabled={busy} onClick={() => updatePartner(partner, { active: Number(partner.active) ? 0 : 1 }, 'Visibility updated.')}>{Number(partner.active) ? 'Active' : 'Hidden'}</button></td>
                    <td className="apm-actions">
                      <button type="button" disabled={busy || index === 0} onClick={() => movePartner(partner, -1)} aria-label="Move up">↑</button>
                      <button type="button" disabled={busy || index === state.partners.length - 1} onClick={() => movePartner(partner, 1)} aria-label="Move down">↓</button>
                      <button type="button" disabled={busy} onClick={() => remove('partners', partner.id, 'Partner deleted.')}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!state.partners.length && <tr><td colSpan={7} className="apm-empty">No partners yet. Add them above.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="event-form">
            <h2>6. Publish History</h2>
            <p className="event-form-note">Restore publishes an earlier snapshot again as the live version. The current draft is not changed.</p>
            <ul className="content-list">
              {history.map((entry) => (
                <li key={entry.id}>
                  <i />
                  <span><strong>{new Date(entry.createdAt).toLocaleString('en-GB')}</strong>{entry.publishedBy || 'Unknown admin'}</span>
                  <button type="button" disabled={busy} onClick={() => restore(entry.id)}>Restore</button>
                </li>
              ))}
              {!history.length && <li className="apm-empty-note">Nothing published yet.</li>}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
