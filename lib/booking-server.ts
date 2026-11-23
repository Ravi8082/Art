import { cookies } from 'next/headers'
import { type BookingUser, type Exhibition } from './booking-api'

const serverApiBaseUrl = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

async function readJson<T>(path: string, forwardCookie: boolean, noStore = false): Promise<T | null> {
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (forwardCookie) {
      const jar = await cookies()
      const serialized = jar.getAll().map((entry) => `${entry.name}=${entry.value}`).join('; ')
      if (serialized) headers.cookie = serialized
    }
    const response = await fetch(`${serverApiBaseUrl}${path}`, forwardCookie || noStore
      ? { headers, cache: 'no-store' }
      : { headers, next: { revalidate: 30 } })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  }
}

export async function getExhibitionsForBooking() {
  return (await readJson<Exhibition[]>('/api/bookings/exhibitions', false, true)) ?? []
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

export type PublicArtistArtwork = {
  id: string
  title: string
  medium: string
  artistId: string
  url: string | null
}

export type DirectoryArtist = {
  id: string
  slug: string
  displayName: string
  city: string
  state: string
  medium: string
  specialty: string
  bio: string
  artistStatement: string
  practiceDetail: string
  activeSince: number
  coreThemes: string[]
  exhibitionHistory: string[]
  portraitUrl: string
  artworkUrl: string
  artworkCount: number
  rosterBadge: string | null
  isSpotlight: boolean
  spotlightQuote: string | null
}

export type DirectoryArtwork = {
  id: string
  title: string
  medium: string
  dimensions: string
  year: number | null
  description: string
  imageUrl: string
  status: 'AVAILABLE' | 'EXHIBITION_PIECE' | 'SOLD'
  priceAmount: number | null
}

export type CuratedGalleryArtwork = {
  id: string
  title: string
  artistId: string
  artistName: string
  artistSlug: string
  medium: string
  dimensions: string
  year: number
  city: string
  price: number
  status: 'AVAILABLE' | 'COLLECTORS_PICK' | 'SOLD'
  description: string
  imageUrl: string
}

export type ExhibitionArchiveMedia = {
  id: string
  editionId: string
  mediaType: 'IMAGE' | 'VIDEO'
  sourceType: 'ASSET' | 'UPLOAD' | 'YOUTUBE'
  sourceUrl?: string | null
  mimeType?: string | null
  caption: string
  artistName: string
  stallName: string
  altText: string
  durationSeconds: number | null
  sortOrder: number
  url: string | null
  embedUrl: string | null
}

export type ExhibitionArchiveEdition = {
  id: string
  editionKey: string
  title: string
  editionNumber: string
  city: string
  monthLabel: string
  startDate: string | null
  endDate: string | null
  dateIsExact: boolean
  venue: string
  artistCount: number
  media: ExhibitionArchiveMedia[]
}

export type GalleryUpcomingEdition = {
  id: string
  editionKey: string
  title: string
  scheduleLabel: string
  cityLabel: string
  venue: string
  startDate: string
  endDate: string | null
  statusLabel: string
  published: boolean
  showOnGallery: boolean
}

export async function getArtistDirectory() {
  return (await readJson<DirectoryArtist[]>('/api/artists', false)) ?? []
}

export async function getArtistDirectoryProfile(slug: string) {
  return readJson<{ artist: DirectoryArtist; artworks: DirectoryArtwork[] }>(`/api/artists/${encodeURIComponent(slug)}`, false)
}

export async function getCuratedGallery() {
  return (await readJson<CuratedGalleryArtwork[]>('/api/artists/curated-gallery', false)) ?? []
}

export async function getExhibitionArchive() {
  return (await readJson<ExhibitionArchiveEdition[]>('/api/exhibition-archive', false)) ?? []
}

export async function getGalleryUpcomingEditions() {
  return (await readJson<GalleryUpcomingEdition[]>('/api/exhibition-archive/upcoming', false, true)) ?? []
}

export async function getPublicArtists() {
  return (await readJson<PublicArtist[]>('/api/artist-profile/public', false)) ?? []
}

const featuredPortraitSlugs = new Set(['vikramaditya-rathore', 'pratibha-yadav', 'aarav-deshmukh', 'saroj'])
const artworkPortraitFallbackSlugs = new Set(['aarav-deshmukh', 'vikramaditya-rathore'])

function normalizeArtistName(name: string) {
  return name.trim().toLocaleLowerCase().replace(/[^a-z]/g, '')
}

export async function getFeaturedArtistDirectory() {
  const [artists, publicArtists] = await Promise.all([getArtistDirectory(), getPublicArtists()])
  const uploadedPortraits = new Map<string, string>()
  for (const artist of publicArtists) {
    if (artist.imageUrl?.trim()) uploadedPortraits.set(normalizeArtistName(artist.displayName), artist.imageUrl.trim())
  }

  return artists.map((artist) => {
    if (!featuredPortraitSlugs.has(artist.slug)) return artist
    const uploadedPortrait = uploadedPortraits.get(normalizeArtistName(artist.displayName))
    return {
      ...artist,
      portraitUrl: uploadedPortrait
        ? /^https?:\/\//i.test(uploadedPortrait) ? uploadedPortrait : `${serverApiBaseUrl}${uploadedPortrait}`
        : artworkPortraitFallbackSlugs.has(artist.slug) ? artist.artworkUrl : '',
    }
  })
}

export async function getPublicArtistGallery() {
  return (await readJson<PublicArtistArtwork[]>('/api/artist-profile/public/gallery', false)) ?? []
}

export async function getPublicArtist(userId: string) {
  const data = await readJson<{ profile: Omit<NonNullable<ArtistProfileData['profile']>, 'phone'>; artworks: ArtistProfileData['artworks'] }>(`/api/artist-profile/public/${encodeURIComponent(userId)}`, false)
  return data
}

export async function getMyArtistProfile() {
  return (await readJson<ArtistProfileData>('/api/artist-profile/me', true)) ?? { profile: null, artworks: [] }
}