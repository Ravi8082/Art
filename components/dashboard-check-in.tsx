'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Camera, CheckCircle2, CircleAlert, QrCode, ScanLine, ShieldCheck, Square } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type ScanResult = { attendee: { name: string; email: string; event: string }; checkedInAt: string }
type StaffEvent = { id: string; title: string; city: string; startsAt: string }
type Attendee = { registrationId: string; fullName: string; email: string; eventId: string; eventTitle: string; city: string; startsAt: string; registeredAt: string; checkedInAt: string | null }
type Barcode = { rawValue: string }
type BarcodeDetectorLike = { detect(source: HTMLVideoElement): Promise<Barcode[]> }
type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => BarcodeDetectorLike

export function DashboardCheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const inFlight = useRef(false)
  const [scanActive, setScanActive] = useState(false)
  const [token, setToken] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [scannerMessage, setScannerMessage] = useState('')
  const [staffEvents, setStaffEvents] = useState<StaffEvent[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [eventFilter, setEventFilter] = useState('')
  const [attendeeQuery, setAttendeeQuery] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)

  const checkIn = useCallback(async (rawToken: string) => {
    if (inFlight.current || !rawToken.trim()) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const response = await fetch(`${apiBase}/api/passes/check-in`, {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ token: rawToken.trim() }),
      })
      const data = await response.json() as ScanResult & { error?: string }
      if (!response.ok) throw new Error(data.error || `Check-in failed (${response.status})`)
      setResult(data)
      setToken('')
      setScanActive(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check in this pass.')
      setScanActive(false)
    } finally {
      setBusy(false)
      inFlight.current = false
    }
  }, [])

  async function searchAttendees(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLookupLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (eventFilter) params.set('eventId', eventFilter)
      if (attendeeQuery.trim()) params.set('q', attendeeQuery.trim())
      const response = await fetch(`${apiBase}/api/passes/attendees?${params}`, {
        credentials: 'include',
        headers: { accept: 'application/json' },
      })
      const data = await response.json() as { error?: string; events?: StaffEvent[]; attendees?: Attendee[] }
      if (!response.ok) throw new Error(data.error || `Search failed (${response.status})`)
      setStaffEvents(data.events ?? [])
      setAttendees(data.attendees ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not search event attendees.')
    } finally {
      setLookupLoading(false)
    }
  }

  useEffect(() => {
    if (!scanActive) return
    let stream: MediaStream | undefined
    let frameId = 0
    let disposed = false
    const detectorConstructor = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!detectorConstructor || !navigator.mediaDevices?.getUserMedia) {
      setScannerMessage('Camera QR scanning is not supported here. Enter the pass code below instead.')
      return () => { disposed = true }
    }
    setScannerMessage('Starting camera…')
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        const video = videoRef.current
        if (!video) throw new Error('Camera preview is unavailable. Try manual pass entry.')
        video.srcObject = stream
        await video.play()
        const detector = new detectorConstructor({ formats: ['qr_code'] })
        setScannerMessage('Point the camera at the visitor’s QR pass.')
        const scanFrame = async () => {
          if (disposed) return
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) {
              await checkIn(codes[0].rawValue)
              return
            }
          } catch {
            setScannerMessage('Unable to read the QR code. Adjust the camera or enter the code manually.')
          }
          if (!disposed) frameId = requestAnimationFrame(() => { void scanFrame() })
        }
        frameId = requestAnimationFrame(() => { void scanFrame() })
      } catch (cause) {
        if (!disposed) setScannerMessage(cause instanceof Error ? cause.message : 'Camera access failed. Enter the pass code below.')
      }
    })()
    return () => {
      disposed = true
      cancelAnimationFrame(frameId)
      stream?.getTracks().forEach((track) => track.stop())
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [scanActive, checkIn])

  return (
    <main className="role-access-page">
      <header className="role-access-header">
        <Link href="/dashboard" className="role-access-back"><ArrowLeft size={15} /> Staff dashboard</Link>
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span className="role-access-secure"><ShieldCheck size={14} /> Event check-in</span>
      </header>
      <div className="role-access-content check-in-content">
        <div className="role-access-title"><span className="role-access-icon"><ScanLine size={22} /></span><div><p className="role-eyebrow">Registration desk</p><h1>Scan visitor pass</h1><p>Scan the visitor’s QR code or enter the pass code to validate and record event entry.</p></div></div>
        {error && <p className="role-error" role="alert"><CircleAlert size={15} /> {error}</p>}
        {result && <section className="check-in-success" role="status"><CheckCircle2 size={26} /><div><p className="role-eyebrow">Entry confirmed</p><h2>{result.attendee.name}</h2><p>{result.attendee.email}</p><strong>{result.attendee.event}</strong></div></section>}
        <section className="check-in-panel">
          <div className="visitor-section-heading"><div><p className="role-eyebrow">Secure validation</p><h2>QR pass scanner</h2></div><QrCode size={20} /></div>
          {scanActive && <div className="check-in-camera"><video ref={videoRef} muted playsInline aria-label="Live QR scanner camera" /><p>{scannerMessage}</p></div>}
          {!scanActive && scannerMessage && <p className="check-in-hint">{scannerMessage}</p>}
          <div className="check-in-actions">
            <button className="role-save-button" type="button" onClick={() => { setError(''); setResult(null); setScannerMessage(''); setScanActive((active) => !active) }} disabled={busy}>
              {scanActive ? <><Square size={15} /> Stop camera</> : <><Camera size={15} /> Open camera</>}
            </button>
            <span>or enter pass code</span>
          </div>
          <form className="check-in-form" onSubmit={(event) => { event.preventDefault(); void checkIn(token) }}>
            <label htmlFor="pass-token">Visitor pass code</label>
            <div><input id="pass-token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste QR pass contents" autoComplete="off" required /><button className="role-save-button" disabled={busy || !token.trim()}>{busy ? 'Checking…' : 'Check in'}</button></div>
          </form>
          <p className="check-in-privacy"><ShieldCheck size={14} /> A successful pass can only be used for check-in once. Invalid and previously used passes are rejected.</p>
        </section>
        <section className="check-in-panel attendee-lookup-panel">
          <div className="visitor-section-heading"><div><p className="role-eyebrow">Registration desk</p><h2>Attendee lookup</h2></div></div>
          <form className="attendee-search-form" onSubmit={searchAttendees}>
            <label>Exhibition<select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}><option value="">All recent exhibitions</option>{staffEvents.map((item) => <option key={item.id} value={item.id}>{item.title}{item.city ? ` · ${item.city}` : ''}</option>)}</select></label>
            <label>Visitor name or email<input value={attendeeQuery} onChange={(event) => setAttendeeQuery(event.target.value)} placeholder="Search registered attendees" maxLength={120} /></label>
            <button className="role-save-button" disabled={lookupLoading}>{lookupLoading ? 'Searching…' : 'Find attendees'}</button>
          </form>
          {attendees.length > 0 && <div className="attendee-result-list">{attendees.map((attendee) => <article className="attendee-result" key={attendee.registrationId}>
            <span className={`visitor-pass-status ${attendee.checkedInAt ? 'active' : ''}`}>{attendee.checkedInAt ? 'Checked in' : 'Registered'}</span>
            <div><strong>{attendee.fullName}</strong><small>{attendee.email}</small></div>
            <div><strong>{attendee.eventTitle}</strong><small>{[attendee.city, new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(attendee.startsAt))].filter(Boolean).join(' · ')}</small></div>
          </article>)}</div>}
          {!lookupLoading && staffEvents.length > 0 && attendees.length === 0 && <p className="role-access-empty">No matching registrations. Search by visitor name or email.</p>}
        </section>
      </div>
    </main>
  )
}
