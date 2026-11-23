'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Eye, EyeOff, Pencil, Plus, X } from 'lucide-react'
import type { GalleryUpcomingEdition } from '@/lib/booking-server'
import { formatScheduleDateRange, formatScheduleYearRange, isUpcomingEditionActive, toDateInputValue, toIndiaDateTime } from '@/lib/exhibitions-schedule'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type UpcomingEditionForm = Omit<GalleryUpcomingEdition, 'id' | 'editionKey' | 'scheduleLabel' | 'startDate' | 'endDate'> & {
  startDate: string
  endDate: string
}

const emptyForm: UpcomingEditionForm = {
  title: '',
  cityLabel: '',
  venue: '',
  startDate: '',
  endDate: '',
  statusLabel: '',
  published: true,
  showOnGallery: true,
}

function isIndiaIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:30$/.test(value)
    && Number.isFinite(Date.parse(value))
}

function isUpcomingEdition(value: unknown): value is GalleryUpcomingEdition {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.editionKey === 'string'
    && typeof entry.title === 'string'
    && typeof entry.scheduleLabel === 'string'
    && typeof entry.cityLabel === 'string'
    && typeof entry.venue === 'string'
    && isIndiaIsoDateTime(entry.startDate)
    && (isIndiaIsoDateTime(entry.endDate) || entry.endDate === null)
    && typeof entry.statusLabel === 'string'
    && typeof entry.published === 'boolean'
    && typeof entry.showOnGallery === 'boolean'
}

function parseUpcomingEditions(value: unknown): GalleryUpcomingEdition[] {
  if (!Array.isArray(value) || !value.every(isUpcomingEdition)) {
    throw new Error('Upcoming edition data returned an invalid response.')
  }
  return value
}

async function responseError(response: Response) {
  const payload: unknown = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
  return `Request failed (${response.status}).`
}

export function UpcomingEditions({
  initialEditions,
  canManage,
}: {
  initialEditions: GalleryUpcomingEdition[]
  canManage: boolean
}) {
  const [editions, setEditions] = useState(initialEditions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UpcomingEditionForm>(emptyForm)
  const [loadingManage, setLoadingManage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  const sortedEditions = useMemo(
    () => [...editions].sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate) || a.title.localeCompare(b.title)),
    [editions],
  )
  const activeEditions = useMemo(
    () => sortedEditions.filter((edition) => edition.published && edition.showOnGallery && isUpcomingEditionActive(edition, now)),
    [now, sortedEditions],
  )
  const activeIds = new Set(activeEditions.map((edition) => edition.id))
  const displayedEditions = canManage
    ? [...activeEditions, ...sortedEditions.filter((edition) => !activeIds.has(edition.id))]
    : activeEditions
  const yearRange = formatScheduleYearRange(activeEditions)
  const scheduledCities = [...new Set(activeEditions.map((edition) => edition.cityLabel))]
  const invitationCopy = activeEditions.length
    ? `Join our ${yearRange} exhibitions across ${scheduledCities.join(', ')}. Explore the confirmed dates below, bring your work to collectors, and become part of India’s living art history.`
    : 'New exhibition dates are being confirmed by the Exhibition Admin. Check back for the next chapter and its live city-wise schedule.'

  useEffect(() => {
    if (!canManage) return
    let active = true
    setLoadingManage(true)
    fetch(`${apiBaseUrl}/api/exhibition-archive/upcoming/manage`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response))
        const allEditions = parseUpcomingEditions(await response.json())
        if (active) setEditions(allEditions)
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Upcoming editions could not be loaded.')
      })
      .finally(() => {
        if (active) setLoadingManage(false)
      })
    return () => { active = false }
  }, [canManage])

  useEffect(() => {
    if (canManage) return
    let active = true
    const refreshPublicSchedule = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/exhibition-archive/upcoming`, {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) throw new Error(await responseError(response))
        const updatedEditions = parseUpcomingEditions(await response.json())
        if (active) {
          setEditions(updatedEditions)
          setNow(Date.now())
          setError('')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Upcoming editions could not be refreshed.')
      }
    }
    const interval = window.setInterval(() => { void refreshPublicSchedule() }, 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [canManage])

  useEffect(() => {
    const nextExpiry = activeEditions.reduce((nearest, edition) => {
      const endTime = Date.parse(edition.endDate ?? '')
      return Number.isFinite(endTime) && endTime < nearest ? endTime : nearest
    }, Number.POSITIVE_INFINITY)
    if (!Number.isFinite(nextExpiry)) return
    const delay = Math.min(Math.max(0, nextExpiry - Date.now() + 1), 2_147_483_647)
    const timeout = window.setTimeout(() => {
      setNow(Date.now())
      window.dispatchEvent(new Event('gallery:refresh-archive'))
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [activeEditions])

  function startNewEdition() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setShowForm(true)
  }

  function startEditing(edition: GalleryUpcomingEdition) {
    setEditingId(edition.id)
    setForm({
      title: edition.title,
      cityLabel: edition.cityLabel,
      venue: edition.venue,
      startDate: toDateInputValue(edition.startDate),
      endDate: toDateInputValue(edition.endDate),
      statusLabel: edition.statusLabel,
      published: edition.published,
      showOnGallery: edition.showOnGallery,
    })
    setError('')
    setShowForm(true)
  }

  async function persistEdition(editionId: string | null, payload: UpcomingEditionForm) {
    if (!payload.startDate || !payload.endDate) throw new Error('Enter exact start and end dates before publishing this schedule entry.')
    const startDate = toIndiaDateTime(payload.startDate)
    const endDate = toIndiaDateTime(payload.endDate, true)
    const response = await fetch(
      `${apiBaseUrl}/api/exhibition-archive/upcoming${editionId ? `/${encodeURIComponent(editionId)}` : ''}`,
      {
        method: editionId ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          scheduleLabel: formatScheduleDateRange({ startDate, endDate }),
          startDate,
          endDate,
        }),
      },
    )
    if (!response.ok) throw new Error(await responseError(response))
    const result: unknown = await response.json()
    if (!isUpcomingEdition(result)) throw new Error('Upcoming edition data returned an invalid response.')
    setEditions((current) => editionId
      ? current.map((entry) => entry.id === editionId ? result : entry)
      : [...current, result])
    return result
  }

  async function submitEdition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !canManage) return
    setSaving(true)
    setError('')
    try {
      await persistEdition(editingId, form)
      setShowForm(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upcoming edition could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEdition(edition: GalleryUpcomingEdition) {
    if (saving || !canManage) return
    setSaving(true)
    setError('')
    try {
      await persistEdition(edition.id, {
        title: edition.title,
        cityLabel: edition.cityLabel,
        venue: edition.venue,
        startDate: toDateInputValue(edition.startDate),
        endDate: toDateInputValue(edition.endDate),
        statusLabel: edition.statusLabel,
        published: !edition.published,
        showOnGallery: edition.showOnGallery,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Edition visibility could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="ga-upcoming" aria-labelledby="ga-upcoming-title">
      <div className="ga-upcoming-copy">
        <p className="ga-upcoming-kicker">{yearRange === 'Dates to be announced' ? 'Upcoming Editions · Dates to be announced' : `Upcoming Editions · ${yearRange}`}</p>
        <h2 id="ga-upcoming-title">The next chapter is waiting for your signature.</h2>
        <p>{invitationCopy}</p>
        <div className="ga-upcoming-ctas">
          <Link className="ga-upcoming-primary" href="/book-your-stall">Book Your Stall{yearRange === 'Dates to be announced' ? '' : ` for ${yearRange}`} <ArrowRight size={16} aria-hidden="true" /></Link>
          <Link className="ga-upcoming-secondary" href="/indore">Get Free Visitor Pass <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>

      <div className="ga-upcoming-schedule">
        <div className="ga-upcoming-schedule-heading">
          <span><CalendarDays size={16} aria-hidden="true" /> Upcoming schedule</span>
          {canManage && <button type="button" className="ga-upcoming-add" onClick={startNewEdition}><Plus size={15} aria-hidden="true" /> Add schedule entry</button>}
        </div>
        {loadingManage && <p className="ga-upcoming-admin-note">Loading Admin schedule…</p>}
        {displayedEditions.filter((edition) => canManage || (edition.published && edition.showOnGallery && isUpcomingEditionActive(edition, now))).map((edition, index) => {
          const expired = !isUpcomingEditionActive(edition, now)
          return (
          <article className={`ga-upcoming-edition${index === 0 && !expired ? ' is-primary' : ''}${edition.published && edition.showOnGallery && !expired ? '' : ' is-hidden'}`} key={edition.id}>
            <div className="ga-upcoming-edition-copy">
              <span className="ga-upcoming-date">{formatScheduleDateRange(edition)}</span>
              <strong>{edition.title}</strong>
              <span className="ga-upcoming-city">{edition.cityLabel}</span>
              {edition.venue && <span className="ga-upcoming-city">{edition.venue}</span>}
            </div>
            <div className="ga-upcoming-edition-actions">
              <span className="ga-upcoming-status">{expired ? 'Moved to archive' : !edition.published ? 'Unpublished' : !edition.showOnGallery ? 'Hidden from schedule' : edition.statusLabel}</span>
              {canManage && <>
                <button type="button" onClick={() => startEditing(edition)} aria-label={`Edit ${edition.title}`}><Pencil size={14} /></button>
                <button type="button" onClick={() => void toggleEdition(edition)} disabled={saving} aria-label={`${edition.published ? 'Hide' : 'Publish'} ${edition.title}`}>
                  {edition.published ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </>}
            </div>
          </article>
        )})}
        {!activeEditions.length && !canManage && <p className="ga-upcoming-admin-note">New exhibition dates will be announced here.</p>}
        {error && <p className="ga-upcoming-error" role="alert">{error}</p>}
      </div>

      {canManage && showForm && (
        <div className="ga-upcoming-form-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false) }}>
          <section className="ga-upcoming-form-dialog" role="dialog" aria-modal="true" aria-labelledby="ga-upcoming-form-title">
            <header><div><p className="ga-upcoming-kicker">Admin · Upcoming schedule</p><h3 id="ga-upcoming-form-title">{editingId ? 'Edit schedule entry' : 'Add schedule entry'}</h3></div><button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Close schedule editor"><X size={19} /></button></header>
            <form onSubmit={submitEdition}>
              <label>Edition / venue title<input required minLength={2} maxLength={180} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
              <div className="ga-upcoming-form-row">
                <label>City / region<input required maxLength={180} value={form.cityLabel} onChange={(event) => setForm({ ...form, cityLabel: event.target.value })} /></label>
                <label>Venue (optional)<input maxLength={220} value={form.venue} onChange={(event) => setForm({ ...form, venue: event.target.value })} /></label>
              </div>
              <div className="ga-upcoming-form-row">
                <label>Start date<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: form.endDate && form.endDate < event.target.value ? '' : form.endDate })} /></label>
                <label>End date<input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label>
              </div>
              <label>Registration status<input required maxLength={100} placeholder="Applications Open" value={form.statusLabel} onChange={(event) => setForm({ ...form, statusLabel: event.target.value })} /></label>
              <label className="ga-upcoming-publish"><input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} /> Include in THOA’s live exhibition answers</label>
              <label className="ga-upcoming-publish"><input type="checkbox" checked={form.showOnGallery} onChange={(event) => setForm({ ...form, showOnGallery: event.target.checked })} /> Show this edition on the Gallery schedule</label>
              {error && <p className="ga-upcoming-error" role="alert">{error}</p>}
              <button className="ga-upcoming-save" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save schedule entry' : 'Publish schedule entry'}</button>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
