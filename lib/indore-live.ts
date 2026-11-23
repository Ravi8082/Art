import { isPlaceholderContent } from '@/lib/content-quality'

export type LiveEvent = {
  slug: string
  title: string
  description: string
  city: string
  state: string
  venue: string
  startsAt: string
  endsAt: string
  passConfig?: {
    passMode: 'FREE' | 'PAID' | 'BOTH'
    freeCapacity: number | null
    freeRemaining: number | null
    paidPrice: number
    paidCapacity: number | null
    paidRemaining: number | null
    freePerks: string[]
    paidPerks: string[]
  }
}

export type IndoreView = {
  slug: string
  event: {
    eyebrow: string
    title: string
    accent: string
    text: string
    city: string
    state: string
    startsAt: string
    dates: string
    venue: string
    timing: string
    badge: string
    heroImage: string
    ctas: { stall: { label: string; href: string }; visitor: { label: string; href: string } }
  }
  info: {
    venue: { title: string; name: string; address: string; image: string; cta: { label: string; href: string } }
    details: { title: string; dates: string; timing: string; entry: string }
  }
}

const TZ = 'Asia/Kolkata'
const part = (date: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, ...options }).format(date)
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
const dayKey = (date: Date) => part(date, { year: 'numeric', month: '2-digit', day: '2-digit' })
const dayNumber = (date: Date) => Number(part(date, { day: 'numeric' }))
const time = (date: Date) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
const withoutRepeats = (venue: string, extras: string[]) => [venue, ...extras.filter((extra) => extra && !venue.toLowerCase().includes(extra.toLowerCase()))].filter(Boolean).join(', ')
const dayWords = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']

export function formatEventDates(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const monthYear = (date: Date) => `${part(date, { month: 'short' })} ${part(date, { year: 'numeric' })}`
  if (dayKey(start) === dayKey(end)) return `${ordinal(dayNumber(start))} ${monthYear(start)}`
  if (monthYear(start) === monthYear(end)) return `${ordinal(dayNumber(start))} – ${ordinal(dayNumber(end))} ${monthYear(end)}`
  return `${ordinal(dayNumber(start))} ${monthYear(start)} – ${ordinal(dayNumber(end))} ${monthYear(end)}`
}

export function resolveIndoreView(event: LiveEvent | null): IndoreView | null {
  if (!event) return null
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const days = Math.max(1, Math.round((Date.parse(dayKey(end).split('/').reverse().join('-')) - Date.parse(dayKey(start).split('/').reverse().join('-'))) / 86_400_000) + 1)
  const dates = formatEventDates(event.startsAt, event.endsAt)
  const timing = `${time(start)} - ${time(end)}`
  const cities = splitPlaces(event.city)
  const single = cities.length <= 1
  const city = single ? (cities[0] ?? '') : ''
  const state = single ? event.state : ''
  const where = withoutRepeats(event.venue, [city, state])
  const mapQuery = encodeURIComponent(withoutRepeats(event.venue, [city]))
  const description = event.description?.trim() ?? ''
  return {
    slug: event.slug,
    event: {
      eyebrow: 'The Haat of Art',
      title: event.title || (single ? (city ? `The Haat of Art in ${city}` : 'The Haat of Art') : `The Haat of Art across ${cities.length} cities`),
      accent: days <= 7 ? `${dayWords[days - 1]} ${days === 1 ? 'Day' : 'Days'}` : 'Exhibition',
      text: description && !isPlaceholderContent(description)
        ? description
        : 'Explore the exhibition, meet participating artists, and plan your visit.',
      city: event.city,
      state: event.state,
      startsAt: event.startsAt,
      dates,
      venue: where,
      timing,
      badge: 'Visitor Registration',
      heroImage: '/media/hero-exhibition.jpg',
      ctas: { stall: { label: 'Book Your Stall', href: '/exhibit-with-us' }, visitor: { label: 'Visitor Registration', href: '#register' } },
    },
    info: {
      venue: {
        title: 'Venue',
        name: event.venue,
        address: single ? withoutRepeats('', [city, state]).replace(/^, /, '') : cities.join(', '),
        image: '/media/exhibition-gallery.jpeg',
        cta: { label: 'View on Map', href: `https://www.google.com/maps/search/?api=1&query=${mapQuery}` },
      },
      details: { title: 'Event Details', dates, timing, entry: 'Visitor registration available' },
    },
  }
}

// Event state/city fields can list several places ("Pan India — Mumbai, Delhi and Pune").
export const splitPlaces = (value: string) => value
  .split(/[,;/]|\band\b/i)
  .map((part) => part.replace(/^(pan india|multiple states)\s*[—-]\s*/i, '').trim())
  .filter(Boolean)
