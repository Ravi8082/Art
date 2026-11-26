'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { ArrowRight, CalendarDays, CheckCircle2, Clock, MapPin, QrCode, TicketCheck, Users } from 'lucide-react'
import { indoreForm } from '@/lib/demo-indore'
import { formatEventDates, resolveIndoreView, splitPlaces, type IndoreView, type LiveEvent } from '@/lib/indore-live'
import { PICK_EVENT } from '@/components/indore/upcoming-exhibitions'
import styles from '@/components/visitor-pass-booking.module.css'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const fallbackPassConfig: NonNullable<LiveEvent['passConfig']> = {
  passMode: 'BOTH',
  freeCapacity: null,
  freeRemaining: null,
  paidPrice: 499,
  paidCapacity: null,
  paidRemaining: null,
  freePerks: ['3-day exhibition access', 'Live art demonstrations', 'Artist gallery walkthroughs'],
  paidPerks: ['Priority fast-track entry', 'Opening-day collector preview access', 'Printed exhibition catalog', 'Reserved workshop seat'],
}

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
  return <div className="in-count" aria-label="Countdown to the event">{parts.map(([label, value]) => <div key={label}><b>{left === null ? '--' : pad(value)}</b><span>{label}</span></div>)}</div>
}

function eventCity(event: Pick<LiveEvent, 'city' | 'state' | 'title'>) {
  const city = event.city.toLowerCase()
  if (city.includes('pan india') || event.title.toLowerCase().includes('tour')) return 'Pan-India Tour'
  return splitPlaces(event.city)[0] || splitPlaces(event.state)[0] || 'India'
}

function cleanOptionText(value: string) {
  return value
    .replace(/\$\{[^{}]*\}|\{[^{}]*\}/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*[·–-]\s*$/, '')
    .trim()
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function dayInputValue(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function eventVisitDays(startsAt: string, endsAt: string) {
  const firstDay = dayInputValue(startsAt)
  const lastDay = dayInputValue(endsAt)
  const first = Date.parse(`${firstDay}T00:00:00Z`)
  const last = Date.parse(`${lastDay}T00:00:00Z`)
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return []
  const days: string[] = []
  for (let timestamp = first; timestamp <= last; timestamp += 86_400_000) {
    days.push(new Date(timestamp).toISOString().slice(0, 10))
  }
  return days
}

function visitDayLabel(day: string) {
  const date = new Date(`${day}T12:00:00Z`)
  const dateLabel = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short' }).format(date)
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(date)
  return `${dateLabel} · ${weekday}`
}

function eventLocation(event: LiveEvent) {
  const state = splitPlaces(event.state)[0] || 'India'
  const city = splitPlaces(event.city)[0] || eventCity(event)
  return `${state} · ${city}`
}

type FinderPlace = { key: string; label: string; state: string; city: string }

const quickFinderPlaces: FinderPlace[] = [
  { key: 'karnataka|bengaluru', label: 'Karnataka · Bengaluru', state: 'Karnataka', city: 'Bengaluru' },
  { key: 'maharashtra|mumbai', label: 'Maharashtra · Mumbai', state: 'Maharashtra', city: 'Mumbai' },
  { key: 'delhi|delhi', label: 'Delhi', state: 'Delhi', city: 'Delhi' },
  { key: 'madhya pradesh|indore', label: 'Madhya Pradesh · Indore', state: 'Madhya Pradesh', city: 'Indore' },
  { key: 'rajasthan|jaipur', label: 'Rajasthan · Jaipur', state: 'Rajasthan', city: 'Jaipur' },
]

const indianStatesAndTerritories = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
]

const cityStateNames: Record<string, string> = {
  ahmedabad: 'Gujarat',
  bengaluru: 'Karnataka',
  delhi: 'Delhi',
  hyderabad: 'Telangana',
  indore: 'Madhya Pradesh',
  jaipur: 'Rajasthan',
  mumbai: 'Maharashtra',
  pune: 'Maharashtra',
}

function normalizedPlace(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
}

function finderPlaceKey(state: string, city: string) {
  return `${normalizedPlace(state)}|${normalizedPlace(city)}`
}

function isSpecificPlace(value: string) {
  return Boolean(value) && !/^(india|pan india|multiple states|multiple cities|multiple exhibition venues)$/i.test(value.trim())
}

function isMultiCityTour(event: LiveEvent) {
  return /pan.?india|multi.?city|tour/i.test(`${event.title} ${event.city}`)
    || splitPlaces(event.city).length > 1
}

function getFinderPlaces(events: LiveEvent[]) {
  const places = [...quickFinderPlaces]
  const seen = new Set(places.map(({ key }) => key))
  const addPlace = (state: string, city: string) => {
    const key = finderPlaceKey(state, city)
    if (seen.has(key)) return
    seen.add(key)
    places.push({
      key,
      label: state && city ? `${state} · ${city}` : state ? `State · ${state}` : `City · ${city}`,
      state,
      city,
    })
  }

  indianStatesAndTerritories.forEach((state) => addPlace(state, ''))
  for (const event of events) {
    const states = splitPlaces(event.state).filter(isSpecificPlace)
    const cities = splitPlaces(event.city).filter(isSpecificPlace)
    if (states.length === 1) {
      cities.forEach((city) => addPlace(states[0], city))
    } else {
      for (const city of cities) addPlace(cityStateNames[normalizedPlace(city)] ?? '', city)
      if (!cities.length) states.forEach((state) => addPlace(state, ''))
    }
  }
  return places
}

function matchesFinderPlace(event: LiveEvent, place: FinderPlace) {
  const states = splitPlaces(event.state).map(normalizedPlace)
  const cities = splitPlaces(event.city).map(normalizedPlace)
  const stateMatches = !place.state || states.includes(normalizedPlace(place.state))
  const cityMatches = !place.city || cities.includes(normalizedPlace(place.city))
  return place.state && place.city
    ? cityMatches && (stateMatches || isMultiCityTour(event))
    : place.city ? cityMatches : stateMatches
}

function locationForFinderPlace(event: LiveEvent, place: FinderPlace) {
  if (place.state && place.city) return `${place.state} · ${place.city}`
  if (place.city) {
    const state = cityStateNames[normalizedPlace(place.city)] || splitPlaces(event.state)[0] || 'India'
    return `${state} · ${place.city}`
  }
  return eventLocation(event)
}

export function IndoreHero({ events, initialEventSlug }: { events: LiveEvent[]; initialEventSlug: string }) {
  const [selectedSlug, setSelectedSlug] = useState(initialEventSlug || events[0]?.slug || '')
  const [selectedPlaceKey, setSelectedPlaceKey] = useState('')
  const finderPlaces = useMemo(() => getFinderPlaces(events), [events])
  const selectedEvent = events.find((event) => event.slug === selectedSlug) ?? events[0] ?? null
  const selectedPlace = finderPlaces.find((place) => place.key === selectedPlaceKey) ?? null
  const matchingEvents = selectedPlace ? events.filter((event) => matchesFinderPlace(event, selectedPlace)) : []
  const tourEvent = events.find(isMultiCityTour)
  const view = resolveIndoreView(selectedEvent)
  useEffect(() => {
    const nextSlug = initialEventSlug || events[0]?.slug || ''
    if (!events.some((event) => event.slug === selectedSlug)) setSelectedSlug(nextSlug)
  }, [events, initialEventSlug, selectedSlug])
  useEffect(() => {
    const onPick = (picked: Event) => {
      const { slug } = (picked as CustomEvent<{ slug?: string }>).detail
      if (slug && events.some((event) => event.slug === slug)) setSelectedSlug(slug)
    }
    window.addEventListener(PICK_EVENT, onPick)
    return () => window.removeEventListener(PICK_EVENT, onPick)
  }, [events])

  const e = view?.event
  const title = e
    ? e.title.toLowerCase().includes('the haat of art')
      ? e.title
      : `The Haat of Art — ${e.title}`
    : 'Plan your next art exhibition visit'
  const city = e ? eventCity(e) : ''
  const kicker = city ? `THE HAAT OF ART · ${city.toUpperCase()} EDITION` : 'THE HAAT OF ART · VISITOR PASSES'
  const heroImage = '/media/hero-exhibition.jpg'
  const selectEdition = (event: LiveEvent, place?: FinderPlace) => {
    setSelectedSlug(event.slug)
    window.dispatchEvent(new CustomEvent(PICK_EVENT, {
      detail: { slug: event.slug, location: place ? locationForFinderPlace(event, place) : eventLocation(event) },
    }))
  }
  const openPassForm = (event: LiveEvent, place: FinderPlace) => {
    selectEdition(event, place)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    document.getElementById('register')?.scrollIntoView({ behavior, block: 'start' })
  }
  return (
    <section className="in-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(20,16,13,.92) 0%, rgba(20,16,13,.72) 48%, rgba(20,16,13,.3) 100%), url(${heroImage})` }}>
      <div className="in-hero-copy">
        <p className="th-eyebrow">{kicker}</p>
        <h1>{title}</h1>
        {e ? (
          <>
            <p className="in-hero-text">Three days of curated contemporary paintings, folk traditions, live workshops, and direct artist interactions in {city}.</p>
            <Countdown startsAt={e.startsAt} />
            <div className="in-hero-actions">
              <a className="th-btn th-btn-lg" href="#register">Get Visitor Pass <ArrowRight size={14} /></a>
              <Link className="th-btn-white th-btn-lg" href="/book-your-stall">Book Your Stall</Link>
            </div>
            <ul className="in-meta">
              <li><CalendarDays size={16} />{e.dates}</li>
              <li><MapPin size={16} />{e.venue}</li>
              <li><Clock size={16} />{e.timing}<span className="in-free">Visitor Passes Available</span></li>
            </ul>
          </>
        ) : (
          <>
            <p className="in-hero-text">Upcoming exhibition dates will appear here as soon as they are published. Explore the exhibition calendar or check back soon for visitor-pass registration.</p>
            <div className="in-hero-actions">
              <Link className="th-btn th-btn-lg" href="/exhibitions">Explore Exhibitions <ArrowRight size={14} /></Link>
              <a className="th-btn-white th-btn-lg" href="#upcoming">Upcoming Shows</a>
            </div>
          </>
        )}
        {events.length > 0 && (
          <nav className="in-hero-editions" aria-label="Select an upcoming exhibition edition">
            <div className="in-hero-editions-heading">
              <span>Upcoming editions</span>
              <small>{events.length} {events.length === 1 ? 'edition' : 'editions'}</small>
            </div>
            <div className="in-hero-edition-list">
              {events.map((event, index) => {
                const active = event.slug === selectedEvent?.slug
                const badge = isMultiCityTour(event) ? 'Multi-City Tour' : index === 0 ? 'Nearest' : 'Upcoming'
                return (
                  <button
                    className={`in-hero-edition-tab${active ? ' is-active' : ''}`}
                    type="button"
                    key={event.slug}
                    aria-pressed={active}
                    onClick={() => selectEdition(event)}
                  >
                    <span className="in-hero-edition-place">{eventCity(event)}</span>
                    <span className="in-hero-edition-date">{formatEventDates(event.startsAt, event.endsAt)}</span>
                    <span className={`in-hero-edition-badge${badge === 'Nearest' ? ' is-nearest' : ''}`}>{badge}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        )}
        <section className="in-hero-finder" aria-labelledby="in-hero-finder-title">
          <div className="in-hero-quick-places" aria-label="Popular exhibition locations">
            {quickFinderPlaces.map((place) => (
              <button
                type="button"
                key={place.key}
                className={selectedPlaceKey === place.key ? 'is-selected' : ''}
                aria-pressed={selectedPlaceKey === place.key}
                onClick={() => setSelectedPlaceKey(place.key)}
              >
                {place.label}
              </button>
            ))}
          </div>
          <div className="in-hero-finder-heading">
            <p id="in-hero-finder-title">Find Your State or City</p>
            <label>
              <span className="in-sr-only">Choose a state or city</span>
              <select value={selectedPlaceKey} onChange={(event) => setSelectedPlaceKey(event.target.value)} aria-label="State / City">
                <option value="">State / City</option>
                {finderPlaces.map((place) => <option value={place.key} key={place.key}>{place.label}</option>)}
              </select>
            </label>
          </div>
          {selectedPlace && (
            <div className={`in-hero-availability${matchingEvents.length ? ' is-available' : ' is-unavailable'}`} aria-live="polite">
              <div className="in-hero-availability-heading">
                <strong>{selectedPlace.label}</strong>
                <span>{matchingEvents.length ? 'Published dates available' : 'Upcoming Dates'}</span>
              </div>
              {matchingEvents.length ? (
                <>
                  {matchingEvents.slice(0, 3).map((event) => (
                    <article className="in-hero-availability-event" key={event.slug}>
                      <div>
                        <strong>{event.title}</strong>
                        <span><CalendarDays size={13} />{formatEventDates(event.startsAt, event.endsAt)}</span>
                        <span><MapPin size={13} />{event.venue || 'Venue to be announced'}</span>
                      </div>
                      <button type="button" onClick={() => openPassForm(event, selectedPlace)}>
                        Select Edition &amp; Get Pass <ArrowRight size={14} />
                      </button>
                    </article>
                  ))}
                  {matchingEvents.length > 3 && <small className="in-hero-desktop-more">{matchingEvents.length - 3} more matching editions are available in the switcher above.</small>}
                </>
              ) : (
                <div className="in-hero-availability-empty">
                  <p>No published dates currently cover {selectedPlace.label}.</p>
                  {tourEvent && <small>Next listed: {cleanOptionText(eventCity(tourEvent))} · {formatEventDates(tourEvent.startsAt, tourEvent.endsAt)}. See its confirmed stops in Upcoming Editions.</small>}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}

type AdminDraft = {
  passMode: 'FREE' | 'PAID' | 'BOTH'
  freeCapacity: string
  paidPrice: string
  paidCapacity: string
  freePerks: string
  paidPerks: string
}

type DigitalPass = {
  passId: string
  passCode: string
  qrData: string
  eventSlug: string
  eventTitle: string
  startsAt: string
  endsAt: string
  city: string
  state: string
  venue: string
  passTier: 'FREE' | 'PAID'
  paymentStatus: 'NOT_REQUIRED' | 'PENDING' | 'PAID'
  amount: number
  quantity: number
  preferredVisitDay: string
}

type VisitorPassRegistration = {
  fullName: string
  phone: string
  email: string
  state: string
  city: string
  passPlan: 'FREE' | 'PAID'
  preferredVisitDay: string
  quantity: number
}

type VerificationRequestResponse = {
  verificationRequired: boolean
  email: string
  message: string
}

function draftFromConfig(config: NonNullable<LiveEvent['passConfig']>): AdminDraft {
  return {
    passMode: config.passMode,
    freeCapacity: config.freeCapacity == null ? '' : String(config.freeCapacity),
    paidPrice: String(config.paidPrice),
    paidCapacity: config.paidCapacity == null ? '' : String(config.paidCapacity),
    freePerks: config.freePerks.join('\n'),
    paidPerks: config.paidPerks.join('\n'),
  }
}

function configFromDraft(draft: AdminDraft, base: NonNullable<LiveEvent['passConfig']>) {
  const capacity = (value: string) => value.trim() === '' ? null : Number(value)
  return {
    ...base,
    passMode: draft.passMode,
    freeCapacity: capacity(draft.freeCapacity),
    paidPrice: Number(draft.paidPrice),
    paidCapacity: capacity(draft.paidCapacity),
    freePerks: draft.freePerks.split('\n').map((item) => item.trim()).filter(Boolean),
    paidPerks: draft.paidPerks.split('\n').map((item) => item.trim()).filter(Boolean),
  }
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/)
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > maxWidth) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = next
    }
  }
  if (line) ctx.fillText(line, x, y)
  return y + lineHeight
}

async function makePassCard(pass: DigitalPass) {
  const qrDataUrl = await QRCode.toDataURL(pass.qrData, { errorCorrectionLevel: 'M', margin: 1, width: 280 })
  const qr = new Image()
  qr.src = qrDataUrl
  await new Promise<void>((resolve, reject) => {
    qr.onload = () => resolve()
    qr.onerror = () => reject(new Error('Could not render the QR code image.'))
  })
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 720
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare the digital pass card.')
  ctx.fillStyle = '#FAF7F2'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#D8CFC4'
  ctx.lineWidth = 3
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
  ctx.fillStyle = '#C04A2B'
  ctx.fillRect(0, 0, 16, canvas.height)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#C04A2B'
  ctx.font = '700 22px Arial'
  ctx.fillText('THE HAAT OF ART', 72, 76)
  ctx.fillStyle = '#1A1614'
  ctx.font = '700 42px Georgia'
  let y = drawText(ctx, pass.eventTitle, 72, 142, 680, 54)
  ctx.fillStyle = '#72685E'
  ctx.font = '500 22px Arial'
  y = drawText(ctx, [pass.venue, pass.city].filter(Boolean).join(' · '), 72, y + 4, 670, 34)
  ctx.fillStyle = '#1A1614'
  ctx.font = '700 30px Arial'
  ctx.fillText(pass.passCode, 72, y + 18)
  ctx.fillStyle = pass.passTier === 'FREE' ? '#3C774F' : '#C04A2B'
  ctx.font = '700 20px Arial'
  ctx.fillText(pass.passTier === 'FREE' ? 'FREE ENTRY' : 'VIP RESERVATION · PAYMENT PENDING', 72, y + 62)
  ctx.fillStyle = '#72685E'
  ctx.font = '500 20px Arial'
  ctx.fillText(`Visit day: ${displayDate(pass.preferredVisitDay)}`, 72, y + 106)
  ctx.fillText(`Number of passes: ${pass.quantity}`, 72, y + 144)
  ctx.fillText(`Exhibition dates: ${formatEventDates(pass.startsAt, pass.endsAt)}`, 72, y + 182)
  ctx.fillStyle = '#A63D25'
  ctx.font = '600 17px Arial'
  drawText(ctx, pass.paymentStatus === 'PENDING'
    ? 'Payment collection is not enabled yet. This reservation QR is not valid for entry until payment is confirmed.'
    : 'Present this QR code at the exhibition entrance.', 72, y + 234, 690, 28)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(850, 196, 286, 286)
  ctx.drawImage(qr, 856, 202, 274, 274)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#72685E'
  ctx.font = '500 16px Arial'
  ctx.fillText('DIGITAL VISITOR PASS', 993, 518)
  return { qrDataUrl, cardDataUrl: canvas.toDataURL('image/png') }
}

export function CityQuickSwitch({ events, nearestSlug }: { events: LiveEvent[]; nearestSlug: string }) {
  if (!events.length) return null
  const nearest = events.find((event) => event.slug === nearestSlug) ?? events[0]
  const indore = events.find((event) =>
    !/pan.?india|tour/i.test(`${event.city} ${event.title}`)
    && /indore/i.test(`${event.city} ${event.state} ${event.title}`),
  )
  const tour = events.find((event) => /pan.?india|tour/i.test(`${event.city} ${event.title}`))
  const items: { event: LiveEvent; label: string; location?: string }[] = [{
    event: nearest,
    label: `Next Nearest: ${eventCity(nearest)} (${formatEventDates(nearest.startsAt, nearest.endsAt)})`,
  }]
  if (indore && indore.slug !== nearest.slug) {
    items.push({ event: indore, label: 'Indore Edition' })
  }
  if (tour && tour.slug !== nearest.slug) {
    items.push({ event: tour, label: `All India Tour (${formatEventDates(tour.startsAt, tour.endsAt)})` })
  }
  const selected = new Set(items.map(({ event }) => event.slug))
  for (const event of events) {
    if (items.length >= 4 || selected.has(event.slug)) continue
    items.push({ event, label: `${eventCity(event)} · ${formatEventDates(event.startsAt, event.endsAt)}` })
    selected.add(event.slug)
  }
  const pick = (event: LiveEvent, location?: string) => {
    window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: { slug: event.slug, state: splitPlaces(event.state)[0] ?? '', location: location || eventLocation(event) } }))
    document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <nav className="in-city-switch" aria-label="Choose an exhibition city">
      <span>Choose an edition</span>
      <div>{items.map(({ event, label, location }) => <button type="button" key={`${event.slug}-${label}`} onClick={() => pick(event, location)}>{label}</button>)}</div>
    </nav>
  )
}

export function VisitorSteps() {
  return (
    <section className="in-steps" aria-label="How visitor passes work">
      <div><span>Step 01</span><MapPin size={19} /><strong>Choose Your Exhibition &amp; City</strong></div>
      <div><span>Step 02</span><TicketCheck size={19} /><strong>Select Free Entry or VIP Pass</strong></div>
      <div><span>Step 03</span><QrCode size={19} /><strong>Get Instant QR Pass on Screen &amp; Email</strong></div>
    </section>
  )
}

export function PassForm({ events, initialEventSlug = '', experience = 'standard' }: { events: LiveEvent[]; initialEventSlug?: string; experience?: 'standard' | 'detail' }) {
  const [selectedSlug, setSelectedSlug] = useState(initialEventSlug || events[0]?.slug || '')
  const selectedEvent = events.find((event) => event.slug === selectedSlug) ?? null
  const [visitDay, setVisitDay] = useState(selectedEvent ? dayInputValue(selectedEvent.startsAt) : '')
  const [locationValue, setLocationValue] = useState(selectedEvent ? eventLocation(selectedEvent) : '')
  const isDetailExperience = experience === 'detail'
  const visitDays = selectedEvent ? eventVisitDays(selectedEvent.startsAt, selectedEvent.endsAt) : []
  const baseConfig = selectedEvent?.passConfig ?? fallbackPassConfig
  const [passPlan, setPassPlan] = useState<'FREE' | 'PAID'>(baseConfig.passMode === 'PAID' ? 'PAID' : 'FREE')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pass, setPass] = useState<(DigitalPass & { message: string; emailSent: boolean }) | null>(null)
  const [pendingRegistration, setPendingRegistration] = useState<VisitorPassRegistration | null>(null)
  const [registrationDraft, setRegistrationDraft] = useState<VisitorPassRegistration | null>(null)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')
  const [resendAfter, setResendAfter] = useState(0)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [qrImage, setQrImage] = useState('')
  const [cardImage, setCardImage] = useState('')
  const [adminAllowed, setAdminAllowed] = useState(false)
  const [adminPreviewRequested, setAdminPreviewRequested] = useState(false)
  const [adminDraft, setAdminDraft] = useState<AdminDraft>(draftFromConfig(baseConfig))
  const [adminDirty, setAdminDirty] = useState(false)
  const [adminBusy, setAdminBusy] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')

  useEffect(() => {
    setAdminPreviewRequested(new URLSearchParams(window.location.search).get('adminPreview') === '1')
  }, [])

  useEffect(() => {
    const onPick = (event: Event) => {
      const { slug, location } = (event as CustomEvent<{ slug: string; location?: string }>).detail
      const selected = events.find((item) => item.slug === slug)
      if (selected) {
        setSelectedSlug(slug)
        setLocationValue(location || eventLocation(selected))
        setVisitDay(dayInputValue(selected.startsAt))
        setPass(null)
        setPendingRegistration(null)
        setVerificationEmail('')
        setVerificationCode('')
        setVerificationMessage('')
        setError('')
      }
    }
    window.addEventListener(PICK_EVENT, onPick)
    return () => window.removeEventListener(PICK_EVENT, onPick)
  }, [events])

  useEffect(() => {
    const slug = initialEventSlug || events[0]?.slug || ''
    setSelectedSlug(slug)
    const initialEvent = events.find((event) => event.slug === slug)
    if (initialEvent) {
      setLocationValue(eventLocation(initialEvent))
      setVisitDay(dayInputValue(initialEvent.startsAt))
    }
  }, [initialEventSlug, events])

  useEffect(() => {
    if (!selectedEvent || !adminPreviewRequested) return
    setPassPlan(selectedEvent.passConfig?.passMode === 'PAID' ? 'PAID' : 'FREE')
    setAdminAllowed(false)
    setAdminDirty(false)
    setAdminMessage('')
    let active = true
    void fetch(`${apiBase}/api/exhibitions/${encodeURIComponent(selectedEvent.slug)}/passes/admin`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
    }).then(async (response) => {
      if (response.status === 401 || response.status === 403) return null
      const data = await response.json() as { error?: string; config?: NonNullable<LiveEvent['passConfig']> }
      if (!response.ok) throw new Error(data.error || 'Could not load pass settings.')
      return data
    }).then((data) => {
      if (!active || !data?.config) return
      setAdminAllowed(true)
      setAdminDraft(draftFromConfig(data.config))
    }).catch((cause: unknown) => {
      if (active) {
        console.error('Could not load admin visitor-pass settings', cause)
        setAdminMessage(cause instanceof Error ? cause.message : 'Could not load pass settings.')
      }
    })
    return () => { active = false }
  }, [selectedEvent?.slug, adminPreviewRequested])

  useEffect(() => {
    if (!pass) return
    let active = true
    void makePassCard(pass)
      .then(({ qrDataUrl, cardDataUrl }) => {
        if (active) {
          setQrImage(qrDataUrl)
          setCardImage(cardDataUrl)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not generate the digital pass card.')
      })
    return () => { active = false }
  }, [pass])

  useEffect(() => {
    if (!resendAfter) {
      setResendSeconds(0)
      return
    }
    const updateCountdown = () => setResendSeconds(Math.max(0, Math.ceil((resendAfter - Date.now()) / 1000)))
    updateCountdown()
    const timer = window.setInterval(updateCountdown, 1000)
    return () => window.clearInterval(timer)
  }, [resendAfter])

  const config = adminAllowed ? configFromDraft(adminDraft, baseConfig) : baseConfig
  const freeAvailable = config.freeRemaining !== 0
  const paidAvailable = config.paidRemaining !== 0
  const freeEnabled = config.passMode !== 'PAID' && freeAvailable
  const paidEnabled = config.passMode !== 'FREE' && paidAvailable

  useEffect(() => {
    if (passPlan === 'FREE' && !freeEnabled && paidEnabled) setPassPlan('PAID')
    if (passPlan === 'PAID' && !paidEnabled && freeEnabled) setPassPlan('FREE')
  }, [passPlan, freeEnabled, paidEnabled])

  async function savePassConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEvent) return
    setAdminBusy(true)
    setAdminMessage('')
    const configInput = configFromDraft(adminDraft, baseConfig)
    try {
      const response = await fetch(`${apiBase}/api/exhibitions/${encodeURIComponent(selectedEvent.slug)}/passes`, {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(configInput),
      })
      const data = await response.json() as { error?: string; config?: NonNullable<LiveEvent['passConfig']> }
      if (!response.ok) throw new Error(data.error || `Could not save pass settings (${response.status}).`)
      if (!data.config) throw new Error('The saved pass settings were not returned by the server.')
      setAdminDraft(draftFromConfig(data.config))
      setAdminDirty(false)
      setPassPlan(data.config.passMode === 'PAID' ? 'PAID' : 'FREE')
      setAdminMessage('Pass settings saved for this exhibition.')
    } catch (cause) {
      setAdminMessage(cause instanceof Error ? cause.message : 'Could not save pass settings.')
    } finally {
      setAdminBusy(false)
    }
  }

  async function requestVerificationCode(registration: VisitorPassRegistration) {
    if (!selectedEvent) throw new Error('Choose an exhibition before requesting a visitor pass.')
    const response = await fetch(`${apiBase}/api/passes/public/events/${encodeURIComponent(selectedEvent.slug)}/register`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(registration),
    })
    const data = await response.json() as Partial<VerificationRequestResponse> & { error?: string }
    if (!response.ok) throw new Error(data.error || `Could not send your verification code (${response.status}).`)
    if (data.verificationRequired !== true || !data.message) {
      throw new Error('The server did not confirm that an email verification code was sent.')
    }
    setPendingRegistration(registration)
    setRegistrationDraft(registration)
    setVerificationEmail(data.email || registration.email)
    setVerificationCode('')
    setVerificationMessage(data.message)
    setResendAfter(Date.now() + 60_000)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    if (!selectedEvent) return
    if (adminDirty) {
      setError('Save the pass settings before testing a registration.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (pendingRegistration) {
        const response = await fetch(`${apiBase}/api/passes/public/events/${encodeURIComponent(selectedEvent.slug)}/verify`, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ email: verificationEmail, code: verificationCode.trim() }),
        })
        const data = await response.json() as {
          error?: string
          message?: string
          emailSent?: boolean
          pass?: DigitalPass
        }
        if (!response.ok) throw new Error(data.error || `Could not verify your email (${response.status}).`)
        if (!data.pass?.passId || !data.pass.passCode || !data.pass.qrData || !data.message) {
          throw new Error('The server response did not contain a complete verified visitor pass.')
        }
        setPass({ ...data.pass, message: data.message, emailSent: data.emailSent === true })
        setPendingRegistration(null)
        setVerificationEmail('')
        setVerificationCode('')
        setVerificationMessage('')
        formElement.reset()
      } else {
        setPass(null)
        const form = new FormData(formElement)
        const placeParts = String(form.get('location') ?? '').split(/[·,]/).map((part) => part.trim()).filter(Boolean)
        const state = placeParts.length > 1 ? placeParts[0] : splitPlaces(selectedEvent.state)[0] || 'Madhya Pradesh'
        const city = placeParts.length > 1 ? placeParts.slice(1).join(' · ') : placeParts[0] || eventCity(selectedEvent)
        const registration: VisitorPassRegistration = {
          fullName: String(form.get('fullName') ?? '').trim(),
          phone: String(form.get('phone') ?? '').trim(),
          email: String(form.get('email') ?? '').trim().toLowerCase(),
          state,
          city,
          passPlan,
          preferredVisitDay: String(form.get('visitDay') ?? ''),
          quantity: Number(form.get('quantity') ?? 1),
        }
        await requestVerificationCode(registration)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete visitor pass registration.')
    } finally {
      setBusy(false)
    }
  }

  async function resendVerificationCode() {
    if (!pendingRegistration || resendSeconds > 0) return
    setBusy(true)
    setError('')
    try {
      await requestVerificationCode(pendingRegistration)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend your verification code.')
    } finally {
      setBusy(false)
    }
  }

  const f = indoreForm
  return (
    <section className={`in-form${isDetailExperience ? ' in-pass-detail' : ''}`} id="register" aria-labelledby="visitor-form-title">
      <div className="in-form-heading">
        <div><p className="th-eyebrow">Visitor registration</p><h2 id="visitor-form-title">Choose Your Pass</h2></div>
        {selectedEvent && <span className="in-event-date-pill">{eventCity(selectedEvent)} · {formatEventDates(selectedEvent.startsAt, selectedEvent.endsAt)}</span>}
      </div>
      {adminAllowed && selectedEvent && (
        <details className="in-admin-config">
          <summary>Admin Pass Mode Preview (Free / Paid / Both)</summary>
          <form onSubmit={savePassConfig}>
            <label>Pass mode<select value={adminDraft.passMode} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, passMode: event.target.value as AdminDraft['passMode'] })); setAdminDirty(true) }}>
              <option value="FREE">Free passes only</option><option value="PAID">Paid passes only</option><option value="BOTH">Free &amp; paid passes</option>
            </select></label>
            <label>Free pass capacity<input type="number" min="0" max="1000000" placeholder="Unlimited" value={adminDraft.freeCapacity} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, freeCapacity: event.target.value })); setAdminDirty(true) }} /></label>
            <label>VIP price (INR)<input type="number" min="0" step="1" value={adminDraft.paidPrice} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, paidPrice: event.target.value })); setAdminDirty(true) }} /></label>
            <label>VIP pass capacity<input type="number" min="0" max="1000000" placeholder="Unlimited" value={adminDraft.paidCapacity} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, paidCapacity: event.target.value })); setAdminDirty(true) }} /></label>
            <label>Free pass benefits<textarea rows={3} value={adminDraft.freePerks} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, freePerks: event.target.value })); setAdminDirty(true) }} /></label>
            <label>VIP pass benefits<textarea rows={3} value={adminDraft.paidPerks} onChange={(event) => { setAdminDraft((draft) => ({ ...draft, paidPerks: event.target.value })); setAdminDirty(true) }} /></label>
            {adminMessage && <p className="in-msg" role="status">{adminMessage}</p>}
            <button className="in-submit" type="submit" disabled={adminBusy}>{adminBusy ? 'Saving…' : 'Save Pass Settings'}</button>
            {adminDirty && <small>Preview changes must be saved before a registration can be submitted.</small>}
          </form>
        </details>
      )}
      {pass ? (
        <div className="in-pass-confirmation" role="status">
          <CheckCircle2 size={30} />
          <h3>{pass.passTier === 'FREE' ? 'Your free visitor pass is ready' : 'Your VIP reservation QR is ready'}</h3>
          <p>{pass.eventTitle}</p>
          <div className="in-digital-pass">
            <div className="in-pass-qr">{qrImage ? <img src={qrImage} alt={`QR visitor pass ${pass.passCode}`} /> : <span>Preparing your QR code…</span>}</div>
            <div className="in-digital-pass-copy">
              <span className={`in-pass-tier ${pass.passTier === 'FREE' ? 'is-free' : 'is-paid'}`}>{pass.passTier === 'FREE' ? 'FREE ENTRY' : 'VIP · PAYMENT PENDING'}</span>
              <strong>{pass.passCode}</strong>
              <span>{formatEventDates(pass.startsAt, pass.endsAt)} · {displayDate(pass.preferredVisitDay)}</span>
              <span>{[pass.venue, pass.city].filter(Boolean).join(' · ')}</span>
              <span>{pass.quantity} {pass.quantity === 1 ? 'pass' : 'passes'}</span>
            </div>
          </div>
          {pass.paymentStatus === 'PENDING' && <p className="in-payment-note">Payment is not integrated yet. Your QR is a reservation only and will not admit you until payment is confirmed.</p>}
          {error && <p className="in-msg" role="alert">{error}</p>}
          <p>{pass.message}</p>
          <div className="in-pass-actions">
            {cardImage && <a className="in-submit" href={cardImage} download={`haat-of-art-${pass.passCode}.png`}><QrCode size={15} /> Download Digital Pass</a>}
            <Link href={`/visitor/pass/${encodeURIComponent(pass.qrData)}`}>View pass details</Link>
            <button className="in-pass-back" type="button" onClick={() => { setPass(null); setQrImage(''); setCardImage('') }}>Register another visitor</button>
          </div>
          {!pass.emailSent && <small>The pass was created on screen, but the confirmation email could not be sent.</small>}
        </div>
      ) : (
        <>
          <p>{f.subtitle}</p>
          {selectedEvent ? (
            <form onSubmit={submit}>
              {pendingRegistration ? (
                <div className="in-otp-stage" aria-live="polite">
                  <div className={styles.eventSummary}>
                    <span className={styles.eventSummaryLabel}>Email verification required</span>
                    <strong className={styles.eventSummaryTitle}>{selectedEvent.title}</strong>
                  </div>
                  <p>A 6-digit code was sent to <strong>{verificationEmail}</strong>. Verify it to issue your QR visitor pass.</p>
                  {verificationMessage && <p className="in-msg" role="status">{verificationMessage}</p>}
                  <label>Email verification code *
                    <input
                      required
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={verificationCode}
                      onChange={(inputEvent) => setVerificationCode(inputEvent.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit code"
                    />
                  </label>
                  {error && <p className="in-msg" role="alert">{error}</p>}
                  <button className="in-submit" type="submit" disabled={busy || verificationCode.length !== 6}>
                    {busy ? 'Verifying your email…' : 'Verify Email & Get Pass'} <ArrowRight size={15} />
                  </button>
                  <button className="in-pass-back" type="button" disabled={busy || resendSeconds > 0} onClick={() => void resendVerificationCode()}>
                    {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend verification code'}
                  </button>
                  <button className="in-pass-back" type="button" disabled={busy} onClick={() => {
                    setPendingRegistration(null)
                    setVerificationEmail('')
                    setVerificationCode('')
                    setVerificationMessage('')
                    setError('')
                  }}>
                    Change registration details
                  </button>
                </div>
              ) : (
                <>
              {isDetailExperience && (
                <>
                  <div className={styles.eventSummary}>
                    <span className={styles.eventSummaryLabel}>Selected Exhibition</span>
                    <strong className={styles.eventSummaryTitle}>{selectedEvent.title} · {formatEventDates(selectedEvent.startsAt, selectedEvent.endsAt)}</strong>
                  </div>
                  <input type="hidden" name="eventSlug" value={selectedSlug} />
                  <input type="hidden" name="passPlan" value={passPlan} />
                  <fieldset className={styles.tierFieldset}>
                    <legend>Choose Your Pass Plan *</legend>
                    <div className={styles.tierGrid}>
                      <button
                        type="button"
                        disabled={!freeEnabled}
                        aria-pressed={passPlan === 'FREE'}
                        className={`${styles.tierCard}${passPlan === 'FREE' ? ` ${styles.tierCardSelected}` : ''}`}
                        onClick={() => setPassPlan('FREE')}
                      >
                        <span className={styles.tierTop}>
                          <span className={styles.tierTitle}>Free General Entry</span>
                          <span className={styles.tierPrice}>₹0</span>
                        </span>
                        <ul className={styles.tierPerks}>
                          {config.freePerks.map((perk) => <li key={perk}>{perk}</li>)}
                          {!freeEnabled && <li>Currently unavailable</li>}
                        </ul>
                      </button>
                      <button
                        type="button"
                        disabled={!paidEnabled}
                        aria-pressed={passPlan === 'PAID'}
                        className={`${styles.tierCard}${passPlan === 'PAID' ? ` ${styles.tierCardSelected}` : ''}`}
                        onClick={() => setPassPlan('PAID')}
                      >
                        <span className={styles.popularBadge}>Popular</span>
                        <span className={styles.tierTop}>
                          <span className={styles.tierTitle}>VIP Collector &amp; Preview Pass</span>
                          <span className={styles.tierPrice}>₹{config.paidPrice}</span>
                        </span>
                        <ul className={styles.tierPerks}>
                          {config.paidPerks.map((perk) => <li key={perk}>{perk}</li>)}
                          {!paidEnabled && <li>Currently unavailable</li>}
                        </ul>
                      </button>
                    </div>
                  </fieldset>
                </>
              )}
              <div className={`in-grid${isDetailExperience ? ` ${styles.bookingGrid}` : ''}`}>
                {!isDetailExperience && (
                  <>
                    <label>Selected Exhibition *
                      <select name="eventSlug" value={selectedSlug} required onChange={(event) => {
                        const selected = events.find((item) => item.slug === event.target.value)
                        setSelectedSlug(event.target.value)
                        if (selected) {
                          const location = eventLocation(selected)
                          setLocationValue(location)
                          setVisitDay(dayInputValue(selected.startsAt))
                          window.dispatchEvent(new CustomEvent(PICK_EVENT, { detail: { slug: selected.slug, location } }))
                        }
                        setError('')
                        setPass(null)
                        setPendingRegistration(null)
                        setVerificationEmail('')
                        setVerificationCode('')
                        setVerificationMessage('')
                      }}>
                        {events.map((item) => <option key={item.slug} value={item.slug}>{cleanOptionText(`${eventCity(item)} · ${formatEventDates(item.startsAt, item.endsAt)}`)}</option>)}
                      </select>
                    </label>
                    <label>Pass Plan *
                      <select name="passPlan" value={passPlan} onChange={(event) => setPassPlan(event.target.value as 'FREE' | 'PAID')} required>
                        {freeEnabled && <option value="FREE">{cleanOptionText('Free General Entry · ₹0')}</option>}
                        {paidEnabled && <option value="PAID">{cleanOptionText(`VIP Collector & Preview Pass · ₹${config.paidPrice}`)}</option>}
                      </select>
                    </label>
                  </>
                )}
                <label>Full Name *<input required name="fullName" minLength={2} maxLength={160} placeholder="Enter your full name" autoComplete="name" defaultValue={registrationDraft?.fullName ?? ''} /></label>
                <label>Mobile / WhatsApp Number *<input required type="tel" name="phone" placeholder="+91 98765 43210" autoComplete="tel" pattern="[0-9+() -]{10,18}" defaultValue={registrationDraft?.phone ?? ''} /></label>
                <label>Email Address *<input required type="email" name="email" maxLength={255} placeholder="Enter your email" autoComplete="email" defaultValue={registrationDraft?.email ?? ''} /></label>
                <label>State / City *<input required name="location" maxLength={120} value={locationValue} onChange={(event) => setLocationValue(event.target.value)} placeholder="Madhya Pradesh · Indore" autoComplete="address-level2" /></label>
                {isDetailExperience ? (
                  <fieldset className={styles.dayFieldset}>
                    <legend>Choose Visit Day *</legend>
                    {visitDays.length > 0 ? (
                      <>
                        <div className={styles.dayGrid} role="group" aria-label="Choose a visit day">
                          {visitDays.map((day) => (
                            <button
                              key={day}
                              type="button"
                              aria-pressed={visitDay === day}
                              className={`${styles.dayCard}${visitDay === day ? ` ${styles.dayCardSelected}` : ''}`}
                              onClick={() => setVisitDay(day)}
                            >
                              {visitDayLabel(day)}
                            </button>
                          ))}
                        </div>
                        <input type="hidden" name="visitDay" value={visitDay} />
                      </>
                    ) : (
                      <input required name="visitDay" type="date" min={dayInputValue(selectedEvent.startsAt)} max={dayInputValue(selectedEvent.endsAt)} value={visitDay} onChange={(event) => setVisitDay(event.target.value)} />
                    )}
                  </fieldset>
                ) : (
                  <label>Visit Day *<input key={selectedEvent.slug} required name="visitDay" type="date" min={dayInputValue(selectedEvent.startsAt)} max={dayInputValue(selectedEvent.endsAt)} value={visitDay} onChange={(event) => setVisitDay(event.target.value)} /></label>
                )}
                <label>Number of Passes *<input required name="quantity" type="number" min="1" max="10" defaultValue={registrationDraft?.quantity ?? 1} /></label>
              </div>
              {!isDetailExperience && (
                <div className="in-tier-detail" aria-live="polite">
                  <strong>{passPlan === 'FREE' ? 'Free General Entry · ₹0' : `VIP Collector & Preview Pass · ₹${config.paidPrice}`}</strong>
                  <ul>{(passPlan === 'FREE' ? config.freePerks : config.paidPerks).map((perk) => <li key={perk}>{perk}</li>)}</ul>
                  {passPlan === 'PAID' && <p>Payment collection is not enabled yet. This creates a clearly marked pending-payment reservation, not an active paid entry pass.</p>}
                </div>
              )}
              {isDetailExperience && passPlan === 'PAID' && <p className="in-payment-note">Payment collection is not enabled yet. This creates a pending-payment reservation, not an active paid entry pass.</p>}
              {error && <p className="in-msg" role="alert">{error}</p>}
              <button className="in-submit" type="submit" disabled={busy || adminDirty || (!freeEnabled && !paidEnabled)}>
                {busy ? 'Sending verification code…' : 'Continue with email verification'} <ArrowRight size={15} />
              </button>
              {adminDirty && <small>Save the admin preview settings before creating a pass.</small>}
              {!freeEnabled && !paidEnabled && <small>This exhibition has reached its current pass capacity.</small>}
              <small>Your pass is generated only after verifying the email OTP.</small>
              {isDetailExperience && <div className={styles.trust}><TicketCheck size={15} aria-hidden="true" /><span>Verify your email first · QR pass shown on screen after confirmation · No additional booking fee.</span></div>}
                </>
              )}
            </form>
          ) : (
            <div className="in-no-events"><CalendarDays size={20} /><strong>No exhibitions are open for visitor registration right now.</strong><span>Check back soon or explore our exhibition calendar.</span><Link href="/exhibitions">Explore exhibitions <ArrowRight size={14} /></Link></div>
          )}
        </>
      )}
    </section>
  )
}

export function UpdatesForm() {
  const u = {
    title: 'Get updates on upcoming exhibitions',
    text: 'Be the first to hear about upcoming exhibitions, artist opportunities, and art events.',
    button: 'Subscribe',
  }
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)
  async function subscribe(e: FormEvent<HTMLFormElement>) {
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

export function EventDetails({ view }: { view: IndoreView | null }) {
  if (!view) return null
  const d = view.info.details
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
