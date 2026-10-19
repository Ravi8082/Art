'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, QrCode, Users } from 'lucide-react'
import { indoreEvent, indoreForm, indoreInfo } from '@/lib/demo-indore'
import type { IndoreView } from '@/lib/indore-live'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

function Countdown({ startsAt }: { startsAt: string }) {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    const target = new Date(startsAt).getTime()
    const tick = () => setLeft(Math.max(0, target - Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [startsAt])
  const s = Math.floor((left ?? 0) / 1000)
  const parts = [['Days', Math.floor(s / 86400)], ['Hours', Math.floor(s / 3600) % 24], ['Minutes', Math.floor(s / 60) % 60], ['Seconds', s % 60]] as const
  return <div className="in-count" aria-label="Countdown to the event">{parts.map(([label, v]) => <div key={label}><b>{left === null ? '--' : pad(v)}</b><span>{label}</span></div>)}</div>
}

export function IndoreHero({ view }: { view?: IndoreView } = {}) {
  const e = view?.event ?? indoreEvent
  return (
    <section className="in-hero" style={{ backgroundImage: `linear-gradient(90deg, #0f1a33 0, #0f1a33 34%, rgba(15,26,51,.55) 58%, rgba(15,26,51,.05)), url(${e.heroImage})` }}>
      <div className="in-hero-copy">
        <p className="th-eyebrow">{e.eyebrow}</p>
        <h1>{e.title}<br /><em>{e.accent}</em></h1>
        <p className="in-hero-text">{e.text}</p>
        <Countdown startsAt={e.startsAt} />
        <div className="in-hero-actions">
          <Link className="th-btn th-btn-lg" href={e.ctas.stall.href}>{e.ctas.stall.label} <ArrowRight size={14} /></Link>
          <a className="th-btn-white th-btn-lg" href={e.ctas.visitor.href}>{e.ctas.visitor.label}</a>
        </div>
        <ul className="in-meta">
          <li><CalendarDays size={16} />{e.dates}</li>
          <li><MapPin size={16} />{e.venue}</li>
          <li><Users size={16} />{e.timing}<span className="in-free">{e.badge}</span></li>
        </ul>
      </div>
    </section>
  )
}

export function PassForm({ eventSlug }: { eventSlug?: string } = {}) {
  const passBase = eventSlug ? `events/${encodeURIComponent(eventSlug)}` : 'indore'
  const f = indoreForm
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')
  const [pass, setPass] = useState<{ passId: string; qrData: string; eventTitle: string; emailSent: boolean; message: string } | null>(null)
  const [qrImage, setQrImage] = useState('')

  useEffect(() => {
    if (!pass) return
    let active = true
    void QRCode.toDataURL(pass.qrData, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
      .then((image) => { if (active) setQrImage(image) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not generate the pass QR code.')
      })
    return () => { active = false }
  }, [pass])

  async function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(ev.currentTarget)
    try {
      const response = await fetch(`${apiBase}/api/passes/public/${passBase}/register`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: String(form.get('name') ?? '').trim(),
          email: String(form.get('email') ?? '').trim().toLowerCase(),
          phone: String(form.get('phone') ?? '').trim(),
          city: String(form.get('city') ?? ''),
          attendingAs: String(form.get('as') ?? ''),
          marketingConsent: form.get('consent') === 'on',
        }),
      })
      const data = await response.json() as { error?: string; email?: string; message?: string }
      if (!response.ok) throw new Error(data.error || `Could not request a pass (${response.status}).`)
      if (!data.email) throw new Error('The verification request returned no email address.')
      setOtpEmail(data.email)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request your entry pass.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(ev.currentTarget)
    try {
      const response = await fetch(`${apiBase}/api/passes/public/${passBase}/verify`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, code: String(form.get('code') ?? '') }),
      })
      const data = await response.json() as {
        error?: string
        message?: string
        pass?: { passId: string; qrData: string; eventTitle: string }
        emailSent?: boolean
      }
      if (!response.ok) throw new Error(data.error || `Could not verify your email (${response.status}).`)
      if (!data.pass?.passId || !data.pass.qrData || !data.pass.eventTitle || !data.message) {
        throw new Error('The server response did not include a valid entry pass.')
      }
      setPass({
        ...data.pass,
        emailSent: data.emailSent === true,
        message: data.message,
      })
      setOtpEmail('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify your email.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="in-form" id="register">
      <h2>{f.title} <em>{f.accent}</em></h2>
      {pass ? (
        <div className="in-pass-confirmation" role="status">
          <CheckCircle2 size={30} />
          <h3>Your free entry pass is ready</h3>
          <p>{pass.eventTitle}</p>
          <div className="in-pass-qr">{qrImage ? <img src={qrImage} alt={`Entry QR pass for ${pass.eventTitle}`} /> : <span>Preparing your QR code…</span>}</div>
          {error && <p className="in-msg" role="alert">{error}</p>}
          <p>{pass.message}</p>
          <div className="in-pass-actions">
            {qrImage && <a className="in-submit" href={qrImage} download={`haat-of-art-pass-${pass.passId}.png`}><QrCode size={15} /> Download QR pass</a>}
            <Link href={`/visitor/pass/${encodeURIComponent(pass.qrData)}`} target="_blank">View pass details</Link>
            <Link href="/visitor/register">Create account to view passes in dashboard</Link>
          </div>
        </div>
      ) : otpEmail ? (
        <form onSubmit={verifyCode}>
          <p>A 6-digit verification code was sent to <strong>{otpEmail}</strong>. Verify your email to generate your entry pass.</p>
          <label>Verification code *<input required name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} /></label>
          {error && <p className="in-msg" role="alert">{error}</p>}
          <button className="in-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify & get pass'} <ArrowRight size={15} /></button>
          <button className="in-pass-back" type="button" onClick={() => { setOtpEmail(''); setError('') }} disabled={busy}>Change registration details</button>
        </form>
      ) : (
        <form onSubmit={submit}>
          <p>{f.subtitle}</p>
          <div className="in-grid">
            <label>Full Name *<input required name="name" minLength={2} maxLength={160} placeholder="Enter your full name" autoComplete="name" /></label>
            <label>Email Address *<input required type="email" name="email" maxLength={255} placeholder="Enter your email" autoComplete="email" /></label>
            <label>Mobile Number *<input required type="tel" name="phone" placeholder="Enter your mobile number" autoComplete="tel" pattern="[0-9+ ]{10,14}" /></label>
            <label>City *{eventSlug
              ? <input required name="city" maxLength={120} placeholder="Enter your city" autoComplete="address-level2" />
              : <select required name="city" defaultValue=""><option value="" disabled>Select city</option>{f.cities.map((c) => <option key={c}>{c}</option>)}</select>}</label>
            <label className="in-wide">Are you attending as? *<select required name="as" defaultValue=""><option value="" disabled>Select option</option>{f.attendingAs.map((c) => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label className="in-check"><input type="checkbox" name="consent" defaultChecked /> <span>{f.consent}</span></label>
          {error && <p className="in-msg" role="alert">{error}</p>}
          <button className="in-submit" type="submit" disabled={busy}>{busy ? 'Sending verification code…' : f.button} <ArrowRight size={15} /></button>
          <small>{f.note}</small>
        </form>
      )}
    </section>
  )
}

export function UpdatesForm() {
  const u = indoreInfo.updates
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  async function subscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const email = String(new FormData(form).get('email') ?? '').trim()
    setBusy(true); setMsg('')
    try {
      const res = await fetch(`${apiBase}/api/newsletter/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many attempts. Please try again later.' : 'Please enter a valid email address.')
      setOk(true); setMsg(data.message ?? 'Thank you for subscribing!'); form.reset()
    } catch (error) {
      setOk(false); setMsg(error instanceof Error ? error.message : 'Could not subscribe right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="in-card in-updates">
      <h3>{u.title}</h3>
      <p>{u.text}</p>
      <form onSubmit={subscribe}>
        <input required name="email" type="email" maxLength={255} placeholder="Enter your email address" aria-label="Email address" />
        <button type="submit" disabled={busy}>{busy ? 'Subscribing…' : u.button}</button>
      </form>
      {msg && <small role={ok ? 'status' : 'alert'}>{msg}</small>}
    </div>
  )
}

export function EventDetails({ view }: { view?: IndoreView } = {}) {
  const d = (view?.info ?? indoreInfo).details
  return (
    <div className="in-card in-details">
      <h3>{d.title}</h3>
      <ul>
        <li><CalendarDays size={18} />{d.dates}</li>
        <li><Clock size={18} />{d.timing}</li>
        <li className="in-green"><Users size={18} />{d.entry}</li>
      </ul>
    </div>
  )
}
