export type ExhibitSectionId = 'why' | 'standard' | 'premium' | 'mentor' | 'stats' | 'promo' | 'participate'

export const exhibitSections: { id: ExhibitSectionId; enabled: boolean; order: number }[] = [
  { id: 'why', enabled: true, order: 1 },
  { id: 'standard', enabled: true, order: 2 },
  { id: 'premium', enabled: true, order: 3 },
  { id: 'mentor', enabled: true, order: 4 },
  { id: 'stats', enabled: true, order: 5 },
  { id: 'promo', enabled: true, order: 6 },
  { id: 'participate', enabled: true, order: 7 },
]

export const exhibitHero = {
  eyebrow: 'EXHIBIT WITH US',
  title: ['Showcase Your Art'],
  accent: 'to a Bigger World',
  text: "Meet art lovers, collectors and creative communities through The Haat of Art's exhibitions.",
  cta: { label: 'Book Your Stall', href: '/book-your-stall' },
  slides: [
    { image: '/media/hero-exhibition.jpg', alt: 'Visitors exploring artwork at an exhibition' },
    { image: '/media/exhibition-gallery.jpeg', alt: 'Artworks presented in a contemporary exhibition space' },
  ],
}

export const exhibitWhy = {
  title: 'Why', accent: 'Exhibit', after: 'With Us',
  image: '/media/exhibition-gallery.jpeg',
  text: 'Present your work in a welcoming exhibition environment, meet audiences in person and connect with the wider art community.',
  benefits: [
    { icon: 'sales', title: 'Direct Sales Opportunity', text: 'Present your work to art lovers and buyers' },
    { icon: 'network', title: 'Network with Collectors', text: 'Connect with artists, galleries and curators' },
    { icon: 'media', title: 'Media & Promotion', text: 'Build visibility through exhibition features' },
    { icon: 'brand', title: 'Grow Your Brand', text: 'Introduce your practice to new audiences' },
    { icon: 'support', title: 'Supportive Environment', text: 'Take part in a thoughtfully organised event' },
    { icon: 'footfall', title: 'Curated Footfall', text: 'Attract serious art collectors, architects and interior designers' },
  ],
}

export type PricingTable = {
  id: string
  title: string
  accent: string
  rows: { from: string; to: string; size: string; price: string; includes: string }[]
  note?: string
  cta: { label: string; href: string }
}

export const exhibitPricing = [
  { id: 'standard', title: 'Stall Rates For', accent: 'Individual Artists' },
  { id: 'premium', title: 'Stall Rates For', accent: 'Groups & Galleries' },
] as const

export const exhibitPromos = [
  { title: 'Personalized Promotions', text: 'Share your work with audiences through exhibition and digital features.' },
  { title: 'Artist E-Portal', text: 'Manage your artist profile and share your creative practice online.' },
]

export const exhibitParticipate = {
  title: 'Want to Participate?',
  text: 'Choose a stall for an upcoming edition or contact our team to learn more.',
  register: { label: 'Enquire / Register', href: '/contact' },
  book: { label: 'Book Your Stall', href: '/book-your-stall' },
  images: ['/media/hero-exhibition.jpg', '/media/exhibition-gallery.jpeg', '/media/visual-art.jpeg'],
}
