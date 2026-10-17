// DEMO CONTENT ONLY. Every price, date, statistic, mentor name and image below is a
// placeholder until the Admin Panel / backend is connected. The shapes are what the
// backend should later return (hero slides with alt text, pricing tables per event,
// stats, mentor, sections with enabled/order). Nothing here is verified information,
// and no booking, upload or payment functionality is connected yet.

export const EXHIBIT_DEMO_NOTE = 'Demo content — prices, dates, statistics and the mentor profile are placeholders, not verified information'

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
  eyebrow: 'Exhibit with us',
  title: ['Showcase', 'Your Art to'],
  accent: 'a Bigger World',
  text: "Be a part of India's most vibrant art exhibitions. Connect, sell, network and grow your artistic journey.",
  cta: { label: 'Book Your Stall', href: '/book-your-stall' },
  slides: [
    { image: '/demo/ex-hero.jpg', alt: 'Visitors walking through an art exhibition hall (demo image)' },
    { image: '/demo/ex-crowd1.jpg', alt: 'Paintings displayed in a gallery stall (demo image)' },
    { image: '/demo/ex-crowd2.jpg', alt: 'Art lovers viewing framed artworks (demo image)' },
  ],
}

export const exhibitWhy = {
  title: 'Why', accent: 'Exhibit', after: 'With Us',
  image: '/demo/ex-why.jpg',
  text: 'Our exhibitions give artists a professional platform to show and sell their artworks, take custom orders, and network with galleries, curators and art buyers. We offer organised event management, promotion, media coverage and a supportive environment for artists of all backgrounds.',
  benefits: [
    { icon: 'sales', title: 'Direct Sales Opportunity', text: 'Sell artworks directly to art lovers and buyers' },
    { icon: 'network', title: 'Network with Collectors', text: 'Meet galleries, curators and art enthusiasts' },
    { icon: 'media', title: 'Media & Promotion', text: 'Get featured across digital and print media' },
    { icon: 'brand', title: 'Grow Your Brand', text: 'Build recognition as an artist' },
    { icon: 'support', title: 'Supportive Environment', text: 'Well-organised and artist-friendly events' },
  ],
}

export type PricingTable = {
  id: string
  title: string
  accent: string
  image: string
  rows: { from: string; to: string; size: string; price: string; includes: string }[]
  note?: string
  cta: { label: string; href: string }
}

export const exhibitPricing: PricingTable[] = [
  {
    id: 'standard', title: 'Stall Rates From', accent: '25 March 2026',
    image: '/demo/ex-stall1.jpg',
    note: 'Pricing applicable for all upcoming exhibitions (demo values)',
    rows: [{ from: '1st Jan 2026', to: '10 Dec 2026', size: '3m x 3m (9 SQM)', price: '₹16,000 + GST', includes: '1 table, 2 chairs, power connection, name board' }],
    cta: { label: 'Book Stall Now', href: '/book-your-stall' },
  },
  {
    id: 'premium', title: 'Stall Rates For', accent: 'Premium Exhibition',
    image: '/demo/ex-stall2.jpg',
    rows: [{ from: '25th Mar 2026', to: '7 Dec 2026', size: '3m x 6m (18 SQM)', price: '₹18,000 + GST', includes: 'Premium location, 2 tables, 4 chairs, power, spotlight, name board' }],
    cta: { label: 'Book Stall Now', href: '/book-your-stall' },
  },
]

export const exhibitMentor = {
  heading: 'Our Mentor', name: 'Demo Mentor Name', image: '/demo/ex-mentor.jpg',
  text: 'Placeholder mentor profile. The mentor name, photo and bio will be edited from the Admin Panel once it is connected. This guidance helps emerging and established artists reach a larger audience and explore new opportunities.',
}

export const exhibitStats = [
  { icon: 'artwork', label: 'Artworks Sold', value: '1,000+', text: 'Demo statistic. Replace with verified figures before publishing.' },
  { icon: 'venue', label: 'Prime Venue', value: '04+', text: 'Demo statistic about past venues. Replace with verified figures before publishing.' },
  { icon: 'audience', label: 'Audience Reach', value: '18,000+', text: 'Demo statistic about visitors. Replace with verified figures before publishing.' },
  { icon: 'network', label: 'Networks Build', value: '45,000+', text: 'Demo statistic about the community network. Replace with verified figures before publishing.' },
]

export const exhibitPromos = [
  { title: 'Personalized Promotions', image: '/demo/ex-promo1.jpg', text: 'Promotion for each artist across social media platforms, website and digital campaigns (demo description).' },
  { title: 'E-Portal', image: '/demo/ex-promo2.jpg', text: 'An online portal where participating artists can post exhibitions, live art and sell exhibited paintings (demo description).' },
]

export const exhibitParticipate = {
  title: 'Want To Participate?',
  text: 'Fill the form below and be a part of The Haat of Art Exhibition.',
  register: { label: 'Registration', href: '/contact' },
  book: { label: 'Book Your Stall', href: '/book-your-stall' },
  images: ['/demo/ex-group.jpg', '/demo/ex-crowd1.jpg', '/demo/ex-crowd2.jpg'],
}
