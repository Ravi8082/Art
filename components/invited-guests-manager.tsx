'use client'

import { useCallback, useEffect, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import Link from 'next/link'
import type { InvitedGuest } from '@/lib/api'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 25 * 1024 * 1024
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif'
const roleOptions = ['Chief Guest', 'Guest of Honour', 'Celebrity Patron', 'Special Invitee', 'Cultural Dignitary'] as const
const visibilityFields = [
  { key: 'showOnHome', label: 'Home' },
  { key: 'showOnAbout', label: 'About Us' },
  { key: 'showOnGallery', label: 'Gallery' },
  { key: 'showOnExhibitions', label: 'Exhibitions' },
] as const
type VisibilityField = typeof visibilityFields[number]['key']
type GuestDraft = Omit<InvitedGuest, 'id'>

function blankGuest(sortOrder: number): GuestDraft {
  return {
    name: '',
    roleBadge: 'Special Invitee',
    designation: '',
    roleSummary: '',
    editionTag: '',
    photoUrl: null,
    sortOrder,
    isActive: true,
    showOnHome: true,
    showOnAbout: true,
    showOnGallery: true,
    showOnExhibitions: true,
  }
}

function isPresetRole(value: string) {
  return roleOptions.some((role) => role === value)
}

async function readError(response: Response) {
  const data: unknown = await response.json().catch(() => null)
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') return data.error
  return `Request failed (${response.status})`
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

function imageUrl(path: string | null) {
  return path && path.startsWith('/') ? `${apiBaseUrl}${path}` : path
}

export function InvitedGuestsManager() {
  const [guests, setGuests] = useState<InvitedGuest[]>([])
  const [draft, setDraft] = useState<GuestDraft>(() => blankGuest(1))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await api('/api/admin/invited-guests', { cache: 'no-store' })
    const data: unknown = await response.json()
    if (!Array.isArray(data)) throw new Error('The invited guests service returned an invalid response.')
    const records = data as InvitedGuest[]
    setGuests(records)
    return records
  }, [])

  useEffect(() => {
    let active = true
    void load()
      .then((records) => {
        if (active) setDraft(blankGuest(Math.max(0, ...records.map((guest) => guest.sortOrder)) + 1))
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Invited guests could not be loaded.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  useEffect(() => {
    if (!selectedPhoto) {
      setPreviewUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(selectedPhoto)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedPhoto])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await action()
      await load()
      setMessage(success)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The request could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  function choosePhoto(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a supported image file.')
      return
    }
    if (file.size > maxFileBytes) {
      setError('Portrait images must be 25 MB or smaller.')
      return
    }
    setError('')
    setSelectedPhoto(file)
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    choosePhoto(event.dataTransfer.files[0])
  }

  function resetForm(sortOrder = Math.max(0, ...guests.map((guest) => guest.sortOrder)) + 1) {
    setDraft(blankGuest(sortOrder))
    setEditingId(null)
    setSelectedPhoto(null)
  }

  function editGuest(guest: InvitedGuest) {
    setDraft({ ...guest })
    setEditingId(guest.id)
    setSelectedPhoto(null)
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    let savedId = editingId
    try {
      const profile = {
        name: draft.name,
        roleBadge: draft.roleBadge,
        designation: draft.designation,
        roleSummary: draft.roleSummary,
        editionTag: draft.editionTag,
        sortOrder: draft.sortOrder,
        isActive: draft.isActive,
        showOnHome: draft.showOnHome,
        showOnAbout: draft.showOnAbout,
        showOnGallery: draft.showOnGallery,
        showOnExhibitions: draft.showOnExhibitions,
      }
      const response = await api(
        editingId ? `/api/admin/invited-guests/${editingId}` : '/api/admin/invited-guests',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        },
      )
      if (!editingId) {
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') {
          throw new Error('The guest profile was saved, but its ID was not returned.')
        }
        savedId = result.id
      }
      if (selectedPhoto && savedId) {
        await api(`/api/admin/invited-guests/${savedId}/photo`, {
          method: 'PUT',
          headers: {
            'Content-Type': selectedPhoto.type,
            'X-Alt-Text': encodeURIComponent(`${draft.name} portrait`),
          },
          body: selectedPhoto,
        })
      }
      const records = await load()
      resetForm(Math.max(0, ...records.map((guest) => guest.sortOrder)) + 1)
      setMessage(editingId ? 'Guest profile updated.' : 'Guest profile added.')
    } catch (cause) {
      if (savedId && !editingId) {
        setEditingId(savedId)
        await load().catch(() => undefined)
      }
      setError(cause instanceof Error ? cause.message : 'The guest profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function toggleField(guest: InvitedGuest, field: 'isActive' | VisibilityField, checked: boolean) {
    void run(async () => {
      await api(`/api/admin/invited-guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: checked }),
      })
    }, 'Guest visibility updated.')
  }

  function reorder(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= guests.length || fromIndex === toIndex) return
    const reordered = [...guests]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    void run(async () => {
      await api('/api/admin/invited-guests/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((guest) => guest.id) }),
      })
    }, 'Guest display order saved.')
  }

  function deleteGuest(guest: InvitedGuest) {
    if (!window.confirm(`Delete ${guest.name}? This cannot be undone.`)) return
    void run(async () => {
      await api(`/api/admin/invited-guests/${guest.id}`, { method: 'DELETE' })
      if (editingId === guest.id) resetForm()
    }, 'Guest profile deleted.')
  }

  const customRole = !isPresetRole(draft.roleBadge)

  return (
    <main className="event-admin ig-manager">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Editorial CMS</p>
          <h1>Invited Guests &amp; Luminaries</h1>
          <p>Manage guest profiles, portraits, visibility and display order across the public site.</p>
        </div>
        <Link className="event-admin-back" href="/dashboard">Dashboard</Link>
      </header>

      {message && <p className="ig-manager-notice" role="status">{message}</p>}
      {error && <p className="ig-manager-error" role="alert">{error}</p>}

      <form className="ig-main-guest-form" onSubmit={saveGuest}>
        <div className="ig-form-heading">
          <div>
            <p className="eyebrow">{editingId ? 'PROFILE EDITOR' : 'NEW PROFILE'}</p>
            <h2>{editingId ? 'Edit Main Guest' : 'Add Main Guest'}</h2>
          </div>
          {editingId && <button className="ig-secondary-button" type="button" disabled={busy} onClick={() => resetForm()}>Cancel editing</button>}
        </div>

        <div className="ig-form-layout">
          <label
            className={`ig-photo-drop${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept={imageAccept}
              onChange={(event) => {
                choosePhoto(event.currentTarget.files?.[0])
                event.currentTarget.value = ''
              }}
            />
            {previewUrl || draft.photoUrl
              ? <img src={previewUrl || imageUrl(draft.photoUrl) || ''} alt="Guest portrait preview" />
              : <span className="ig-photo-empty">Drop a portrait here or click to upload</span>}
            <span className="ig-photo-overlay">{selectedPhoto ? selectedPhoto.name : 'Choose portrait'}</span>
            <small>JPG, PNG, WebP or GIF · up to 25 MB · portrait framing recommended</small>
          </label>

          <div className="ig-fields">
            <div className="ig-field-grid">
              <label>Guest full name
                <input value={draft.name} maxLength={180} required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <label>Event role
                <select
                  value={customRole ? '__custom' : draft.roleBadge}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    roleBadge: event.target.value === '__custom' ? (isPresetRole(current.roleBadge) ? '' : current.roleBadge) : event.target.value,
                  }))}
                >
                  {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
                  <option value="__custom">Custom role…</option>
                </select>
                {customRole && <input className="ig-custom-role" value={draft.roleBadge} maxLength={80} required placeholder="Enter custom event role" onChange={(event) => setDraft((current) => ({ ...current, roleBadge: event.target.value }))} />}
              </label>
              <label>Official designation / profession
                <input value={draft.designation} maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, designation: event.target.value }))} />
              </label>
              <label>Edition / city
                <input value={draft.editionTag} maxLength={120} placeholder="Mumbai Edition" onChange={(event) => setDraft((current) => ({ ...current, editionTag: event.target.value }))} />
              </label>
              <label className="ig-summary-field">Role &amp; presence summary
                <textarea value={draft.roleSummary} maxLength={500} rows={3} placeholder="Describe their contribution to the exhibition…" onChange={(event) => setDraft((current) => ({ ...current, roleSummary: event.target.value }))} />
                <small>{draft.roleSummary.length}/500 characters</small>
              </label>
              <label>Display priority
                <input type="number" min={0} max={999999} step={1} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
              </label>
            </div>

            <div className="ig-form-controls">
              <label className="ig-switch">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
                <span>Active status</span>
              </label>
              <fieldset className="ig-page-controls">
                <legend>Show on pages</legend>
                {visibilityFields.map(({ key, label }) => (
                  <label key={key}><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>
                ))}
              </fieldset>
            </div>
          </div>
        </div>
        <div className="ig-form-actions">
          <button className="ig-save-button" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save Guest Changes' : 'Add Main Guest'}</button>
          {!editingId && <span>New profiles are visible only after a real portrait is uploaded.</span>}
        </div>
      </form>

      <section className="ig-records-section">
        <div className="ig-form-heading">
          <div>
            <p className="eyebrow">DATABASE RECORDS</p>
            <h2>All invited guests <span>({guests.length})</span></h2>
          </div>
        </div>
        {loading ? <p className="ig-empty-state">Loading guest profiles…</p> : guests.length === 0 ? (
          <p className="ig-empty-state">No guest profiles yet. Add the first main guest above.</p>
        ) : (
          <div className="ig-record-grid">
            {guests.map((guest, index) => (
              <article className={`ig-record-card${guest.isActive ? '' : ' is-inactive'}`} key={guest.id}>
                <div className="ig-record-portrait">
                  {guest.photoUrl
                    ? <img src={imageUrl(guest.photoUrl) || ''} alt={`${guest.name} portrait`} />
                    : <span>{guest.name.trim().charAt(0).toUpperCase() || '?'}</span>}
                </div>
                <div className="ig-record-details">
                  <div className="ig-record-title">
                    <span className="ig-role-pill">{guest.roleBadge}</span>
                    <h3>{guest.name}</h3>
                    <p>{guest.designation || 'Designation not provided'}</p>
                    {guest.roleSummary && <p className="ig-record-summary">{guest.roleSummary}</p>}
                    <small>{guest.editionTag || 'Edition not specified'} · Order {guest.sortOrder}</small>
                  </div>
                  <div className="ig-record-actions">
                    <button type="button" disabled={busy} onClick={() => editGuest(guest)}>Edit</button>
                    <button type="button" aria-label={`Move ${guest.name} up`} disabled={busy || index === 0} onClick={() => reorder(index, index - 1)}>↑</button>
                    <button type="button" aria-label={`Move ${guest.name} down`} disabled={busy || index === guests.length - 1} onClick={() => reorder(index, index + 1)}>↓</button>
                    <button type="button" className="ig-delete-button" disabled={busy} onClick={() => deleteGuest(guest)}>Delete</button>
                  </div>
                </div>
                <div className="ig-record-toggles">
                  <label className="ig-switch">
                    <input type="checkbox" checked={guest.isActive} disabled={busy} onChange={(event) => toggleField(guest, 'isActive', event.target.checked)} />
                    <span>{guest.isActive ? 'Published' : 'Inactive'}</span>
                  </label>
                  <div className="ig-record-visibilities">
                    {visibilityFields.map(({ key, label }) => (
                      <label key={key}><input type="checkbox" checked={guest[key]} disabled={busy} onChange={(event) => toggleField(guest, key, event.target.checked)} />{label}</label>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
