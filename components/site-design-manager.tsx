'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { defaultSiteSettings, mergeSiteSettings, type NavLink, type SiteLink, type SiteSettings } from '@/lib/site-settings'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', cache: 'no-store', ...init })
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const issues = data && typeof data === 'object' && 'issues' in data ? JSON.stringify((data as { issues: unknown }).issues).slice(0, 200) : ''
    throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? `${data.error} ${issues}` : `Request failed (${response.status})`)
  }
  return data as T
}

const themeLabels: Record<keyof SiteSettings['theme'], string> = {
  orange: 'Accent / buttons', navy: 'Headings & dark areas', cream: 'Page background', card: 'Cards', muted: 'Muted text', line: 'Borders',
}

function move<T>(list: T[], index: number, dir: -1 | 1) {
  const target = index + dir
  if (target < 0 || target >= list.length) return list
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function SiteDesignManager() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings)
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ settings: Partial<SiteSettings> | null }>('/api/site-settings')
      .then((data) => { setSettings(mergeSiteSettings(data.settings)); setState('ready') })
      .catch(() => setState('denied'))
  }, [])

  const patchFooter = (patch: Partial<SiteSettings['footer']>) => setSettings((s) => ({ ...s, footer: { ...s.footer, ...patch } }))
  const setLinks = (links: NavLink[]) => setSettings((s) => ({ ...s, navbar: { ...s.navbar, links } }))
  const setColumns = (columns: SiteSettings['footer']['columns']) => patchFooter({ columns })

  async function run(action: () => Promise<string>) {
    setBusy(true); setError(''); setMessage('')
    try { setMessage(await action()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.') } finally { setBusy(false) }
  }

  const save = () => run(async () => {
    await api('/api/site-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    return 'Saved. Website par changes 15-30 seconds mein live ho jayenge.'
  })
  const reset = () => {
    if (!window.confirm('Navbar, footer aur theme ko original default par reset karna hai?')) return
    run(async () => {
      await api('/api/site-settings', { method: 'DELETE' })
      setSettings(defaultSiteSettings)
      return 'Default par reset ho gaya.'
    })
  }

  if (state === 'loading') return <section className="account-page"><p>Loading…</p></section>
  if (state === 'denied') return <section className="account-page"><p>Aapke paas site design edit karne ka access nahi hai.</p></section>

  const { theme, navbar, footer } = settings
  const text = (label: string, key: 'about' | 'script' | 'scriptSub' | 'newsletterTitle' | 'newsletterText' | 'address' | 'phone' | 'email' |   'hours' | 'copyright' | 'partnersTitle' | 'whatsapp') => (
      <label className="sd-field">{label}{key === 'copyright'
        ? <textarea rows={2} value={footer[key]} onChange={(e) => patchFooter({ copyright: e.target.value })} />
        : <input value={footer[key]} onChange={(e) => patchFooter({ [key]: key === 'whatsapp' ? e.target.value.replace(/\D/g, '') : e.target.value })} />}</label>
    )

  return (
    <section className="account-page sd-page">
      <Link className="account-back" href="/dashboard"><ArrowLeft size={16} /> Dashboard</Link>
      <header className="sd-head">
        <div><h1>Site design</h1><p>Navbar, footer, theme colours aur contact details yahin se badlein. Images ke liye <Link href="/dashboard/homepage-media">Media library</Link>, page text ke liye <Link href="/dashboard/content">Website content</Link>.</p></div>
        <div className="sd-actions">
          <button type="button" className="sd-ghost" onClick={reset} disabled={busy}><RotateCcw size={16} /> Reset</button>
          <button type="button" className="sd-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </header>
      {message && <p className="sd-msg" role="status">{message}</p>}
      {error && <p className="sd-err" role="alert">{error}</p>}

      <section className="sd-card">
        <h2>Theme colours</h2>
        <div className="sd-colors">
          {(Object.keys(themeLabels) as (keyof SiteSettings['theme'])[]).map((key) => (
            <label key={key} className="sd-color">
              <input type="color" value={theme[key]} onChange={(e) => setSettings((s) => ({ ...s, theme: { ...s.theme, [key]: e.target.value } }))} />
              <span>{themeLabels[key]}<small>{theme[key]}</small></span>
            </label>
          ))}
        </div>
        <div className="sd-preview" style={{ background: theme.cream, borderColor: theme.line, color: theme.navy }}>
          <strong style={{ color: theme.navy }}>Preview</strong>
          <span style={{ color: theme.muted }}>Muted text sample</span>
          <i style={{ background: theme.card, borderColor: theme.line }}>Card</i>
          <b style={{ background: theme.orange }}>Button</b>
        </div>
      </section>

      <section className="sd-card">
        <h2>Navbar links</h2>
        <label className="sd-check"><input type="checkbox" checked={navbar.showSearch} onChange={(e) => setSettings((s) => ({ ...s, navbar: { ...s.navbar, showSearch: e.target.checked } }))} /> Search icon dikhayein</label>
        {navbar.links.map((link, i) => (
          <div className="sd-row" key={i}>
            <input aria-label="Label" value={link.label} onChange={(e) => setLinks(navbar.links.map((l, j) => j === i ? { ...l, label: e.target.value } : l))} />
            <input aria-label="Link" value={link.href} onChange={(e) => setLinks(navbar.links.map((l, j) => j === i ? { ...l, href: e.target.value } : l))} />
            <label className="sd-check"><input type="checkbox" checked={link.visible} onChange={(e) => setLinks(navbar.links.map((l, j) => j === i ? { ...l, visible: e.target.checked } : l))} /> Show</label>
            <label className="sd-check"><input type="checkbox" checked={link.highlight} onChange={(e) => setLinks(navbar.links.map((l, j) => j === i ? { ...l, highlight: e.target.checked } : l))} /> Button</label>
            <button type="button" aria-label="Move up" onClick={() => setLinks(move(navbar.links, i, -1))}><ArrowUp size={15} /></button>
            <button type="button" aria-label="Move down" onClick={() => setLinks(move(navbar.links, i, 1))}><ArrowDown size={15} /></button>
            <button type="button" aria-label="Remove" onClick={() => setLinks(navbar.links.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
          </div>
        ))}
        {navbar.links.length < 14 && <button type="button" className="sd-add" onClick={() => setLinks([...navbar.links, { label: 'New link', href: '/', visible: true, highlight: false }])}><Plus size={15} /> Add link</button>}
      </section>

      <section className="sd-card">
        <h2>Footer text & contact</h2>
        <div className="sd-grid">
          {text('About text', 'about')}
          {text('Tagline', 'script')}
          {text('Tagline (small)', 'scriptSub')}
          {text('Newsletter title', 'newsletterTitle')}
          {text('Newsletter text', 'newsletterText')}
          {text('Address', 'address')}
          {text('Phone', 'phone')}
          {text('Email', 'email')}
          {text('Working hours', 'hours')}
          {text('Copyright (2 lines allowed, Enter se nayi line)', 'copyright')}
          {text('Partners section title', 'partnersTitle')}
          {text('WhatsApp number (with country code, e.g. 918052696360)', 'whatsapp')}
        </div>
      </section>

      <section className="sd-card">
        <h2>Social links</h2>
        <p className="sd-hint">https:// se shuru hone wale full URL daalein. Khali chhodne par icon /contact par jayega.</p>
        <div className="sd-grid">
          {(['facebook', 'instagram', 'youtube', 'linkedin', 'x'] as const).map((key) => (
            <label className="sd-field" key={key}>{key}<input placeholder="https://" value={footer.social[key]} onChange={(e) => patchFooter({ social: { ...footer.social, [key]: e.target.value } })} /></label>
          ))}
        </div>
      </section>

      <section className="sd-card">
        <h2>Footer link columns</h2>
        {footer.columns.map((col, ci) => {
          const setLinksOf = (links: SiteLink[]) => setColumns(footer.columns.map((c, k) => k === ci ? { ...c, links } : c))
          return (
            <div className="sd-col" key={ci}>
              <div className="sd-row">
                <input aria-label="Column title" className="sd-title" value={col.title} onChange={(e) => setColumns(footer.columns.map((c, k) => k === ci ? { ...c, title: e.target.value } : c))} />
                <button type="button" aria-label="Move column up" onClick={() => setColumns(move(footer.columns, ci, -1))}><ArrowUp size={15} /></button>
                <button type="button" aria-label="Move column down" onClick={() => setColumns(move(footer.columns, ci, 1))}><ArrowDown size={15} /></button>
                <button type="button" aria-label="Remove column" onClick={() => setColumns(footer.columns.filter((_, k) => k !== ci))}><Trash2 size={15} /></button>
              </div>
              {col.links.map((link, li) => (
                <div className="sd-row" key={li}>
                  <input aria-label="Label" value={link.label} onChange={(e) => setLinksOf(col.links.map((l, k) => k === li ? { ...l, label: e.target.value } : l))} />
                  <input aria-label="Link" value={link.href} onChange={(e) => setLinksOf(col.links.map((l, k) => k === li ? { ...l, href: e.target.value } : l))} />
                  <button type="button" aria-label="Move up" onClick={() => setLinksOf(move(col.links, li, -1))}><ArrowUp size={15} /></button>
                  <button type="button" aria-label="Move down" onClick={() => setLinksOf(move(col.links, li, 1))}><ArrowDown size={15} /></button>
                  <button type="button" aria-label="Remove" onClick={() => setLinksOf(col.links.filter((_, k) => k !== li))}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="sd-add" onClick={() => setLinksOf([...col.links, { label: 'New link', href: '/' }])}><Plus size={15} /> Add link</button>
            </div>
          )
        })}
        {footer.columns.length < 5 && <button type="button" className="sd-add" onClick={() => setColumns([...footer.columns, { title: 'New column', links: [] }])}><Plus size={15} /> Add column</button>}
      </section>

      <section className="sd-card">
        <h2>Partners & supporters</h2>
        {footer.partners.map((name, i) => (
          <div className="sd-row" key={i}>
            <input aria-label="Partner name" value={name} onChange={(e) => patchFooter({ partners: footer.partners.map((p, k) => k === i ? e.target.value : p) })} />
            <button type="button" aria-label="Move up" onClick={() => patchFooter({ partners: move(footer.partners, i, -1) })}><ArrowUp size={15} /></button>
            <button type="button" aria-label="Move down" onClick={() => patchFooter({ partners: move(footer.partners, i, 1) })}><ArrowDown size={15} /></button>
            <button type="button" aria-label="Remove" onClick={() => patchFooter({ partners: footer.partners.filter((_, k) => k !== i) })}><Trash2 size={15} /></button>
          </div>
        ))}
        {footer.partners.length < 12 && <button type="button" className="sd-add" onClick={() => patchFooter({ partners: [...footer.partners, 'NEW PARTNER'] })}><Plus size={15} /> Add partner</button>}
      </section>

      <div className="sd-actions sd-bottom">
        <button type="button" className="sd-primary" onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </section>
  )
}
