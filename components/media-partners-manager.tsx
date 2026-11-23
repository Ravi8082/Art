'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import Link from 'next/link'
import type { MediaPartner } from '@/lib/api'
import styles from './media-partners-manager.module.css'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 25 * 1024 * 1024
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif'
const visibilityFields = [
  { key: 'showOnHome', label: 'Home' },
  { key: 'showOnAbout', label: 'About' },
  { key: 'showOnExhibitions', label: 'Exhibitions' },
] as const
type VisibilityField = typeof visibilityFields[number]['key']
type PartnerDraft = Omit<MediaPartner, 'id' | 'logoUrl' | 'websiteUrl'> & { websiteUrl: string }

function blankPartner(sortOrder: number): PartnerDraft {
  return {
    name: '',
    category: '',
    websiteUrl: '',
    sortOrder,
    isActive: true,
    showOnHome: true,
    showOnAbout: true,
    showOnExhibitions: true,
  }
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

function isPartnerList(value: unknown): value is MediaPartner[] {
  return Array.isArray(value) && value.every((item) => item
    && typeof item === 'object'
    && 'id' in item && typeof item.id === 'string'
    && 'name' in item && typeof item.name === 'string'
    && 'category' in item && typeof item.category === 'string'
    && 'logoUrl' in item && (item.logoUrl === null || typeof item.logoUrl === 'string')
    && 'websiteUrl' in item && (item.websiteUrl === null || typeof item.websiteUrl === 'string')
    && 'sortOrder' in item && typeof item.sortOrder === 'number'
    && 'isActive' in item && typeof item.isActive === 'boolean'
    && 'showOnHome' in item && typeof item.showOnHome === 'boolean'
    && 'showOnAbout' in item && typeof item.showOnAbout === 'boolean'
    && 'showOnExhibitions' in item && typeof item.showOnExhibitions === 'boolean')
}

function mediaUrl(url: string | null | undefined) {
  return url && url.startsWith('/') ? `${apiBaseUrl}${url}` : url
}

export function MediaPartnersManager() {
  const [partners, setPartners] = useState<MediaPartner[]>([])
  const [draft, setDraft] = useState<PartnerDraft>(() => blankPartner(1))
  const [editing, setEditing] = useState<MediaPartner | null>(null)
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await api('/api/admin/media-partners', { cache: 'no-store' })
    const data: unknown = await response.json()
    if (!isPartnerList(data)) throw new Error('The media partners service returned an invalid response.')
    setPartners(data)
    return data
  }, [])

  useEffect(() => {
    let active = true
    void load()
      .then((records) => {
        if (active) setDraft(blankPartner(Math.max(0, ...records.map((partner) => partner.sortOrder)) + 1))
      })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Media partners could not be loaded.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  useEffect(() => {
    if (!selectedLogo) {
      setPreviewUrl('')
      return
    }
    const objectUrl = URL.createObjectURL(selectedLogo)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedLogo])

  function resetForm(nextOrder = Math.max(0, ...partners.map((partner) => partner.sortOrder)) + 1) {
    setDraft(blankPartner(nextOrder))
    setEditing(null)
    setSelectedLogo(null)
  }

  function editPartner(partner: MediaPartner) {
    setDraft({
      name: partner.name,
      category: partner.category,
      websiteUrl: partner.websiteUrl ?? '',
      sortOrder: partner.sortOrder,
      isActive: partner.isActive,
      showOnHome: partner.showOnHome,
      showOnAbout: partner.showOnAbout,
      showOnExhibitions: partner.showOnExhibitions,
    })
    setEditing(partner)
    setSelectedLogo(null)
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a JPG, PNG, WebP or GIF logo.')
      return
    }
    if (file.size > maxFileBytes) {
      setError('Logo images must be 25 MB or smaller.')
      return
    }
    setError('')
    setSelectedLogo(file)
  }

  async function savePartner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    let savedId = editing?.id ?? null
    try {
      const response = await api(
        editing ? `/api/admin/media-partners/${editing.id}` : '/api/admin/media-partners',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        },
      )
      if (!editing) {
        const result: unknown = await response.json()
        if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') {
          throw new Error('The media partner was saved, but its ID was not returned.')
        }
        savedId = result.id
      }
      if (selectedLogo && savedId) {
        await api(`/api/admin/media-partners/${savedId}/logo`, {
          method: 'PUT',
          headers: { 'Content-Type': selectedLogo.type, 'X-Alt-Text': encodeURIComponent(`${draft.name} logo`) },
          body: selectedLogo,
        })
      }
      const records = await load()
      resetForm(Math.max(0, ...records.map((partner) => partner.sortOrder)) + 1)
      setMessage(editing ? 'Media partner updated.' : 'Media partner added.')
    } catch (cause) {
      if (savedId && !editing) {
        const createdPartner: MediaPartner = {
          id: savedId,
          ...draft,
          logoUrl: null,
          websiteUrl: draft.websiteUrl || null,
        }
        setEditing(partners.find((partner) => partner.id === savedId) ?? createdPartner)
      }
      setError(cause instanceof Error ? cause.message : 'The media partner could not be saved.')
    } finally {
      setBusy(false)
    }
  }

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

  function toggleField(partner: MediaPartner, field: 'isActive' | VisibilityField, checked: boolean) {
    void run(async () => {
      await api(`/api/admin/media-partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: checked }),
      })
    }, 'Media partner visibility updated.')
  }

  function reorder(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= partners.length || fromIndex === toIndex) return
    const reordered = [...partners]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    void run(async () => {
      await api('/api/admin/media-partners/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((partner) => partner.id) }),
      })
    }, 'Partner display order saved.')
  }

  function deletePartner(partner: MediaPartner) {
    if (!window.confirm(`Delete ${partner.name}? This cannot be undone.`)) return
    void run(async () => {
      await api(`/api/admin/media-partners/${partner.id}`, { method: 'DELETE' })
      if (editing?.id === partner.id) resetForm()
    }, 'Media partner deleted.')
  }

  const currentLogo = previewUrl || mediaUrl(editing?.logoUrl) || ''

  return (
    <main className={styles.manager}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>The Haat of Art · Editorial CMS</p>
          <h1>Media, Press &amp; Outdoor Alliances</h1>
          <p>Manage partner mastheads, logos, publication order and page-by-page visibility.</p>
        </div>
        <Link className={styles.back} href="/dashboard">Dashboard</Link>
      </header>

      {message && <p className={styles.notice} role="status">{message}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <form className={styles.form} onSubmit={savePartner}>
        <div className={styles.formHeading}>
          <div>
            <p className={styles.eyebrow}>{editing ? 'PARTNER EDITOR' : 'NEW ALLIANCE'}</p>
            <h2>{editing ? 'Edit Media Partner' : 'Add Media Partner'}</h2>
          </div>
          {editing && <button className={styles.secondary} type="button" disabled={busy} onClick={() => resetForm()}>Cancel editing</button>}
        </div>

        <div className={styles.formGrid}>
          <label className={styles.logoPicker}>
            <input type="file" accept={imageAccept} disabled={busy} onChange={chooseLogo} />
            {currentLogo
              ? <img src={currentLogo} alt={`${draft.name || 'Partner'} logo preview`} />
              : <span className={styles.logoPlaceholder}>{draft.name || 'Publication masthead'}</span>}
            <span className={styles.logoOverlay}>{selectedLogo ? selectedLogo.name : editing?.logoUrl ? 'Replace logo' : 'Upload logo'}</span>
            <small>JPG, PNG, WebP or GIF · up to 25 MB</small>
          </label>

          <div className={styles.fields}>
            <label>Publication / partner name
              <input value={draft.name} maxLength={180} required onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>Category
              <input value={draft.category} maxLength={80} placeholder="Print & Lifestyle, Outdoor Media…" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} />
            </label>
            <label>Website URL <span>(optional)</span>
              <input type="url" value={draft.websiteUrl} maxLength={500} placeholder="https://" onChange={(event) => setDraft((current) => ({ ...current, websiteUrl: event.target.value }))} />
            </label>
            <label>Display order
              <input type="number" min={0} max={999999} step={1} value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
            </label>
            <label className={styles.switch}>
              <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} />
              <span>Published</span>
            </label>
            <fieldset className={styles.visibility}>
              <legend>Show on pages</legend>
              {visibilityFields.map(({ key, label }) => (
                <label key={key}><input type="checkbox" checked={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))} />{label}</label>
              ))}
            </fieldset>
          </div>
        </div>
        <div className={styles.formActions}>
          <button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Partner Changes' : 'Add Media Partner'}</button>
          <span>Uploaded logos appear on every page where this alliance is published.</span>
        </div>
      </form>

      <section className={styles.records}>
        <div className={styles.formHeading}>
          <div>
            <p className={styles.eyebrow}>DATABASE RECORDS</p>
            <h2>All media alliances <span>({partners.length})</span></h2>
          </div>
        </div>
        {loading ? <p className={styles.empty}>Loading media partners…</p> : partners.length === 0 ? (
          <p className={styles.empty}>No media partners yet. Add the first alliance above.</p>
        ) : (
          <div className={styles.partnerList}>
            {partners.map((partner, index) => (
              <article className={`${styles.partnerCard}${partner.isActive ? '' : ` ${styles.inactive}`}`} key={partner.id}>
                <div className={styles.mark}>
                  {partner.logoUrl
                    ? <img src={mediaUrl(partner.logoUrl) ?? ''} alt={`${partner.name} logo`} />
                    : <span>{partner.name}</span>}
                </div>
                <div className={styles.details}>
                  <h3>{partner.name}</h3>
                  <p>{partner.category || 'Category not specified'}{partner.websiteUrl && <> · <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer">Website</a></>}</p>
                  <small>Display order {partner.sortOrder}</small>
                </div>
                <div className={styles.controls}>
                  <label className={styles.switch}>
                    <input type="checkbox" checked={partner.isActive} disabled={busy} onChange={(event) => toggleField(partner, 'isActive', event.target.checked)} />
                    <span>{partner.isActive ? 'Published' : 'Inactive'}</span>
                  </label>
                  <div className={styles.pageSwitches}>
                    {visibilityFields.map(({ key, label }) => (
                      <label key={key}><input type="checkbox" checked={partner[key]} disabled={busy} onChange={(event) => toggleField(partner, key, event.target.checked)} />{label}</label>
                    ))}
                  </div>
                  <div className={styles.actions}>
                    <button type="button" disabled={busy} onClick={() => editPartner(partner)}>Edit</button>
                    <button type="button" aria-label={`Move ${partner.name} up`} disabled={busy || index === 0} onClick={() => reorder(index, index - 1)}>↑</button>
                    <button type="button" aria-label={`Move ${partner.name} down`} disabled={busy || index === partners.length - 1} onClick={() => reorder(index, index + 1)}>↓</button>
                    <button className={styles.delete} type="button" disabled={busy} onClick={() => deletePartner(partner)}>Delete</button>
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
