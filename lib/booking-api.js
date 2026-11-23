"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMoney = exports.getReceipt = exports.getMine = exports.getStalls = exports.getEventStallTypes = exports.getStallTypes = exports.getExhibitions = exports.BookingApiError = exports.apiBaseUrl = void 0;
exports.bookingApi = bookingApi;
exports.getCurrentUser = getCurrentUser;
exports.uploadApplicationMedia = uploadApplicationMedia;
exports.mediaUrl = mediaUrl;
exports.fetchProtectedMedia = fetchProtectedMedia;
exports.formatEventDates = formatEventDates;
exports.formatDate = formatDate;
exports.stallSize = stallSize;
exports.stallSquareMeters = stallSquareMeters;
exports.totalWithTax = totalWithTax;
exports.taxRatePercent = taxRatePercent;
exports.buildInvoiceHtml = buildInvoiceHtml;
exports.downloadInvoice = downloadInvoice;
const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
exports.apiBaseUrl = apiBaseUrl;
class BookingApiError extends Error {
    status;
    payload;
    constructor(status, message, payload = {}) {
        super(message);
        this.status = status;
        this.payload = payload;
    }
}
exports.BookingApiError = BookingApiError;
async function readError(response) {
    const payload = (await response.json().catch(() => null));
    const message = payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
    return new BookingApiError(response.status, message, payload ?? {});
}
async function bookingApi(path, init = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init });
    if (!response.ok)
        throw await readError(response);
    if (response.status === 204)
        return undefined;
    return await response.json();
}
async function getCurrentUser() {
    try {
        const data = await bookingApi('/api/auth/me');
        return data.user;
    }
    catch {
        return null;
    }
}
const getExhibitions = () => bookingApi('/api/bookings/exhibitions');
exports.getExhibitions = getExhibitions;
const getStallTypes = () => bookingApi('/api/bookings/stall-types');
exports.getStallTypes = getStallTypes;
const getEventStallTypes = (eventId) => bookingApi(`/api/bookings/events/${encodeURIComponent(eventId)}/stall-types`, { cache: 'no-store' });
exports.getEventStallTypes = getEventStallTypes;
const getStalls = (eventId) => bookingApi(`/api/bookings/events/${encodeURIComponent(eventId)}/stalls`);
exports.getStalls = getStalls;
const getMine = () => bookingApi('/api/bookings/mine');
exports.getMine = getMine;
const getReceipt = (bookingId) => bookingApi(`/api/bookings/bookings/${encodeURIComponent(bookingId)}/receipt`);
exports.getReceipt = getReceipt;
function uploadApplicationMedia(file, kind, altText = '') {
    return bookingApi('/api/bookings/media', {
        method: 'POST',
        headers: { 'content-type': file.type || 'application/octet-stream', 'x-media-kind': kind, 'x-alt-text': altText },
        body: file,
    });
}
function mediaUrl(assetId) {
    return `${apiBaseUrl}/api/bookings/media/${encodeURIComponent(assetId)}`;
}
async function fetchProtectedMedia(assetId) {
    const response = await fetch(mediaUrl(assetId), { credentials: 'include' });
    if (!response.ok)
        throw await readError(response);
    return await response.blob();
}
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const formatMoney = (value) => inr.format(Number(value));
exports.formatMoney = formatMoney;
function formatEventDates(startsAt, endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return 'Dates to be confirmed';
    const dayMonth = (date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
    const sameMonth = start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
    return sameMonth
        ? `${dayMonth(start)} - ${end.getUTCDate()} ${end.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} ${end.getUTCFullYear()}`
        : `${dayMonth(start)} - ${dayMonth(end)} ${end.getUTCFullYear()}`;
}
function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return '—';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
function stallSize(type) {
    return `${Number(type.widthM)}m × ${Number(type.depthM)}m`;
}
function stallSquareMeters(type) {
    return Math.round(Number(type.widthM) * Number(type.depthM) * 100) / 100;
}
function totalWithTax(price, taxRate) {
    const base = Math.round(price * 100) / 100;
    const tax = Math.round(base * Number(taxRate)) / 100;
    return { base, tax, total: Math.round((base + tax) * 100) / 100 };
}
// MySQL hands back tax_rate as a DECIMAL percent ("18.00"), but the admin form can save a
// fraction, so labels accept either.
function taxRatePercent(taxRate) {
    const value = Number(taxRate);
    return Math.round((value > 1 ? value : value * 100) * 100) / 100;
}
function buildInvoiceHtml(receipt) {
    const rows = [
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
    ];
    const table = rows.map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('');
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${receipt.invoiceNo ?? receipt.bookingRef}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;color:#0f1e36;max-width:680px;margin:40px auto;padding:0 24px}h1{font-size:24px;margin:0 0 4px}p.kicker{color:#ee4b12;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:12px;margin:0 0 24px}table{width:100%;border-collapse:collapse;margin:0 0 24px}th{text-align:left;width:220px;color:#5d6677;font-weight:500;padding:8px 12px 8px 0;border-bottom:1px solid #f3dcc8;vertical-align:top}td{padding:8px 0;border-bottom:1px solid #f3dcc8}tfoot td,tfoot th{border:0;font-weight:700}.total{font-size:20px}</style>
</head><body>
<p class="kicker">The Haat of Art</p><h1>Stall booking receipt</h1>
<table><tbody>${table}
<tr><th>Stall fee</th><td>${(0, exports.formatMoney)(receipt.baseAmount)}</td></tr>
<tr><th>GST</th><td>${(0, exports.formatMoney)(receipt.taxAmount)}</td></tr>
</tbody><tfoot><tr><th>Total paid</th><td class="total">${(0, exports.formatMoney)(receipt.totalAmount)} ${receipt.currency}</td></tr></tfoot></table>
<p>This is a computer-generated receipt and does not require a signature.</p>
</body></html>`;
}
function downloadInvoice(receipt) {
    const blob = new Blob([buildInvoiceHtml(receipt)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receipt.invoiceNo ?? receipt.bookingRef}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
