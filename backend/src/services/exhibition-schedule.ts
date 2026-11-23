const indiaOffsetMinutes = 5 * 60 + 30

export function toIndiaSqlDateTime(value: string) {
  return value.slice(0, 19).replace('T', ' ')
}

export function currentIndiaSqlDateTime(now = new Date()) {
  return new Date(now.getTime() + indiaOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')
}

export function isScheduleActive(endDate: string | null, now = Date.now()) {
  if (!endDate) return false
  const endTime = Date.parse(endDate)
  return Number.isFinite(endTime) && endTime >= now
}
