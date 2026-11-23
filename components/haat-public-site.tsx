import { PublicShell } from './public-shell'
import { HeroSection } from './home/hero-section'
import { UpcomingExhibitions } from './home/upcoming-exhibitions'
import { FeatureGrid } from './home/feature-grid'
import { FeaturedArtists } from './home/featured-artists'
import { GuestFeedbackSection } from './home/guest-feedback-section'
import { VenuePartners } from './home/venue-partners'
import { GalleryStrip } from './home/gallery-strip'
import { ImpactStrip } from './home/impact-strip'
import { EventHighlights } from './home/event-highlights'
import { MutualValueSection } from './mutual-value-section'
import { InvitedGuestsMarquee } from './invited-guests-marquee'
import type { SiteContent } from '@/lib/site-content'
import type { AboutTeamMember, HomepageExhibitionAnnouncement, InvitedGuest, MediaPartner, PublicGuestFeedback } from '@/lib/api'
import type { DirectoryArtist } from '@/lib/booking-server'
import { defaultHomepageContent, type HomepageContent, type HomepageHeroMedia } from '@/lib/homepage-content'
import { ScrollReveal } from '@/components/motion/scroll-reveal'
import { hasNotExpired } from '@/lib/exhibitions-schedule'
import { MediaAlliancesMarquee } from '@/components/media-alliances-marquee'

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

export function HaatPublicSite({
  events,
  homepageExhibitions,
  eventsUnavailable,
  apiBaseUrl,
  homepageMedia,
  homepageHeroMedia,
  content,
  artists: directoryArtists,
  guestFeedback,
  homepageContent,
  homepageHighlights,
  invitedGuests,
  leadership,
  mediaPartners,
}: {
  events: HomeEvent[]
  homepageExhibitions: HomepageExhibitionAnnouncement[]
  eventsUnavailable: boolean
  apiBaseUrl: string
  homepageMedia: HomepageMediaMap
  homepageHeroMedia: HomepageHeroMedia
  content: SiteContent
  artists: DirectoryArtist[]
  guestFeedback: PublicGuestFeedback[]
  homepageContent: HomepageContent
  homepageHighlights: HomepageContent['highlights']
  invitedGuests: InvitedGuest[]
  leadership: AboutTeamMember[]
  mediaPartners: MediaPartner[]
}) {
  const abs = (url: string | null | undefined) => (url ? (/^https?:\/\//i.test(url) ? url : `${apiBaseUrl}${url}`) : undefined)
  const referenceMedia: Record<string, string> = {
    hero: '/media/exhibition-gallery.jpeg',
    glimpse: '/media/exhibition-gallery.jpeg',
    highlight1: '/media/live-mural.jpeg',
    highlight2: '/media/sculpture.jpeg',
    highlight3: '/media/sculpture.jpeg',
    highlight4: '/media/installation.jpeg',
    highlight5: '/media/exhibition-gallery.jpeg',
    gallery1: '/media/visual-art.jpeg',
    gallery2: '/media/ceramics.jpg',
    gallery3: '/media/live-mural.jpeg',
    gallery4: '/media/sculpture.jpeg',
    gallery5: '/media/installation.jpeg',
    venuePartner1: '',
    venuePartner2: '',
    venuePartner3: '',
    venuePartner4: '',
    venuePartner5: '',
  }
  const media = (key: string) => homepageMedia[key]
    ? abs(homepageMedia[key].url)
    : referenceMedia[key]
  const fallbackHeroSlides = [
    { image: media('hero') ?? '/media/exhibition-gallery.jpeg', alt: 'Warm-lit Indian art exhibition with contemporary paintings on display' },
    { image: '/media/exhibition-gallery.jpeg', alt: 'Artworks displayed in a gallery space' },
    { image: '/media/live-mural.jpeg', alt: 'Artist creating a mural during an exhibition' },
  ]
  const configuredHeroSlides = homepageHeroMedia.slides
    .filter((slide) => slide.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slide) => ({ image: abs(slide.imageUrl) ?? slide.imageUrl, alt: slide.altText, caption: slide.caption }))
  const heroSlides = homepageHeroMedia.slidesManaged ? configuredHeroSlides : fallbackHeroSlides
  const heroVideo = {
    ...homepageHeroMedia.video,
    url: abs(homepageHeroMedia.video.url) ?? '',
    posterUrl: abs(homepageHeroMedia.video.posterUrl) ?? '',
  }

  const eventCards = events.map((event, index) => {
    const image = event.media.find((item) => item.mediaType === 'IMAGE')
    const hasUsefulAlt = image?.altText.trim() && image.altText.trim() !== event.title.trim()
    const imageUrl = image && hasUsefulAlt ? abs(image.url) : undefined
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      venue: event.venue,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      image: imageUrl,
      alt: image && hasUsefulAlt ? image.altText.trim() : event.title,
      fallback: '/media/exhibition-gallery.jpeg',
      galleryImage: imageUrl,
    }
  })
  const now = Date.now()
  const scheduledExhibitions = eventCards
    .filter((event) => hasNotExpired(event.endsAt, now))
    .map((event, index) => {
      const exhibitionImage = homepageMedia[`exhibition${index + 1}`]
      return exhibitionImage
        ? { ...event, image: abs(exhibitionImage.url), alt: exhibitionImage.altText, isFirstInState: false, state: '' }
        : { ...event, isFirstInState: false, state: '' }
    })
  const stateAnnouncements = homepageExhibitions.map((exhibition, index) => ({
    id: `announcement-${exhibition.id}`,
    title: exhibition.title,
    description: exhibition.description,
    venue: [exhibition.venue, exhibition.city, exhibition.state].filter(Boolean).join(', '),
    startsAt: exhibition.startsAt,
    endsAt: exhibition.endsAt,
    image: exhibition.imageKey ? media(exhibition.imageKey) : undefined,
    alt: exhibition.title,
    fallback: '/media/exhibition-gallery.jpeg',
    isFirstInState: exhibition.isFirstInState,
    state: exhibition.state,
  }))
  const exhibitions = [...stateAnnouncements, ...scheduledExhibitions]
    .filter((event) => hasNotExpired(event.endsAt, now))
    .sort((a, b) => {
      const startA = a.startsAt ? Date.parse(a.startsAt) : Number.POSITIVE_INFINITY
      const startB = b.startsAt ? Date.parse(b.startsAt) : Number.POSITIVE_INFINITY
      return (Number.isFinite(startA) ? startA : Number.POSITIVE_INFINITY)
        - (Number.isFinite(startB) ? startB : Number.POSITIVE_INFINITY)
    })
  const galleryImages = new Map<string, { id: string; image: string; alt: string }>()
  Object.entries(homepageMedia)
    .filter(([key, item]) => /^gallery[1-5]$/.test(key) && item.mimeType.startsWith('image/'))
    .forEach(([key, item]) => {
      const image = abs(item.url)
      if (image) galleryImages.set(image, { id: key, image, alt: item.altText })
    })
  for (const event of events) {
    for (const image of event.media.filter((item) => item.mediaType === 'IMAGE')) {
      const imageUrl = abs(image.url)
      if (imageUrl && !galleryImages.has(imageUrl)) {
        galleryImages.set(imageUrl, { id: image.id, image: imageUrl, alt: image.altText || event.title })
      }
    }
  }
  const galleryItems = [...galleryImages.values()].slice(0, 5)
  if (!galleryItems.length) {
    galleryItems.push(
      { id: 'gallery-visual-art', image: '/media/visual-art.jpeg', alt: 'Original artwork presented at The Haat of Art' },
      { id: 'gallery-ceramics', image: '/media/ceramics.jpg', alt: 'Handcrafted ceramics featured at The Haat of Art' },
      { id: 'gallery-sculpture', image: '/media/sculpture.jpeg', alt: 'Sculptural artwork displayed at an exhibition' },
      { id: 'gallery-installation', image: '/media/installation.jpeg', alt: 'Art installation in a gallery space' },
      { id: 'gallery-mural', image: '/media/live-mural.jpeg', alt: 'Artist creating a live mural at an exhibition' },
    )
  }
  const artists = directoryArtists.map((artist) => ({
    id: artist.id,
    slug: artist.slug,
    name: artist.displayName,
    role: artist.medium,
    city: artist.city,
    specialty: artist.specialty,
    image: artist.portraitUrl,
    artworkImage: artist.artworkUrl,
    artworkCount: artist.artworkCount,
  }))
  const aboutTitle = content.text.statementLine1?.trim() || 'About The Haat of'
  const aboutAccent = content.text.statementAccent?.trim() || 'Art'
  const aboutText = content.text.statementText?.trim() || 'The Haat of Art is a purpose-driven platform that brings together artists from diverse backgrounds and art forms through curated exhibitions, live performances and workshops. We provide a common space for emerging, established and specially-abled artists to showcase their work, connect with art lovers and grow within a vibrant art community.'
  const aboutImage = media('glimpse') || '/media/exhibition-gallery.jpeg'
  const venuePartners = homepageContent.venuePartners.map((partner, index) => ({
    id: `homepage-venue-partner-${index}`,
    name: partner.name,
    websiteUrl: null,
    logo: media(`venuePartner${index + 1}`),
  }))
  const eventImagePool = eventCards.map((event) => event.image).filter((image): image is string => Boolean(image))
  const eventHighlights = homepageHighlights.map((highlight, index) => ({
    ...highlight,
    id: `homepage-highlight-${index}`,
    image: media(`highlight${index + 1}`) || eventImagePool[index % Math.max(eventImagePool.length, 1)] || '/media/exhibition-gallery.jpeg',
  }))
  const visibility = { ...defaultHomepageContent.visibility, ...homepageContent.visibility }

  return (
    <PublicShell
      homepage
      logoUrl={media('logo') ?? '/media/logo.png'}
      logoAlt={homepageMedia.logo?.altText.trim() || 'The Haat of Art'}
    >
      {visibility.hero && <HeroSection
        slides={heroSlides}
        title={content.text.heroLine1?.trim() || 'Celebrating'}
        accent={content.text.heroAccent?.trim() || 'Indian Art & Artists'}
        eyebrow={content.text.heroKicker?.trim() || 'THE HAAT OF ART · PAN-INDIA EDITIONS'}
        intro={content.text.heroIntro?.trim() || 'A vibrant platform bringing together emerging, established, and specially-abled artists through curated exhibitions, live performances, and workshops.'}
        features={homepageContent.heroFeatures ?? defaultHomepageContent.heroFeatures}
        video={heroVideo}
        useFallbackSlides={!homepageHeroMedia.slidesManaged}
      />}
      {visibility.upcomingExhibitions && <ScrollReveal className="home-upcoming-reveal"><UpcomingExhibitions items={exhibitions} unavailable={eventsUnavailable} /></ScrollReveal>}
      {visibility.exploreArtSpaces && <ScrollReveal className="home-feature-reveal"><FeatureGrid items={homepageContent.categories} /></ScrollReveal>}
      {visibility.featuredArtists && <ScrollReveal><FeaturedArtists items={artists} /></ScrollReveal>}
      {(visibility.aboutStory || visibility.leadership || visibility.impact) && <ScrollReveal><ImpactStrip
        aboutImage={aboutImage}
        aboutAlt={homepageMedia.glimpse?.altText || 'A view inside The Haat of Art'}
        aboutTitle={aboutTitle}
        aboutAccent={aboutAccent}
        aboutText={aboutText}
        items={homepageContent.impact}
        leaders={leadership}
        apiBaseUrl={apiBaseUrl}
        showStory={visibility.aboutStory}
        showLeadership={visibility.leadership}
        showImpact={visibility.impact}
      /></ScrollReveal>}
      {visibility.invitedGuests && <InvitedGuestsMarquee page="home" guests={invitedGuests} />}
      {visibility.valueProposition && <ScrollReveal><MutualValueSection /></ScrollReveal>}
      {visibility.eventHighlights && <ScrollReveal><EventHighlights items={eventHighlights} /></ScrollReveal>}
      {visibility.gallery && <ScrollReveal><GalleryStrip items={galleryItems} /></ScrollReveal>}
      {visibility.communityTestimonials && <ScrollReveal><GuestFeedbackSection
        items={guestFeedback}
        fallbackItems={homepageContent.testimonials}
        images={[
          media('testimonial1'),
          media('testimonial2'),
          media('testimonial3'),
          media('testimonial4'),
          media('testimonial5'),
        ]}
      /></ScrollReveal>}
      {visibility.venuePartners && venuePartners.length > 0 && <ScrollReveal><section className="th-section th-partners-section"><VenuePartners partners={venuePartners} /></section></ScrollReveal>}
      {visibility.mediaAlliances && <MediaAlliancesMarquee page="home" partners={mediaPartners} />}
    </PublicShell>
  )
}

export default HaatPublicSite
