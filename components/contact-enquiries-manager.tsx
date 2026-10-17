'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_REPLY', 'RESOLVED', 'CLOSED', 'SPAM'] as const
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const categories = ['General', 'Exhibition/Stall Booking', 'Artist', 'Partnership', 'Media', 'Sponsorship', 'Technical Support'] as const

type Enquiry = {
  id: string; refCode: string; name: string; email: string; phone: string; category: string; subject: string
  status: typeof statuses[number]; priority: typeof priorities[number]; assignedTo: string | null; assignedToName: string | null
  followUpAt: string | null; resolvedAt: string | null; createdAt: string; updatedAt: string; attachmentCount: number; overdue?: boolean
}
type Detail = {
  enquiry: Enquiry & { message: string }
  messages: { id: string; direction: 'INCOMING' | 'OUTGOING' | 'SYSTEM'; body: string; emailStatus: string | null; createdAt: string; authorName: string | null }[]
  notes: { id: string; body: string; createdAt: string; authorName: string }[]
  attachments: { id: string; fileName: string; mimeType: string; byteSize: number; createdAt: string }[]
}
type Stats = { total: number; new: number; unassigned: number; inProgress: number; resolved: number; spam: number; overdue: number }
type Staff = { id: string; fullName: string; email: string; roles: string[] }

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

async function download(path: string, fileName: string) {
  const response = await api(path)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

const when = (value: string | null) => (value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const isoLocal = (value: string | null) => (value ? new Date(new Date(value).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

export function ContactEnquiriesManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows] = useState<Enquiry[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [staff, setStaff] = useState<Staff[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ q: '', status: '', category: '', priority: '', assigned: '', sort: 'created' })
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [reply, setReply] = useState('')
  const [draft, setDraft] = useState({ status: 'NEW', priority: 'NORMAL', assignedTo: '', followUpAt: '', resolutionNote: '' })

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20', sort: filters.sort })
    for (const key of ['q', 'status', 'category', 'priority', 'assigned'] as const) if (filters[key]) params.set(key, filters[key])
    const data = await (await api(`/api/enquiries?${params}`, { cache: 'no-store' })).json() as { enquiries: Enquiry[]; total: number; stats: Stats }
    setRows(data.enquiries)
    setTotal(data.total)
    setStats(data.stats)
  }, [filters, page])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' }).then(async (response) => {
      setChecked(true)
      if (!response.ok) return
      setSignedIn(true)
      await load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Enquiries could not be loaded.'))
    }).catch(() => setChecked(true))
  }, [load])

  useEffect(() => {
    if (!signedIn) return
    void api('/api/enquiries/staff', { cache: 'no-store' })
      .then(async (response) => setStaff((await response.json() as { staff: Staff[] }).staff))
      .catch(() => setStaff([]))
  }, [signedIn])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    void api(`/api/enquiries/${selected}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as Detail
        setDetail(data)
        setDraft({
          status: data.enquiry.status, priority: data.enquiry.priority, assignedTo: data.enquiry.assignedTo ?? '',
          followUpAt: isoLocal(data.enquiry.followUpAt), resolutionNote: '',
        })
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Enquiry could not be loaded.'))
  }, [selected])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError('')
    try { await action(); await load(); if (selected) setDetail(await (await api(`/api/enquiries/${selected}`, { cache: 'no-store' })).json() as Detail); setMessage(success) }
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

  function saveEnquiry() {
    void run(async () => {
      await api(`/api/enquiries/${selected}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: draft.status, priority: draft.priority,
          assignedTo: draft.assignedTo || null,
          followUpAt: draft.followUpAt ? new Date(draft.followUpAt).toISOString() : null,
          resolutionNote: draft.resolutionNote || undefined,
        }),
      })
      setNote('')
    }, 'Enquiry updated.')
  }

  function addNote() {
    if (!note.trim()) return
    void run(async () => { await api(`/api/enquiries/${selected}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: note }) }) }, 'Internal note added.')
  }

  function sendReply() {
    if (!reply.trim()) return
    void run(async () => {
      const result = await (await api(`/api/enquiries/${selected}/reply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply }) })).json() as { emailStatus: string }
      if (result.emailStatus !== 'SENT') throw new Error(`Reply was logged but not emailed (${result.emailStatus === 'SKIPPED' ? 'SMTP is not configured on this server' : 'the email provider rejected it'}).`)
      setReply('')
    }, 'Reply emailed and logged.')
  }

  if (checked && !signedIn) {
    return (
      <main className="event-admin">
        <header className="event-admin-header">
          <div><p className="eyebrow">The Haat of Art · Contact Manager</p><h1>Contact Enquiries</h1><p>Admin sign-in is required to read private enquiries.</p></div>
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

  const cards = stats ? [
    ['Total enquiries', stats.total, ''], ['New / unassigned', stats.new, stats.unassigned ? `${stats.unassigned} unassigned` : ''],
    ['In progress', stats.inProgress, ''], ['Resolved', stats.resolved, ''], ['Overdue follow-ups', stats.overdue, stats.overdue ? 'needs attention' : ''], ['Spam', stats.spam, ''],
  ] : []

  return (
    <main className="event-admin apm ce">
      <header className="event-admin-header">
        <div>
          <p className="eyebrow">The Haat of Art · Content Management · Contact</p>
          <h1>Contact Enquiries</h1>
          <p>NEW → ASSIGNED → IN_PROGRESS → WAITING_FOR_REPLY → RESOLVED → CLOSED. Internal notes are never shown to visitors.</p>
        </div>
        <div className="apm-header-actions">
          <Link className="apm-secondary" href="/contact" target="_blank">View Contact Page</Link>
          <Link className="apm-secondary" href="/dashboard/contact-page">Contact Page Manager</Link>
          <button type="button" className="apm-publish" disabled={busy} onClick={() => void download('/api/enquiries/export.csv', `contact-enquiries-${new Date().toISOString().slice(0, 10)}.csv`).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Export failed'))}>Export CSV</button>
        </div>
      </header>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      {message && <p className="event-form-success" role="status">{message}</p>}

      <section className="ce-stats">
        {cards.map(([label, value, hint]) => (
          <article key={String(label)} className={String(label) === 'Overdue follow-ups' && Number(value) > 0 ? 'is-warn' : ''}>
            <strong>{value as number}</strong><span>{label as string}</span>{hint ? <small>{hint as string}</small> : null}
          </article>
        ))}
      </section>

      <form className="ce-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); void load() }}>
        <label>Search<input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Reference, name, email or subject" /></label>
        <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>Category<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Priority<select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}><option value="">All</option>{priorities.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label>Assigned<select value={filters.assigned} onChange={(e) => setFilters({ ...filters, assigned: e.target.value })}><option value="">Anyone</option><option value="me">Me</option><option value="unassigned">Unassigned</option></select></label>
        <label>Sort<select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="created">Newest</option><option value="updated">Recently updated</option><option value="priority">Priority</option><option value="status">Status</option><option value="followUp">Follow-up date</option></select></label>
        <button type="submit" disabled={busy}>Apply</button>
      </form>

      <section className="event-form">
        <h2>Enquiries <small>{total} total</small></h2>
        <table className="apm-table ce-table">
          <thead><tr><th>Reference</th><th>From</th><th>Category</th><th>Subject</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Follow-up</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={selected === row.id ? 'is-active' : ''} onClick={() => setSelected(row.id)}>
                <td><button type="button" className="ce-ref">{row.refCode}</button></td>
                <td><strong>{row.name}</strong><small>{row.email}</small></td>
                <td>{row.category}</td>
                <td className="ce-subject">{row.subject}</td>
                <td><span className={`ce-pill ce-${row.status.toLowerCase()}`}>{row.status}</span></td>
                <td>{row.priority}</td>
                <td>{row.assignedToName ?? '—'}</td>
                <td className={row.overdue ? 'ce-overdue' : ''}>{row.followUpAt ? when(row.followUpAt) : '—'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="ce-empty">No enquiries match these filters.</td></tr>}
          </tbody>
        </table>
        <div className="ce-pager">
          <button type="button" disabled={page === 1 || busy} onClick={() => setPage(page - 1)}>← Previous</button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / 20))}</span>
          <button type="button" disabled={page * 20 >= total || busy} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </section>

      {detail && (
        <section className="event-form ce-detail">
          <h2>{detail.enquiry.refCode} · {detail.enquiry.subject}</h2>
          <div className="ce-cols">
            <div>
              <p className="apm-label">Visitor</p>
              <ul className="ce-person">
                <li><strong>{detail.enquiry.name}</strong> · {detail.enquiry.email}{detail.enquiry.phone ? ` · ${detail.enquiry.phone}` : ''}</li>
                <li>Category: {detail.enquiry.category} · Received {when(detail.enquiry.createdAt)}</li>
                {detail.enquiry.resolvedAt && <li>Resolved {when(detail.enquiry.resolvedAt)}</li>}
              </ul>
              <p className="apm-label">Message</p>
              <p className="ce-message">{detail.enquiry.message}</p>
              <p className="apm-label">Attachments</p>
              {detail.attachments.length ? (
                <ul className="ce-files">
                  {detail.attachments.map((file) => (
                    <li key={file.id}>
                      <button type="button" disabled={busy} onClick={() => void download(`/api/enquiries/${detail.enquiry.id}/attachments/${file.id}`, file.fileName).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Download failed'))}>{file.fileName}</button>
                      <small>{(file.byteSize / 1024).toFixed(0)} KB · {file.mimeType}</small>
                    </li>
                  ))}
                </ul>
              ) : <p className="ce-none">None.</p>}

              <p className="apm-label">Conversation</p>
              <ol className="ce-thread">
                {detail.messages.map((item) => (
                  <li key={item.id} className={`ce-${item.direction.toLowerCase()}`}>
                    <span>{item.direction === 'OUTGOING' ? `Reply by ${item.authorName ?? 'admin'}` : item.direction === 'SYSTEM' ? 'System' : `Visitor`} · {when(item.createdAt)}{item.emailStatus ? ` · email ${item.emailStatus}` : ''}</span>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="ce-fields">
              <label>Status
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </label>
              <label>Priority
                <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>{priorities.map((p) => <option key={p} value={p}>{p}</option>)}</select>
              </label>
              <label>Assign to
                <select value={draft.assignedTo} onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })}>
                  <option value="">Unassigned</option>
                  {staff.map((member) => <option key={member.id} value={member.id}>{member.fullName} ({member.roles?.join(', ') ?? ''})</option>)}
                </select>
              </label>
              <label>Follow-up date<input type="datetime-local" value={draft.followUpAt} onChange={(e) => setDraft({ ...draft, followUpAt: e.target.value })} /></label>
              <label>Resolution note (internal)<textarea rows={2} value={draft.resolutionNote} onChange={(e) => setDraft({ ...draft, resolutionNote: e.target.value })} placeholder="Why this is resolved / what was agreed" /></label>
              <button type="button" className="apm-publish" disabled={busy} onClick={saveEnquiry}>Save changes</button>

              <p className="apm-label">Internal note — never shown to visitors</p>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the team" />
              <button type="button" className="apm-secondary" disabled={busy || !note.trim()} onClick={addNote}>Add note</button>
              <ul className="ce-notes">
                {detail.notes.map((item) => <li key={item.id}><span>{item.authorName} · {when(item.createdAt)}</span><p>{item.body}</p></li>)}
                {!detail.notes.length && <li className="ce-none">No internal notes yet.</li>}
              </ul>

              <p className="apm-label">Reply to visitor by email</p>
              <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Hello ${detail.enquiry.name},`} />
              <button type="button" className="apm-publish" disabled={busy || !reply.trim()} onClick={sendReply}>Send reply</button>
              <p className="ce-hint">Sending a reply logs the message and delivery status. It does not mark the enquiry resolved — update the status when the case is actually closed.</p>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
