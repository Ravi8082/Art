'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowLeft, ArrowDownToLine, CheckCircle2, CircleAlert, Clock3, Database,
  RefreshCw, Search, ShieldCheck, Users,
} from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type Mode = 'reports' | 'audit' | 'system'
type ReportData = {
  generatedAt: string
  summary: Record<string, number>
  monthlyRevenue: { month: string; invoices: number; revenue: number | string }[]
  events: { id: string; title: string; city: string; status: string; startsAt: string; applications: number; confirmedBookings: number; revenue: number | string; visitorRegistrations: number }[]
  paymentsByStatus: { status: string; total: number }[]
}
type AuditEntry = { id: number; action: string; entityType: string; entityId: string | null; metadata: Record<string, unknown> | null; createdAt: string; actorName: string | null; actorEmail: string | null }
type AuditData = { entries: AuditEntry[]; page: number; limit: number; total: number }
type SystemData = {
  health: { application: string; database: string }
  runtime: { databaseName: string; databaseVersion: string; nodeVersion: string; environment: string; emailProviderConfigured: boolean; secureCookiesEnabled: boolean; jwtSecretConfigured: boolean }
  security: { activeUsers: number; suspendedUsers: number; pendingVerificationChallenges: number; auditEventsLast24Hours: number; activeVisitorPasses: number }
  emailDeliveriesLast7Days: { status: string; count: number }[]
  recentActivity: { action: string; entityType: string; createdAt: string }[]
  checkedAt: string
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { credentials: 'include', headers: { accept: 'application/json' } })
  const data = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data
}

const money = (value: number | string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0)
const dateTime = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
const dateOnly = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
}
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function DashboardInsights({ mode }: { mode: Mode }) {
  const [reports, setReports] = useState<ReportData | null>(null)
  const [audit, setAudit] = useState<AuditData | null>(null)
  const [system, setSystem] = useState<SystemData | null>(null)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      if (mode === 'reports') setReports(await getJson<ReportData>('/api/dashboard/reports'))
      if (mode === 'system') setSystem(await getJson<SystemData>('/api/dashboard/system'))
      if (mode === 'audit') {
        const params = new URLSearchParams({ page: String(page), limit: '30', q: submittedQuery })
        setAudit(await getJson<AuditData>(`/api/dashboard/audit?${params}`))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [mode, page, submittedQuery])

  useEffect(() => { void load() }, [load])

  function searchAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setSubmittedQuery(query.trim())
  }

  function downloadReport() {
    if (!reports) return
    const rows = [
      ['Report', 'Value'],
      ...Object.entries(reports.summary),
      [],
      ['Exhibition', 'City', 'Status', 'Applications', 'Confirmed bookings', 'Revenue INR', 'Visitor registrations'],
      ...reports.events.map((event) => [event.title, event.city, event.status, event.applications, event.confirmedBookings, event.revenue, event.visitorRegistrations]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'haat-of-art-dashboard-report.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const heading = mode === 'reports'
    ? { eyebrow: 'Operations & finance', title: 'Reports & Analytics', description: 'Live overview of users, exhibitions, applications, bookings, payments and visitor activity.' }
    : mode === 'audit'
      ? { eyebrow: 'Platform security', title: 'Audit Log', description: 'Trace administrative actions and platform changes, with actor and event metadata.' }
      : { eyebrow: 'Platform administration', title: 'System & Security', description: 'Review database availability, essential security configuration, account health and delivery queues.' }

  return (
    <main className="role-access-page">
      <header className="role-access-header">
        <Link href="/dashboard" className="role-access-back"><ArrowLeft size={15} /> Dashboard</Link>
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span className="role-access-secure"><ShieldCheck size={14} /> Protected workspace</span>
      </header>
      <div className="role-access-content insights-content">
        <div className="role-access-title"><span className="role-access-icon">{mode === 'system' ? <Database size={22} /> : mode === 'audit' ? <ShieldCheck size={22} /> : <Activity size={22} />}</span><div><p className="role-eyebrow">{heading.eyebrow}</p><h1>{heading.title}</h1><p>{heading.description}</p></div></div>
        <div className="insights-toolbar">
          <span>{loading ? 'Refreshing data…' : mode === 'reports' && reports ? `Updated ${dateTime(reports.generatedAt)}` : mode === 'system' && system ? `Checked ${dateTime(system.checkedAt)}` : 'Live dashboard data'}</span>
          <div>
            {mode === 'reports' && <button type="button" className="role-edit-button" onClick={downloadReport} disabled={!reports}><ArrowDownToLine size={14} /> Export CSV</button>}
            <button type="button" className="role-edit-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> Refresh</button>
          </div>
        </div>
        {error && <p className="role-error insights-error" role="alert"><CircleAlert size={15} /> {error}</p>}
        {loading && !reports && !audit && !system ? <p className="role-access-empty">Loading secure dashboard data…</p> : null}
        {mode === 'reports' && reports && <ReportsView data={reports} />}
        {mode === 'audit' && audit && <AuditView data={audit} query={query} setQuery={setQuery} onSearch={searchAudit} page={page} setPage={setPage} />}
        {mode === 'system' && system && <SystemView data={system} />}
      </div>
    </main>
  )
}

function ReportsView({ data }: { data: ReportData }) {
  const kpis = [
    ['Confirmed revenue', money(data.summary.confirmedRevenue), 'green'],
    ['Payments to review', data.summary.paymentsToReview, 'orange'],
    ['Confirmed bookings', data.summary.confirmedBookings, 'blue'],
    ['Visitor entries', `${data.summary.visitorCheckIns} / ${data.summary.visitorRegistrations}`, 'purple'],
    ['Pending applications', data.summary.pendingApplications, 'orange'],
    ['Active users', `${data.summary.activeUsers} / ${data.summary.totalUsers}`, 'blue'],
  ] as const
  const maxRevenue = Math.max(...data.monthlyRevenue.map((month) => Number(month.revenue)), 1)
  return <>
    <section className="insights-kpis">{kpis.map(([label, value, tone]) => <article className="insights-kpi" key={label}><span className={`insights-kpi-mark ${tone}`} /><small>{label}</small><strong>{value}</strong></article>)}</section>
    <section className="insights-grid">
      <article className="insights-card insights-revenue"><div className="insights-card-heading"><div><p className="role-eyebrow">Finance module</p><h2>Monthly invoiced revenue</h2></div><span>Last six months</span></div>
        {data.monthlyRevenue.length ? <div className="insights-bars">{data.monthlyRevenue.map((month) => <div className="insights-bar-column" key={month.month}><strong>{money(month.revenue)}</strong><div className="insights-bar-track"><i style={{ height: `${Math.max(5, Number(month.revenue) / maxRevenue * 100)}%` }} /></div><small>{dateOnly(`${month.month}-01`)}</small></div>)}</div> : <p className="role-access-empty">Invoices will appear here once payments are verified.</p>}
      </article>
      <article className="insights-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Reconciliation</p><h2>Payment status</h2></div></div>
        {data.paymentsByStatus.length ? data.paymentsByStatus.map((item) => <div className="insights-status-row" key={item.status}><span>{titleCase(item.status)}</span><strong>{item.total}</strong></div>) : <p className="role-access-empty">No payment records yet.</p>}
        <Link className="insights-inline-link" href="/dashboard/finance">Open payment reconciliation <span>→</span></Link>
      </article>
    </section>
    <section className="insights-card insights-table-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Performance</p><h2>Exhibition overview</h2></div><span>{data.events.length} exhibitions</span></div>
      <div className="role-access-table-wrap"><table className="role-access-table insights-table"><thead><tr><th>Exhibition</th><th>Status</th><th>Applications</th><th>Stall bookings</th><th>Revenue</th><th>Visitors</th></tr></thead><tbody>
        {data.events.map((event) => <tr key={event.id}><td><strong>{event.title}</strong><small>{[event.city, dateOnly(event.startsAt)].filter(Boolean).join(' · ')}</small></td><td><span className="role-account-status">{titleCase(event.status)}</span></td><td>{event.applications}</td><td>{event.confirmedBookings}</td><td>{money(event.revenue)}</td><td>{event.visitorRegistrations}</td></tr>)}
        {!data.events.length && <tr><td colSpan={6} className="role-access-empty">No exhibitions in the system yet.</td></tr>}
      </tbody></table></div>
    </section>
  </>
}

function AuditView({ data, query, setQuery, onSearch, page, setPage }: { data: AuditData; query: string; setQuery: (value: string) => void; onSearch: (event: FormEvent<HTMLFormElement>) => void; page: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.limit))
  return <section className="insights-card insights-table-card">
    <div className="insights-card-heading"><div><p className="role-eyebrow">Immutable activity trail</p><h2>{data.total} recorded actions</h2></div><Users size={18} /></div>
    <form className="audit-search" onSubmit={onSearch}><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search action, account, entity or ID" /></label><button className="role-save-button">Search log</button></form>
    <div className="role-access-table-wrap"><table className="role-access-table insights-table audit-table"><thead><tr><th>Action</th><th>Actor</th><th>Entity</th><th>Details</th><th>When</th></tr></thead><tbody>
      {data.entries.map((entry) => <tr key={entry.id}><td><strong>{titleCase(entry.action)}</strong><small>Log #{entry.id}</small></td><td>{entry.actorName || 'System'}<small>{entry.actorEmail || 'Automated process'}</small></td><td>{titleCase(entry.entityType)}<small>{entry.entityId || '—'}</small></td><td><code>{entry.metadata ? JSON.stringify(entry.metadata) : '—'}</code></td><td>{dateTime(entry.createdAt)}</td></tr>)}
      {!data.entries.length && <tr><td colSpan={5} className="role-access-empty">No matching audit events.</td></tr>}
    </tbody></table></div>
    <div className="audit-pagination"><span>Page {page} of {pages}</span><div><button className="role-cancel-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="role-cancel-button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button></div></div>
  </section>
}

function SystemView({ data }: { data: SystemData }) {
  const config = [
    ['Database connection', data.health.database === 'ok', data.runtime.databaseName],
    ['JWT signing secret', data.runtime.jwtSecretConfigured, data.runtime.jwtSecretConfigured ? 'Configured' : 'Missing or too short'],
    ['Secure session cookies', data.runtime.secureCookiesEnabled, data.runtime.secureCookiesEnabled ? 'Enabled' : 'Development mode — HTTP cookies'],
    ['Email provider', data.runtime.emailProviderConfigured, data.runtime.emailProviderConfigured ? 'SMTP configured' : 'SMTP not configured'],
  ] as const
  return <>
    <section className="insights-kpis">
      <article className="insights-kpi"><span className="insights-kpi-mark green" /><small>Application</small><strong><CheckCircle2 size={17} /> Online</strong></article>
      <article className="insights-kpi"><span className="insights-kpi-mark green" /><small>Database</small><strong><CheckCircle2 size={17} /> Connected</strong></article>
      <article className="insights-kpi"><span className="insights-kpi-mark blue" /><small>Active accounts</small><strong>{data.security.activeUsers}</strong></article>
      <article className="insights-kpi"><span className="insights-kpi-mark orange" /><small>Suspended accounts</small><strong>{data.security.suspendedUsers}</strong></article>
      <article className="insights-kpi"><span className="insights-kpi-mark purple" /><small>Security events · 24h</small><strong>{data.security.auditEventsLast24Hours}</strong></article>
    </section>
    <section className="insights-grid">
      <article className="insights-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Security posture</p><h2>Configuration checks</h2></div><ShieldCheck size={19} /></div>
        {config.map(([label, ok, detail]) => <div className="system-check-row" key={label}><span className={ok ? 'system-check-dot is-good' : 'system-check-dot is-warning'} /><div><strong>{label}</strong><small>{detail}</small></div><span className={`role-account-status ${ok ? 'active' : ''}`}>{ok ? 'Ready' : 'Action needed'}</span></div>)}
        <p className="system-disclaimer">Development mode warnings are expected locally. Enable HTTPS, a strong secret and SMTP before production.</p>
      </article>
      <article className="insights-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Runtime</p><h2>Service details</h2></div><Database size={19} /></div>
        <div className="system-detail-row"><span>Database</span><strong>{data.runtime.databaseName}</strong></div><div className="system-detail-row"><span>MySQL version</span><strong>{data.runtime.databaseVersion}</strong></div><div className="system-detail-row"><span>Node.js</span><strong>{data.runtime.nodeVersion}</strong></div><div className="system-detail-row"><span>Environment</span><strong>{titleCase(data.runtime.environment)}</strong></div><div className="system-detail-row"><span>Open verification codes</span><strong>{data.security.pendingVerificationChallenges}</strong></div><div className="system-detail-row"><span>Active visitor passes</span><strong>{data.security.activeVisitorPasses}</strong></div>
      </article>
    </section>
    <section className="insights-grid">
      <article className="insights-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Mail queue</p><h2>Deliveries · last 7 days</h2></div><Clock3 size={18} /></div>{data.emailDeliveriesLast7Days.length ? data.emailDeliveriesLast7Days.map((row) => <div className="insights-status-row" key={row.status}><span>{titleCase(row.status)}</span><strong>{row.count}</strong></div>) : <p className="role-access-empty">No email delivery attempts recorded in the last seven days.</p>}</article>
      <article className="insights-card"><div className="insights-card-heading"><div><p className="role-eyebrow">Monitoring</p><h2>Latest system activity</h2></div><Activity size={18} /></div>{data.recentActivity.length ? data.recentActivity.map((entry, index) => <div className="system-activity-row" key={`${entry.action}-${index}`}><span>{titleCase(entry.action)}<small>{titleCase(entry.entityType)}</small></span><time>{dateTime(entry.createdAt)}</time></div>) : <p className="role-access-empty">No administrative events recorded.</p>}</article>
    </section>
  </>
}
