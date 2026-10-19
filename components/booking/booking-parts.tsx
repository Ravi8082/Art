'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  formatEventDates, formatMoney, stallSize, stallSquareMeters, taxRatePercent, totalWithTax,
  type Exhibition, type Stall, type StallType,
} from '@/lib/booking-api'

const toolbarButtons = [
  { command: 'bold', label: 'B', title: 'Bold', className: 'bw-tool-bold' },
  { command: 'italic', label: 'I', title: 'Italic', className: 'bw-tool-italic' },
  { command: 'underline', label: 'U', title: 'Underline', className: 'bw-tool-underline' },
] as const

export function RichTextEditor({ value, onChange, placeholder, invalid }: {
  value: string
  onChange: (html: string) => void
  placeholder: string
  invalid?: boolean
}) {
  const editor = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = value
  }, [value])

  function emit() {
    onChange(editor.current?.innerHTML ?? '')
  }

  function refreshActive() {
    const next: Record<string, boolean> = {}
    for (const button of toolbarButtons) {
      try { next[button.command] = document.queryCommandState(button.command) } catch { next[button.command] = false }
    }
    setActive(next)
  }

  function run(command: string) {
    editor.current?.focus()
    document.execCommand(command, false)
    emit()
    refreshActive()
  }

  function insertLink() {
    const raw = window.prompt('Link address (https://…)')
    if (!raw) return
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    editor.current?.focus()
    document.execCommand('createLink', false, href)
    emit()
  }

  return (
    <div className={`bw-editor ${invalid ? 'is-invalid' : ''}`}>
      <div className="bw-toolbar" role="toolbar" aria-label="Text formatting">
        {toolbarButtons.map((button) => (
          <button key={button.command} type="button" title={button.title} aria-label={button.title}
            aria-pressed={Boolean(active[button.command])} className={button.className} onClick={() => run(button.command)}>{button.label}</button>
        ))}
        <span className="bw-tool-sep" />
        <button type="button" title="Insert link" aria-label="Insert link" onClick={insertLink}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
        </button>
        <button type="button" title="Bulleted list" aria-label="Bulleted list" onClick={() => run('insertUnorderedList')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.4" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12" r="1.4" fill="currentColor" stroke="none" /><circle cx="3.5" cy="18" r="1.4" fill="currentColor" stroke="none" /></svg>
        </button>
        <button type="button" title="Numbered list" aria-label="Numbered list" onClick={() => run('insertOrderedList')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 6h11M10 12h11M10 18h11" /><path d="M3 5h1.5v4M3 15h2v1.5H3v1.5h2" strokeWidth="1.6" /></svg>
        </button>
        <span className="bw-tool-sep" />
        <button type="button" title="Clear formatting" aria-label="Clear formatting" onClick={() => run('removeFormat')}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 5h12M9 5l-1 14M15 5l-.6 8" /><path d="M14 17l6 6M20 17l-6 6" /></svg>
        </button>
      </div>
      <div
        ref={editor}
        className="bw-editor-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
      />
    </div>
  )
}

export function ImageUploader({ files, onAdd, onRemove, max = 10 }: {
  files: { id: string; file: File; previewUrl: string }[]
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
  max?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [rejected, setRejected] = useState('')

  function accept(list: FileList | null) {
    setRejected('')
    if (!list?.length) return
    const incoming = [...list]
    const valid = incoming.filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))
    if (valid.length !== incoming.length) setRejected('Only JPG, PNG, WebP or GIF images can be uploaded.')
    const oversized = valid.filter((file) => file.size > 10 * 1024 * 1024)
    if (oversized.length) setRejected('Each image must be 10 MB or smaller.')
    const usable = valid.filter((file) => file.size <= 10 * 1024 * 1024)
    const room = max - files.length
    if (usable.length > room) setRejected(`You can upload a maximum of ${max} artwork images.`)
    if (room > 0 && usable.length) onAdd(usable.slice(0, room))
    if (input.current) input.current.value = ''
  }

  return (
    <div className="bw-uploader">
      <div className="bw-thumbs">
        {files.map((entry) => (
          <figure key={entry.id} className="bw-thumb">
            <img src={entry.previewUrl} alt={entry.file.name} />
            <figcaption>{entry.file.name}</figcaption>
            <button type="button" aria-label={`Remove ${entry.file.name}`} onClick={() => onRemove(entry.id)}>×</button>
          </figure>
        ))}
        {files.length < max && (
          <button type="button" className="bw-thumb bw-thumb-add" onClick={() => input.current?.click()}>
            <span aria-hidden="true">+</span>Add Images
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => accept(event.currentTarget.files)} />
      <p className="bw-hint">{files.length}/{max} images · JPG, PNG, WebP or GIF · 10 MB each</p>
      {rejected && <p className="bw-field-error" role="alert">{rejected}</p>}
    </div>
  )
}

export function PdfUploader({ file, onAdd, onRemove }: {
  file: { file: File; name: string } | null
  onAdd: (file: File) => void
  onRemove: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [rejected, setRejected] = useState('')
  return (
    <div className="bw-pdf">
      <button type="button" className="bw-pdf-choose" onClick={() => input.current?.click()}>Choose File</button>
      {file
        ? <span className="bw-pdf-name">{file.name}<button type="button" aria-label="Remove portfolio" onClick={onRemove}>×</button></span>
        : <span className="bw-pdf-none">No file chosen</span>}
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(event) => {
        const chosen = event.currentTarget.files?.[0]
        setRejected('')
        if (!chosen) return
        if (chosen.type !== 'application/pdf') setRejected('Portfolio must be a PDF file.')
        else if (chosen.size > 20 * 1024 * 1024) setRejected('Portfolio PDF must be 20 MB or smaller.')
        else onAdd(chosen)
        event.currentTarget.value = ''
      }} />
      {rejected && <p className="bw-field-error" role="alert">{rejected}</p>}
    </div>
  )
}

export function CityTabs({ cities, active, onChange }: { cities: string[]; active: string; onChange: (city: string) => void }) {
  return (
    <div className="bw-citytabs" role="tablist" aria-label="Filter exhibitions by city">
      {['All', ...cities].map((city) => (
        <button key={city} type="button" role="tab" aria-selected={active === city} className={active === city ? 'is-active' : ''} onClick={() => onChange(city)}>{city}</button>
      ))}
    </div>
  )
}

export function ExhibitionCards({ exhibitions, selectedIds, onToggle, mediaBase }: {
  exhibitions: Exhibition[]
  selectedIds: string[]
  onToggle: (id: string) => void
  mediaBase: string
}) {
  if (!exhibitions.length) return <p className="bw-empty">No exhibitions are open for stall booking right now. Please check back soon.</p>
  return (
    <div className="bw-cards">
      {exhibitions.map((exhibition) => {
        const cover = exhibition.media[0]
        const selected = selectedIds.includes(exhibition.id)
        return (
          <article key={exhibition.id} className={`bw-card ${selected ? 'is-selected' : ''}`}>
            <div className="bw-card-media">
              {cover ? <img src={`${mediaBase}${cover.url}`} alt={cover.altText || exhibition.title} loading="lazy" />
                : <span className="bw-card- placeholder" aria-hidden="true">THOA</span>}
              {!exhibition.registrationOpen && <span className="bw-card-closed">Entries closed</span>}
            </div>
            <div className="bw-card-body">
              <h3>{exhibition.title}</h3>
              <p className="bw-card-dates"><CalendarIcon /> {formatEventDates(exhibition.startsAt, exhibition.endsAt)}</p>
              <p className="bw-card-venue"><PinIcon /> {exhibition.venue || exhibition.city || 'Venue to be confirmed'}</p>
              <p className="bw-card-stalls">{exhibition.totalStalls > 0 ? `${exhibition.availableStalls} of ${exhibition.totalStalls} stalls available` : 'Stall slots will be announced soon'}</p>
              <div className="bw-card-actions">
                <button type="button" className="bw-btn-outline" onClick={() => onToggle(exhibition.id)} disabled={!exhibition.registrationOpen} aria-pressed={selected}>
                  {selected ? 'Selected ✓' : 'Select exhibition'}
                </button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function PreferenceChecklist({ exhibitions, selectedIds, onToggle }: {
  exhibitions: Exhibition[]
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  return (
    <div className="bw-checklist">
      {exhibitions.map((exhibition) => {
        const checked = selectedIds.includes(exhibition.id)
        return (
          <label key={exhibition.id} className={`bw-check ${checked ? 'is-checked' : ''} ${exhibition.registrationOpen ? '' : 'is-closed'}`}>
            <input type="checkbox" checked={checked} disabled={!exhibition.registrationOpen} onChange={() => onToggle(exhibition.id)} />
            <span>
              <strong>{exhibition.city || exhibition.title}</strong>
              {exhibition.city && <span className="bw-check-title"> · {exhibition.title}</span>}
              {' — '}<em>{formatEventDates(exhibition.startsAt, exhibition.endsAt)}</em>
              {!exhibition.registrationOpen && <small> entries closed {exhibition.registrationDeadline ? formatDateOnly(exhibition.registrationDeadline) : ''}</small>}
            </span>
          </label>
        )
      })}
      {!exhibitions.length && <p className="bw-empty">No exhibitions are open for registration right now.</p>}
    </div>
  )
}

function formatDateOnly(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function StallTypePicker({ types, value, onChange }: { types: StallType[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="bw-typegrid">
      {types.map((type) => {
        const selected = value === type.id
        const price = totalWithTax(Number(type.price), Number(type.taxRate))
        return (
          <button key={type.id} type="button" className={`bw-type ${selected ? 'is-selected' : ''}`} aria-pressed={selected} onClick={() => onChange(selected ? '' : type.id)}>
            <strong>{type.name}</strong>
            <span>{stallSize(type)} · {stallSquareMeters(type)} sq m</span>
            <span className="bw-type-price">{formatMoney(price.total)} incl. GST</span>
            <span className="bw-type-cat">{categoryLabel(type.category)}</span>
          </button>
        )
      })}
      {!types.length && <p className="bw-empty">Stall types have not been published yet.</p>}
    </div>
  )
}

export function categoryLabel(category: string) {
  return category === 'INDIVIDUAL' ? 'Individual Stall' : category === 'GROUP' ? 'Group Stall' : category === 'GALLERY' ? 'Gallery Space' : category
}

export function StallMap({ stalls, selectedId, onSelect, coverUrl, coverAlt }: {
  stalls: Stall[]
  selectedId: string
  onSelect: (id: string) => void
  coverUrl?: string
  coverAlt?: string
}) {
  const groups = new Map<string, Stall[]>()
  for (const stall of stalls) {
    const key = `${stall.type.name}|${stall.location || ''}`
    groups.set(key, [...(groups.get(key) ?? []), stall])
  }
  const selected = stalls.find((stall) => stall.id === selectedId) ?? null

  return (
    <div className="bw-map">
      <div className="bw-legend" aria-hidden="true">
        <span className="bw-key is-available">Available</span>
        <span className="bw-key is-selected">Selected</span>
        <span className="bw-key is-booked">Booked</span>
        <span className="bw-key is-disabled">Not Available</span>
      </div>
      <div className="bw-map-main">
        {!stalls.length && <p className="bw-empty">The floor plan for this exhibition is being prepared. Please check back shortly.</p>}
        {[...groups.entries()].map(([key, group]) => {
          const [typeName, location] = key.split('|')
          const type = group[0]?.type
          return (
            <section key={key} className="bw-hall">
              <h4>{location ? `${location} — ${typeName}` : typeName}{type && <small> ({stallSize(type)} m)</small>}</h4>
              <div className="bw-cells">
                {group.map((stall) => {
                  const isSelected = stall.id === selectedId
                  const selectable = stall.status === 'AVAILABLE'
                  return (
                    <button
                      key={stall.id} type="button"
                      className={`bw-cell is-${stall.status.toLowerCase()} ${isSelected ? 'is-selected' : ''}`}
                      disabled={!selectable && !isSelected}
                      aria-pressed={isSelected}
                      title={selectable ? `Select stall ${stall.code}` : `Stall ${stall.code} — ${stall.status.toLowerCase()}`}
                      onClick={() => onSelect(isSelected ? '' : stall.id)}
                    >{stall.code}</button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <aside className="bw-selected">
        {selected ? (
          <>
            <h4>Selected Stall: {selected.code}</h4>
            {coverUrl && <img className="bw-selected-media" src={coverUrl} alt={coverAlt || `Stall ${selected.code}`} />}
            <dl className="bw-specs">
              <div><dt>Stall Type</dt><dd>{selected.type.name}</dd></div>
              <div><dt>Size</dt><dd>{stallSize(selected.type)} ({stallSquareMeters(selected.type)} sq m)</dd></div>
              <div><dt>Price</dt><dd>{formatMoney(selected.type.price)}</dd></div>
              <div><dt>GST</dt><dd>{taxRatePercent(selected.type.taxRate)}%</dd></div>
              <div><dt>Location</dt><dd>{selected.location || 'Main hall'}</dd></div>
              <div className="bw-specs-total"><dt>Total Amount</dt><dd>{formatMoney(totalWithTax(Number(selected.type.price), Number(selected.type.taxRate)).total)}</dd></div>
            </dl>
            {selected.type.includes && <p className="bw-includes"><strong>Includes:</strong> {selected.type.includes}</p>}
          </>
        ) : (
          <div className="bw-selected-empty">
            <h4>Select a stall</h4>
            <p>Tap any green stall on the floor plan to see its size, price and what is included.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

export function SignInPanel({ onSuccess, busy, error, onSignIn, onRegister }: {
  onSuccess: () => void
  busy: boolean
  error: string
  onSignIn: (email: string, password: string) => Promise<void>
  onRegister: (fullName: string, email: string, password: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [local, setLocal] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setLocal('')
    try {
      if (mode === 'up') await onRegister(fullName.trim(), email.trim().toLowerCase(), password)
      else await onSignIn(email.trim().toLowerCase(), password)
      onSuccess()
    } catch (cause) {
      setLocal(cause instanceof Error ? cause.message : mode === 'up' ? 'Could not create the account' : 'Sign in failed')
    }
  }
  return (
    <form className="bw-signin" onSubmit={submit}>
      <h4>{mode === 'up' ? 'Create your exhibitor account' : 'Sign in to continue'}</h4>
      <p>Stall applications and payments are linked to your exhibitor account, so we need you signed in before submitting.</p>
      {mode === 'up' && (
        <label>Name on the account
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required minLength={2} maxLength={160} />
        </label>
      )}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required maxLength={255} /></label>
      <label>Password
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={mode === 'up' ? 12 : 1} maxLength={128} />
        {mode === 'up' && <small className="bw-hint">At least 12 characters.</small>}
      </label>
      <button className="bw-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Working…' : mode === 'up' ? 'Create account & continue' : 'Sign in'}
      </button>
      {(local || error) && <p className="bw-field-error" role="alert">{local || error}</p>}
      <p className="bw-hint">
        {mode === 'up'
          ? <>Already registered? <button type="button" className="bw-linkbtn" onClick={() => { setLocal(''); setMode('in') }}>Sign in instead</button></>
          : <>New exhibitor? <button type="button" className="bw-linkbtn" onClick={() => { setLocal(''); setMode('up') }}>Create an account</button> — it takes a minute and the stall fee is only paid after approval. <a href="/password-reset">Forgot password?</a></>}
      </p>
    </form>
  )
}

export function CalendarIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
}

export function PinIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 21s7-5.8 7-11a7 7 0 1 0-14 0c0 5.2 7 11 7 11z" /><circle cx="12" cy="10" r="2.6" /></svg>
}
