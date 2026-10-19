'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Link from 'next/link'
import { Camera, ImagePlus, Pencil, Trash2, X } from 'lucide-react'
import type { ArtistProfileData } from '@/lib/booking-server'
import { indianStates, indianUnionTerritories } from '@/lib/indian-states'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const MAX_BYTES = 8 * 1024 * 1024
const MAX_RAW_BYTES = 40 * 1024 * 1024
const MAX_SIDE = 2400
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type Profile = NonNullable<ArtistProfileData['profile']>
type Form = { displayName: string; headline: string; city: string; state: string; phone: string; artStyle: string; bio: string; websiteUrl: string; instagramUrl: string; facebookUrl: string }
type ItemForm = { title: string; medium: string; dimensions: string; year: string; price: string; description: string }

const emptyItem: ItemForm = { title: '', medium: '', dimensions: '', year: '', price: '', description: '' }
const src = (path: string | null | undefined) => (path ? `${apiBase}${path}` : null)

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}/api/artist-profile${path}`, { ...init, credentials: 'include' })
  const body = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body
}

function checkImage(file: File | undefined) {
  if (!file) return 'Choose an image first'
  if (!IMAGE_TYPES.includes(file.type)) return 'Only JPG, PNG, WebP or GIF images are allowed'
  if (file.size > MAX_RAW_BYTES) return 'Image is too large (max 40 MB)'
  return null
}

// Shrinks big photos (e.g. from a phone camera) so they fit the 8 MB upload limit.
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif' || file.size <= 1.5 * 1024 * 1024) {
    if (file.size > MAX_BYTES) throw new Error('This GIF is larger than 8 MB. Please choose a smaller one.')
    return file
  }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!blob) throw new Error('Could not process this image. Try a different file.')
  if (blob.size > MAX_BYTES) throw new Error('Image is still larger than 8 MB after resizing. Please choose a smaller one.')
  return blob
}

export function ArtistProfileEditor({ initial, fallbackName, email }: { initial: ArtistProfileData; fallbackName: string; email: string }) {
  const [data, setData] = useState(initial)
  const [editing, setEditing] = useState(!initial.profile)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [item, setItem] = useState<ItemForm>(emptyItem)
  const [itemFile, setItemFile] = useState<File | null>(null)
  const [itemPreview, setItemPreview] = useState<string | null>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const p = data.profile
  const [form, setForm] = useState<Form>({
    displayName: p?.displayName || fallbackName, headline: p?.headline ?? '', city: p?.city ?? '', state: p?.state ?? '', phone: p?.phone ?? '',
    artStyle: p?.artStyle ?? '', bio: p?.bio ?? '', websiteUrl: p?.websiteUrl ?? '', instagramUrl: p?.instagramUrl ?? '', facebookUrl: p?.facebookUrl ?? '',
  })
  const name = p?.displayName || fallbackName
  const location = [p?.city, p?.state].filter(Boolean).join(', ')

  const fail = (error: unknown) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong' })
  const ok = (text: string) => setNotice({ type: 'ok', text })
  const setField = (key: keyof Form) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const setItemField = (key: keyof ItemForm) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setItem((current) => ({ ...current, [key]: event.target.value }))

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setBusy('profile'); setNotice(null)
    try {
      setData(await call<ArtistProfileData>('/me', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) }))
      setEditing(false); ok('Profile saved')
    } catch (error) { fail(error) } finally { setBusy('') }
  }

  async function uploadImage(slot: 'photo' | 'cover', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const problem = checkImage(file)
    if (problem) return setNotice({ type: 'error', text: problem })
    setBusy(slot); setNotice(null)
    try {
      const blob = await prepareImage(file!)
      setData(await call<ArtistProfileData>(`/me/image/${slot}`, { method: 'POST', headers: { 'content-type': blob.type }, body: blob }))
      ok(slot === 'photo' ? 'Profile photo updated' : 'Cover image updated')
    } catch (error) { fail(error) } finally { setBusy('') }
  }

  function pickItemImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const problem = checkImage(file)
    if (problem) { event.target.value = ''; return setNotice({ type: 'error', text: problem }) }
    if (itemPreview) URL.revokeObjectURL(itemPreview)
    setItemFile(file!); setItemPreview(URL.createObjectURL(file!)); setNotice(null)
  }

  function closeAdd() {
    if (itemPreview) URL.revokeObjectURL(itemPreview)
    setAdding(false); setItem(emptyItem); setItemFile(null); setItemPreview(null)
  }

  async function addArtwork(event: FormEvent) {
    event.preventDefault()
    const problem = checkImage(itemFile ?? undefined)
    if (problem) return setNotice({ type: 'error', text: problem })
    setBusy('artwork'); setNotice(null)
    try {
      const blob = await prepareImage(itemFile!)
      const uploaded = await call<{ assetId: string }>('/me/artworks/image', { method: 'POST', headers: { 'content-type': blob.type }, body: blob })
      setData(await call<ArtistProfileData>('/me/artworks', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...item, year: item.year ? Number(item.year) : null, price: item.price ? Number(item.price) : null, imageAssetId: uploaded.assetId }),
      }))
      closeAdd(); ok('Artwork added')
    } catch (error) { fail(error) } finally { setBusy('') }
  }

  async function removeArtwork(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setBusy(id); setNotice(null)
    try { setData(await call<ArtistProfileData>(`/me/artworks/${id}`, { method: 'DELETE' })); ok('Artwork deleted') } catch (error) { fail(error) } finally { setBusy('') }
  }

  const noticeBox = notice && <div className={`ap-notice is-${notice.type}`} role="alert">{notice.text}<button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}><X size={14} /></button></div>
  const cover = src(p?.coverUrl)
  const photo = src(p?.photoUrl)

  return (
    <>
      <section className="ap-cover">
        {cover ? <img src={cover} alt="Cover" /> : <div className="ap-cover-empty" />}
        <button type="button" className="ap-edit-btn ap-cover-btn" onClick={() => coverInput.current?.click()} disabled={busy === 'cover'}>
          <ImagePlus size={14} /> {busy === 'cover' ? 'Uploading…' : cover ? 'Change cover' : 'Add cover image'}
        </button>
        <input ref={coverInput} type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={(event) => uploadImage('cover', event)} />
      </section>

      <section className="ap-head">
        <div className="ap-photo-wrap">
          {photo ? <img src={photo} alt={name} className="ap-photo" /> : <span className="ap-photo ap-photo-empty">{name.slice(0, 1).toUpperCase()}</span>}
          <button type="button" className="ap-photo-btn" aria-label="Change profile photo" onClick={() => photoInput.current?.click()} disabled={busy === 'photo'}><Camera size={14} /></button>
          <input ref={photoInput} type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={(event) => uploadImage('photo', event)} />
        </div>
        <div className="ap-info">
          <h1>{name}</h1>
          {p && p.status && (
            <p className={`ap-review ap-review-${p.status.toLowerCase()}`}>
              {p.status === 'APPROVED' ? 'Live on the public Artists page'
                : p.status === 'REJECTED' ? `Not approved${p.reviewNote ? `: ${p.reviewNote}` : ''}. Update your profile and save to resubmit.`
                  : 'Waiting for admin approval. Your profile will appear on the public Artists page once approved.'}
            </p>
          )}
          {p?.headline && <p className="ap-headline">{p.headline}</p>}
          <p className="ap-loc">{[location, email].filter(Boolean).join(' · ')}</p>
          {p?.bio ? <p>{p.bio}</p> : <p>Add a short bio so visitors and collectors can get to know you.</p>}
          <div className="ap-links">
            {p?.websiteUrl && <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer">Website</a>}
            {p?.instagramUrl && <a href={p.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {p?.facebookUrl && <a href={p.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>}
          </div>
        </div>
        <button type="button" className="th-btn" onClick={() => setEditing((value) => !value)}><Pencil size={13} /> {editing ? 'Close editor' : 'Edit profile'}</button>
      </section>

      {!adding && noticeBox}

      {editing && (
        <form className="ap-editor ar-form" onSubmit={saveProfile}>
          <h2>Edit profile</h2>
          <div className="ap-editor-grid">
            <label className="ar-field"><span>Artist name <em>*</em></span><input required minLength={2} maxLength={160} value={form.displayName} onChange={setField('displayName')} /></label>
            <label className="ar-field"><span>Headline</span><input maxLength={160} placeholder="e.g. Contemporary painter" value={form.headline} onChange={setField('headline')} /></label>
            <label className="ar-field"><span>City</span><input maxLength={120} value={form.city} onChange={setField('city')} /></label>
            <label className="ar-field"><span>State</span>
              <select value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}>
                <option value="">Select state</option>
                {form.state && ![...indianStates, ...indianUnionTerritories].includes(form.state as never) && <option value={form.state}>{form.state}</option>}
                <optgroup label="States">{indianStates.map((state) => <option key={state} value={state}>{state}</option>)}</optgroup>
                <optgroup label="Union Territories">{indianUnionTerritories.map((state) => <option key={state} value={state}>{state}</option>)}</optgroup>
              </select>
            </label>
            <label className="ar-field"><span>Art style / medium</span><input maxLength={160} placeholder="e.g. Acrylic, mixed media" value={form.artStyle} onChange={setField('artStyle')} /></label>
            <label className="ar-field"><span>Phone</span><input type="tel" maxLength={30} placeholder="+91 98765 43210" value={form.phone} onChange={setField('phone')} /></label>
            <label className="ar-field"><span>Website</span><input type="url" maxLength={512} placeholder="https://" value={form.websiteUrl} onChange={setField('websiteUrl')} /></label>
            <label className="ar-field"><span>Instagram</span><input type="url" maxLength={512} placeholder="https://instagram.com/…" value={form.instagramUrl} onChange={setField('instagramUrl')} /></label>
            <label className="ar-field"><span>Facebook</span><input type="url" maxLength={512} placeholder="https://facebook.com/…" value={form.facebookUrl} onChange={setField('facebookUrl')} /></label>
          </div>
          <label className="ar-field"><span>Bio <small>({form.bio.length}/2000)</small></span><textarea rows={5} maxLength={2000} value={form.bio} onChange={setField('bio')} /></label>
          <div className="ap-editor-actions">
            {p && <button type="button" className="th-btn-outline" onClick={() => setEditing(false)}>Cancel</button>}
            <button type="submit" className="th-btn" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      )}

      <section className="ap-stats ap-stats-4">
        <div><b>{data.artworks.length}</b><small>Artworks</small></div>
        <div><b>{p?.city || '—'}</b><small>City</small></div>
        <div><b>{p?.artStyle || '—'}</b><small>Art style</small></div>
        <div><b>{p?.phone || '—'}</b><small>Phone</small></div>
      </section>

      <nav className="ap-tabs">
        <span className="is-on">Artworks</span>
        <button type="button" className="ap-add-btn th-btn" onClick={() => (adding ? closeAdd() : setAdding(true))}><ImagePlus size={13} /> {adding ? 'Cancel' : 'Add artwork'}</button>
      </nav>

      {adding && (
        <form className="ap-editor ar-form" onSubmit={addArtwork}>
          <h2>Add artwork</h2>
          {noticeBox}
          <label className="ap-drop">
            {itemPreview ? <img src={itemPreview} alt="Selected artwork preview" /> : <span><ImagePlus size={26} /><b>Click to choose an image</b><small>JPG, PNG, WebP or GIF · max 8 MB</small></span>}
            <input type="file" accept={IMAGE_TYPES.join(',')} hidden onChange={pickItemImage} />
          </label>
          <div className="ap-editor-grid">
            <label className="ar-field"><span>Title <em>*</em></span><input required maxLength={160} value={item.title} onChange={setItemField('title')} /></label>
            <label className="ar-field"><span>Medium</span><input maxLength={160} placeholder="e.g. Acrylic on canvas" value={item.medium} onChange={setItemField('medium')} /></label>
            <label className="ar-field"><span>Dimensions</span><input maxLength={80} placeholder="e.g. 24 x 36 inches" value={item.dimensions} onChange={setItemField('dimensions')} /></label>
            <label className="ar-field"><span>Year</span><input type="number" min={1900} max={2100} value={item.year} onChange={setItemField('year')} /></label>
            <label className="ar-field"><span>Price (₹, optional)</span><input type="number" min={0} step="0.01" value={item.price} onChange={setItemField('price')} /></label>
          </div>
          <label className="ar-field"><span>Description</span><textarea rows={3} maxLength={1000} value={item.description} onChange={setItemField('description')} /></label>
          <div className="ap-editor-actions">
            <button type="button" className="th-btn-outline" onClick={closeAdd}>Cancel</button>
            <button type="submit" className="th-btn" disabled={busy === 'artwork'}>{busy === 'artwork' ? 'Uploading…' : 'Add artwork'}</button>
          </div>
        </form>
      )}

      {data.artworks.length ? (
        <section className="ap-grid">
          {data.artworks.map((art) => (
            <article key={art.id}>
              <img src={src(art.imageUrl) ?? ''} alt={art.title} loading="lazy" />
              <b>{art.title}</b>
              <small>{[art.medium, art.dimensions, art.year].filter(Boolean).join(' · ')}</small>
              {art.description && <p className="ap-art-desc">{art.description}</p>}
              {art.price !== null && <strong>₹{art.price.toLocaleString('en-IN')}</strong>}
              <button type="button" className="ap-del" aria-label={`Delete ${art.title}`} onClick={() => removeArtwork(art.id, art.title)} disabled={busy === art.id}><Trash2 size={13} /></button>
            </article>
          ))}
        </section>
      ) : (
        <p className="ap-empty">No artworks yet. Use “Add artwork” to upload your first piece. <Link href="/exhibitions">See how to exhibit</Link></p>
      )}
    </>
  )
}
