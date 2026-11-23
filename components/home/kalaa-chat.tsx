'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowRight, LoaderCircle, MessageCircle, MoreHorizontal, Send, Sparkles, X } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const leadStorageKey = 'thoa_concierge_lead'
const whatsappHref = `https://wa.me/917304645333?text=${encodeURIComponent('Hi, I would like to speak with The Haat of Art team.')}`
const isExternalHref = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(href)
const externalLinkProps = (href: string) => /^https?:\/\//i.test(href)
  ? { target: '_blank' as const, rel: 'noopener noreferrer' }
  : {}

const roleOptions = [
  { value: 'ARTIST_EXHIBITOR', label: 'Artist / Exhibitor' },
  { value: 'ART_VISITOR', label: 'Art Visitor' },
  { value: 'COLLECTOR_BUYER', label: 'Collector / Buyer' },
  { value: 'BRAND_VENUE_PARTNER', label: 'Brand / Venue Partner' },
] as const

const starterQuestions = [
  'How THOA Works',
  'Upcoming Exhibitions',
  'Book a Stall',
  'Visitor Pass',
]

type LeadRole = typeof roleOptions[number]['value']
type SavedLead = {
  leadId: string
  sessionToken: string
  name: string
  phone: string
  email: string
  role: LeadRole
  sourcePage: string
  createdAt: string
}
type ChatAction = { label: string; href: string }
type ChatMessage = {
  id: string
  sender: 'USER' | 'ASSISTANT'
  text: string
  detectedIntent: string
  createdAt: string
  actions?: ChatAction[]
}
type ChatView = 'loading' | 'lead' | 'chat'

function isSavedLead(value: unknown): value is SavedLead {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.leadId === 'string'
    && typeof entry.sessionToken === 'string'
    && /^[a-f0-9]{64}$/i.test(entry.sessionToken)
    && typeof entry.name === 'string'
    && typeof entry.phone === 'string'
    && typeof entry.email === 'string'
    && typeof entry.role === 'string'
    && roleOptions.some((role) => role.value === entry.role)
    && typeof entry.sourcePage === 'string'
    && typeof entry.createdAt === 'string'
}

async function responseError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status}).`
}

function savedActions(message: ChatMessage): ChatAction[] {
  if (message.actions) return message.actions
  if (message.detectedIntent === 'UNVERIFIED_FACT') return [
    { label: 'Contact the Team', href: '/contact' },
    { label: 'WhatsApp the Team', href: 'https://wa.me/917304645333' },
  ]
  if (message.detectedIntent === 'PLATFORM') return [{ label: 'Explore Exhibitions', href: '/exhibitions' }, { label: 'Book Stall', href: '/book-your-stall' }]
  if (message.detectedIntent === 'UPCOMING_EXHIBITIONS') return [{ label: 'Get Visitor Pass', href: '/indore' }]
  if (message.detectedIntent === 'STALL_BOOKING') return [{ label: 'Book Your Stall', href: '/book-your-stall' }]
  if (message.detectedIntent === 'VISITOR_PASSES') return [{ label: 'Register for a Visitor Pass', href: '/indore' }]
  if (message.detectedIntent === 'ARTIST_SUPPORT') return [{ label: 'Explore Artist Profiles', href: '/artists' }, { label: 'Talk to the Team', href: '/contact' }]
  if (message.detectedIntent === 'BRAND_PARTNERSHIP') return [{ label: 'Contact the Partnerships Team', href: '/contact' }, { label: 'WhatsApp +91 7304645333', href: 'https://wa.me/917304645333' }]
  return []
}

export function KalaaChat({
  sourcePage,
  onClose,
  onReplayIntro,
}: {
  sourcePage: string
  onClose: () => void
  onReplayIntro: () => void
}) {
  const [view, setView] = useState<ChatView>('loading')
  const [lead, setLead] = useState<SavedLead | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'ARTIST_EXHIBITOR' as LeadRole, consent: false })
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [editingLead, setEditingLead] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPortalRoot(document.body)
    let active = true
    async function restore() {
      try {
        const rawLead = window.localStorage.getItem(leadStorageKey)
        if (!rawLead) {
          if (active) setView('lead')
          return
        }
        const parsed: unknown = JSON.parse(rawLead)
        if (!isSavedLead(parsed)) {
          window.localStorage.removeItem(leadStorageKey)
          if (active) {
            setError('Your saved details were incomplete. Please enter them again.')
            setView('lead')
          }
          return
        }
        if (active) {
          setLead(parsed)
          setForm({ name: parsed.name, phone: parsed.phone, email: parsed.email, role: parsed.role, consent: true })
        }
        const response = await fetch(`${apiBaseUrl}/api/concierge/conversation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: parsed.leadId, sessionToken: parsed.sessionToken }),
          cache: 'no-store',
        })
        if (response.status === 401) {
          window.localStorage.removeItem(leadStorageKey)
          if (active) {
            setLead(null)
            setError('Please confirm your details to start a new concierge session.')
            setView('lead')
          }
          return
        }
        if (!response.ok) throw new Error(await responseError(response))
        const data = await response.json() as { messages?: ChatMessage[] }
        if (!Array.isArray(data.messages)) throw new Error('Your saved conversation returned an invalid response.')
        if (active) {
          setMessages(data.messages)
          setView('chat')
        }
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Your saved conversation could not be loaded.')
        setView('lead')
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, view])

  function changeDetails() {
    if (lead) {
      setForm({ name: lead.name, phone: lead.phone, email: lead.email, role: lead.role, consent: true })
      setEditingLead(true)
      setView('lead')
      setError('')
    }
    setShowMenu(false)
  }

  async function loadConversation(savedLead: SavedLead) {
    const response = await fetch(`${apiBaseUrl}/api/concierge/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: savedLead.leadId, sessionToken: savedLead.sessionToken }),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(await responseError(response))
    const result = await response.json() as { messages?: ChatMessage[] }
    if (!Array.isArray(result.messages)) throw new Error('The saved conversation returned an invalid response.')
    setMessages(result.messages)
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/concierge/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingLead && lead ? { leadId: lead.leadId, sessionToken: lead.sessionToken } : {}),
          name: form.name,
          phone: form.phone,
          email: form.email,
          role: form.role,
          sourcePage,
          consent: form.consent,
        }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const saved: unknown = await response.json()
      if (!isSavedLead(saved)) throw new Error('The concierge returned an invalid lead confirmation.')
      setLead(saved)
      setEditingLead(false)
      try {
        window.localStorage.setItem(leadStorageKey, JSON.stringify(saved))
      } catch (storageError) {
        console.error('[thoa] Could not cache the saved lead in local storage', storageError)
        setError('Your details were saved, but this browser could not remember them for your next visit.')
      }
      await loadConversation(saved)
      setView('chat')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your details could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(text: string) {
    if (!lead || busy || !text.trim()) return
    const cleanText = text.trim()
    setDraft('')
    setBusy(true)
    setTyping(true)
    setError('')
    const waiting = new Promise<void>((resolve) => window.setTimeout(resolve, 500))
    try {
      const [response] = await Promise.all([
        fetch(`${apiBaseUrl}/api/concierge/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: lead.leadId, sessionToken: lead.sessionToken, text: cleanText }),
        }),
        waiting,
      ])
      if (!response.ok) throw new Error(await responseError(response))
      const result = await response.json() as { userMessage?: ChatMessage; assistantMessage?: ChatMessage }
      if (!result.userMessage || !result.assistantMessage) throw new Error('The concierge returned an invalid message response.')
      setMessages((current) => [...current, result.userMessage!, result.assistantMessage!])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'THOA could not reply right now. Please try again.')
      setDraft(cleanText)
    } finally {
      setTyping(false)
      setBusy(false)
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(draft)
    }
  }

  const hasAsked = messages.some((message) => message.sender === 'USER')
  const showStarters = !hasAsked

  return portalRoot ? createPortal((
    <section className="kalaa-drawer" role="dialog" aria-modal="false" aria-labelledby="thoa-title">
      <header className="kalaa-header">
        <span className="kalaa-header-icon"><MessageCircle size={19} aria-hidden="true" /></span>
        <div className="kalaa-header-copy">
          <p>THOA · YOUR FRIENDLY ART GUIDE · ONLINE</p>
          <h2 id="thoa-title">THOA</h2>
        </div>
        <div className="kalaa-header-actions">
          {view === 'chat' && (
            <div className="kalaa-menu-wrap">
              <button type="button" className="kalaa-icon-button" aria-label="THOA options" aria-expanded={showMenu} onClick={() => setShowMenu((open) => !open)}>
                <MoreHorizontal size={19} />
              </button>
              {showMenu && <div className="kalaa-menu">
                <button type="button" onClick={changeDetails}>Change Details</button>
                <button type="button" onClick={() => { setShowMenu(false); onReplayIntro() }}>Replay 3D Welcome</button>
              </div>}
            </div>
          )}
          <button type="button" className="kalaa-icon-button" aria-label="Close THOA chat" onClick={onClose}><X size={19} /></button>
        </div>
      </header>

      {view === 'loading' ? (
        <div className="kalaa-loading"><LoaderCircle size={22} className="kalaa-spinner" /> Loading your conversation…</div>
      ) : view === 'lead' ? (
        <div className="kalaa-intro">
          <p className="kalaa-greeting">Namaste! I’m THOA, your friendly guide at The Haat of Art. Share a few quick details so I can help and send event/stall updates:</p>
          <form className="kalaa-lead-form" onSubmit={submitLead}>
            <label>Full Name<input required minLength={2} maxLength={160} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Mobile / WhatsApp Number
              <span className="kalaa-phone-field"><span>+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[6-9][0-9]{9}" title="Enter a valid 10-digit Indian mobile number." value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 10) })} /></span>
            </label>
            <label>Email Address<input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>I am joining as:
              <select value={form.role} onChange={(event) => setForm({ ...form, role: roleOptions.find((option) => option.value === event.target.value)?.value ?? 'ARTIST_EXHIBITOR' })}>
                {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="kalaa-consent"><input required type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>I agree to receive event and stall updates. See our <Link href="/privacy-policy">Privacy Policy</Link>.</span></label>
            {error && <p className="kalaa-error" role="alert">{error}</p>}
            <button type="submit" className="kalaa-submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="kalaa-spinner" /> Saving securely…</> : editingLead ? 'Update Details & Continue' : 'Save Details & Start Chat'}<ArrowRight size={16} aria-hidden="true" /></button>
            {editingLead && <button type="button" className="kalaa-cancel-edit" onClick={() => { setEditingLead(false); setView('chat'); setError('') }}>Cancel</button>}
          </form>
        </div>
      ) : (
        <>
          <div className="kalaa-log" ref={logRef} role="log" aria-live="polite" aria-label="THOA conversation">
            {!hasAsked && <div className="kalaa-step-intro"><Sparkles size={15} aria-hidden="true" /> Your details are saved. Choose a topic to explore step-by-step.</div>}
            {messages.map((message) => (
              <article className={`kalaa-message ${message.sender === 'USER' ? 'is-user' : 'is-assistant'}`} key={message.id}>
                {message.sender === 'ASSISTANT' && <span className="kalaa-message-name">THOA</span>}
                <p>{message.text}</p>
                {savedActions(message).length > 0 && <div className="kalaa-actions">
                  {savedActions(message).map((action) => (
                    isExternalHref(action.href)
                      ? <a key={`${message.id}-${action.href}`} href={action.href} {...externalLinkProps(action.href)}>{action.label}<ArrowRight size={13} aria-hidden="true" /></a>
                      : <Link key={`${message.id}-${action.href}`} href={action.href} onClick={onClose}>{action.label}<ArrowRight size={13} aria-hidden="true" /></Link>
                  ))}
                </div>}
              </article>
            ))}
            {typing && <div className="kalaa-typing" aria-label="THOA is typing"><span /><span /><span /></div>}
          </div>
          {showStarters && <div className="kalaa-starters" aria-label="Suggested questions">
            {starterQuestions.map((question) => <button key={question} type="button" disabled={busy} onClick={() => void sendMessage(question)}>{question}</button>)}
          </div>}
          {error && <p className="kalaa-chat-error" role="alert">{error}</p>}
          <form className="kalaa-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft) }}>
            <textarea aria-label="Ask THOA a question" placeholder="Ask THOA anything in English or Hinglish..." rows={1} maxLength={1200} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">{busy ? <LoaderCircle size={17} className="kalaa-spinner" /> : <Send size={17} />}</button>
          </form>
        </>
      )}

      <footer className="kalaa-footer">
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">Talk to Human Team on WhatsApp <ArrowRight size={14} aria-hidden="true" /></a>
      </footer>
    </section>
  ), portalRoot) : null
}
