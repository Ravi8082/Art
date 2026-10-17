'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, LockKeyhole, RefreshCw, Save, Search, ShieldCheck, Users, X } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin / Operations',
  CONTENT_MANAGER: 'Content Manager',
  REGISTRATION_MANAGER: 'Registration & Event Staff',
  ARTIST_EXHIBITOR: 'Artist / Exhibitor',
  VISITOR: 'Visitor',
}

type Account = {
  id: string
  fullName: string
  email: string
  status: string
  createdAt: string
  roles: string[]
  permissions: string[]
  directPermissions: string[]
}

export function DashboardAccessManager() {
  const [users, setUsers] = useState<Account[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [selected, setSelected] = useState<Account | null>(null)
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editPermissions, setEditPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/dashboard/users`, { credentials: 'include', headers: { accept: 'application/json' } })
      const data = await response.json() as { error?: string; users?: Account[]; roles?: string[]; permissions?: string[] }
      if (!response.ok) throw new Error(data.error || `Could not load accounts (${response.status})`)
      setUsers(data.users ?? [])
      setRoles(data.roles ?? [])
      setPermissions(data.permissions ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load accounts.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const filteredUsers = users.filter((account) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || `${account.fullName} ${account.email}`.toLowerCase().includes(normalizedQuery)
    const matchesRole = !roleFilter || account.roles.includes(roleFilter)
    const matchesStatus = !statusFilter || account.status === statusFilter
    return matchesQuery && matchesRole && matchesStatus
  })
  const activeUsers = users.filter((account) => account.status === 'ACTIVE').length
  const superAdmins = users.filter((account) => account.roles.includes('SUPER_ADMIN')).length

  function openEditor(account: Account) {
    setSelected(account)
    setEditRoles(account.roles)
    setEditPermissions(account.directPermissions)
    setError('')
    setNotice('')
  }

  function toggleRole(role: string) {
    setEditRoles((current) => current.includes(role)
      ? current.filter((entry) => entry !== role)
      : [...current, role])
  }

  function togglePermission(permission: string) {
    setEditPermissions((current) => current.includes(permission)
      ? current.filter((entry) => entry !== permission)
      : [...current, permission])
  }

  async function saveRoles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !editRoles.length) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`${apiBase}/api/dashboard/users/${encodeURIComponent(selected.id)}/roles`, {
        method: 'PUT',
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ roles: editRoles, permissions: editPermissions }),
      })
      const data = await response.json() as { error?: string; roles?: string[]; directPermissions?: string[] }
      if (!response.ok) throw new Error(data.error || `Could not update roles (${response.status})`)
      setUsers((current) => current.map((account) => account.id === selected.id
        ? { ...account, roles: data.roles ?? editRoles, directPermissions: data.directPermissions ?? editPermissions }
        : account))
      setSelected(null)
      setNotice(`Access updated for ${selected.fullName}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update access roles.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="role-access-page">
      <header className="role-access-header">
        <Link href="/dashboard" className="role-access-back"><ArrowLeft size={15} /> Dashboard</Link>
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span className="role-access-secure"><LockKeyhole size={14} /> Super Admin access control</span>
      </header>
      <div className="role-access-content">
        <div className="role-access-title">
          <span className="role-access-icon"><ShieldCheck size={25} /></span>
          <div><p className="role-eyebrow">Platform administration</p><h1>Users &amp; Roles</h1><p>Manage account access, dashboard roles and additional permissions.</p></div>
          <button type="button" className="role-access-refresh" onClick={() => void loadUsers()} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'is-spinning' : ''} /> {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <section className="role-access-stats" aria-label="Account totals">
          <article><span className="role-access-stat-icon"><Users size={17} /></span><div><small>Total accounts</small><strong>{users.length}</strong></div></article>
          <article><span className="role-access-stat-icon is-green"><Check size={17} /></span><div><small>Active accounts</small><strong>{activeUsers}</strong></div></article>
          <article><span className="role-access-stat-icon is-purple"><ShieldCheck size={17} /></span><div><small>Super Admins</small><strong>{superAdmins}</strong></div></article>
          <article><span className="role-access-stat-icon is-blue"><LockKeyhole size={17} /></span><div><small>Dashboard roles</small><strong>{roles.length}</strong></div></article>
        </section>
        {notice && <p className="role-access-success" role="status"><Check size={15} /> {notice}</p>}
        {error && <p className="role-error" role="alert">{error}</p>}
        <section className="role-access-panel">
          <div className="role-access-panel-heading">
            <div><h2>Platform accounts</h2><p>Role changes are recorded in the audit log.</p></div>
            <span><Users size={15} /> {filteredUsers.length} of {users.length} accounts</span>
          </div>
          <div className="role-access-toolbar">
            <label className="role-access-search"><Search size={16} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" aria-label="Search accounts by name or email" /></label>
            <label className="role-access-filter"><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by dashboard role"><option value="">All roles</option>{roles.map((role) => <option value={role} key={role}>{roleLabels[role] ?? role}</option>)}</select></label>
            <label className="role-access-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by account status"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="SUSPENDED">Suspended</option></select></label>
          </div>
          {loading ? <p className="role-access-empty">Loading accounts…</p> : users.length ? (
            <div className="role-access-table-wrap">
              <table className="role-access-table">
                <thead><tr><th>Account</th><th>Status</th><th>Assigned dashboard roles</th><th>Extra permissions</th><th>Access</th></tr></thead>
                <tbody>{filteredUsers.map((account) => (
                  <tr key={account.id}>
                    <td><div className="role-access-account"><span>{account.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HA'}</span><div><strong>{account.fullName}</strong><small>{account.email}</small></div></div></td>
                    <td><span className={`role-account-status ${account.status.toLowerCase()}`}>{account.status}</span></td>
                    <td><div className="role-chip-list">{account.roles.length ? account.roles.map((role) => <span className="role-access-chip" key={role}>{roleLabels[role] ?? role}</span>) : <span className="role-access-unassigned">No dashboard role</span>}</div></td>
                    <td><div className="role-chip-list">{account.directPermissions.length
                      ? <>{account.directPermissions.slice(0, 3).map((permission) => <span className="role-access-chip role-permission-chip" key={permission} title={permission}>{permissionLabel(permission)}</span>)}{account.directPermissions.length > 3 && <span className="role-access-chip">+{account.directPermissions.length - 3}</span>}</>
                      : <span className="role-access-unassigned">Role-based only</span>}</div></td>
                    <td><button type="button" className="role-edit-button" onClick={() => openEditor(account)}>Edit access</button></td>
                  </tr>
                ))}{!filteredUsers.length && <tr><td className="role-access-no-results" colSpan={5}>No accounts match these filters. Try changing your search or filters.</td></tr>}</tbody>
              </table>
            </div>
          ) : <p className="role-access-empty">No accounts are available to manage.</p>}
        </section>
        <p className="role-access-note"><ShieldCheck size={15} /> Only a Super Admin can grant Super Admin access. The final active Super Admin account cannot be demoted.</p>
      </div>
      {selected && (
        <div className="role-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null) }}>
          <form className="role-edit-modal" onSubmit={saveRoles} aria-labelledby="role-edit-title">
            <button type="button" className="role-modal-close" onClick={() => setSelected(null)} aria-label="Close role editor" disabled={saving}><X size={18} /></button>
            <p className="role-eyebrow">Account access</p>
            <h2 id="role-edit-title">{selected.fullName}</h2>
            <p className="role-modal-email">{selected.email}</p>
            <fieldset><legend>Dashboard roles</legend>
              {roles.map((role) => <label className="role-choice" key={role}>
                <input type="checkbox" checked={editRoles.includes(role)} onChange={() => toggleRole(role)} />
                <span><strong>{roleLabels[role] ?? role}</strong><small>{rolePermissionSummary(role)}</small></span>
              </label>)}
            </fieldset>
            <fieldset className="role-permission-fieldset"><legend>Additional permissions</legend>
              <p className="role-permission-help">Direct grants are added to the selected roles and are recorded in the audit log.</p>
              <div className="role-permission-options">{permissions.map((permission) => <label className="role-permission-choice" key={permission} title={permission}>
                <input type="checkbox" checked={editPermissions.includes(permission)} onChange={() => togglePermission(permission)} />
                <span>{permissionLabel(permission)}</span>
              </label>)}</div>
            </fieldset>
            {error && <p className="role-error" role="alert">{error}</p>}
            {!editRoles.length && <p className="role-access-validation">Choose at least one role to keep the account eligible for dashboard sign-in.</p>}
            <div className="role-modal-actions"><button type="button" className="role-cancel-button" onClick={() => setSelected(null)} disabled={saving}>Cancel</button><button type="submit" className="role-save-button" disabled={saving || !editRoles.length}><Save size={15} /> {saving ? 'Saving…' : 'Save access'}</button></div>
          </form>
        </div>
      )}
    </main>
  )
}

function rolePermissionSummary(role: string) {
  const descriptions: Record<string, string> = {
    SUPER_ADMIN: 'All dashboards and platform permissions',
    ADMIN: 'Operations, events, bookings, payments and enquiries',
    CONTENT_MANAGER: 'Website pages, media and exhibition content',
    REGISTRATION_MANAGER: 'Event registration and attendance overview',
    ARTIST_EXHIBITOR: 'Own artist profile, applications and bookings',
    VISITOR: 'Own visitor registration and pass overview',
  }
  return descriptions[role] ?? 'No description available'
}

function permissionLabel(permission: string) {
  return permission.split(':').map((part) => part.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' · ')
}
