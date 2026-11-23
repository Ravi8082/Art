'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Download, LoaderCircle, MessageCircle, RefreshCw, Search, Users } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type LeadMessage = {
  id: string
  sender: 'USER' | 'ASSISTANT'
  text: string
  detectedIntent: string
  createdAt: string
}
type Lead = {
  id: string
  name: string
  phone: string
  email: string
  role: string
  sourcePage: string
  createdAt: string
  messages: LeadMessage[]
}

async function responseError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status}).`
}

function displayDate(value: string) {
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export function KalaaLeadManager() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(30)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
      if (query) params.set('q', query)
      const response = await fetch(`${apiBaseUrl}/api/concierge/admin/leads?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await responseError(response))
      const data = await response.json() as { leads?: Lead[]; total?: number }
      if (!Array.isArray(data.leads) || typeof data.total !== 'number') throw new Error('The THOA lead list returned an invalid response.')
      setLeads(data.leads)
      setTotal(data.total)
      setSelectedId((current) => data.leads!.some((lead) => lead.id === current) ? current : data.leads![0]?.id ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'THOA leads could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, query])

  useEffect(() => { void load() }, [load])

  const selectedLead = leads.find((lead) => lead.id === selectedId) ?? null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  async function exportCsv() {
    if (exporting) return
    setExporting(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/concierge/admin/export.csv`, {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await responseError(response))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'thoa-leads.csv'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The CSV export could not be downloaded.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="kalaa-admin-page">
      <header className="kalaa-admin-heading">
        <div>
          <p>ADMIN · LEADS & CONVERSATIONS</p>
          <h1>THOA Concierge</h1>
          <span>Review captured leads and their complete THOA chat transcripts.</span>
        </div>
        <div className="kalaa-admin-toolbar">
          <button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} className={loading ? 'kalaa-spinner' : ''} />Refresh</button>
          <button type="button" onClick={() => void exportCsv()} disabled={exporting}><Download size={15} />{exporting ? 'Preparing…' : 'Export CSV'}</button>
        </div>
      </header>

      <section className="kalaa-admin-stats" aria-label="THOA lead summary">
        <div><Users size={18} /><span><strong>{total}</strong><small>Captured leads</small></span></div>
        <div><MessageCircle size={18} /><span><strong>{leads.reduce((count, lead) => count + lead.messages.length, 0)}</strong><small>Messages on this page</small></span></div>
        <div><span className="kalaa-admin-live-dot" /><span><strong>Live</strong><small>Transcript data from database</small></span></div>
      </section>

      <form className="kalaa-admin-search" onSubmit={submitSearch}>
        <Search size={16} aria-hidden="true" />
        <input aria-label="Search THOA leads" placeholder="Search name, phone or email…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit">Search</button>
      </form>

      {error && <p className="kalaa-admin-error" role="alert">{error}</p>}

      <section className="kalaa-admin-workspace">
        <div className="kalaa-admin-leads">
          <div className="kalaa-admin-list-heading"><h2>Leads</h2><span>{total}</span></div>
          {loading && leads.length === 0 ? <p className="kalaa-admin-empty"><LoaderCircle size={17} className="kalaa-spinner" /> Loading leads…</p>
            : leads.length === 0 ? <p className="kalaa-admin-empty">No THOA leads found.</p>
              : leads.map((lead) => (
                <button type="button" className={`kalaa-admin-lead${lead.id === selectedId ? ' is-selected' : ''}`} key={lead.id} onClick={() => setSelectedId(lead.id)}>
                  <strong>{lead.name}</strong>
                  <span>{lead.role.replace(/_/g, ' ')}</span>
                  <small>{lead.email}</small>
                  <small>{lead.phone} · {displayDate(lead.createdAt)}</small>
                </button>
              ))}
          <div className="kalaa-admin-pagination">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        </div>

        <div className="kalaa-admin-detail">
          {selectedLead ? <>
            <header className="kalaa-admin-contact">
              <div><p>LEAD DETAILS</p><h2>{selectedLead.name}</h2></div>
              <span>{selectedLead.role.replace(/_/g, ' ')}</span>
              <a href={`tel:${selectedLead.phone}`}>{selectedLead.phone}</a>
              <a href={`mailto:${selectedLead.email}`}>{selectedLead.email}</a>
              <small>Source: {selectedLead.sourcePage} · {displayDate(selectedLead.createdAt)}</small>
            </header>
            <div className="kalaa-admin-transcript" aria-label={`Conversation transcript for ${selectedLead.name}`}>
              <h3>Conversation transcript <span>{selectedLead.messages.length} messages</span></h3>
              {selectedLead.messages.length ? selectedLead.messages.map((message) => (
                <article className={`kalaa-admin-message${message.sender === 'USER' ? ' is-user' : ''}`} key={message.id}>
                  <div><strong>{message.sender === 'USER' ? selectedLead.name : 'THOA'}</strong><time>{displayDate(message.createdAt)}</time></div>
                  <p>{message.text}</p>
                </article>
              )) : <p className="kalaa-admin-empty">No conversation messages were saved for this lead.</p>}
            </div>
          </> : <div className="kalaa-admin-no-selection"><MessageCircle size={28} /><p>Select a lead to review their contact details and transcript.</p></div>}
        </div>
      </section>
    </main>
  )
}
