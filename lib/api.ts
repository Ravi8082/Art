import type { SiteContent } from './site-content'
import { mergeSiteSettings, type SiteSettings } from './site-settings'
import { defaultHomepageContent, type HomepageContent } from './homepage-content'

export const apiBaseUrl = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export type PublicEvent = {
  id: string
  slug: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  venue: string
  city: string
  media: { id: string; altText: string; mediaType: 'IMAGE' | 'VIDEO'; url: string }[]
}

export type HomepageExhibitionAnnouncement = {
  id: string
  title: string
  description: string
  state: string
  city: string
  venue: string
  startsAt: string | null
  endsAt: string | null
  isFirstInState: boolean
  imageKey: 'exhibition1' | 'exhibition2' | 'exhibition3' | null
}

export type BlogSummary = { id: string; title: string; excerpt: string; author: string; publishedAt: string; coverUrl: string | null }
export type BlogMedia = { id: string; mediaType: 'IMAGE' | 'VIDEO'; url: string }
export type BlogPost = BlogSummary & { body: string; media?: BlogMedia[] }

export type AboutSection = { sectionKey: string; title: string; subtitle: string; bodyHtml: string | null; imageUrl: string | null; imagePosition: 'left' | 'right'; linkUrl?: string | null; buttonLabel?: string | null; visible: number; sortOrder: number }
export type AboutSettings = {
  heroKicker: string; heroTitle: string; heroSubtitle: string; heroImageUrl: string | null; heroVisible: boolean
  heroImageAssetId?: string | null
  storyKicker: string; storyHeading: string; storyBodyHtml: string | null; storyImageUrl: string | null; storyImagePosition: 'left' | 'right'; storyTags: string[]; storyVisible: boolean
  storyImageAssetId?: string | null
  journeyKicker: string; journeyHeading: string; journeyVisible: boolean
  ecosystemKicker: string; ecosystemHeading: string; ecosystemSubtitle: string
}
export type AboutMetric = { id: number; metricKey: string; value: string; label: string; sublabel: string; sortOrder: number; isVisible: boolean }
export type AboutMilestone = { id: number; milestoneKey: string; yearRange: string; title: string; description: string; sortOrder: number; isVisible: boolean }
export type AboutVisionMission = { sectionKey: 'vision' | 'mission'; title: string; bodyHtml: string | null; sortOrder: number; isVisible: boolean }
export type AboutEcosystemCard = { id: number; cardKey: string; title: string; lead: string; bodyHtml: string | null; sortOrder: number; isVisible: boolean }
export type AboutTeamMember = { id: string; name: string; designation: string; role: string; badgeLabel: string; isFeaturedMentor: boolean; bio: string; photoUrl: string | null; facebookUrl: string | null; linkedinUrl: string | null; instagramUrl: string | null; sortOrder: number; active: number; isActive: boolean }
export type AboutPartner = { id: string; name: string; shortCode: string; category: string; websiteUrl: string | null; logoUrl: string | null; sortOrder: number; active: number; isActive: boolean }
export type AboutState = {
  sections: AboutSection[]
  settings: AboutSettings | null
  metrics: AboutMetric[]
  milestones: AboutMilestone[]
  visionMission: AboutVisionMission[]
  ecosystemCards: AboutEcosystemCard[]
  team: AboutTeamMember[]
  partners: AboutPartner[]
}
export type PublicContactSettings = {
  address: string
  phones: string[]
  email: string
  hours: string
  socialLinks: { label: string; url: string }[]
}

export type PublicGuest = {
  id: string
  name: string
  role: string
  eventName: string
  bio: string
  photoUrl: string | null
  instagramUrl: string | null
  websiteUrl: string | null
  sortOrder: number
  active: boolean
}
export type PublicGuestFeedback = {
  id: string
  guestId: string | null
  guestName: string | null
  authorName: string
  authorRole: string
  message: string
  rating: number
  sortOrder: number
  active: boolean
}
export type InvitedGuestsPage = 'home' | 'about' | 'gallery' | 'exhibitions'
export type InvitedGuest = {
  id: string
  name: string
  roleBadge: string
  designation: string
  roleSummary: string
  editionTag: string
  photoUrl: string | null
  isPlaceholder?: boolean
  sortOrder: number
  isActive: boolean
  showOnHome: boolean
  showOnAbout: boolean
  showOnGallery: boolean
  showOnExhibitions: boolean
}
export type MediaPartnerPage = 'home' | 'about' | 'exhibitions'
export type MediaPartner = {
  id: string
  name: string
  category: string
  logoUrl: string | null
  websiteUrl: string | null
  sortOrder: number
  isActive: boolean
  showOnHome: boolean
  showOnAbout: boolean
  showOnExhibitions: boolean
}

export type EventFlowPhase = {
  id: 'pre-event' | 'inauguration' | 'showcase' | 'felicitation' | 'closing'
  number: string
  title: string
  timeframe: string
  audience: string[]
  introduction: string
  activities: string[]
  imageUrl: string
}
export type EventFlowContent = {
  kicker: string
  title: string
  subtitle: string
  phases: EventFlowPhase[]
  schedule: { day: string; title: string; items: { period: 'Morning' | 'Afternoon' | 'Evening'; time: string; activity: string }[] }[]
  ctaTitle: string
}

const publicDataRevalidateSeconds = 30

async function getJson<T>(path: string, cache: 'revalidate' | 'no-store' = 'revalidate'): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, cache === 'no-store'
      ? { cache: 'no-store' }
      : { next: { revalidate: publicDataRevalidateSeconds } })
    if (!response.ok) return null
    return await response.json() as T
  } catch {
    return null
  }
}

export async function getContent(): Promise<SiteContent> {
  const data = await getJson<Partial<SiteContent>>('/api/content')
  return {
    text: data?.text ?? {},
    artists: data?.artists ?? [],
    artworks: data?.artworks ?? [],
  }
}

export async function getExhibitInfo() {
  return getJson<ExhibitInfo>('/api/bookings/exhibit-info')
}

export type ExhibitInfo = {
  stallTypes: { id: string; code: string; name: string; category: 'INDIVIDUAL' | 'GROUP' | 'GALLERY'; widthM: number; depthM: number; price: number; taxRate: number; includes: string | null }[]
  window: { startsAt: string | null; endsAt: string | null; upcoming: number }
  stats: { events: number; stallsBooked: number; visitors: number; artists: number; openStalls: number }
}

export type PublicExhibitionStallCatalog = {
  stallTypes: {
    id: string
    code: string
    name: string
    category: 'INDIVIDUAL' | 'GROUP' | 'GALLERY'
    widthM: number
    depthM: number
    includes: string | null
  }[]
  editions: {
    eventId: string
    title: string
    city: string
    venue: string
    startsAt: string
    endsAt: string
    rates: Record<string, { price: number; taxRate: number }>
  }[]
}

export async function getExhibitionStallCatalog() {
  return getJson<PublicExhibitionStallCatalog>('/api/exhibitions/stalls', 'no-store')
}

export async function getEvents() {
  return getJson<PublicEvent[]>('/api/events')
}

export async function getLogo(): Promise<{ url: string; altText: string } | null> {
  const media = await getHomepageMedia()
  return media?.logo ?? null
}

export async function getHomepageMedia() {
  return getJson<Record<string, { url: string; altText: string }>>('/api/homepage/media')
}

export async function getBlogPosts() {
  return (await getJson<{ posts: BlogSummary[] }>('/api/content/blog'))?.posts ?? null
}

export function getBlogPost(id: string) {
  return getJson<BlogPost>(`/api/content/blog/${encodeURIComponent(id)}`)
}

export async function getPublishedAbout(): Promise<{ state: AboutState; publishedAt: string | null } | null> {
  const data = await getJson<{ published: { state: AboutState; publishedAt: string | null } | null }>('/api/about', 'no-store')
  return data?.published ?? null
}

export async function getContactSettings(): Promise<PublicContactSettings | null> {
  const data = await getJson<{ contact: PublicContactSettings }>('/api/settings/contact', 'no-store')
  return data?.contact ?? null
}

export async function getGuests(): Promise<{ guests: PublicGuest[]; feedback: PublicGuestFeedback[] } | null> {
  return getJson<{ guests: PublicGuest[]; feedback: PublicGuestFeedback[] }>('/api/guests')
}

function isInvitedGuest(value: unknown): value is InvitedGuest {
  if (!value || typeof value !== 'object') return false
  const guest = value as Record<string, unknown>
  return typeof guest.id === 'string'
    && typeof guest.name === 'string'
    && typeof guest.roleBadge === 'string'
    && typeof guest.designation === 'string'
    && typeof guest.roleSummary === 'string'
    && typeof guest.editionTag === 'string'
    && (guest.photoUrl === null || typeof guest.photoUrl === 'string')
    && typeof guest.sortOrder === 'number'
    && typeof guest.isActive === 'boolean'
    && typeof guest.showOnHome === 'boolean'
    && typeof guest.showOnAbout === 'boolean'
    && typeof guest.showOnGallery === 'boolean'
    && typeof guest.showOnExhibitions === 'boolean'
}

export async function getInvitedGuests(page: InvitedGuestsPage): Promise<InvitedGuest[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/invited-guests?page=${page}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Invited guests API returned ${response.status}`)
    const data: unknown = await response.json()
    if (!Array.isArray(data) || !data.every(isInvitedGuest)) throw new Error('Invited guests API returned an invalid response')
    return data.map((guest: InvitedGuest) => ({
      ...guest,
      photoUrl: guest.photoUrl && !guest.photoUrl.startsWith('http') ? `${apiBaseUrl}${guest.photoUrl}` : guest.photoUrl,
    }))
  } catch (error) {
    console.error(`[invited-guests] Could not load ${page} guests`, error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

export async function getMediaPartners(page: MediaPartnerPage): Promise<MediaPartner[]> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/media-partners?page=${page}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`Media partners API returned ${response.status}`)
    const data: unknown = await response.json()
    if (!Array.isArray(data) || !data.every((item) => item
      && typeof item === 'object'
      && 'id' in item && typeof item.id === 'string'
      && 'name' in item && typeof item.name === 'string'
      && 'category' in item && typeof item.category === 'string'
      && 'logoUrl' in item && (item.logoUrl === null || typeof item.logoUrl === 'string')
      && 'websiteUrl' in item && (item.websiteUrl === null || typeof item.websiteUrl === 'string')
      && 'sortOrder' in item && typeof item.sortOrder === 'number'
      && 'isActive' in item && typeof item.isActive === 'boolean'
      && 'showOnHome' in item && typeof item.showOnHome === 'boolean'
      && 'showOnAbout' in item && typeof item.showOnAbout === 'boolean'
      && 'showOnExhibitions' in item && typeof item.showOnExhibitions === 'boolean')) {
      throw new Error('Media partners API returned an invalid response')
    }
    return data.map((partner: MediaPartner) => ({
      ...partner,
      logoUrl: partner.logoUrl && !partner.logoUrl.startsWith('http') ? `${apiBaseUrl}${partner.logoUrl}` : partner.logoUrl,
    }))
  } catch (error) {
    console.error(`[media-partners] Could not load ${page} partners`, error instanceof Error ? error.message : 'Unknown error')
    return []
  }
}

export async function getEventFlow(): Promise<EventFlowContent | null> {
  return getJson<EventFlowContent>('/api/event-flow', 'no-store')
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const data = await getJson<{ settings: Partial<SiteSettings> | null }>('/api/site-settings')
  return mergeSiteSettings(data?.settings)
}

export async function getHomepageContent(): Promise<HomepageContent> {
  const data = await getJson<{ homepage: HomepageContent | null }>('/api/site-settings/homepage')
  return data?.homepage ?? defaultHomepageContent
}

export async function getHomepageHighlights(): Promise<HomepageContent['highlights']> {
  const data = await getJson<{ highlights: HomepageContent['highlights'] }>('/api/highlights')
  if (!Array.isArray(data?.highlights) || !data.highlights.every((item) =>
    item && typeof item.title === 'string' && typeof item.description === 'string')) {
    return defaultHomepageContent.highlights
  }
  return data.highlights.length ? data.highlights : defaultHomepageContent.highlights
}

export async function getShell() {
  const [content, logo] = await Promise.all([getContent(), getLogo()])
  const footer = content.text.footerLocations
  return {
    content,
    shell: { logoUrl: logo ? `${apiBaseUrl}${logo.url}` : undefined, logoAlt: logo?.altText, footerLocations: footer || undefined },
  }
}

export function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date to be confirmed'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
