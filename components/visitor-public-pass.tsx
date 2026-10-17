'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Clock3, MapPin, ShieldCheck, TicketCheck } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type PublicPass = {
  attendee: string
  event: string
  city: string | null
  venue: string | null
  startsAt: string
  endsAt: string
  status: 'Valid' | 'Checked in' | 'Expired' | 'Cancelled' | 'Revoked'
  checkedInAt: string | null
}

function isPublicPass(value: unknown): value is PublicPass {
  if (!value || typeof value !== 'object') return false
  const pass = value as Record<string, unknown>
  return typeof pass.attendee === 'string'
    && typeof pass.event === 'string'
    && typeof pass.startsAt === 'string'
    && typeof pass.endsAt === 'string'
    && typeof pass.status === 'string'
    && ['Valid', 'Checked in', 'Expired', 'Cancelled', 'Revoked'].includes(pass.status)
    && (pass.city === null || typeof pass.city === 'string')
    && (pass.venue === null || typeof pass.venue === 'string')
    && (pass.checkedInAt === null || typeof pass.checkedInAt === 'string')
}

function dateTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function VisitorPublicPass({ token }: { token: string }) {
  const [pass, setPass] = useState<PublicPass | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void fetch(`${apiBase}/api/passes/public/${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    }).then(async (response) => {
      const data: unknown = await response.json()
      if (!response.ok) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'This visitor pass could not be found.'
        throw new Error(message)
      }
      if (!isPublicPass(data)) throw new Error('The pass details could not be verified.')
      setPass(data)
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load visitor pass details.')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [token])

  const status = pass?.status ?? ''
  const valid = status === 'Valid' || status === 'Checked in'

  return (
    <main className="visitor-public-page">
      <header className="visitor-public-header">
        <Link href="/" className="visitor-public-brand"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span><ShieldCheck size={15} /> Secure visitor pass</span>
      </header>
      <section className="visitor-public-card" aria-live="polite">
        <div className={`visitor-public-mark ${valid ? 'valid' : ''}`}>
          {loading ? <span className="role-spinner" /> : valid ? <CheckCircle2 size={28} /> : <TicketCheck size={28} />}
        </div>
        <p className="role-eyebrow">The Haat of Art · Exhibition entry</p>
        <h1>{loading ? 'Checking pass…' : error ? 'Pass details unavailable' : pass?.event}</h1>
        {error
          ? <p className="visitor-public-error" role="alert">{error}</p>
          : loading
            ? <p className="visitor-public-intro">Please wait while we verify this QR pass.</p>
            : pass && <>
              <span className={`visitor-public-status ${valid ? 'valid' : ''}`}>{pass.status}</span>
              <dl className="visitor-public-details">
                <div><dt>Visitor</dt><dd>{pass.attendee}</dd></div>
                <div><dt><CalendarDays size={14} /> Exhibition time</dt><dd>{dateTimeLabel(pass.startsAt)} – {dateTimeLabel(pass.endsAt)}</dd></div>
                <div><dt><MapPin size={14} /> Venue</dt><dd>{[pass.venue, pass.city].filter(Boolean).join(' · ') || 'Venue to be announced'}</dd></div>
                {pass.checkedInAt && <div><dt><Clock3 size={14} /> Check-in</dt><dd>{dateTimeLabel(pass.checkedInAt)}</dd></div>}
              </dl>
              <p className="visitor-public-notice">This page shows pass information only. Entry is confirmed by event staff using the website check-in scanner.</p>
            </>}
        <Link href="/" className="visitor-public-home">Visit The Haat of Art</Link>
      </section>
    </main>
  )
}
