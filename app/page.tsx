import HaatPublicSite from '@/components/haat-public-site'
import type { SiteContent } from '@/lib/site-content'
import { getBlogPosts, getGuests, type PublicGuest, type PublicGuestFeedback } from '@/lib/api'

type HomeEvent = {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  venue: string
  status: string
  media: {
    id: string
    altText: string
    mediaType: 'IMAGE' | 'VIDEO'
    url: string
  }[]
}

type HomepageMedia = {
  mimeType: string
  altText: string
  url: string
}

type HomepageMediaMap = Record<string, HomepageMedia>

export const dynamic = 'force-dynamic'

function isHomeEvent(value: unknown): value is HomeEvent {
  if (!value || typeof value !== 'object') return false
  const event = value as Record<string, unknown>
  return typeof event.id === 'string'
    && typeof event.title === 'string'
    && typeof event.description === 'string'
    && typeof event.startsAt === 'string'
    && typeof event.endsAt === 'string'
    && typeof event.venue === 'string'
    && typeof event.status === 'string'
    && Array.isArray(event.media)
    && event.media.every((item) => item
      && typeof item === 'object'
      && 'id' in item && typeof item.id === 'string'
      && 'altText' in item && typeof item.altText === 'string'
      && 'mediaType' in item && (item.mediaType === 'IMAGE' || item.mediaType === 'VIDEO')
      && 'url' in item && typeof item.url === 'string')
}

function isHomepageMediaMap(value: unknown): value is HomepageMediaMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((item) => item
    && typeof item === 'object'
    && 'mimeType' in item && typeof item.mimeType === 'string'
    && 'altText' in item && typeof item.altText === 'string'
    && 'url' in item && typeof item.url === 'string')
}

export default async function Page() {
  const apiBaseUrl = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
  let events: HomeEvent[] = []
  let eventsUnavailable = false
  let homepageMedia: HomepageMediaMap = {}

  const [eventsResult, mediaResult, contentResult] = await Promise.allSettled([
    fetch(`${apiBaseUrl}/api/events`, { cache: 'no-store' }),
    fetch(`${apiBaseUrl}/api/homepage/media`, { cache: 'no-store' }),
    fetch(`${apiBaseUrl}/api/content`, { cache: 'no-store' }),
  ])
  let content: SiteContent = { text: {}, artists: [], artworks: [] }
  if (contentResult.status === 'fulfilled' && contentResult.value.ok) {
    try {
      const data = await contentResult.value.json() as Partial<SiteContent>
      content = {
        text: data.text && typeof data.text === 'object' ? data.text : {},
        artists: Array.isArray(data.artists) ? data.artists : [],
        artworks: Array.isArray(data.artworks) ? data.artworks : [],
      }
    } catch (error) {
      console.error('[homepage] Could not parse site content', error instanceof Error ? error.message : 'Unknown error')
    }
  } else {
    console.error('[homepage] Could not load site content')
  }
  if (eventsResult.status === 'fulfilled') {
    try {
      if (!eventsResult.value.ok) throw new Error(`Events API returned ${eventsResult.value.status}`)
      const data: unknown = await eventsResult.value.json()
      if (!Array.isArray(data) || !data.every(isHomeEvent)) throw new Error('Events API returned an invalid response')
      events = data
    } catch (error) {
      console.error('[homepage] Could not load events', error instanceof Error ? error.message : 'Unknown error')
      eventsUnavailable = true
    }
  } else {
    console.error('[homepage] Could not connect to the events API', eventsResult.reason)
    eventsUnavailable = true
  }

  if (mediaResult.status === 'fulfilled') {
    try {
      if (!mediaResult.value.ok) throw new Error(`Homepage media API returned ${mediaResult.value.status}`)
      const data: unknown = await mediaResult.value.json()
      if (!isHomepageMediaMap(data)) throw new Error('Homepage media API returned an invalid response')
      homepageMedia = data
    } catch (error) {
      console.error('[homepage] Could not load homepage media', error instanceof Error ? error.message : 'Unknown error')
    }
  } else {
    console.error('[homepage] Could not connect to homepage media API', mediaResult.reason)
  }

  const posts = (await getBlogPosts()) ?? []
  const guestData = await getGuests()
  const guests: PublicGuest[] = Array.isArray(guestData?.guests) ? guestData.guests : []
  const guestFeedback: PublicGuestFeedback[] = Array.isArray(guestData?.feedback) ? guestData.feedback : []

  return <HaatPublicSite events={events} eventsUnavailable={eventsUnavailable} apiBaseUrl={apiBaseUrl} homepageMedia={homepageMedia} content={content} posts={posts} guests={guests} guestFeedback={guestFeedback} />
}
