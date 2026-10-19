'use client'

import { PublicShell } from './public-shell'
import { HeroSection } from './home/hero-section'
import { UpcomingExhibitions } from './home/upcoming-exhibitions'
import { FeatureGrid } from './home/feature-grid'
import { AboutSection } from './home/about-section'
import { FeaturedArtists } from './home/featured-artists'
import { GuestsSection } from './home/guests-section'
import { GuestFeedbackSection } from './home/guest-feedback-section'
import { BlogSection } from './home/blog-section'
import { VenuePartners } from './home/venue-partners'
import type { SiteContent } from '@/lib/site-content'
import type { BlogSummary, PublicGuest, PublicGuestFeedback } from '@/lib/api'

type HomeEvent = {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  venue: string
  status: string
  media: { id: string; altText: string; mediaType: 'IMAGE' | 'VIDEO'; url: string }[]
}

type HomepageMediaMap = Record<string, { mimeType: string; altText: string; url: string }>

const heroKeys = ['hero', 'hero2', 'hero3'] as const

export function HaatPublicSite({
  events,
  apiBaseUrl,
  homepageMedia,
  content,
  posts,
  guests,
  guestFeedback,
}: {
  events: HomeEvent[]
  eventsUnavailable: boolean
  apiBaseUrl: string
  homepageMedia: HomepageMediaMap
  content: SiteContent
  posts: BlogSummary[]
  guests: PublicGuest[]
  guestFeedback: PublicGuestFeedback[]
}) {
  const abs = (url: string | null | undefined) => (url ? (url.startsWith('http') ? url : `${apiBaseUrl}${url}`) : undefined)
  const media = (key: string) => (homepageMedia[key] ? `${apiBaseUrl}${homepageMedia[key].url}` : undefined)
  const slides = heroKeys.flatMap((key) => (media(key) ? [{ src: media(key)!, alt: homepageMedia[key].altText }] : []))

  const exhibitions = events.slice(0, 3).map((event) => {
    const image = event.media.find((m) => m.mediaType === 'IMAGE')
    return { id: event.id, title: event.title, venue: event.venue, startsAt: event.startsAt, image: abs(image?.url), alt: image?.altText }
  })
  const artists = content.artists.map((a) => ({ id: a.id, name: a.name, role: a.bio.split(' — ')[0], image: abs(a.photoUrl) }))
  const blogs = posts.map((p) => ({ id: p.id, title: p.title, image: abs(p.coverUrl), date: p.publishedAt, href: `/blog/${p.id}` }))

  return (
    <PublicShell logoUrl={media('logo') ?? '/media/logo.png'} logoAlt={homepageMedia.logo?.altText ?? 'The Haat of Art'}>
      <HeroSection slides={slides} />
      <UpcomingExhibitions items={exhibitions} />
      <FeatureGrid />
      <AboutSection image={media('glimpse')} alt={homepageMedia.glimpse?.altText} videoUrl={media('film')} />
      <FeaturedArtists items={artists} />
      <GuestsSection items={guests} apiBaseUrl={apiBaseUrl} />
      <GuestFeedbackSection items={guestFeedback} />
      <section className="th-section th-spotlight">
        <BlogSection items={blogs} />
        <VenuePartners />
      </section>
    </PublicShell>
  )
}

export default HaatPublicSite
