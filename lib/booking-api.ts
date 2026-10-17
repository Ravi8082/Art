const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export { apiBaseUrl }

export type BookingUser = { id: string; roles: string[]; email: string; fullName: string }

export type Exhibition = {
  id: string
  title: string
  city: string
  venue: string
  startsAt: string
  endsAt: string
  registrationDeadline: string | null
  availableStalls: number
  totalStalls: number
  registrationOpen: boolean
  media: { id: string; altText: string; url: string }[]
}

export type StallType = {
  id: string
  code: string
  name: string
  category: 'INDIVIDUAL' | 'GROUP' | 'GALLERY'
  widthM: number
  depthM: number
  price: number
  taxRate: number
  includes: string | null
}

export type StallStatus = 'AVAILABLE' | 'BOOKED' | 'HELD' | 'DISABLED'

export type Stall = {
  id: string
  code: string
  location: string
  sortOrder: number
  status: StallStatus
  holdExpiresAt: string | null
  type: StallType & { id: string }
}

export type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED'

export type MineApplication = {
  id: string
  applicationRef: string
  status: ApplicationStatus
  createdAt: string
  adminNotes: string | null
  requestedStallId: string | null
  requestedStallCode: string | null
  eventId: string
  eventTitle: string
  eventCity: string
  eventStartsAt: string
}

export type BookingStatus = 'PAYMENT_PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_PENDING' | 'REFUNDED'

export type MyBooking = {
  id: string
  bookingRef: string
  status: BookingStatus
  baseAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  createdAt: string
  eventId: string
  eventTitle: string
  stallCode: string
  stallTypeName: string
  applicationRef: string
  invoiceNo: string | null
}

export type Receipt = {
  id: string
  bookingRef: string
  status: BookingStatus
  baseAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  createdAt: string
  applicationRef: string
  firstName: string
  lastName: string
  accountEmail: string
  eventTitle: string
  eventCity: string
  venue: string
  eventStartsAt: string
  eventEndsAt: string
  stallCode: string
  stallLocation: string
  stallTypeName: string
  widthM: number
  depthM: number
  invoiceNo: string | null
  invoiceIssuedAt: string | null
  transactionRef: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  paymentVerifiedAt: string | null
  paymentProofAssetId: string | null
  paymentProofMime: string | null
  paymentProofBytes: number | null
  confirmationEmail: 'QUEUED' | 'SENT' | 'FAILED' | null
}

export type PaymentTicket = {
  provider: 'SANDBOX'
  paymentId: string
  idempotencyKey: string
  transactionRef: string
  amount: number
  status: string
  holdExpiresAt?: string
  note?: string
  duplicate?: boolean
  sandboxSuccessWebhook: { url: string; body: Record<string, unknown> } | null
}

export class BookingApiError extends Error {
  status: number
  payload: Record<string, unknown>
  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

async function readError(response: Response) {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  const message = payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`
  return new BookingApiError(response.status, message, payload ?? {})
}

export async function bookingApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw await readError(response)
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export async function getCurrentUser() {
  try {
    const data = await bookingApi<{ user: BookingUser }>('/api/auth/me')
    return data.user
  } catch {
    return null
  }
}

export const getExhibitions = () => bookingApi<Exhibition[]>('/api/bookings/exhibitions')
export const getStallTypes = () => bookingApi<StallType[]>('/api/bookings/stall-types')
export const getStalls = (eventId: string) => bookingApi<Stall[]>(`/api/bookings/events/${encodeURIComponent(eventId)}/stalls`)
export const getMine = () => bookingApi<{ applications: MineApplication[]; bookings: MyBooking[] }>('/api/bookings/mine')
export const getReceipt = (bookingId: string) => bookingApi<Receipt>(`/api/bookings/bookings/${encodeURIComponent(bookingId)}/receipt`)

export function uploadApplicationMedia(file: Blob, kind: 'artwork' | 'portfolio' | 'document', altText = '') {
  return bookingApi<{ assetId: string; mediaKind: string; byteSize: number }>('/api/bookings/media', {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream', 'x-media-kind': kind, 'x-alt-text': altText },
    body: file,
  })
}

export function mediaUrl(assetId: string) {
  return `${apiBaseUrl}/api/bookings/media/${encodeURIComponent(assetId)}`
}

export async function fetchProtectedMedia(assetId: string) {
  const response = await fetch(mediaUrl(assetId), { credentials: 'include' })
  if (!response.ok) throw await readError(response)
  return await response.blob()
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
export const formatMoney = (value: number | string) => inr.format(Number(value))

export function formatEventDates(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Dates to be confirmed'
  const dayMonth = (date: Date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()
  return sameMonth
    ? `${dayMonth(start)} - ${end.getUTCDate()} ${end.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} ${end.getUTCFullYear()}`
    : `${dayMonth(start)} - ${dayMonth(end)} ${end.getUTCFullYear()}`
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function stallSize(type: Pick<StallType, 'widthM' | 'depthM'>) {
  return `${Number(type.widthM)}m x ${Number(type.depthM)}m`
}

export function stallSquareMeters(type: Pick<StallType, 'widthM' | 'depthM'>) {
  return Math.round(Number(type.widthM) * Number(type.depthM) * 100) / 100
}

export function totalWithTax(price: number, taxRate: number) {
  const base = Math.round(price * 100) / 100
  const tax = Math.round(base * Number(taxRate)) / 100
  return { base, tax, total: Math.round((base + tax) * 100) / 100 }
}

// MySQL hands back tax_rate as a DECIMAL percent ("18.00"), but the admin form can save a
// fraction, so labels accept either.
export function taxRatePercent(taxRate: number | string) {
  const value = Number(taxRate)
  return Math.round((value > 1 ? value : value * 100) * 100) / 100
}

export function buildInvoiceHtml(receipt: Receipt) {
  const rows: [string, string][] = [
    ['Booking ID', receipt.bookingRef],
    ['Application', receipt.applicationRef],
    ['Exhibitor', `${receipt.firstName} ${receipt.lastName}`.trim()],
    ['Email', receipt.accountEmail],
    ['Exhibition', receipt.eventTitle],
    ['Venue', [receipt.venue, receipt.eventCity].filter(Boolean).join(', ')],
    ['Event dates', formatEventDates(receipt.eventStartsAt, receipt.eventEndsAt)],
    ['Stall', `${receipt.stallCode} — ${receipt.stallTypeName} (${stallSize(receipt)} m)`],
    ['Location', receipt.stallLocation || '—'],
    ['Payment method', receipt.paymentMethod ?? '—'],
    ['Transaction reference', receipt.transactionRef ?? '—'],
    ['Invoice number', receipt.invoiceNo ?? '—'],
  ]
  const table = rows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${receipt.invoiceNo ?? receipt.bookingRef}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;color:#0f1e36;max-width:680px;margin:40px auto;padding:0 24px}h1{font-size:24px;margin:0 0 4px}p.kicker{color:#ee4b12;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:12px;margin:0 0 24px}table{width:100%;border-collapse:collapse;margin:0 0 24px}th{text-align:left;width:220px;color:#5d6677;font-weight:500;padding:8px 12px 8px 0;border-bottom:1px solid #f3dcc8;vertical-align:top}td{padding:8px 0;border-bottom:1px solid #f3dcc8}tfoot td,tfoot th{border:0;font-weight:700}.total{font-size:20px}</style>
</head><body>
<p class="kicker">The Haat of Art</p><h1>Stall booking receipt</h1>
<table><tbody>${table}
<tr><th>Stall fee</th><td>${formatMoney(receipt.baseAmount)}</td></tr>
<tr><th>GST</th><td>${formatMoney(receipt.taxAmount)}</td></tr>
</tbody><tfoot><tr><th>Total paid</th><td class="total">${formatMoney(receipt.totalAmount)} ${receipt.currency}</td></tr></tfoot></table>
<p>This is a computer-generated receipt and does not require a signature.</p>
</body></html>`
}

export function downloadInvoice(receipt: Receipt) {
  const blob = new Blob([buildInvoiceHtml(receipt)], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${receipt.invoiceNo ?? receipt.bookingRef}.html`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
