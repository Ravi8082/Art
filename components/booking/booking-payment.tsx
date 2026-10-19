'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  bookingApi, downloadInvoice, formatEventDates, formatMoney, getReceipt, getStalls,
  taxRatePercent, totalWithTax, uploadApplicationMedia,
  type Exhibition, type MineApplication, type PaymentTicket, type Receipt, type Stall,
} from '@/lib/booking-api'
import { StallMap } from './booking-parts'

const paymentMethods = [
  { id: 'ONLINE', label: 'Online Payment (Razorpay / Stripe / UPI)', hint: 'Instant — the sandbox adapter settles this through a signed webhook.' },
  { id: 'UPI', label: 'UPI (QR Code)', hint: 'Scan and pay, then confirm the reference below.' },
  { id: 'BANK_TRANSFER', label: 'Bank Transfer (Manual Verification)', hint: 'Our team verifies the transfer before your stall is confirmed.' },
] as const

type Method = (typeof paymentMethods)[number]['id']
type Stage = 'select' | 'hold' | 'paying' | 'pending' | 'confirmed'

export function PaymentStage({ application, exhibition, mediaBase, onChanged }: {
  application: MineApplication
  exhibition: Exhibition
  mediaBase: string
  onChanged: () => void
}) {
  const [stalls, setStalls] = useState<Stall[]>([])
  const [loadError, setLoadError] = useState('')
  const [stallId, setStallId] = useState(application.requestedStallId ?? '')
  const [stage, setStage] = useState<Stage>('select')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<Method>('ONLINE')
  const [proof, setProof] = useState<File | null>(null)
  const [booking, setBooking] = useState<{ bookingId: string; bookingRef: string; totalAmount: number; holdExpiresAt: string } | null>(null)
  const [ticket, setTicket] = useState<PaymentTicket | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [remaining, setRemaining] = useState(0)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    getStalls(exhibition.id)
      .then((rows) => { if (!cancelled) { setStalls(rows); setLoadError('') } })
      .catch((cause: unknown) => { if (!cancelled) setLoadError(cause instanceof Error ? cause.message : 'Floor plan unavailable') })
    return () => { cancelled = true }
  }, [exhibition.id])

  useEffect(() => {
    if (!booking) return
    const deadline = new Date(booking.holdExpiresAt).getTime()
    const tick = () => setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    tick()
    poll.current = setInterval(tick, 1000)
    return () => { if (poll.current) clearInterval(poll.current) }
  }, [booking])

  const selected = useMemo(() => stalls.find((stall) => stall.id === stallId) ?? null, [stalls, stallId])

  async function confirmStall() {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const created = await bookingApi<{ bookingId: string; bookingRef: string; totalAmount: number; holdExpiresAt: string }>('/api/bookings/bookings', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ applicationId: application.id, stallId: selected.id }),
      })
      setBooking(created)
      setStage('hold')
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not hold this stall')
      setStallId('')
      await getStalls(exhibition.id).then(setStalls).catch(() => undefined)
    } finally { setBusy(false) }
  }

  async function payNow() {
    if (!booking) return
    setBusy(true); setError('')
    try {
      let proofAssetId: string | null = null
      if (method === 'BANK_TRANSFER' && proof) {
        proofAssetId = (await uploadApplicationMedia(proof, 'document', `Payment proof for ${booking.bookingRef}`)).assetId
      }
      const idempotencyKey = `web-${booking.bookingId}-${method.toLowerCase()}`
      const initiated = await bookingApi<PaymentTicket>(`/api/bookings/bookings/${booking.bookingId}/pay`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
        body: JSON.stringify({ method, paymentProofAssetId: proofAssetId }),
      })
      setTicket(initiated)
      if (!initiated.sandboxSuccessWebhook) { setStage('pending'); onChanged(); return }
      const settled = await bookingApi<{ paymentStatus: string; bookingStatus?: string; error?: string }>('/api/bookings/payments/webhook', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initiated.sandboxSuccessWebhook.body),
      })
      if (settled.paymentStatus !== 'VERIFIED') {
        setError(settled.error ?? 'The payment could not be settled. Please retry before the hold expires.')
        setStage('hold')
      } else {
        setStage('confirmed')
        setReceipt(await getReceipt(booking.bookingId))
      }
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Payment failed')
      setStage('hold')
    } finally { setBusy(false) }
  }

  async function checkVerification() {
    setBusy(true); setError('')
    try {
      const fresh = await getReceipt(booking?.bookingId ?? '')
      if (fresh.status === 'CONFIRMED') { setReceipt(fresh); setStage('confirmed') }
      else setError(`Still ${fresh.paymentStatus === 'VERIFIED' ? 'being finalised' : 'awaiting payment verification'} by our team.`)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check the payment status')
    } finally { setBusy(false) }
  }

  async function releaseHold() {
    setBusy(true); setError('')
    try {
      await bookingApi(`/api/bookings/admin/bookings/${booking?.bookingId ?? ''}/cancel`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Withdrawn by the exhibitor before payment', refund: false }),
      })
      setBooking(null); setStage('select'); onChanged()
    } catch {
      setError('This booking will release itself automatically once the hold window expires.')
    } finally { setBusy(false) }
  }

  if (stage === 'confirmed' && receipt) return <Confirmed receipt={receipt} exhibition={exhibition} />

  return (
    <div className="bw-pay">
      <div className="bw-pay-grid">
        <div className="bw-pay-main">
          {!booking && (
            <>
              <h4>Choose your stall</h4>
              <p className="bw-hint">Your application is approved. Pick any available stall — it is held for you while you pay.</p>
              {loadError && <p className="bw-field-error" role="alert">{loadError}</p>}
              <StallMap stalls={stalls} selectedId={stallId} onSelect={setStallId}
                coverUrl={exhibition.media[0] ? `${mediaBase}${exhibition.media[0].url}` : undefined} coverAlt={exhibition.title} />
              <button className="bw-btn-primary bw-confirm" type="button" disabled={!selected || busy} onClick={confirmStall}>
                {busy ? 'Holding your stall…' : 'Confirm Selection →'}
              </button>
              {error && <p className="bw-field-error" role="alert">{error}</p>}
            </>
          )}

          {booking && stage === 'hold' && (
            <>
              <div className="bw-hold">
                <p className="bw-hold-ref">Booking <strong>{booking.bookingRef}</strong></p>
                <p className={`bw-count ${remaining < 120 ? 'is-urgent' : ''}`}>
                  <ClockIcon /> Stall held for {Math.floor(remaining / 3600)}h {String(Math.floor(remaining / 60) % 60).padStart(2, '0')}m
                </p>
                <p className="bw-hint">Our team has been notified of your booking and will contact you on your phone and email to collect the payment. You can also pay below. If the hold ends without payment, the stall returns to the floor plan.</p>
              </div>
              <h4>Select Payment Method</h4>
              <div className="bw-methods">
                {paymentMethods.map((entry) => (
                  <label key={entry.id} className={`bw-method ${method === entry.id ? 'is-active' : ''}`}>
                    <input type="radio" name="bw-method" value={entry.id} checked={method === entry.id} onChange={() => setMethod(entry.id)} />
                    <span><strong>{entry.label}</strong><small>{entry.hint}</small></span>
                  </label>
                ))}
              </div>
              {method === 'BANK_TRANSFER' && (
                <label className="bw-proof">Upload payment proof (optional)
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setProof(event.currentTarget.files?.[0] ?? null)} />
                </label>
              )}
              <button className="bw-btn-primary bw-confirm" type="button" disabled={busy} onClick={payNow}>{busy ? 'Processing…' : 'Pay Now →'}</button>
              <button className="bw-btn-ghost" type="button" disabled={busy} onClick={releaseHold}>Release this hold</button>
              {error && <p className="bw-field-error" role="alert">{error}</p>}
            </>
          )}

          {booking && stage === 'pending' && (
            <div className="bw-pending">
              <h4>Payment submitted for verification</h4>
              <p>Booking <strong>{booking.bookingRef}</strong> is held while our team checks your {method === 'BANK_TRANSFER' ? 'bank transfer' : 'UPI payment'}
                {proof ? ` (proof: ${proof.name})` : ''}. Use “Check status” to see when the curation desk clears it.</p>
              {ticket && <p className="bw-hint">Reference: {ticket.transactionRef} · {formatMoney(ticket.amount)}</p>}
              {error && <p className="bw-field-error" role="alert">{error}</p>}
              <button className="bw-btn-outline" type="button" disabled={busy} onClick={checkVerification}>{busy ? 'Checking…' : 'Check status'}</button>
            </div>
          )}
        </div>

        <aside className="bw-summary">
          <h4>Payment</h4>
          <dl>
            <div><dt>Exhibition</dt><dd>{exhibition.title}</dd></div>
            <div><dt>Application</dt><dd>{application.applicationRef}</dd></div>
            {(selected || booking) && <div><dt>Stall Number</dt><dd>{(selected?.code ?? receipt?.stallCode) ?? booking?.bookingRef}</dd></div>}
            {selected && <div><dt>Stall Size</dt><dd>{Number(selected.type.widthM)}m x {Number(selected.type.depthM)}m ({Math.round(Number(selected.type.widthM) * Number(selected.type.depthM) * 100) / 100} sq m)</dd></div>}
            {selected && <div><dt>Stall Price</dt><dd>{formatMoney(selected.type.price)}</dd></div>}
            {selected && <div><dt>GST ({taxRatePercent(selected.type.taxRate)}%)</dt><dd>{formatMoney(totalWithTax(Number(selected.type.price), Number(selected.type.taxRate)).tax)}</dd></div>}
            {selected && <div className="bw-total"><dt>Total Amount</dt><dd>{formatMoney(totalWithTax(Number(selected.type.price), Number(selected.type.taxRate)).total)}</dd></div>}
          </dl>
          <p className="bw-sandbox">Payments run through a clearly-labelled sandbox adapter — no real money moves in this environment.</p>
        </aside>
      </div>
    </div>
  )
}

export function ClockIcon() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
}

function Confirmed({ receipt, exhibition }: { receipt: Receipt; exhibition: Exhibition }) {
  return (
    <div className="bw-confirmed" role="status">
      <span className="bw-tick" aria-hidden="true">✓</span>
      <h3>Booking Confirmed!</h3>
      <p>Your stall has been successfully booked for <strong>{exhibition.title}</strong>.</p>
      <div className="bw-confirmed-grid">
        <div><span>Booking ID</span><strong>{receipt.bookingRef}</strong></div>
        <div><span>Stall Number</span><strong>{receipt.stallCode} ({receipt.stallTypeName})</strong></div>
        <div><span>Event Dates</span><strong>{formatEventDates(receipt.eventStartsAt, receipt.eventEndsAt)}</strong></div>
        <div><span>Venue</span><strong>{receipt.venue || receipt.eventCity || 'To be confirmed'}</strong></div>
        <div><span>Amount Paid</span><strong>{formatMoney(receipt.totalAmount)}</strong></div>
        <div><span>Invoice</span><strong>{receipt.invoiceNo ?? 'Being generated'}</strong></div>
      </div>
      <div className="bw-confirmed-actions">
        <button className="bw-btn-outline" type="button" onClick={() => downloadInvoice(receipt)}>Download Invoice</button>
        <a className="bw-btn-primary" href="/artist/bookings">View Dashboard</a>
      </div>
      <p className="bw-hint">{receipt.confirmationEmail === 'SENT'
        ? `A confirmation email has been sent to ${receipt.accountEmail}.`
        : `This booking is saved on the exhibitor account ${receipt.accountEmail}.`}</p>
    </div>
  )
}
