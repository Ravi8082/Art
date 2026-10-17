import { cookies } from 'next/headers'
import { apiBaseUrl, type BookingUser, type Exhibition, type StallType } from './booking-api'

async function readJson<T>(path: string, forwardCookie: boolean): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (forwardCookie) {
      const jar = await cookies()
      const serialized = jar.getAll().map((entry) => `${entry.name}=${entry.value}`).join('; ')
      if (serialized) headers.cookie = serialized
    }
    const response = await fetch(`${apiBaseUrl}${path}`, { headers, cache: 'no-store' })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  }
}

export async function getExhibitionsForBooking() {
  return (await readJson<Exhibition[]>('/api/bookings/exhibitions', false)) ?? []
}

export async function getStallTypesForBooking() {
  return (await readJson<StallType[]>('/api/bookings/stall-types', false)) ?? []
}

export async function getBookingUser() {
  const data = await readJson<{ user: BookingUser }>('/api/auth/me', true)
  return data?.user ?? null
}
