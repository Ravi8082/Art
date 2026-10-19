import { indoreEvent, indoreInfo } from '@/lib/demo-indore'

export type LiveEvent = {
  slug: string
  title: string
  description: string
  city: string
  state: string
  venue: string
  startsAt: string
  endsAt: string
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
  if (monthYear(start) === monthYear(end)) return `${ordinal(dayNumber(start))} - ${ordinal(dayNumber(end))} ${monthYear(end)}`
  return `${ordinal(dayNumber(start))} ${monthYear(start)} - ${ordinal(dayNumber(end))} ${monthYear(end)}`
}

// Builds the hero and info content from a dashboard event, falling back to the demo copy when none is available.
export function resolveIndoreView(event: LiveEvent | null) {
  if (!event) return { slug: undefined as string | undefined, event: indoreEvent, info: indoreInfo }
  const start = new Date(event.startsAt)
  const end = new Date(event.endsAt)
  const days = Math.max(1, Math.round((Date.parse(dayKey(end).split('/').reverse().join('-')) - Date.parse(dayKey(start).split('/').reverse().join('-'))) / 86_400_000) + 1)
  const dates = formatEventDates(event.startsAt, event.endsAt)
  const timing = `${time(start)} - ${time(end)}`
  const where = withoutRepeats(event.venue, [event.city, event.state])
  const mapQuery = encodeURIComponent(withoutRepeats(event.venue, [event.city]))
  return {
    slug: event.slug,
    event: {
      ...indoreEvent,
      title: event.city ? `Comes to ${event.city}` : event.title,
      accent: days <= 7 ? `${dayWords[days - 1]} ${days === 1 ? 'Day' : 'Days'}, Free.` : 'Free Entry.',
      text: event.description || indoreEvent.text,
      startsAt: event.startsAt,
      dates,
      venue: where,
      timing,
    },
    info: {
      ...indoreInfo,
      venue: {
        ...indoreInfo.venue,
        name: event.venue,
        address: withoutRepeats('', [event.city, event.state]).replace(/^, /, ''),
        cta: { ...indoreInfo.venue.cta, href: `https://www.google.com/maps/search/?api=1&query=${mapQuery}` },
      },
      details: { ...indoreInfo.details, dates, timing },
    },
  }
}

export type IndoreView = ReturnType<typeof resolveIndoreView>
