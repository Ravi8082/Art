import type { ExhibitInfo } from '@/lib/api'
import type { PublicEvent } from '@/lib/api'
import { exhibitPricing, type PricingTable } from '@/lib/exhibit-content'

const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`
const monthYear = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be announced'
const size = (t: { widthM: number; depthM: number }) => `${+t.widthM}m × ${+t.depthM}m (${+(t.widthM * t.depthM).toFixed(1)} SQM)`

export function buildPricing(info: ExhibitInfo | null, events: PublicEvent[] = []): { standard: PricingTable | null; premium: PricingTable | null } {
  if (!info) return { standard: null, premium: null }
  const from = monthYear(info.window.startsAt)
  const to = monthYear(info.window.endsAt)
  const rows = (types: ExhibitInfo['stallTypes']) => types.map((t) => {
    const tax = Math.round(Number(t.price) * Number(t.taxRate) / 100)
    return {
      from, to, size: `${t.name} · ${size(t)}`,
      price: `${inr(t.price)} + ${inr(tax)} GST = ${inr(Number(t.price) + tax)}`,
      includes: t.includes || 'Details shared at booking',
    }
  })
  const individual = info.stallTypes.filter((t) => t.category === 'INDIVIDUAL')
  const others = info.stallTypes.filter((t) => t.category !== 'INDIVIDUAL')
  const cta = { label: 'Book This Stall', href: '/book-stall' }
  const upcomingEvents = events
    .filter((event) => new Date(event.endsAt).getTime() >= Date.now())
  const upcomingEditions = (info.window.upcoming > 0 ? upcomingEvents.slice(0, info.window.upcoming) : upcomingEvents)
    .map((event) => [event.city || event.venue, event.title].filter(Boolean).join(' — '))
  const editionNote = upcomingEditions.length
    ? `Dates ${from} – ${to} apply to: ${upcomingEditions.join('; ')}.`
    : `Dates ${from} – ${to} apply to upcoming editions listed in the booking system.`
  return {
    standard: individual.length ? { ...exhibitPricing[0], note: editionNote, rows: rows(individual), cta } : null,
    premium: others.length ? { ...exhibitPricing[1], note: editionNote, rows: rows(others), cta } : null,
  }
}

const count = (value: number) => Number(value).toLocaleString('en-IN')

export function buildStats(info: ExhibitInfo) {
  const s = info.stats
  return [
    { icon: 'network', label: 'Exhibitors', value: '2,500+', text: 'Artists and exhibitors have taken part in our exhibitions.' },
    { icon: 'audience', label: 'Art Lovers & Buyers', value: '77,000+', text: 'Visitors and buyers reached through our exhibitions.' },
    { icon: 'artwork', label: 'Artworks Sold', value: '₹17.60 Cr+', text: 'Cumulative artwork sales.' },
    { icon: 'venue', label: 'Prime Stalls Open', value: count(s.openStalls), text: 'Live availability across upcoming editions' },
  ]
}
