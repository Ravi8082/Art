'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  apiBaseUrl, bookingApi, downloadInvoice, formatEventDates, formatMoney, getExhibitions, getMine, getReceipt,
  type BookingUser, type Exhibition, type MineApplication, type MyBooking, type Receipt,
} from '@/lib/booking-api'
import { PaymentStage } from './booking-payment'
import { pillLabel } from './booking-labels'

export function MyBookings({ initialUser }: { initialUser: BookingUser | null }) {
  const [user, setUser] = useState(initialUser)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [applications, setApplications] = useState<MineApplication[]>([])
  const [bookings, setBookings] = useState<MyBooking[]>([])
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([])
  const [openBooking, setOpenBooking] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const load = useCallback(async () => {
    const mine = await getMine()
    setApplications(mine.applications)
    setBookings(mine.bookings)
  }, [])

  useEffect(() => {
    bookingApi<{ user: BookingUser }>('/api/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecked(true))
    getExhibitions().then(setExhibitions).catch(() => setExhibitions([]))
  }, [])

  useEffect(() => { if (user) void load().catch(() => setError('Your bookings could not be loaded. Please sign in again.')) }, [user, load])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await bookingApi('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) })
      const me = await bookingApi<{ user: BookingUser }>('/api/auth/me')
      setUser(me.user)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed')
    } finally { setBusy(false) }
  }

  async function signOut() {
    await bookingApi('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null); setApplications([]); setBookings([]); setReceipt(null); setOpenBooking(null)
  }

  async function openReceipt(booking: MyBooking) {
    setBusy(true); setError('')
    try {
      setReceipt(await getReceipt(booking.id))
      setOpenBooking(booking.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Receipt unavailable')
    } finally { setBusy(false) }
  }

  if (checked && !user) {
    return (
      <div className="mb-page">
        <div className="mb-signin">
          <h1>Exhibitor account</h1>
          <p>Sign in with the email you used to apply, so we can show your applications, approvals and payment status.</p>
          <form onSubmit={signIn}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
            <button className="bw-btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          {error && <p className="bw-field-error" role="alert">{error}</p>}
          <p className="bw-hint">Not registered yet? <Link href="/book-your-stall">Start a stall application</Link> — you will be asked to sign in before it is submitted.</p>
        </div>
      </div>
    )
  }

  const payable = applications.find((application) => application.status === 'APPROVED' && !bookings.some((booking) => booking.applicationRef === application.applicationRef))
  const payableExhibition = payable ? exhibitions.find((entry) => entry.id === payable.eventId) ?? null : null

  return (
    <div className="mb-page">
      <header className="mb-head">
        <div>
          <p className="mb-kicker">The Haat of Art · Exhibitors</p>
          <h1>My applications &amp; bookings</h1>
          <p className="mb-email">{user?.email}</p>
        </div>
        <div className="mb-head-actions">
          <Link className="bw-btn-outline" href="/book-your-stall">Apply for another exhibition</Link>
          <button className="bw-btn-ghost" type="button" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && <p className="bw-field-error" role="alert">{error}</p>}

      <section className="mb-block">
        <h2>Exhibition applications</h2>
        {!applications.length && <p className="mb-empty">You have no applications yet. <Link href="/book-your-stall">Book a stall</Link> to get started.</p>}
        <div className="mb-list">
          {applications.map((application) => (
            <article key={application.id} className="mb-item">
              <div className="mb-item-main">
                <h3>{application.eventTitle}</h3>
                <p>{application.applicationRef}{application.requestedStallCode ? ` · requested stall ${application.requestedStallCode}` : ''} · applied {formatEventDates(application.createdAt, application.createdAt)}</p>
                {application.adminNotes && <p className="mb-notes"><strong>Note from the curation team:</strong> {application.adminNotes}</p>}
              </div>
              <span className={`bw-pill is-${application.status.toLowerCase()}`}>{pillLabel(application.status)}</span>
            </article>
          ))}
        </div>
      </section>

      {payable && payableExhibition && (
        <section className="mb-block">
          <h2>Approved — choose your stall and pay</h2>
          <p className="mb-lead">Application {payable.applicationRef} is approved. Your stall is held for a short window while you complete the payment.</p>
          <PaymentStage application={payable} exhibition={payableExhibition} mediaBase={apiBaseUrl} onChanged={load} />
        </section>
      )}

      <section className="mb-block">
        <h2>Stall bookings</h2>
        {!bookings.length && <p className="mb-empty">No stall bookings yet. A booking appears here once an approved application picks a stall.</p>}
        <div className="mb-list">
          {bookings.map((booking) => (
            <article key={booking.id} className="mb-item">
              <div className="mb-item-main">
                <h3>{booking.stallCode} · {booking.stallTypeName}</h3>
                <p>{booking.bookingRef} · {booking.eventTitle}</p>
                <p className="mb-amount">{formatMoney(booking.totalAmount)} {booking.currency}{booking.invoiceNo ? ` · invoice ${booking.invoiceNo}` : ''}</p>
              </div>
              <div className="mb-item-actions">
                <span className={`bw-pill is-${booking.status.toLowerCase()}`}>{pillLabel(booking.status)}</span>
                <button className="bw-btn-outline" type="button" disabled={busy} onClick={() => openReceipt(booking)}>
                  {booking.status === 'PAYMENT_PENDING' ? 'Payment status' : 'Receipt'}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {openBooking && receipt && (
        <section className="mb-block mb-receipt" id="receipt">
          <h2>Receipt · {receipt.invoiceNo ?? receipt.bookingRef}</h2>
          <dl className="mb-receipt-grid">
            <div><dt>Booking ID</dt><dd>{receipt.bookingRef}</dd></div>
            <div><dt>Exhibition</dt><dd>{receipt.eventTitle}</dd></div>
            <div><dt>Venue</dt><dd>{receipt.venue || receipt.eventCity || 'To be confirmed'}</dd></div>
            <div><dt>Event dates</dt><dd>{formatEventDates(receipt.eventStartsAt, receipt.eventEndsAt)}</dd></div>
            <div><dt>Stall</dt><dd>{receipt.stallCode} — {receipt.stallTypeName} ({Number(receipt.widthM)}m × {Number(receipt.depthM)}m)</dd></div>
            <div><dt>Location</dt><dd>{receipt.stallLocation || 'Main hall'}</dd></div>
            <div><dt>Stall fee</dt><dd>{formatMoney(receipt.baseAmount)}</dd></div>
            <div><dt>GST</dt><dd>{formatMoney(receipt.taxAmount)}</dd></div>
            <div className="mb-total"><dt>Total paid</dt><dd>{formatMoney(receipt.totalAmount)} {receipt.currency}</dd></div>
            <div><dt>Payment</dt><dd>{receipt.paymentMethod ?? '—'} · {receipt.paymentStatus ?? '—'}</dd></div>
            <div><dt>Transaction</dt><dd>{receipt.transactionRef ?? '—'}</dd></div>
          </dl>
          <div className="mb-receipt-actions">
            <button className="bw-btn-primary" type="button" onClick={() => downloadInvoice(receipt)}>Download Invoice</button>
            <button className="bw-btn-ghost" type="button" onClick={() => setOpenBooking(null)}>Close</button>
          </div>
        </section>
      )}
    </div>
  )
}
