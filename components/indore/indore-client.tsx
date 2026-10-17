'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Clock, MapPin, Users } from 'lucide-react'
import { indoreEvent, indoreForm, indoreInfo } from '@/lib/demo-indore'

const pad = (n: number) => String(Math.max(0, n)).padStart(2, '0')

function Countdown() {
  const [left, setLeft] = useState<number | null>(null)
  useEffect(() => {
    const target = new Date(indoreEvent.startsAt).getTime()
    const tick = () => setLeft(Math.max(0, target - Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])
  const s = Math.floor((left ?? 0) / 1000)
  const parts = [['Days', Math.floor(s / 86400)], ['Hours', Math.floor(s / 3600) % 24], ['Minutes', Math.floor(s / 60) % 60], ['Seconds', s % 60]] as const
  return <div className="in-count" aria-label="Countdown to the event">{parts.map(([label, v]) => <div key={label}><b>{left === null ? '--' : pad(v)}</b><span>{label}</span></div>)}</div>
}

export function IndoreHero() {
  const e = indoreEvent
  return (
    <section className="in-hero" style={{ backgroundImage: `linear-gradient(90deg, #0f1a33 0, #0f1a33 34%, rgba(15,26,51,.55) 58%, rgba(15,26,51,.05)), url(${e.heroImage})` }}>
      <div className="in-hero-copy">
        <p className="th-eyebrow">{e.eyebrow}</p>
        <h1>{e.title}<br /><em>{e.accent}</em></h1>
        <p className="in-hero-text">{e.text}</p>
        <Countdown />
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

export function PassForm() {
  const f = indoreForm
  const [msg, setMsg] = useState('')
  function submit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setMsg('Demo only: the form is valid, but registration and email OTP are not connected yet, so nothing was saved or sent.')
  }
  return (
    <form className="in-form" id="register" onSubmit={submit}>
      <h2>{f.title} <em>{f.accent}</em></h2>
      <p>{f.subtitle}</p>
      <div className="in-grid">
        <label>Full Name *<input required name="name" placeholder="Enter your full name" autoComplete="name" /></label>
        <label>Email Address *<input required type="email" name="email" placeholder="Enter your email" autoComplete="email" /></label>
        <label>Mobile Number *<input required type="tel" name="phone" placeholder="Enter your mobile number" autoComplete="tel" pattern="[0-9+ ]{10,14}" /></label>
        <label>City *<select required name="city" defaultValue=""><option value="" disabled>Select city</option>{f.cities.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="in-wide">Are you attending as? *<select required name="as" defaultValue=""><option value="" disabled>Select option</option>{f.attendingAs.map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <label className="in-check"><input type="checkbox" name="consent" defaultChecked /> <span>{f.consent}</span></label>
      <button className="in-submit" type="submit">{f.button} <ArrowRight size={15} /></button>
      <small>{f.note}</small>
      {msg && <p className="in-msg" role="status">{msg}</p>}
    </form>
  )
}

export function UpdatesForm() {
  const u = indoreInfo.updates
  const [msg, setMsg] = useState('')
  return (
    <div className="in-card in-updates">
      <h3>{u.title}</h3>
      <p>{u.text}</p>
      <form onSubmit={(e) => { e.preventDefault(); setMsg('Demo only: subscriptions are not connected yet.') }}>
        <input required type="email" placeholder="Enter your email address" aria-label="Email address" />
        <button type="submit">{u.button}</button>
      </form>
      {msg && <small role="status">{msg}</small>}
    </div>
  )
}

export function EventDetails() {
  const d = indoreInfo.details
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
