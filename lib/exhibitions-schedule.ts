import type { GalleryUpcomingEdition } from './booking-server'

const exhibitionTimeZone = 'Asia/Kolkata'

export function hasNotExpired(endDate: string | null | undefined, now = Date.now()) {
  if (!endDate) return true
  const endTime = Date.parse(endDate)
  return Number.isFinite(endTime) && endTime >= now
}

export function isUpcomingEditionActive(edition: GalleryUpcomingEdition, now = Date.now()) {
  if (!edition.endDate) return false
  return hasNotExpired(edition.endDate, now)
}

export function formatScheduleDateRange(edition: Pick<GalleryUpcomingEdition, 'startDate' | 'endDate'>) {
  const start = new Date(edition.startDate)
  const end = edition.endDate ? new Date(edition.endDate) : start
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone: exhibitionTimeZone, month: 'short', day: 'numeric' }
  const yearOptions: Intl.DateTimeFormatOptions = { timeZone: exhibitionTimeZone, year: 'numeric' }
  const startDate = new Intl.DateTimeFormat('en', dateOptions).format(start)
  const endDate = new Intl.DateTimeFormat('en', dateOptions).format(end)
  const startYear = new Intl.DateTimeFormat('en', yearOptions).format(start)
  const endYear = new Intl.DateTimeFormat('en', yearOptions).format(end)
  const sameMonth = start.toLocaleDateString('en', { timeZone: exhibitionTimeZone, month: 'numeric' })
    === end.toLocaleDateString('en', { timeZone: exhibitionTimeZone, month: 'numeric' })
  const sameDay = start.toLocaleDateString('en', { timeZone: exhibitionTimeZone })
    === end.toLocaleDateString('en', { timeZone: exhibitionTimeZone })

  if (sameDay) return `${startDate}, ${startYear}`
  if (sameMonth && startYear === endYear) {
    const startDay = new Intl.DateTimeFormat('en', { timeZone: exhibitionTimeZone, day: 'numeric' }).format(start)
    return `${startDate.replace(/\s+\d+$/, '')} ${startDay}–${endDate.match(/\d+$/)?.[0]}, ${startYear}`
  }
  return `${startDate}, ${startYear} – ${endDate}, ${endYear}`
}

export function formatScheduleYearRange(editions: GalleryUpcomingEdition[]) {
  const years = [...new Set(editions.map((edition) => new Intl.DateTimeFormat('en', {
    timeZone: exhibitionTimeZone,
    year: 'numeric',
  }).format(new Date(edition.startDate))))].sort()

  if (!years.length) return 'Dates to be announced'
  if (years.length === 1) return years[0]
  return `${years[0]} – ${years[years.length - 1]}`
}

export function toIndiaDateTime(date: string, endOfDay = false) {
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}+05:30`
}

export function toDateInputValue(value: string | null) {
  return value?.slice(0, 10) ?? ''
}
