import type { ExhibitInfo } from '@/lib/api'
import { exhibitPricing, type PricingTable } from '@/lib/demo-exhibit'

const inr = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`
const monthYear = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'To be announced'
const size = (t: { widthM: number; depthM: number }) => `${+t.widthM}m x ${+t.depthM}m (${+(t.widthM * t.depthM).toFixed(1)} SQM)`

export function buildPricing(info: ExhibitInfo | null): { standard: PricingTable | null; premium: PricingTable | null } {
  if (!info) return { standard: null, premium: null }
  const from = monthYear(info.window.startsAt)
  const to = monthYear(info.window.endsAt)
  const rows = (types: ExhibitInfo['stallTypes']) => types.map((t) => ({
    from, to, size: `${t.name} · ${size(t)}`,
    price: `${inr(t.price)} + ${+t.taxRate}% GST`,
    includes: t.includes || 'Details shared at booking',
  }))
  const individual = info.stallTypes.filter((t) => t.category === 'INDIVIDUAL')
  const others = info.stallTypes.filter((t) => t.category !== 'INDIVIDUAL')
  const cta = { label: 'Book Stall Now', href: '/book-your-stall' }
  return {
    standard: individual.length ? { ...exhibitPricing[0], title: 'Stall Rates For', accent: 'Individual Artists', note: info.window.upcoming ? `Applies to ${info.window.upcoming} upcoming exhibition${info.window.upcoming > 1 ? 's' : ''}` : undefined, rows: rows(individual), cta } : null,
    premium: others.length ? { ...exhibitPricing[1], title: 'Stall Rates For', accent: 'Groups & Galleries', rows: rows(others), cta } : null,
  }
}

const count = (value: number) => Number(value).toLocaleString('en-IN')

export function buildStats(info: ExhibitInfo) {
  const s = info.stats
  return [
    { icon: 'artwork', label: 'Stalls Booked', value: count(s.stallsBooked), text: `${count(s.openStalls)} stall slots still open across upcoming exhibitions.` },
    { icon: 'venue', label: 'Exhibitions', value: count(s.events), text: 'Published and upcoming exhibitions on The Haat of Art.' },
    { icon: 'audience', label: 'Visitors Registered', value: count(s.visitors), text: 'Visitors who have registered for free entry passes.' },
    { icon: 'network', label: 'Artists On Platform', value: count(s.artists), text: 'Approved artist profiles showcased on the website.' },
  ]
}
