'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, KeyRound, UserPlus } from 'lucide-react'
import { indianStates, indianUnionTerritories } from '@/lib/indian-states'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', CONTENT_MANAGER: 'Content Manager', REGISTRATION_MANAGER: 'Event Staff',
}

type Member = { id: string; fullName: string; email: string; status: string; roles: string[]; states: string[]; eventCount: number }
type EventOption = { id: string; title: string; city: string; state: string }
type Credentials = { name: string; email: string; password: string }

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : `Request failed (${response.status})`)
  return data as T
}

export function TeamManager() {
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<EventOption[]>([])
  const [canManageAdmins, setCanManageAdmins] = useState(false)
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [role, setRole] = useState('CONTENT_MANAGER')
  const [states, setStates] = useState<string[]>([])
  const [eventIds, setEventIds] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const data = await api<{ members: Member[]; events: EventOption[]; canManageAdmins: boolean }>('/api/team')
    setMembers(data.members); setEvents(data.events); setCanManageAdmins(data.canManageAdmins); setState('ready')
  }, [])

  useEffect(() => { load().catch(() => setState('denied')) }, [load])

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action(); await load() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.') } finally { setBusy(false) }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const element = event.currentTarget
    const form = new FormData(element)
    const fullName = String(form.get('fullName') ?? '')
    void run(async () => {
      const result = await api<{ email: string; password: string }>('/api/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email: form.get('email'), role, states, eventIds }),
      })
      setCredentials({ name: fullName, email: result.email, password: result.password })
      setCopied(false); setStates([]); setEventIds([]); element.reset()
    })
  }

  function resetPassword(member: Member) {
    if (!window.confirm(`Generate a new password for ${member.fullName}? Their current password and sessions will stop working.`)) return
    void run(async () => {
      const result = await api<{ password: string }>(`/api/team/${member.id}/reset-password`, { method: 'POST' })
      setCredentials({ name: member.fullName, email: member.email, password: result.password }); setCopied(false)
    })
  }

  function setStatus(member: Member, status: 'ACTIVE' | 'SUSPENDED') {
    void run(async () => { await api(`/api/team/${member.id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }) })
  }

  async function copy() {
    if (!credentials) return
    await navigator.clipboard.writeText(`Login: ${window.location.origin}/dashboard\nEmail: ${credentials.email}\nPassword: ${credentials.password}`)
    setCopied(true)
  }

  if (state === 'loading') return <main className="account-page"><p className="account-note">Loading team…</p></main>
  if (state === 'denied') return <main className="account-page"><section className="account-card"><h1>No access</h1><p className="account-note">Sign in with an Admin or Super Admin account to manage the team.</p><Link className="account-primary" href="/dashboard">Go to dashboard</Link></section></main>

  return (
    <main className="account-page team-page">
      <Link href="/dashboard" className="account-back"><ArrowLeft size={15} /> Back to dashboard</Link>
      <section className="account-card">
        <h1>Team &amp; employees</h1>
        <p className="account-note">Add your staff. A secure password is generated for each new account; share it with them privately.{canManageAdmins ? ' As Super Admin you can also add Admins.' : ''}</p>
        {credentials && (
          <div className="team-credentials" role="status">
            <strong>Login created for {credentials.name}</strong>
            <code>Email: {credentials.email}<br />Password: {credentials.password}</code>
            <p>This password is shown only once. Ask them to change it from My profile after logging in.</p>
            <button type="button" className="account-primary" onClick={() => void copy()}><Copy size={14} /> {copied ? 'Copied' : 'Copy login details'}</button>
          </div>
        )}
        <form className="account-form" onSubmit={create}>
          <label>Full name<input name="fullName" required minLength={2} maxLength={160} /></label>
          <label>Email (login)<input name="email" type="email" required maxLength={255} /></label>
          <label>Role
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              <option value="CONTENT_MANAGER">Content Manager</option>
              <option value="REGISTRATION_MANAGER">Event Staff (check-in)</option>
              {canManageAdmins && <option value="ADMIN">Admin</option>}
              {canManageAdmins && <option value="SUPER_ADMIN">Super Admin</option>}
            </select>
          </label>
          {role === 'REGISTRATION_MANAGER' && (
            <>
              <label className="account-wide">States they can check in
                <select value="" onChange={(event) => { const value = event.target.value; if (value && !states.includes(value)) setStates([...states, value]) }}>
                  <option value="">Add a state…</option>
                  {[...indianStates, ...indianUnionTerritories].map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              {states.length > 0 && <div className="account-wide team-chips">{states.map((name) => <button type="button" key={name} onClick={() => setStates(states.filter((entry) => entry !== name))}>{name} ×</button>)}</div>}
              {events.length > 0 && <fieldset className="account-wide team-events"><legend>Or specific events</legend>
                {events.map((item) => <label key={item.id}><input type="checkbox" checked={eventIds.includes(item.id)} onChange={() => setEventIds(eventIds.includes(item.id) ? eventIds.filter((id) => id !== item.id) : [...eventIds, item.id])} /> {item.title}</label>)}
              </fieldset>}
            </>
          )}
          <div className="account-wide account-submit">
            <button className="account-primary" type="submit" disabled={busy}><UserPlus size={15} /> {busy ? 'Creating…' : 'Create account & generate password'}</button>
            {error && <span className="account-err" role="alert">{error}</span>}
          </div>
        </form>
      </section>
      <section className="account-card">
        <h2>Current team ({members.length})</h2>
        <div className="team-list">
          {members.map((member) => (
            <article key={member.id} className="team-row">
              <div><strong>{member.fullName}</strong><small>{member.email}</small></div>
              <div className="team-meta">
                {member.roles.filter((name) => roleLabels[name]).map((name) => <span key={name} className="team-pill">{roleLabels[name]}</span>)}
                {member.roles.includes('REGISTRATION_MANAGER') && <span className="team-pill team-pill-soft">{member.states.length ? member.states.join(', ') : `${member.eventCount} events`}</span>}
                <span className={`team-pill ${member.status === 'ACTIVE' ? 'team-ok' : 'team-off'}`}>{member.status === 'ACTIVE' ? 'Active' : 'Suspended'}</span>
              </div>
              <div className="team-actions">
                <button type="button" disabled={busy} onClick={() => resetPassword(member)}><KeyRound size={14} /> New password</button>
                <button type="button" disabled={busy} onClick={() => setStatus(member, member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>{member.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
