export type HomepageIcon = 'calendar' | 'users' | 'accessibility' | 'palette' | 'image' | 'landmark' | 'brush' | 'archive'

export type HomepageSectionVisibility = {
  hero: boolean
  upcomingExhibitions: boolean
  exploreArtSpaces: boolean
  featuredArtists: boolean
  aboutStory: boolean
  leadership: boolean
  impact: boolean
  invitedGuests: boolean
  valueProposition: boolean
  eventHighlights: boolean
  gallery: boolean
  communityTestimonials: boolean
  venuePartners: boolean
  mediaAlliances: boolean
}

export type HomepageContent = {
  heroFeatures: { icon: HomepageIcon; title: string; subtitle: string }[]
  categories: { icon: HomepageIcon; title: string; href: string }[]
  visibility: HomepageSectionVisibility
  mentor: { visible: boolean; name: string; title: string; bio: string }
  impact: { value: string; label: string }[]
  highlights: { title: string; description: string }[]
  testimonials: { authorName: string; authorRole: string; message: string }[]
  venuePartners: { name: string }[]
}

export type HomepageHeroSlide = {
  id: string
  imageUrl: string
  altText: string
  caption: string
  sortOrder: number
  isActive: boolean
}

export type HomepageHeroMedia = {
  slides: HomepageHeroSlide[]
  slidesManaged: boolean
  video: {
    url: string
    posterUrl: string
    enabled: boolean
    autoplay: boolean
    loop: boolean
  }
}

export const defaultHomepageHeroMedia: HomepageHeroMedia = {
  slides: [],
  slidesManaged: false,
  video: { url: '', posterUrl: '', enabled: false, autoplay: true, loop: true },
}

export const defaultHomepageContent: HomepageContent = {
  heroFeatures: [
    { icon: 'calendar', title: 'Exhibitions', subtitle: 'Across India' },
    { icon: 'users', title: 'Emerging to established', subtitle: 'Artists' },
    { icon: 'accessibility', title: 'Specially-abled', subtitle: 'Artists' },
    { icon: 'palette', title: 'Painting · Sculpture', subtitle: '3D Art & More' },
  ],
  categories: [
    { icon: 'palette', title: 'Art Design', href: '/gallery' },
    { icon: 'image', title: 'Art Gallery', href: '/gallery' },
    { icon: 'landmark', title: 'Art Institutes', href: '/about' },
    { icon: 'brush', title: 'Art Studio', href: '/artists' },
    { icon: 'archive', title: 'Artifacts', href: '/gallery' },
    { icon: 'users', title: 'Art For All', href: '/artists' },
  ],
  visibility: {
    hero: true,
    upcomingExhibitions: true,
    exploreArtSpaces: true,
    featuredArtists: true,
    aboutStory: true,
    leadership: true,
    impact: true,
    invitedGuests: true,
    valueProposition: true,
    eventHighlights: true,
    gallery: true,
    communityTestimonials: true,
    venuePartners: true,
    mediaAlliances: true,
  },
  mentor: {
    visible: true,
    name: 'Vinod Dara Singh',
    title: 'Our Mentor',
    bio: 'Strategic guidance and cultural mentorship for India’s emerging and established artists.',
  },
  impact: [
    { value: '2,500+', label: 'Exhibitors' },
    { value: '40,000+', label: 'Artworks Displayed' },
    { value: '77,000+', label: 'Visitors' },
    { value: '₹17.60 Cr+', label: 'Artwork Sold' },
    { value: '26,000 SQMT', label: 'Exhibition Area' },
  ],
  highlights: [
    { title: 'Art Exhibitions', description: 'Curated showcases of contemporary and traditional art.' },
    { title: 'Live Painting', description: 'Witness creativity in action by renowned artists.' },
    { title: 'Sculpture & 3D Art', description: 'From classical to modern, exploring dimensional art forms.' },
    { title: 'Visitor Workshops', description: 'Hands-on sessions to learn, create and experience art.' },
    { title: 'Curated Collector Previews', description: 'A considered first look at featured works, artist stories and new collections.' },
  ],
  testimonials: [
    { authorName: 'Anjali Verma', authorRole: 'Collector', message: 'It was wonderful to see inclusive participation, especially the support for specially-abled artists — it is truly inspiring.' },
  ],
  venuePartners: [
    { name: 'BIEC · Bangalore International Exhibition Centre' },
    { name: 'PIEC · Pune International Exhibition Centre' },
    { name: 'Pragati Maidan · New Delhi' },
    { name: 'NESCO · Bombay Exhibition Centre, Mumbai' },
    { name: 'Abhay Prashal · Indore' },
  ],
}
