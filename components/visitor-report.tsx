'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type CityRow = { city: string; registered: number; checkedIn: number }
type StateRow = { state: string; registered: number; checkedIn: number; cities: CityRow[] }
type Visitor = { state: string; city: string; fullName: string; email: string; phone: string | null; eventTitle: string; registeredAt: string; checkedInAt: string | null }
type Report = {
  events: { id: string; title: string }[]
  states: StateRow[]
  visitors: Visitor[]
  totals: { registered: number; checkedIn: number; states: number; cities: number }
}

export function VisitorReport() {
  const [report, setReport] = useState<Report | null>(null)
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [eventId, setEventId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'denied'>('loading')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (state) params.set('state', state)
    if (city) params.set('city', city)
    if (eventId) params.set('eventId', eventId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return params
  }, [state, city, eventId, from, to])

  const load = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/visitor-report?${query}`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) throw new Error(String(response.status))
    setReport(await response.json() as Report)
    setStatus('ready')
  }, [query])

  useEffect(() => { load().catch(() => setStatus('denied')) }, [load])

  async function download(format: 'xlsx' | 'pdf') {
    setBusy(format); setError('')
    try {
      const params = new URLSearchParams(query)
      params.set('format', format)
      const response = await fetch(`${apiBaseUrl}/api/visitor-report/export?${params}`, { credentials: 'include' })
      if (!response.ok) throw new Error('Download failed. Please try again.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `visitors-${new Date().toISOString().slice(0, 10)}.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Download failed.')
    } finally { setBusy('') }
  }

  if (status === 'denied') return <main className="account-page"><section className="account-card"><h1>Visitor reports</h1><p>Only Admin and Super Admin can view this report.</p></section></main>
  if (!report) return <main className="account-page"><section className="account-card"><p>Loading…</p></section></main>

  const cityOptions = report.states.find((row) => row.state === state)?.cities.map((row) => row.city) ?? []
  const shownStates = report.states.filter((row) => !state || row.state === state)

  return (
    <main className="account-page vr-page">
      <Link href="/dashboard" className="account-back"><ArrowLeft size={15} /> Back to dashboard</Link>
      <section className="account-card">
        <h1>Visitor reports</h1>
        <p className="account-note">See how many visitors registered from each state and city, filter them, and download the data.</p>
        <div className="vr-filters">
          <label>State<select value={state} onChange={(event) => { setState(event.target.value); setCity('') }}>
            <option value="">All states</option>
            {report.states.map((row) => <option key={row.state} value={row.state}>{row.state} ({row.registered})</option>)}
          </select></label>
          <label>City<select value={city} onChange={(event) => setCity(event.target.value)} disabled={!state}>
            <option value="">{state ? 'All cities' : 'Pick a state first'}</option>
            {cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select></label>
          <label>Exhibition<select value={eventId} onChange={(event) => { setEventId(event.target.value); setState(''); setCity('') }}>
            <option value="">All exhibitions</option>
            {report.events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <div className="vr-actions">
          <button type="button" className="account-primary" disabled={Boolean(busy)} onClick={() => void download('xlsx')}><Download size={14} /> {busy === 'xlsx' ? 'Preparing…' : 'Download Excel'}</button>
          <button type="button" className="account-primary" disabled={Boolean(busy)} onClick={() => void download('pdf')}><Download size={14} /> {busy === 'pdf' ? 'Preparing…' : 'Download PDF'}</button>
        </div>
        {error && <p className="account-error" role="alert">{error}</p>}
        <div className="vr-cards">
          <div><b>{report.totals.registered}</b><span>Visitors</span></div>
          <div><b>{report.totals.checkedIn}</b><span>Checked in</span></div>
          <div><b>{report.totals.states}</b><span>States</span></div>
          <div><b>{report.totals.cities}</b><span>Cities</span></div>
        </div>
      </section>

      <section className="account-card">
        <h2>By state &amp; city</h2>
        {shownStates.length === 0 ? <p className="account-note">No visitors match these filters.</p> : (
          <div className="vr-table-wrap"><table className="vr-table">
            <thead><tr><th>State / City</th><th>Registered</th><th>Checked in</th></tr></thead>
            <tbody>
              {shownStates.map((row) => (
                <FragmentRows key={row.state} row={row} onPick={(value) => { setState(row.state); setCity(value) }} />
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section className="account-card">
        <h2>Visitors ({report.visitors.length}{report.totals.registered > report.visitors.length ? ` of ${report.totals.registered}` : ''})</h2>
        <div className="vr-table-wrap"><table className="vr-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>State</th><th>City</th><th>Exhibition</th><th>Checked in</th></tr></thead>
          <tbody>
            {report.visitors.map((v, index) => (
              <tr key={`${v.email}-${index}`}><td>{v.fullName}</td><td>{v.email}</td><td>{v.phone ?? ''}</td><td>{v.state}</td><td>{v.city}</td><td>{v.eventTitle}</td><td>{v.checkedInAt ? 'Yes' : 'No'}</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </main>
  )
}

function FragmentRows({ row, onPick }: { row: StateRow; onPick: (city: string) => void }) {
  return (
    <>
      <tr className="vr-state-row"><td>{row.state}</td><td>{row.registered}</td><td>{row.checkedIn}</td></tr>
      {row.cities.map((c) => (
        <tr key={c.city}><td className="vr-city"><button type="button" onClick={() => onPick(c.city)}>{c.city}</button></td><td>{c.registered}</td><td>{c.checkedIn}</td></tr>
      ))}
    </>
  )
}
