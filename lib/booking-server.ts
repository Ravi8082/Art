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

export type ArtistProfileData = {
  profile: null | {
    displayName: string; headline: string; city: string; state: string; phone: string; artStyle: string; bio: string | null
    websiteUrl: string; instagramUrl: string; facebookUrl: string; photoUrl: string | null; coverUrl: string | null
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'; reviewNote?: string | null
  }
  artworks: { id: string; title: string; medium: string; dimensions: string; year: number | null; price: number | null; description: string; imageUrl: string; createdAt: string }[]
}

export type PublicArtist = { userId: string; displayName: string; headline: string; city: string; state: string; artStyle: string; imageUrl: string | null }

export async function getPublicArtists() {
  return (await readJson<PublicArtist[]>('/api/artist-profile/public', false)) ?? []
}

export async function getPublicArtist(userId: string) {
  const data = await readJson<{ profile: Omit<NonNullable<ArtistProfileData['profile']>, 'phone'>; artworks: ArtistProfileData['artworks'] }>(`/api/artist-profile/public/${encodeURIComponent(userId)}`, false)
  return data
}

export async function getMyArtistProfile() {
  return (await readJson<ArtistProfileData>('/api/artist-profile/me', true)) ?? { profile: null, artworks: [] }
}