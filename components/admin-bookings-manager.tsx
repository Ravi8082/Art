'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, BriefcaseBusiness, CalendarDays, Check, ExternalLink, RefreshCw, ShieldCheck, Users, Wallet } from 'lucide-react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const applicationStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const
type ApplicationStatus = (typeof applicationStatuses)[number]
type DecisionAction = 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
type BookingStatus = 'PAYMENT_PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED'
type ReviewTab = 'details' | 'portfolio' | 'stall' | 'notes'

interface ApplicationRow {
  id: string
  applicationRef: string
  status: ApplicationStatus
  firstName: string
  lastName: string
  artForm: string
  spaceCategory: string
  createdAt: string
  reviewedAt: string | null
  eventTitle: string
  eventCity: string
  email: string
  preferredStallType: string | null
}

interface ApplicationMediaItem {
  id: string
  mimeType: string
  byteSize: number
  altText: string | null
  kind: string
  sortOrder: number
  url: string
}

interface ApplicationDetail {
  id: string
  applicationRef: string
  status: ApplicationStatus
  firstName: string
  lastName: string
  phone: string
  address: string
  websiteUrl: string | null
  instagramUrl: string | null
  artForm: string
  fasciaName: string
  bio: string
  spaceCategory: string
  preferredStallTypeId: string | null
  preferredStallType: string | null
  preferredStallPrice: number | string | null
  requestedStallId: string | null
  requestedStallCode: string | null
  requestedStallLocation: string | null
  approxSizeSqm: number | string | null
  specialRequirements: string
  adminNotes: string | null
  reviewedAt: string | null
  reviewedByName: string | null
  createdAt: string
  eventTitle: string
  eventCity: string
  venue: string | null
  eventStartsAt: string
  email: string
  emailVerifiedAt: string | null
  media: ApplicationMediaItem[]
}

interface BookingRow {
  id: string
  bookingRef: string
  status: BookingStatus
  totalAmount: number | string
  currency: string
  createdAt: string
  applicationRef: string
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  stallType?: string | null
  holdExpiresAt?: string | null
  eventTitle: string
  stallCode: string
  paymentId: string | null
  paymentStatus: string | null
  paymentMethod: string | null
  transactionRef: string | null
  paidAmount: number | string | null
  paymentProofAssetId: string | null
  paymentProofMime: string | null
  invoiceNo: string | null
}

interface ExhibitionOption {
  id: string
  title: string
  city: string
  venue: string | null
  startsAt: string
  endsAt: string
  availableStalls: number
  totalStalls: number
  registrationOpen: boolean
}

interface VerifyResult {
  id: string
  paymentStatus: string
  bookingId: string
  bookingStatus: string
  invoiceNo: string
}

interface CancelResult {
  bookingId: string
  status: BookingStatus
}

interface ReceiptResponse {
  bookingRef?: string | null
  booking_ref?: string | null
  status?: string | null
  baseAmount?: number | string | null
  base_amount?: number | string | null
  taxAmount?: number | string | null
  tax_amount?: number | string | null
  totalAmount?: number | string | null
  total_amount?: number | string | null
  currency?: string | null
  eventTitle?: string | null
  eventCity?: string | null
  venue?: string | null
  eventStartsAt?: string | null
  eventEndsAt?: string | null
  stallCode?: string | null
  stallLocation?: string | null
  stallTypeName?: string | null
  widthM?: number | string | null
  depthM?: number | string | null
  invoiceNo?: string | null
  invoiceIssuedAt?: string | null
  transactionRef?: string | null
  paymentMethod?: string | null
  paymentStatus?: string | null
  paymentVerifiedAt?: string | null
  applicationRef?: string | null
  firstName?: string | null
  first_name?: string | null
  lastName?: string | null
  last_name?: string | null
  email?: string | null
  accountEmail?: string | null
  createdAt?: string | null
  created_at?: string | null
}

interface ReceiptView {
  bookingRef: string
  status: string
  baseAmount: string
  taxAmount: string
  totalAmount: string
  eventTitle: string
  eventCity: string
  venue: string
  schedule: string
  stall: string
  invoiceNo: string
  invoiceIssuedAt: string
  transactionRef: string
  paymentMethod: string
  paymentStatus: string
  paymentVerifiedAt: string
  applicant: string
  email: string
  applicationRef: string
  createdAt: string
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

async function readError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status})`
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

function text(value: string | number | null | undefined) {
  if (value === null || value === undefined) return ''
  const rendered = String(value).trim()
  return rendered === 'null' ? '' : rendered
}

function money(value: number | string | null | undefined) {
  const amount = Number(value)
  return Number.isFinite(amount) ? inr.format(amount) : '—'
}

function shortDate(value: string | null | undefined) {
  const raw = text(value)
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function longDate(value: string | null | undefined) {
  const raw = text(value)
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return `${shortDate(raw)}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

function dayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function titleCase(value: string | null | undefined) {
  const raw = text(value)
  if (!raw) return ''
  return raw.toLowerCase().replace(/_/g, ' ').replace(/(^|[\s/-])([a-z])/g, (_match, lead: string, letter: string) => lead + letter.toUpperCase())
}

const proofExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

function sizeLabel(width: number | string | null | undefined, depth: number | string | null | undefined) {
  const w = Number(width)
  const d = Number(depth)
  if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) return ''
  return `${w}m x ${d}m`
}

function hasNumber(value: number | string | null | undefined) {
  return value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value))
}

function byteLabel(value: number) {
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return ''
  return size >= 1_048_576 ? `${(size / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`
}

function initialsOf(first: string, last: string) {
  const initials = `${text(first).slice(0, 1)}${text(last).slice(0, 1)}`
  return initials.toUpperCase() || '—'
}

const statusLabels: Record<string, string> = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes Requested',
  REJECTED: 'Rejected',
  PAYMENT_PENDING: 'Payment Pending',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  REFUND_PENDING: 'Refund Pending',
  REFUNDED: 'Refunded',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
}

const statusTones: Record<string, string> = {
  SUBMITTED: 'is-amber',
  UNDER_REVIEW: 'is-amber',
  APPROVED: 'is-green',
  CHANGES_REQUESTED: 'is-orange',
  REJECTED: 'is-red',
  PAYMENT_PENDING: 'is-amber',
  CONFIRMED: 'is-green',
  CANCELLED: 'is-red',
  EXPIRED: 'is-red',
  REFUND_PENDING: 'is-orange',
  REFUNDED: 'is-slate',
  PENDING: 'is-amber',
  VERIFIED: 'is-green',
  FAILED: 'is-red',
}

function Pill({ status, label }: { status: string | null | undefined; label?: string }) {
  const key = text(status).toUpperCase()
  const tone = statusTones[key] ?? 'is-slate'
  return <span className={`abm-pill ${tone}`}>{label || statusLabels[key] || titleCase(key) || '—'}</span>
}

function bookingBadge(row: BookingRow) {
  if (row.status === 'CONFIRMED') return { label: 'Paid', status: 'APPROVED' }
  if (row.status === 'PAYMENT_PENDING') return { label: 'Pending', status: 'PAYMENT_PENDING' }
  return { label: statusLabels[row.status] ?? titleCase(row.status), status: row.status }
}

function normalizeReceipt(input: ReceiptResponse): ReceiptView {
  const scheduleFrom = text(input.eventStartsAt)
  const scheduleTo = text(input.eventEndsAt)
  const schedule = scheduleFrom || scheduleTo
    ? `${shortDate(scheduleFrom) || '—'} → ${shortDate(scheduleTo) || '—'}`
    : ''
  const stall = [text(input.stallCode), text(input.stallLocation), text(input.stallTypeName), sizeLabel(input.widthM, input.depthM)]
    .filter(Boolean)
    .join(' · ')
  const amount = (value: number | string | null | undefined) => (Number.isFinite(Number(value)) ? money(value) : '')
  return {
    bookingRef: text(input.bookingRef) || text(input.booking_ref),
    status: text(input.status),
    baseAmount: amount(input.baseAmount ?? input.base_amount),
    taxAmount: amount(input.taxAmount ?? input.tax_amount),
    totalAmount: amount(input.totalAmount ?? input.total_amount),
    eventTitle: text(input.eventTitle),
    eventCity: text(input.eventCity),
    venue: text(input.venue),
    schedule,
    stall,
    invoiceNo: text(input.invoiceNo),
    invoiceIssuedAt: shortDate(input.invoiceIssuedAt),
    transactionRef: text(input.transactionRef),
    paymentMethod: titleCase(text(input.paymentMethod)),
    paymentStatus: text(input.paymentStatus),
    paymentVerifiedAt: shortDate(input.paymentVerifiedAt),
    applicant: [text(input.firstName) || text(input.first_name), text(input.lastName) || text(input.last_name)].filter(Boolean).join(' '),
    email: text(input.email) || text(input.accountEmail),
    applicationRef: text(input.applicationRef),
    createdAt: shortDate(input.createdAt ?? input.created_at),
  }
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  const isEmpty = typeof value === 'string' && value.trim() === ''
  return (
    <div className="abm-field">
      <span className="abm-field-label">{label}</span>
      <span className="abm-field-colon" aria-hidden="true">:</span>
      <span className="abm-field-value">{isEmpty || value === null || value === undefined ? '—' : value}</span>
    </div>
  )
}

function useAuthBlobUrl(path: string | null) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!path) { setUrl(''); setFailed(false); return }
    let objectUrl = ''
    let active = true
    setUrl('')
    setFailed(false)
    // Media is cookie-protected, so an <img src> cannot authenticate; fetch the bytes and use an object URL.
    void (async () => {
      try {
        const response = await api(path, { cache: 'force-cache' })
        const blob = await response.blob()
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      } catch {
        if (active) setFailed(true)
      }
    })()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [path])

  return { url, failed }
}

function AuthThumb({ item }: { item: ApplicationMediaItem }) {
  const isImage = item.mimeType.startsWith('image/')
  const { url, failed } = useAuthBlobUrl(isImage ? item.url : null)
  if (!isImage) return <span className="abm-thumb-state">{titleCase(item.mimeType.split('/')[1]) || 'File'}</span>
  if (url) return <img src={url} alt={text(item.altText) || `Artwork ${item.sortOrder}`} loading="lazy" />
  if (failed) return <span className="abm-thumb-state">Image unavailable</span>
  return <span className="abm-thumb-state">Loading…</span>
}

function AuthDownload({ path, filename, label }: { path: string; filename: string; label: string }) {
  const [state, setState] = useState<'idle' | 'working' | 'failed'>('idle')
  return (
    <button
      type="button"
      className="abm-download"
      disabled={state === 'working'}
      onClick={() => {
        setState('working')
        void (async () => {
          try {
            const response = await api(path, { cache: 'no-store' })
            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = objectUrl
            anchor.download = filename
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            URL.revokeObjectURL(objectUrl)
            setState('idle')
          } catch {
            setState('failed')
          }
        })()
      }}
    >
      {state === 'failed' ? 'Download failed' : state === 'working' ? 'Preparing…' : label}
    </button>
  )
}

const bookingTabs: { label: string; status: '' | BookingStatus }[] = [
  { label: 'All Bookings', status: '' },
  { label: 'Pending Payment', status: 'PAYMENT_PENDING' },
  { label: 'Confirmed', status: 'CONFIRMED' },
  { label: 'Cancelled', status: 'CANCELLED' },
  { label: 'Expired', status: 'EXPIRED' },
  { label: 'Refunds', status: 'REFUND_PENDING' },
]

const reviewTabs: { label: string; tab: ReviewTab }[] = [
  { label: 'Application Details', tab: 'details' },
  { label: 'Artwork Portfolio', tab: 'portfolio' },
  { label: 'Stall Preference', tab: 'stall' },
  { label: 'Reviews & Notes', tab: 'notes' },
]

const decisionOptions: { value: DecisionAction; label: string }[] = [
  { value: 'APPROVE', label: 'Approve Application' },
  { value: 'START_REVIEW', label: 'Start Review' },
  { value: 'REQUEST_CHANGES', label: 'Request Changes' },
  { value: 'REJECT', label: 'Reject Application' },
]

export function AdminBookingsManager() {
  const [signedIn, setSignedIn] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [exhibitions, setExhibitions] = useState<ExhibitionOption[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'' | ApplicationStatus>('')
  const [eventFilter, setEventFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const [openApplicationId, setOpenApplicationId] = useState('')
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [reviewTab, setReviewTab] = useState<ReviewTab>('details')
  const [decisionAction, setDecisionAction] = useState<DecisionAction>('APPROVE')
  const [decisionNotes, setDecisionNotes] = useState('')

  const [bookingFilter, setBookingFilter] = useState<'' | BookingStatus>('')
  const [selectedBookingId, setSelectedBookingId] = useState('')
  const [receipt, setReceipt] = useState<ReceiptView | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [issueRefund, setIssueRefund] = useState(false)

  const handleLoadError = useCallback((cause: unknown) => {
    const detail = cause instanceof Error ? cause.message : 'Data could not be loaded.'
    setError(detail)
    if (/auth|login|forbidden|session/i.test(detail)) setSignedIn(false)
  }, [])

  const loadExhibitions = useCallback(async () => {
    const response = await api('/api/bookings/exhibitions', { cache: 'no-store' })
    setExhibitions(await response.json() as ExhibitionOption[])
  }, [])

  const loadApplications = useCallback(async () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (eventFilter) params.set('eventId', eventFilter)
    if (searchTerm) params.set('q', searchTerm)
    const query = params.toString()
    const response = await api(`/api/bookings/admin/applications${query ? `?${query}` : ''}`, { cache: 'no-store' })
    setApplications(await response.json() as ApplicationRow[])
  }, [statusFilter, eventFilter, searchTerm])

  const loadBookings = useCallback(async () => {
    const response = await api(`/api/bookings/admin/bookings${bookingFilter ? `?status=${bookingFilter}` : ''}`, { cache: 'no-store' })
    setBookings(await response.json() as BookingRow[])
  }, [bookingFilter])

  const loadApplicationDetail = useCallback(async (id: string) => {
    const response = await api(`/api/bookings/admin/applications/${id}`, { cache: 'no-store' })
    setApplication(await response.json() as ApplicationDetail)
  }, [])

  const loadReceipt = useCallback(async (id: string) => {
    const response = await api(`/api/bookings/bookings/${id}/receipt`, { cache: 'no-store' })
    setReceipt(normalizeReceipt(await response.json() as ReceiptResponse))
  }, [])

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' })
      .then(async (response) => {
        setChecked(true)
        if (response.ok) {
          setSignedIn(true)
          await loadExhibitions().catch(handleLoadError)
        }
      })
      .catch(() => setChecked(true))
  }, [loadExhibitions, handleLoadError])

  useEffect(() => {
    if (!signedIn) return
    void Promise.all([loadApplications(), loadBookings()])
      .catch(handleLoadError)
      .finally(() => setLoaded(true))
  }, [signedIn, loadApplications, loadBookings, handleLoadError])

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchDraft.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchDraft])

  const refreshAll = useCallback(async () => {
    const tasks: Promise<void>[] = [loadApplications(), loadBookings()]
    if (openApplicationId) tasks.push(loadApplicationDetail(openApplicationId))
    if (selectedBookingId) tasks.push(loadReceipt(selectedBookingId))
    await Promise.all(tasks)
  }, [loadApplications, loadBookings, loadApplicationDetail, loadReceipt, openApplicationId, selectedBookingId])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage(''); setError('')
    try { await action(); await refreshAll(); setMessage(success) }
    catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Request failed.'
      setError(detail)
      if (/auth|login|forbidden|session/i.test(detail)) setSignedIn(false)
    } finally { setBusy(false) }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) })
      setSignedIn(true)
    }, 'Signed in.')
  }

  function openReview(id: string) {
    setBusy(true); setError(''); setMessage('')
    void (async () => {
      try {
        const response = await api(`/api/bookings/admin/applications/${id}`, { cache: 'no-store' })
        setApplication(await response.json() as ApplicationDetail)
        setOpenApplicationId(id)
        setReviewTab('details')
        setDecisionAction('APPROVE')
        setDecisionNotes('')
      } catch (cause) {
        handleLoadError(cause)
      } finally {
        setBusy(false)
      }
    })()
  }

  function closeReview() {
    setOpenApplicationId('')
    setApplication(null)
    setDecisionNotes('')
    setError('')
    setMessage('')
  }

  function saveDecision() {
    if (!application) return
    const target = application.id
    const action = decisionAction
    const notes = decisionNotes.trim()
    void run(async () => {
      await api(`/api/bookings/admin/applications/${target}/decision`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, notes: notes || undefined }),
      })
      setDecisionNotes('')
    }, 'Decision saved — the notification is queued for the artist.')
  }

  function openBooking(id: string) {
    setBusy(true); setError(''); setMessage('')
    setSelectedBookingId(id)
    setReceipt(null)
    setCancelReason('')
    setIssueRefund(false)
    void (async () => {
      try { await loadReceipt(id) }
      catch (cause) { handleLoadError(cause) }
      finally { setBusy(false) }
    })()
  }

  function verifyPayment(paymentId: string) {
    void run(async () => {
      const response = await api(`/api/bookings/admin/payments/${paymentId}/verify`, { method: 'POST' })
      const result = await response.json() as VerifyResult
      setSelectedBookingId(result.bookingId)
    }, 'Payment verified — booking confirmed and invoice issued.')
  }

  function rejectPayment(paymentId: string) {
    void run(() => api(`/api/bookings/admin/payments/${paymentId}/reject`, { method: 'POST' }).then(() => undefined), 'Payment rejected.')
  }

  function cancelBooking(bookingId: string) {
    const reason = cancelReason.trim()
    if (reason.length < 3) { setError('Add a cancellation reason of at least 3 characters.'); return }
    void run(async () => {
      const response = await api(`/api/bookings/admin/bookings/${bookingId}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, refund: issueRefund }),
      })
      const result = await response.json() as CancelResult
      setCancelReason('')
      setIssueRefund(false)
      setSelectedBookingId(result.bookingId)
    }, issueRefund ? 'Booking cancelled — refund queued.' : 'Booking cancelled.')
  }

  function completeRefund(bookingId: string) {
    void run(() => api(`/api/bookings/admin/bookings/${bookingId}/refund-complete`, { method: 'POST' }).then(() => undefined), 'Refund marked as complete.')
  }

  const visibleApplications = useMemo(() => {
    if (!dateFilter) return applications
    return applications.filter((row) => dayKey(row.createdAt) === dateFilter)
  }, [applications, dateFilter])

  const selectedBooking = useMemo(() => bookings.find((row) => row.id === selectedBookingId) ?? null, [bookings, selectedBookingId])
  const pendingPayment = useMemo(() => {
    if (!selectedBooking) return null
    if (text(selectedBooking.paymentStatus).toUpperCase() !== 'PENDING') return null
    if (!selectedBooking.paymentId) return null
    const assetId = text(selectedBooking.paymentProofAssetId)
    const proof = assetId
      ? { path: `/api/bookings/media/${assetId}`, name: `payment-proof.${proofExtensions[text(selectedBooking.paymentProofMime)] ?? 'bin'}` }
      : null
    return { booking: selectedBooking, paymentId: selectedBooking.paymentId, proof }
  }, [selectedBooking])

  const artworks = useMemo(() => (application?.media ?? []).filter((item) => item.kind === 'ARTWORK'), [application])
  const portfolioFiles = useMemo(() => (application?.media ?? []).filter((item) => item.kind === 'PORTFOLIO_PDF'), [application])

  if (checked && !signedIn) {
    return (
      <main className="event-admin abm dashboard-bookings-admin">
        <header className="event-admin-header dashboard-bookings-header">
          <div>
            <p className="eyebrow">The Haat of Art · Operations</p>
            <h1>Applications &amp; bookings</h1>
            <p>Review artist applications, track exhibition bookings and verify stall payments.</p>
          </div>
          <Link className="dashboard-bookings-back" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link>
        </header>
        <form className="event-form dashboard-bookings-login" onSubmit={signIn}>
          <span className="dashboard-bookings-login-icon"><ShieldCheck size={21} /></span>
          <div><h2>Sign in to manage bookings</h2><p>Use your authorized dashboard account to view applicant and payment information.</p></div>
          <label>Admin email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Admin password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
        {error && <p className="event-form-error dashboard-bookings-feedback" role="alert">{error}</p>}
      </main>
    )
  }

  return (
    <main className="event-admin abm dashboard-bookings-admin">
      <header className="event-admin-header dashboard-bookings-header">
        <div>
          <p className="eyebrow">The Haat of Art · Operations workspace</p>
          <h1>Applications &amp; bookings</h1>
          <p>Review artist and exhibitor applications, verify stall payments, and manage exhibition bookings.</p>
        </div>
        <div className="abm-header-actions">
          <Link className="dashboard-bookings-public" href="/artist" target="_blank" rel="noopener noreferrer">Artist site <ExternalLink size={13} /></Link>
          <button type="button" className="dashboard-bookings-refresh" disabled={busy || !loaded} onClick={() => {
            setError('')
            setMessage('')
            void refreshAll().then(() => setMessage('Applications and bookings refreshed.')).catch(handleLoadError)
          }}><RefreshCw size={14} />Refresh</button>
          <Link className="dashboard-bookings-back" href="/dashboard"><ArrowLeft size={14} /> Dashboard</Link>
        </div>
      </header>

      {error && <p className="event-form-error dashboard-bookings-feedback" role="alert">{error}</p>}
      {message && <p className="event-form-success dashboard-bookings-feedback" role="status"><Check size={15} />{message}</p>}
      {!loaded && !error && signedIn && <p className="event-form-note dashboard-bookings-loading"><span />Loading applications and bookings…</p>}

      {signedIn && (
        <section className="dashboard-bookings-summary" aria-label="Current view summary">
          <article><span><Users size={18} /></span><div><small>Applications in view</small><strong>{visibleApplications.length}</strong></div></article>
          <article><span className="is-blue"><BriefcaseBusiness size={18} /></span><div><small>Bookings in view</small><strong>{bookings.length}</strong></div></article>
          <article><span className="is-purple"><CalendarDays size={18} /></span><div><small>Exhibitions</small><strong>{exhibitions.length}</strong></div></article>
          <article><span className="is-green"><Wallet size={18} /></span><div><small>Payments to review</small><strong>{bookings.filter((booking) => text(booking.paymentStatus).toUpperCase() === 'PENDING' && Boolean(booking.paymentId)).length}</strong></div></article>
        </section>
      )}

      {application ? (
        <section className="event-form">
          <div className="abm-section-head">
            <h2>Admin – Application Review</h2>
            <button type="button" className="abm-back" disabled={busy} onClick={closeReview}>← Back</button>
          </div>

          <div className="abm-tabs" role="tablist" aria-label="Application review sections">
            {reviewTabs.map((entry) => (
              <button
                key={entry.tab}
                type="button"
                role="tab"
                aria-selected={reviewTab === entry.tab}
                className={`abm-tab${reviewTab === entry.tab ? ' is-active' : ''}`}
                onClick={() => setReviewTab(entry.tab)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="abm-review-card">
            <span className="abm-avatar" aria-hidden="true">{initialsOf(application.firstName, application.lastName)}</span>
            <div className="abm-review-identity">
              <strong>{[application.firstName, application.lastName].filter(Boolean).join(' ') || application.applicationRef}</strong>
              <span>{text(application.email) || '—'}</span>
              <span>{text(application.phone) || '—'}</span>
            </div>
            <div className="abm-review-meta">
              <span className="abm-ref">{application.applicationRef}</span>
              <Pill status={application.status} />
            </div>
          </div>

          {reviewTab === 'details' && (
            <div className="abm-panel">
              <h3 className="abm-panel-title">Applicant Details</h3>
              <div className="abm-fields">
                <Field label="Application ID" value={application.applicationRef} />
                <Field label="Full Name" value={[application.firstName, application.lastName].filter(Boolean).join(' ')} />
                <Field label="Email" value={text(application.email) ? <a className="abm-link" href={`mailto:${application.email}`}>{application.email}</a> : ''} />
                <Field label="Email Verified" value={application.emailVerifiedAt ? longDate(application.emailVerifiedAt) : 'Not verified'} />
                <Field label="Phone" value={application.phone} />
                <Field label="Art Form" value={application.artForm} />
                <Field label="Fascia / Studio Name" value={application.fasciaName} />
                <Field label="Space Category" value={titleCase(application.spaceCategory)} />
                <Field label="Address" value={application.address} />
                <Field label="Website" value={text(application.websiteUrl) ? <a className="abm-link" href={application.websiteUrl ?? '#'} target="_blank" rel="nofollow noopener noreferrer">{application.websiteUrl}</a> : ''} />
                <Field label="Instagram" value={text(application.instagramUrl) ? <a className="abm-link" href={application.instagramUrl ?? '#'} target="_blank" rel="nofollow noopener noreferrer">{application.instagramUrl}</a> : ''} />
                <Field label="Applied On" value={longDate(application.createdAt)} />
                <Field label="Exhibition" value={[application.eventTitle, application.eventCity].filter(Boolean).join(' · ')} />
                <Field label="Venue" value={application.venue} />
                <Field label="Exhibition Starts" value={shortDate(application.eventStartsAt)} />
              </div>
              <h3 className="abm-panel-title">Artist Bio</h3>
              {/* Bio is sanitised HTML stored by the backend artist editor. */}
              <div className="abm-bio" dangerouslySetInnerHTML={{ __html: application.bio }} />
            </div>
          )}

          {reviewTab === 'portfolio' && (
            <div className="abm-panel">
              <h3 className="abm-panel-title">Artwork Images</h3>
              {artworks.length ? (
                <div className="abm-thumbs">
                  {artworks.map((item) => (
                    <figure className="abm-thumb" key={item.id}>
                      <AuthThumb item={item} />
                      <figcaption>
                        <span>{text(item.altText) || `Artwork ${item.sortOrder}`}</span>
                        <small>{byteLabel(item.byteSize)}</small>
                        {!item.mimeType.startsWith('image/') && <AuthDownload path={item.url} filename={`artwork-${item.id}`} label="Download" />}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : <p className="abm-empty">No artwork images were uploaded with this application.</p>}

              <h3 className="abm-panel-title">Portfolio</h3>
              {portfolioFiles.length ? (
                <ul className="abm-files">
                  {portfolioFiles.map((item) => (
                    <li key={item.id}>
                      <span className="abm-file-icon" aria-hidden="true">PDF</span>
                      <span className="abm-file-name">{text(item.altText) || `portfolio-${item.id}.pdf`}</span>
                      <small>{byteLabel(item.byteSize)}</small>
                      <AuthDownload path={item.url} filename={`portfolio-${item.id}.pdf`} label="Download" />
                    </li>
                  ))}
                </ul>
              ) : <p className="abm-empty">No portfolio PDF was uploaded.</p>}
            </div>
          )}

          {reviewTab === 'stall' && (
            <div className="abm-panel">
              <h3 className="abm-panel-title">Requested Stall</h3>
              <div className="abm-fields">
                <Field label="Exhibition" value={[application.eventTitle, application.eventCity].filter(Boolean).join(' · ')} />
                <Field
                  label="Stall Type"
                  value={hasNumber(application.preferredStallPrice) && text(application.preferredStallType)
                    ? `${application.preferredStallType} · ${money(application.preferredStallPrice)}`
                    : text(application.preferredStallType)}
                />
                <Field label="Preferred Size" value={hasNumber(application.approxSizeSqm) ? `${application.approxSizeSqm} sq. m.` : ''} />
                <Field label="Space Category" value={titleCase(application.spaceCategory)} />
                <Field label="Stall Code" value={application.requestedStallCode} />
                <Field label="Stall Location" value={application.requestedStallLocation} />
                <Field label="Special Requirements" value={application.specialRequirements} />
              </div>
            </div>
          )}

          {reviewTab === 'notes' && (
            <div className="abm-panel">
              <h3 className="abm-panel-title">Admin Actions</h3>
              <div className="abm-decision">
                <select value={decisionAction} disabled={busy} onChange={(event) => setDecisionAction(event.target.value as DecisionAction)} aria-label="Decision">
                  {decisionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <textarea
                  value={decisionNotes}
                  maxLength={1000}
                  rows={4}
                  disabled={busy}
                  placeholder="Add review notes (optional)…"
                  onChange={(event) => setDecisionNotes(event.target.value)}
                />
                <button type="button" className="abm-save" disabled={busy} onClick={saveDecision}>Save &amp; Notify</button>
              </div>

              <h3 className="abm-panel-title">Review History</h3>
              <div className="abm-fields">
                <Field label="Current Status" value={<Pill status={application.status} />} />
                <Field label="Reviewed By" value={application.reviewedByName} />
                <Field label="Reviewed On" value={longDate(application.reviewedAt)} />
              </div>
              <p className="abm-notes-label">Latest note to the artist</p>
              <p className="abm-notes">{text(application.adminNotes) || 'No notes have been saved yet.'}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="event-form">
          <div className="abm-section-head">
            <h2>Artist / Exhibitor Applications</h2>
            <p className="abm-count">{visibleApplications.length} application{visibleApplications.length === 1 ? '' : 's'}</p>
          </div>

          <div className="abm-filters">
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as '' | ApplicationStatus)}>
                <option value="">All Status</option>
                {applicationStatuses.map((status) => <option key={status} value={status}>{statusLabels[status] ?? status}</option>)}
              </select>
            </label>
            <label>
              <span>Exhibition</span>
              <select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
                <option value="">All Exhibitions</option>
                {exhibitions.map((exhibition) => (
                  <option key={exhibition.id} value={exhibition.id}>{exhibition.title}{exhibition.city ? ` — ${exhibition.city}` : ''}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Date</span>
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </label>
            <label className="abm-search">
              <span>Search</span>
              <input
                value={searchDraft}
                maxLength={120}
                placeholder="Name, email or application ID"
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </label>
          </div>

          <div className="abm-scroll">
            <table className="apm-table abm-table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Exhibition</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibleApplications.map((row, index) => (
                  <tr key={row.id}>
                    <td className="abm-num">{index + 1}</td>
                    <td>
                      <span className="abm-strong">{[row.firstName, row.lastName].filter(Boolean).join(' ') || row.applicationRef}</span>
                      <small>{row.applicationRef}{row.artForm ? ` · ${row.artForm}` : ''}</small>
                    </td>
                    <td>{text(row.eventCity) || text(row.eventTitle) || '—'}</td>
                    <td>{shortDate(row.createdAt) || '—'}</td>
                    <td><Pill status={row.status} /></td>
                    <td className="abm-actions">
                      <button type="button" disabled={busy} onClick={() => openReview(row.id)}>[View]</button>
                    </td>
                  </tr>
                ))}
                {!visibleApplications.length && loaded && (
                  <tr><td colSpan={6} className="apm-empty">No applications match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="event-form">
        <div className="abm-section-head">
          <h2>Admin – Bookings &amp; Payments</h2>
          <p className="abm-count">{bookings.length} booking{bookings.length === 1 ? '' : 's'}</p>
        </div>

        <div className="abm-tabs" role="tablist" aria-label="Booking filters">
          {bookingTabs.map((tab) => (
            <button
              key={tab.status || 'all'}
              type="button"
              role="tab"
              aria-selected={bookingFilter === tab.status}
              className={`abm-tab${bookingFilter === tab.status ? ' is-active' : ''}`}
              onClick={() => setBookingFilter(tab.status)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="abm-scroll">
          <table className="apm-table abm-table">
            <thead>
              <tr><th>#</th><th>Booking ID</th><th>Name</th><th>Exhibition</th><th>Stall</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {bookings.map((row, index) => {
                const badge = bookingBadge(row)
                const isPendingPayment = Boolean(row.paymentId && text(row.paymentStatus).toUpperCase() === 'PENDING')
                return (
                  <tr key={row.id} className={row.id === selectedBookingId ? ' is-active' : undefined}>
                    <td className="abm-num">{index + 1}</td>
                    <td>
                      <span className="abm-strong">{row.bookingRef}</span>
                      <small>{text(row.invoiceNo) ? `Invoice ${row.invoiceNo}` : shortDate(row.createdAt)}</small>
                    </td>
                    <td>
                      <span className="abm-strong">{[row.firstName, row.lastName].filter(Boolean).join(' ') || row.applicationRef}</span>
                      <small>{text(row.email)}</small>
                      {text(row.phone) && (
                        <small className="abm-contact">
                          <a className="abm-link" href={`tel:${row.phone}`}>{row.phone}</a>
                          {' · '}
                          <a className="abm-link" href={`https://wa.me/${String(row.phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
                        </small>
                      )}
                    </td>
                    <td>{text(row.eventTitle) || '—'}</td>
                    <td>{text(row.stallCode) || '—'}{text(row.stallType) && <small>{row.stallType}</small>}</td>
                    <td className="abm-amount">{money(row.totalAmount)}</td>
                    <td><Pill status={badge.status} label={badge.label} /></td>
                    <td className="abm-actions">
                      <button type="button" disabled={busy} onClick={() => openBooking(row.id)}>[View]</button>
                      {isPendingPayment && <button type="button" className="abm-verify" disabled={busy} onClick={() => openBooking(row.id)}>[Verify]</button>}
                    </td>
                  </tr>
                )
              })}
              {!bookings.length && loaded && <tr><td colSpan={8} className="apm-empty">No bookings in this view yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="abm-cols">
          <div className="abm-card">
            <h3 className="abm-panel-title">Stall Payment Verification</h3>
            {pendingPayment ? (
              <>
                <div className="abm-fields">
                  <Field label="Booking ID" value={pendingPayment.booking.bookingRef} />
                  <Field label="Amount" value={money(pendingPayment.booking.paidAmount ?? pendingPayment.booking.totalAmount)} />
                  <Field label="Payment Method" value={titleCase(pendingPayment.booking.paymentMethod)} />
                  <Field label="Transaction ID" value={pendingPayment.booking.transactionRef} />
                  <Field
                    label="Payment Proof"
                    value={pendingPayment.proof ? (
                      <span className="abm-proof">
                        <span className="abm-file-name">{pendingPayment.proof.name}</span>
                        <AuthDownload path={pendingPayment.proof.path} filename={pendingPayment.proof.name} label="Download" />
                      </span>
                    ) : 'Not attached'}
                  />
                  <Field label="Status" value={<Pill status="PENDING" label="Pending Verification" />} />
                </div>
                <div className="abm-btn-row">
                  <button type="button" className="abm-paid" disabled={busy} onClick={() => verifyPayment(pendingPayment.paymentId)}>Mark as Paid</button>
                  <button type="button" className="abm-reject" disabled={busy} onClick={() => rejectPayment(pendingPayment.paymentId)}>Reject Payment</button>
                </div>
              </>
            ) : (
              <p className="abm-empty">
                {selectedBooking
                  ? 'This booking has no payment awaiting verification.'
                  : 'Select a booking with a pending bank transfer or UPI payment to verify it here.'}
              </p>
            )}
          </div>

          <div className="abm-card">
            <h3 className="abm-panel-title">Booking Details</h3>
            {receipt ? (
              <>
                <div className="abm-fields">
                  <Field label="Booking ID" value={receipt.bookingRef} />
                  <Field label="Booking Status" value={receipt.status ? <Pill status={receipt.status} /> : ''} />
                  <Field label="Application" value={receipt.applicationRef} />
                  <Field label="Exhibitor" value={receipt.applicant} />
                  <Field label="Email" value={receipt.email} />
                  <Field label="Exhibition" value={[receipt.eventTitle, receipt.eventCity].filter(Boolean).join(' · ')} />
                  <Field label="Venue" value={receipt.venue} />
                  <Field label="Dates" value={receipt.schedule} />
                  <Field label="Stall" value={receipt.stall} />
                  <Field label="Base Amount" value={receipt.baseAmount} />
                  <Field label="Tax" value={receipt.taxAmount} />
                  <Field label="Total Paid" value={receipt.totalAmount} />
                  <Field label="Invoice No" value={receipt.invoiceNo} />
                  <Field label="Invoice Issued" value={receipt.invoiceIssuedAt} />
                  <Field label="Payment Method" value={receipt.paymentMethod} />
                  <Field label="Transaction ID" value={receipt.transactionRef} />
                  <Field label="Payment Status" value={receipt.paymentStatus ? <Pill status={receipt.paymentStatus} /> : ''} />
                  <Field label="Payment Verified" value={receipt.paymentVerifiedAt} />
                  <Field label="Booked On" value={receipt.createdAt} />
                </div>

                {receipt.status === 'REFUND_PENDING' && (
                  <button type="button" className="abm-paid abm-full" disabled={busy} onClick={() => completeRefund(selectedBookingId)}>Mark refund complete</button>
                )}

                {['PAYMENT_PENDING', 'CONFIRMED'].includes(receipt.status) && (
                  <div className="abm-cancel">
                    <label>
                      <span>Cancellation reason</span>
                      <textarea
                        value={cancelReason}
                        rows={3}
                        maxLength={255}
                        disabled={busy}
                        placeholder="Why is this booking being cancelled?"
                        onChange={(event) => setCancelReason(event.target.value)}
                      />
                    </label>
                    <label className="abm-check">
                      <input type="checkbox" checked={issueRefund} disabled={busy} onChange={(event) => setIssueRefund(event.target.checked)} />
                      <span>Issue refund (paid bookings only)</span>
                    </label>
                    <button type="button" className="abm-reject" disabled={busy || cancelReason.trim().length < 3} onClick={() => cancelBooking(selectedBookingId)}>Cancel booking</button>
                  </div>
                )}
              </>
            ) : (
              <p className="abm-empty">Select a booking above to view its receipt and cancellation options.</p>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default AdminBookingsManager
