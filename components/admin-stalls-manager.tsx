'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import type { Exhibition, Stall, StallStatus, StallType } from '@/lib/booking-api'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const categories: StallType['category'][] = ['INDIVIDUAL', 'GROUP', 'GALLERY']
const categoryLabels: Record<StallType['category'], string> = { INDIVIDUAL: 'Individual', GROUP: 'Group', GALLERY: 'Gallery' }
const MAX_BLOCK = 100

const statusStyles: Record<StallStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Available', className: 'is-available' },
  HELD: { label: 'Selected / Held', className: 'is-held' },
  BOOKED: { label: 'Booked', className: 'is-booked' },
  DISABLED: { label: 'Not Available', className: 'is-disabled' },
}
const legendOrder: StallStatus[] = ['AVAILABLE', 'HELD', 'BOOKED', 'DISABLED']

// HELD and BOOKED are derived from live bookings; the editable column only stores AVAILABLE / DISABLED.
function baseStatus(stall: Stall): 'AVAILABLE' | 'DISABLED' {
  return stall.status === 'DISABLED' ? 'DISABLED' : 'AVAILABLE'
}

type StallTypeCategory = StallType['category']

interface TypeFormValues {
  code: string
  name: string
  category: string
  widthM: string
  depthM: string
  price: string
  taxRate: string
  includes: string
}

interface StallDraft {
  code: string
  location: string
  status: 'AVAILABLE' | 'DISABLED'
  stallTypeId: string
}

interface StallPatch {
  code?: string
  location?: string
  status?: 'AVAILABLE' | 'DISABLED'
  stallTypeId?: string
}

interface OkResponse { ok: boolean }
interface StallTypeIdResponse { id: string }
interface StallCreateResponse { id: string; affected: number }
interface EventPatchResponse { status: string }

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

function json(body: unknown): RequestInit {
  return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const response = await api(path, { method, ...json(body) })
  return await response.json() as T
}

// mysql2 serialises DECIMAL columns as strings, so every numeric catalogue field is coerced.
function asNumber(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

let inrFormatter: Intl.NumberFormat | undefined
function inr(value: string | number): string {
  inrFormatter ??= new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
  return inrFormatter.format(asNumber(value))
}

function meters(value: string | number): string {
  const parsed = asNumber(value)
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1)
}

function sizeLabel(type: Pick<StallType, 'widthM' | 'depthM'>): string {
  return `${meters(type.widthM)}m × ${meters(type.depthM)}m`
}

// POST/PUT take taxRate as a percentage (18); GET returns the stored decimal, documented as a
// fraction (0.18) but delivered as DECIMAL(5,2). Values at or below 1 are read as fractions.
function taxToPercent(value: string | number): number {
  const parsed = asNumber(value)
  if (parsed <= 0) return 0
  return parsed <= 1 ? Math.round(parsed * 10000) / 100 : Math.round(parsed * 100) / 100
}

function dayLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function dateTimeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// The deadline is stored as a DATETIME; the browser calendar day keeps the input a yyyy-mm-dd string.
function toDateInput(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function toCategory(raw: string): StallTypeCategory {
  return categories.find((category) => category === raw) ?? 'INDIVIDUAL'
}

function typeValues(source: FormData | TypeFormValues): TypeFormValues {
  const pick = (key: keyof TypeFormValues) => (source instanceof FormData ? String(source.get(key) ?? '') : source[key])
  return {
    code: pick('code').trim(),
    name: pick('name').trim(),
    category: pick('category'),
    widthM: pick('widthM'),
    depthM: pick('depthM'),
    price: pick('price'),
    taxRate: pick('taxRate'),
    includes: pick('includes').trim(),
  }
}

function typeInput(values: TypeFormValues) {
  const category = toCategory(values.category)
  const widthM = asNumber(values.widthM)
  const depthM = asNumber(values.depthM)
  const price = asNumber(values.price)
  const taxRate = asNumber(values.taxRate)
  if (values.code.length < 2 || values.code.length > 40) throw new Error('Code must be 2 to 40 characters.')
  if (values.name.length < 2 || values.name.length > 120) throw new Error('Name must be 2 to 120 characters.')
  if (widthM < 1 || widthM > 50) throw new Error('Width must be between 1 and 50 metres.')
  if (depthM < 1 || depthM > 50) throw new Error('Depth must be between 1 and 50 metres.')
  if (price < 0 || price > 10000000) throw new Error('Price must be between ₹0 and ₹1,00,00,000.')
  if (taxRate < 0 || taxRate > 100) throw new Error('GST % must be between 0 and 100.')
  if (values.includes.length > 255) throw new Error('Inclusions must be 255 characters or fewer.')
  return { code: values.code, name: values.name, category, widthM, depthM, price, taxRate, includes: values.includes }
}

function hallLabel(stalls: Stall[]): string {
  const segments = new Set<string>()
  for (const stall of stalls) {
    const raw = stall.location.trim()
    segments.add(raw ? (raw.split(/[-–—\/]/)[0] ?? '').trim().slice(0, 24) : '')
  }
  if (segments.size !== 1) return ''
  const only = [...segments][0]
  return only ? only : ''
}

interface StallGroup {
  key: string
  title: string
  size: string
  available: number
  stalls: Stall[]
}

function buildGroups(stalls: Stall[]): StallGroup[] {
  const collected = new Map<string, Stall[]>()
  for (const stall of stalls) {
    const bucket = collected.get(stall.type.id)
    if (bucket) bucket.push(stall)
    else collected.set(stall.type.id, [stall])
  }
  return [...collected.entries()].map(([key, list]) => {
    const first = list[0]
    const hall = hallLabel(list)
    const name = first?.type.name ?? 'Stall type'
    return {
      key,
      stalls: list,
      title: hall ? `${hall} – ${name}` : name,
      size: first ? sizeLabel(first.type) : '',
      available: list.filter((stall) => stall.status === 'AVAILABLE').length,
    }
  })
}

const emptyTypeForm: TypeFormValues = { code: '', name: '', category: 'INDIVIDUAL', widthM: '3', depthM: '3', price: '', taxRate: '18', includes: '' }
const emptyStallDraft: StallDraft = { code: '', location: '', status: 'AVAILABLE', stallTypeId: '' }

export function AdminStallsManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [types, setTypes] = useState<StallType[]>([])
  const [stalls, setStalls] = useState<Stall[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [editingTypeId, setEditingTypeId] = useState('')
  const [typeDraft, setTypeDraft] = useState<TypeFormValues>(emptyTypeForm)
  const [editingStallId, setEditingStallId] = useState('')
  const [stallDraft, setStallDraft] = useState<StallDraft>(emptyStallDraft)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [blockNote, setBlockNote] = useState('')
  const selectedIdRef = useRef('')

  const fetchStalls = useCallback(async (eventId: string) => {
    if (!eventId) { setStalls([]); return }
    const response = await api(`/api/bookings/events/${eventId}/stalls`, { cache: 'no-store' })
    setStalls(await response.json() as Stall[])
  }, [])

  const load = useCallback(async () => {
    const [exhibitionResponse, typeResponse] = await Promise.all([
      api('/api/bookings/exhibitions', { cache: 'no-store' }),
      api('/api/bookings/stall-types', { cache: 'no-store' }),
    ])
    const list = await exhibitionResponse.json() as Exhibition[]
    setExhibitions(list)
    setTypes(await typeResponse.json() as StallType[])
    const keep = selectedIdRef.current && list.some((exhibition) => exhibition.id === selectedIdRef.current)
      ? selectedIdRef.current
      : (list[0]?.id ?? '')
    selectedIdRef.current = keep
    setSelectedId(keep)
    const selected = list.find((exhibition) => exhibition.id === keep)
    setDeadlineDraft(toDateInput(selected?.registrationDeadline ?? null))
    await fetchStalls(keep)
  }, [fetchStalls])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        setChecked(true)
        if (response.ok) { setSignedIn(true); await load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Stall data could not be loaded.')) }
      })
      .catch(() => setChecked(true))
  }, [load])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError(''); setBlockNote('')
    try { await action(); await load(); setMessage(success) }
    catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Request failed.'
      setError(text)
      if (/auth|login|forbidden|session/i.test(text)) setSignedIn(false)
    } finally { setBusy(false) }
  }

  function reject(text: string) {
    setError(text)
    return false
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      await api('/api/auth/login', { method: 'POST', ...json({ email: form.get('email'), password: form.get('password') }) })
      setSignedIn(true)
    }, 'Signed in.')
  }

  function selectExhibition(eventId: string) {
    selectedIdRef.current = eventId
    setSelectedId(eventId)
    setEditingStallId('')
    setStallDraft(emptyStallDraft)
    const selected = exhibitions.find((exhibition) => exhibition.id === eventId)
    setDeadlineDraft(toDateInput(selected?.registrationDeadline ?? null))
    void fetchStalls(eventId).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Stalls could not be loaded.'))
  }

  function saveDeadline() {
    if (!selectedId) return reject('Select an exhibition first.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineDraft)) return reject('Registration closes must be a yyyy-mm-dd date.')
    void run(async () => {
      await send<EventPatchResponse>(`/api/events/${selectedId}`, 'PATCH', { registrationDeadline: deadlineDraft })
    }, 'Registration deadline updated.')
    return true
  }

  function clearDeadline() {
    if (!selectedId) return reject('Select an exhibition first.')
    void run(async () => {
      await send<EventPatchResponse>(`/api/events/${selectedId}`, 'PATCH', { registrationDeadline: null })
      setDeadlineDraft('')
    }, 'Deadline removed — registration stays open.')
    return true
  }

  function addType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const values = typeValues(new FormData(element))
    void run(async () => {
      await send<StallTypeIdResponse>('/api/bookings/admin/stall-types', 'POST', typeInput(values))
      element.reset()
    }, 'Stall type added.')
  }

  function startTypeEdit(type: StallType) {
    setEditingStallId('')
    setEditingTypeId(type.id)
    setTypeDraft({
      code: type.code,
      name: type.name,
      category: type.category,
      widthM: meters(type.widthM),
      depthM: meters(type.depthM),
      price: String(asNumber(type.price)),
      taxRate: String(taxToPercent(type.taxRate)),
      includes: type.includes ?? '',
    })
  }

  function saveType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const type = types.find((entry) => entry.id === editingTypeId)
    if (!type) return false
    const values = typeDraft
    void run(async () => {
      await send<OkResponse>(`/api/bookings/admin/stall-types/${type.id}`, 'PUT', typeInput(values))
      setEditingTypeId('')
    }, 'Stall type updated.')
    return true
  }

  function retireType(type: StallType) {
    if (!window.confirm(`Retire “${type.name}”? Stalls already mapped to it keep their price, but a retired type leaves this list and cannot be relisted from this page.`)) return false
    void run(async () => {
      await send<OkResponse>(`/api/bookings/admin/stall-types/${type.id}`, 'PUT', { active: false })
      if (editingTypeId === type.id) setEditingTypeId('')
    }, 'Stall type retired.')
    return true
  }

  function addStall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return reject('Select an exhibition first.')
    const element = event.currentTarget
    const form = new FormData(element)
    const code = String(form.get('code') ?? '').trim()
    const stallTypeId = String(form.get('stallTypeId') ?? '')
    const location = String(form.get('location') ?? '').trim()
    if (code.length < 1 || code.length > 20) return reject('Stall code must be 1 to 20 characters.')
    if (!stallTypeId) return reject('Choose a stall type.')
    void run(async () => {
      await send<StallCreateResponse>('/api/bookings/admin/stalls', 'POST', { eventId: selectedId, stallTypeId, code, location })
      element.reset()
    }, 'Stall added to the floor plan.')
    return true
  }

  // Stalls are created one request at a time because the backend has no bulk route; the chain stops
  // on the first 409 (duplicate code) and reports how many landed.
  async function generateBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId) return reject('Select an exhibition first.')
    const element = event.currentTarget
    const form = new FormData(element)
    const prefix = String(form.get('prefix') ?? '').trim()
    const stallTypeId = String(form.get('stallTypeId') ?? '')
    const location = String(form.get('location') ?? '').trim()
    const start = Number(form.get('start'))
    const end = Number(form.get('end'))
    if (!/^[A-Za-z0-9-]{1,12}$/.test(prefix)) return reject('Prefix must be 1 to 12 letters, digits or hyphens.')
    if (!stallTypeId) return reject('Choose a stall type.')
    if (!Number.isInteger(start) || !Number.isInteger(end)) return reject('Start and end must be whole numbers.')
    if (end < start) return reject('The end number must be greater than the start number.')
    if (end - start + 1 > MAX_BLOCK) return reject(`A block can hold at most ${MAX_BLOCK} stalls.`)
    const eventId = selectedId
    await run(async () => {
      let created = 0
      let stopped = ''
      for (let index = start; index <= end; index += 1) {
        const code = `${prefix}${index}`
        try {
          await send<StallCreateResponse>('/api/bookings/admin/stalls', 'POST', { eventId, stallTypeId, code, location })
          created += 1
        } catch (cause) {
          const text = cause instanceof Error ? cause.message : 'the request failed'
          const progress = `Created ${created} stall${created === 1 ? '' : 's'} of this block.`
          if (/auth|login|forbidden|session/i.test(text)) { setBlockNote(progress); throw cause }
          stopped = text
          break
        }
      }
      const range = created > 0 ? ` (${prefix}${start} → ${prefix}${start + created - 1})` : ''
      setBlockNote(`Created ${created} stall${created === 1 ? '' : 's'}${range}.`)
      if (stopped) { setError(stopped); return }
      element.reset()
    }, 'Floor plan updated.')
  }

  function openStallEditor(stall: Stall) {
    if (editingStallId === stall.id) { setEditingStallId(''); return }
    setEditingTypeId('')
    setEditingStallId(stall.id)
    setStallDraft({ code: stall.code, location: stall.location, status: baseStatus(stall), stallTypeId: stall.type.id })
  }

  function saveStall(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const stall = stalls.find((entry) => entry.id === editingStallId)
    if (!stall) return false
    const code = stallDraft.code.trim()
    if (code.length < 1 || code.length > 20) return reject('Stall code must be 1 to 20 characters.')
    const patch: StallPatch = {}
    if (code !== stall.code) patch.code = code
    if (stallDraft.location.trim() !== stall.location) patch.location = stallDraft.location.trim()
    if (stallDraft.status !== baseStatus(stall)) patch.status = stallDraft.status
    if (stallDraft.stallTypeId !== stall.type.id) patch.stallTypeId = stallDraft.stallTypeId
    if (!Object.keys(patch).length) return reject('Nothing changed — edit a field before saving.')
    void run(async () => {
      await send<OkResponse>(`/api/bookings/admin/stalls/${stall.id}`, 'PUT', patch)
    }, 'Stall updated.')
    return true
  }

  function deleteStall(stall: Stall) {
    if (!window.confirm(`Delete stall ${stall.code}? A stall that already has bookings cannot be deleted.`)) return
    void run(async () => {
      await api(`/api/bookings/admin/stalls/${stall.id}`, { method: 'DELETE' })
      setEditingStallId('')
      setStallDraft(emptyStallDraft)
    }, 'Stall deleted.')
  }

  const selected = exhibitions.find((exhibition) => exhibition.id === selectedId) ?? null
  const editingType = types.find((type) => type.id === editingTypeId) ?? null
  const editingStall = stalls.find((stall) => stall.id === editingStallId) ?? null
  const groups = buildGroups(stalls)

  const typeOptions = (stall: Stall) => {
    const options = types.map((type) => ({ id: type.id, label: `${type.name} · ${sizeLabel(type)} · ${inr(type.price)}` }))
    if (!options.some((option) => option.id === stall.type.id)) options.unshift({ id: stall.type.id, label: `${stall.type.name} (retired)` })
    return options
  }

  if (checked && !signedIn) {
    return (
      <main className="event-admin asm">
        <header className="event-admin-header">
          <div><p className="eyebrow">The Haat of Art · Content Management</p><h1>Stall &amp; Floor Plan Manager</h1><p>Admin sign-in is required to manage stalls and floor plans.</p></div>
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
    <main className="event-admin asm">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Content Management · Stalls</p>
          <h1>Stall &amp; Floor Plan Manager</h1>
          <p>Define stall types once, then lay out the stalls exhibition by exhibition. The public booking wizard reads this floor plan live.</p>
        </div>
        <Link className="event-admin-back" href="/dashboard">Dashboard</Link>
      </header>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      {message && <p className="event-form-success" role="status">{message}</p>}

      <section className="event-form">
        <h2>1. Exhibition</h2>
        {!checked && <p className="event-form-note">Loading…</p>}
        {checked && !exhibitions.length && !error && <p className="event-form-note">No published or approved exhibition yet. Publish an event first.</p>}
        {exhibitions.length > 0 && (
          <>
            <label>Exhibition
              <select value={selectedId} disabled={busy} onChange={(event) => selectExhibition(event.target.value)}>
                {exhibitions.map((exhibition) => (
                  <option key={exhibition.id} value={exhibition.id}>
                    {exhibition.title} · {exhibition.city || exhibition.venue} · {dayLabel(exhibition.startsAt)}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <>
                <dl className="asm-summary">
                  <div><dt>City</dt><dd>{selected.city || '—'}</dd></div>
                  <div><dt>Venue</dt><dd>{selected.venue || '—'}</dd></div>
                  <div><dt>Dates</dt><dd>{dayLabel(selected.startsAt)} → {dayLabel(selected.endsAt)}</dd></div>
                  <div><dt>Stalls</dt><dd>{selected.availableStalls} / {selected.totalStalls} available</dd></div>
                </dl>
                <p className="event-form-note">
                  Registration on the public wizard is <strong>{selected.registrationOpen ? 'open' : 'closed'}</strong>
                  {selected.registrationDeadline ? ` (closes ${dateTimeLabel(selected.registrationDeadline)})` : ' (no deadline set)'}.
                </p>
                <div className="asm-deadline">
                  <label>Registration closes
                    <input type="date" value={deadlineDraft} disabled={busy} max='2100-12-31' onChange={(event) => setDeadlineDraft(event.target.value)} />
                  </label>
                  <button type="button" disabled={busy || !deadlineDraft} onClick={saveDeadline}>Save deadline</button>
                  <button type="button" className="asm-ghost" disabled={busy || !selected.registrationDeadline} onClick={clearDeadline}>Remove deadline</button>
                </div>
                <p className="event-form-note">
                  Deadlines are saved through the events route. A published exhibition is locked by the backend — it replies
                  &ldquo;Event cannot be edited in its current state&rdquo;, and an approved one returns to the approval queue.
                </p>
              </>
            )}
          </>
        )}
      </section>

      <section className="event-form">
        <h2>2. Stall Types</h2>
        <p className="event-form-note">
          GST is entered as a percentage (18 = 18%). There is no delete endpoint: retire a type with the Active toggle.
          Retired types leave this list and cannot be relisted here.
        </p>
        <div className="asm-table-wrap">
          <table className="asm-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Category</th><th>Size</th><th>Price</th><th>GST %</th><th>Includes</th><th>Active</th><th>Edit</th></tr>
            </thead>
            <tbody>
              {types.map((type) => (
                editingType && type.id === editingType.id ? (
                  <tr className="asm-edit-row" key={type.id}>
                    <td colSpan={9}>
                      <form className="asm-type-edit" onSubmit={saveType}>
                        <label>Code<input value={typeDraft.code} maxLength={40} required onChange={(event) => setTypeDraft({ ...typeDraft, code: event.target.value })} /></label>
                        <label>Name<input value={typeDraft.name} maxLength={120} required onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })} /></label>
                        <label>Category
                          <select value={typeDraft.category} onChange={(event) => setTypeDraft({ ...typeDraft, category: event.target.value })}>
                            {categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                          </select>
                        </label>
                        <label>Width (m)<input type="number" step="0.1" min="1" max="50" value={typeDraft.widthM} required onChange={(event) => setTypeDraft({ ...typeDraft, widthM: event.target.value })} /></label>
                        <label>Depth (m)<input type="number" step="0.1" min="1" max="50" value={typeDraft.depthM} required onChange={(event) => setTypeDraft({ ...typeDraft, depthM: event.target.value })} /></label>
                        <label>Price ₹<input type="number" step="1" min="0" max="10000000" value={typeDraft.price} required onChange={(event) => setTypeDraft({ ...typeDraft, price: event.target.value })} /></label>
                        <label>GST %<input type="number" step="0.01" min="0" max="100" value={typeDraft.taxRate} required onChange={(event) => setTypeDraft({ ...typeDraft, taxRate: event.target.value })} /></label>
                        <label className="asm-wide">Includes<input value={typeDraft.includes} maxLength={255} placeholder="3 side walls, 2 spot lights, 1 table, 2 chairs, fascia name" onChange={(event) => setTypeDraft({ ...typeDraft, includes: event.target.value })} /></label>
                        <div className="asm-actions">
                          <button type="submit" disabled={busy}>Save</button>
                          <button type="button" className="asm-ghost" disabled={busy} onClick={() => setEditingTypeId('')}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={type.id}>
                    <td className="asm-mono">{type.code}</td>
                    <td>{type.name}</td>
                    <td>{categoryLabels[type.category]}</td>
                    <td className="asm-nowrap">{sizeLabel(type)}</td>
                    <td className="asm-price">{inr(type.price)}</td>
                    <td>{taxToPercent(type.taxRate)}%</td>
                    <td className="asm-includes">{type.includes || '—'}</td>
                    <td><button type="button" className="asm-status is-active" disabled={busy} onClick={() => retireType(type)}>Active</button></td>
                    <td className="asm-actions"><button type="button" disabled={busy} onClick={() => startTypeEdit(type)}>Edit</button></td>
                  </tr>
                )
              ))}
              {!types.length && checked && signedIn && <tr><td colSpan={9} className="asm-empty">No active stall types. Add the first one below.</td></tr>}
            </tbody>
          </table>
        </div>

        <form className="asm-add-row asm-type-add" onSubmit={addType}>
          <label>Code<input name="code" placeholder="STD-3X3" maxLength={40} required /></label>
          <label>Name<input name="name" placeholder="Standard Stall" maxLength={120} required /></label>
          <label>Category
            <select name="category" defaultValue="INDIVIDUAL">
              {categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
            </select>
          </label>
          <label>Width (m)<input name="widthM" type="number" step="0.1" min="1" max="50" defaultValue="3" required /></label>
          <label>Depth (m)<input name="depthM" type="number" step="0.1" min="1" max="50" defaultValue="3" required /></label>
          <label>Price ₹<input name="price" type="number" step="1" min="0" max="10000000" placeholder="45000" required /></label>
          <label>GST %<input name="taxRate" type="number" step="0.01" min="0" max="100" defaultValue="18" required /></label>
          <label className="asm-wide">Includes<input name="includes" maxLength={255} placeholder="3 side walls, 2 spot lights, 1 table, 2 chairs, fascia name" /></label>
          <button disabled={busy} type="submit">+ Add stall type</button>
        </form>
      </section>

      <section className="event-form">
        <h2>3. Floor Plan</h2>
        {!selected && <p className="event-form-note">Select an exhibition above to lay out its stalls.</p>}
        {selected && (
          <>
            <p className="event-form-note">{selected.title} · {selected.totalStalls > 0 ? `${selected.availableStalls} of ${selected.totalStalls} stalls bookable.` : 'no stalls yet — use "Generate block" below to create the slots.'}</p>
            <div className="asm-legend">
              {legendOrder.map((status) => (
                <span key={status} className={`asm-legend-item ${statusStyles[status].className}`}><i aria-hidden="true" />{statusStyles[status].label}</span>
              ))}
            </div>

            <form className="asm-add-row asm-stall-add" onSubmit={addStall}>
              <label>Stall code<input name="code" placeholder="A1" maxLength={20} required /></label>
              <label>Stall type
                <select name="stallTypeId" defaultValue={types[0]?.id ?? ''} required>
                  {!types.length && <option value="">No active stall type</option>}
                  {types.map((type) => <option key={type.id} value={type.id}>{type.name} · {sizeLabel(type)}</option>)}
                </select>
              </label>
              <label className="asm-wide">Location<input name="location" maxLength={120} placeholder="Hall A – Row 1" /></label>
              <button disabled={busy || !types.length} type="submit">+ Add stall</button>
            </form>

            <form className="asm-add-row asm-block" onSubmit={generateBlock}>
              <label>Prefix<input name="prefix" placeholder="A-" maxLength={12} required /></label>
              <label>From<input name="start" type="number" min="1" max="9999" defaultValue="1" required /></label>
              <label>To<input name="end" type="number" min="1" max="9999" defaultValue="12" required /></label>
              <label>Stall type
                <select name="stallTypeId" defaultValue={types[0]?.id ?? ''} required>
                  {!types.length && <option value="">No active stall type</option>}
                  {types.map((type) => <option key={type.id} value={type.id}>{type.name} · {sizeLabel(type)}</option>)}
                </select>
              </label>
              <label className="asm-wide">Location (optional)<input name="location" maxLength={120} placeholder="Hall A" /></label>
              <button disabled={busy || !types.length} type="submit">Generate block</button>
            </form>
            {blockNote && <p className="event-form-success" role="status">{blockNote}</p>}

            {!stalls.length && !busy && <p className="event-form-note">No stalls laid out for this exhibition yet. Add one above or generate a block.</p>}

            {groups.map((group) => (
              <div className="asm-group" key={group.key}>
                <h3 className="asm-group-heading">
                  <span>{group.title}{group.size ? ` (${group.size})` : ''}</span>
                  <small>{group.stalls.length} stalls · {group.available} available</small>
                </h3>
                <div className="asm-cells">
                  {group.stalls.map((stall) => (
                    <button
                      key={stall.id}
                      type="button"
                      className={`asm-cell ${statusStyles[stall.status].className}${editingStallId === stall.id ? ' is-selected' : ''}`}
                      title={`${stall.code} · ${statusStyles[stall.status].label}${stall.location ? ` · ${stall.location}` : ''}`}
                      aria-pressed={editingStallId === stall.id}
                      disabled={busy}
                      onClick={() => openStallEditor(stall)}
                    >
                      <span className="asm-cell-code">{stall.code}</span>
                    </button>
                  ))}
                </div>

                {editingStall && group.stalls.some((stall) => stall.id === editingStall.id) && (
                  <form className="asm-editor" onSubmit={saveStall}>
                    <div className="asm-editor-head">
                      <strong>{editingStall.code}</strong>
                      <span className={`asm-chip ${statusStyles[editingStall.status].className}`}>{statusStyles[editingStall.status].label}</span>
                      {editingStall.holdExpiresAt && <small>Hold expires {dateTimeLabel(editingStall.holdExpiresAt)}</small>}
                    </div>
                    <label>Stall code<input value={stallDraft.code} maxLength={20} required onChange={(event) => setStallDraft({ ...stallDraft, code: event.target.value })} /></label>
                    <label>Location<input value={stallDraft.location} maxLength={120} placeholder="Hall A – Row 1" onChange={(event) => setStallDraft({ ...stallDraft, location: event.target.value })} /></label>
                    <label>Status
                      <select value={stallDraft.status} onChange={(event) => setStallDraft({ ...stallDraft, status: event.target.value === 'DISABLED' ? 'DISABLED' : 'AVAILABLE' })}>
                        <option value="AVAILABLE">Available</option>
                        <option value="DISABLED">Not Available</option>
                      </select>
                    </label>
                    <label>Stall type
                      <select value={stallDraft.stallTypeId} onChange={(event) => setStallDraft({ ...stallDraft, stallTypeId: event.target.value })}>
                        {typeOptions(editingStall).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="asm-actions">
                      <button type="submit" disabled={busy}>Save stall</button>
                      <button type="button" className="asm-danger" disabled={busy} onClick={() => deleteStall(editingStall)}>Delete</button>
                      <button type="button" className="asm-ghost" disabled={busy} onClick={() => setEditingStallId('')}>Close</button>
                    </div>
                    <p className="event-form-note">Booked and held stalls are driven by live bookings — set a stall to Not Available to take it off the map instead.</p>
                  </form>
                )}
              </div>
            ))}
          </>
        )}
      </section>
    </main>
  )
}

export default AdminStallsManager
