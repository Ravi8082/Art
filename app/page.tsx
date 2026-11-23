import HaatPublicSite from '@/components/haat-public-site'
import type { SiteContent } from '@/lib/site-content'
import { getGuests, getHomepageContent, getHomepageHighlights, getInvitedGuests, getMediaPartners, getPublishedAbout, type AboutTeamMember, type HomepageExhibitionAnnouncement, type InvitedGuest, type MediaPartner, type PublicGuestFeedback } from '@/lib/api'
import { getArtistDirectory } from '@/lib/booking-server'
import type { Metadata } from 'next'
import { defaultHomepageContent, defaultHomepageHeroMedia, type HomepageHeroMedia } from '@/lib/homepage-content'

export const metadata: Metadata = { alternates: { canonical: '/' } }
export const dynamic = 'force-dynamic'

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

function isHomepageExhibition(value: unknown): value is HomepageExhibitionAnnouncement {
  if (!value || typeof value !== 'object') return false
  const exhibition = value as Record<string, unknown>
  return typeof exhibition.id === 'string'
    && typeof exhibition.title === 'string'
    && typeof exhibition.description === 'string'
    && typeof exhibition.state === 'string'
    && typeof exhibition.city === 'string'
    && typeof exhibition.venue === 'string'
    && (exhibition.startsAt === null || typeof exhibition.startsAt === 'string')
    && (exhibition.endsAt === null || typeof exhibition.endsAt === 'string')
    && typeof exhibition.isFirstInState === 'boolean'
    && (exhibition.imageKey === null || exhibition.imageKey === 'exhibition1' || exhibition.imageKey === 'exhibition2' || exhibition.imageKey === 'exhibition3')
}

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

function isHomepageHeroMedia(value: unknown): value is HomepageHeroMedia {
  if (!value || typeof value !== 'object') return false
  const media = value as Record<string, unknown>
  if (!Array.isArray(media.slides) || typeof media.slidesManaged !== 'boolean' || !media.video || typeof media.video !== 'object') return false
  const video = media.video as Record<string, unknown>
  return media.slides.every((slide) => slide
    && typeof slide === 'object'
    && 'id' in slide && typeof slide.id === 'string'
    && 'imageUrl' in slide && typeof slide.imageUrl === 'string'
    && 'altText' in slide && typeof slide.altText === 'string'
    && 'caption' in slide && typeof slide.caption === 'string'
    && 'sortOrder' in slide && typeof slide.sortOrder === 'number'
    && 'isActive' in slide && typeof slide.isActive === 'boolean')
    && typeof video.url === 'string'
    && typeof video.posterUrl === 'string'
    && typeof video.enabled === 'boolean'
    && typeof video.autoplay === 'boolean'
    && typeof video.loop === 'boolean'
}

export default async function Page() {
  const apiBaseUrl = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
  let events: HomeEvent[] = []
  let eventsUnavailable = false
  let homepageExhibitions: HomepageExhibitionAnnouncement[] = []
  let homepageMedia: HomepageMediaMap = {}

  const [eventsResult, mediaResult, contentResult, homepageExhibitionsResult, heroMediaResult] = await Promise.allSettled([
    fetch(`${apiBaseUrl}/api/events`, { next: { revalidate: 30 } }),
    fetch(`${apiBaseUrl}/api/homepage/media`, { next: { revalidate: 30 } }),
    fetch(`${apiBaseUrl}/api/content`, { next: { revalidate: 30 } }),
    fetch(`${apiBaseUrl}/api/homepage/exhibitions`, { next: { revalidate: 30 } }),
    fetch(`${apiBaseUrl}/api/homepage`, { cache: 'no-store' }),
  ])
  let content: SiteContent = { text: {}, artists: [], artworks: [] }
  let homepageHeroMedia: HomepageHeroMedia = defaultHomepageHeroMedia
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

  if (heroMediaResult.status === 'fulfilled') {
    try {
      if (!heroMediaResult.value.ok) throw new Error(`Homepage hero API returned ${heroMediaResult.value.status}`)
      const data: unknown = await heroMediaResult.value.json()
      if (!isHomepageHeroMedia(data)) throw new Error('Homepage hero API returned an invalid response')
      homepageHeroMedia = data
    } catch (error) {
      console.error('[homepage] Could not load hero media', error instanceof Error ? error.message : 'Unknown error')
    }
  } else {
    console.error('[homepage] Could not connect to hero media API', heroMediaResult.reason)
  }

  if (homepageExhibitionsResult.status === 'fulfilled') {
    try {
      if (!homepageExhibitionsResult.value.ok) throw new Error(`Homepage exhibitions API returned ${homepageExhibitionsResult.value.status}`)
      const data: unknown = await homepageExhibitionsResult.value.json()
      if (!Array.isArray(data) || !data.every(isHomepageExhibition)) throw new Error('Homepage exhibitions API returned an invalid response')
      homepageExhibitions = data
    } catch (error) {
      console.error('[homepage] Could not load state announcements', error instanceof Error ? error.message : 'Unknown error')
    }
  } else {
    console.error('[homepage] Could not connect to homepage exhibitions', homepageExhibitionsResult.reason)
  }

  const [guestResult, artistDirectoryResult, homepageContentResult, homepageHighlightsResult, invitedGuestsResult, aboutResult, mediaPartnersResult] = await Promise.allSettled([
    getGuests(),
    getArtistDirectory(),
    getHomepageContent(),
    getHomepageHighlights(),
    getInvitedGuests('home'),
    getPublishedAbout(),
    getMediaPartners('home'),
  ])
  if (guestResult.status === 'rejected') console.error('[homepage] Could not load guests', guestResult.reason)
  if (artistDirectoryResult.status === 'rejected') console.error('[homepage] Could not load artist directory', artistDirectoryResult.reason)
  if (homepageContentResult.status === 'rejected') console.error('[homepage] Could not load homepage sections', homepageContentResult.reason)
  if (homepageHighlightsResult.status === 'rejected') console.error('[homepage] Could not load event highlights', homepageHighlightsResult.reason)
  if (invitedGuestsResult.status === 'rejected') console.error('[homepage] Could not load invited guests', invitedGuestsResult.reason)
  if (aboutResult.status === 'rejected') console.error('[homepage] Could not load leadership profiles', aboutResult.reason)
  if (mediaPartnersResult.status === 'rejected') console.error('[homepage] Could not load media partners', mediaPartnersResult.reason)
  const guestData = guestResult.status === 'fulfilled' ? guestResult.value : null
  const artists = artistDirectoryResult.status === 'fulfilled' ? artistDirectoryResult.value : []
  const homepageContent = homepageContentResult.status === 'fulfilled' ? homepageContentResult.value : defaultHomepageContent
  const homepageHighlights = homepageHighlightsResult.status === 'fulfilled'
    ? homepageHighlightsResult.value
    : defaultHomepageContent.highlights
  const invitedGuests: InvitedGuest[] = invitedGuestsResult.status === 'fulfilled' ? invitedGuestsResult.value : []
  const leadership: AboutTeamMember[] = (aboutResult.status === 'fulfilled' ? aboutResult.value?.state.team ?? [] : [])
    .filter((member) => member.isActive)
    .sort((a, b) => {
      const priority = (member: AboutTeamMember) => member.isFeaturedMentor ? 0 : /founder/i.test(member.role || member.designation) ? 1 : 2
      return priority(a) - priority(b) || a.sortOrder - b.sortOrder
    })
  const guestFeedback: PublicGuestFeedback[] = Array.isArray(guestData?.feedback) ? guestData.feedback : []
  const mediaPartners: MediaPartner[] = mediaPartnersResult.status === 'fulfilled' ? mediaPartnersResult.value : []

  return <HaatPublicSite events={events} homepageExhibitions={homepageExhibitions} eventsUnavailable={eventsUnavailable} apiBaseUrl={apiBaseUrl} homepageMedia={homepageMedia} homepageHeroMedia={homepageHeroMedia} content={content} artists={artists} guestFeedback={guestFeedback} homepageContent={homepageContent} homepageHighlights={homepageHighlights} invitedGuests={invitedGuests} leadership={leadership} mediaPartners={mediaPartners} />
}
