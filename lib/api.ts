import type { SiteContent } from './site-content'

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

export type BlogSummary = { id: string; title: string; excerpt: string; author: string; publishedAt: string; coverUrl: string | null }
export type BlogPost = BlogSummary & { body: string }

export type AboutSection = { sectionKey: string; title: string; subtitle: string; bodyHtml: string | null; imageUrl: string | null; imagePosition: 'left' | 'right'; visible: number; sortOrder: number }
export type AboutTeamMember = { id: string; name: string; designation: string; bio: string; photoUrl: string | null; facebookUrl: string | null; linkedinUrl: string | null; instagramUrl: string | null; sortOrder: number; active: number }
export type AboutPartner = { id: string; name: string; category: string; websiteUrl: string | null; logoUrl: string | null; sortOrder: number; active: number }
export type AboutState = { sections: AboutSection[]; team: AboutTeamMember[]; partners: AboutPartner[] }

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

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { cache: 'no-store' })
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

export async function getPublishedAbout(): Promise<{ state: AboutState; publishedAt: string } | null> {
  const data = await getJson<{ published: { state: AboutState; publishedAt: string } | null }>('/api/about')
  return data?.published ?? null
}

export async function getGuests(): Promise<{ guests: PublicGuest[]; feedback: PublicGuestFeedback[] } | null> {
  return getJson<{ guests: PublicGuest[]; feedback: PublicGuestFeedback[] }>('/api/guests')
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
