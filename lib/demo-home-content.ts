// DEMO CONTENT ONLY. Names, dates, statistics, venues and partners below are
// placeholders, not verified real-world information. The homepage prefers data
// from the backend API (events, artists, blog posts, homepage media) and falls
// back to this file. Replace with Admin Panel / API data when it is connected.

export const DEMO_LABEL = 'Demo content — sample names, dates and statistics are placeholders'

export const demoHero = {
  eyebrow: "India's Biggest Art Exhibition",
  title: 'The Haat',
  accent: 'Art',
  text: 'A platform where Artists, Art Lovers and Opportunities come together.',
  badge: 'Art Connects People',
  badgeSub: '',
  primaryCta: { label: 'Explore Exhibitions', href: '/exhibitions' },
  secondaryCta: { label: 'Register Now', href: '/contact' },
  slides: [
    { src: '/demo/hero1.jpg', alt: 'Demo hero: visitors in an exhibition hall' },
    { src: '/media/hero-exhibition.jpg', alt: 'Demo hero: sculpture and visitors' },
    { src: '/demo/hero3.jpg', alt: 'Demo hero: gallery artworks' },
  ],
  stats: [
    { value: '1000+', label: 'Artists', icon: 'users' },
    { value: '50+', label: 'Cities', icon: 'map' },
    { value: '50K+', label: 'Visitors', icon: 'eye' },
    { value: '100+', label: 'Art Forms', icon: 'palette' },
  ],
}

export const demoExhibitions = [
  { id: 'demo-1', title: 'The Haat of Art — Indore', venue: 'Demo Venue, Indore', startsAt: '2026-10-30', image: '/demo/event-indore.jpg' },
  { id: 'demo-2', title: 'The Haat of Art — Mumbai', venue: 'Demo Venue, Mumbai', startsAt: '2026-11-14', image: '/demo/event-mumbai.jpg' },
  { id: 'demo-3', title: 'The Haat of Art — Bengaluru', venue: 'Demo Venue, Bengaluru', startsAt: '2026-12-05', image: '/demo/event-bengaluru.jpg' },
]

export const demoFeatures = [
  { icon: 'palette', title: 'Art Gallery', text: 'Explore artworks from across India', href: '/gallery' },
  { icon: 'users', title: 'Featured Artists', text: 'Meet talented artists', href: '/artists' },
  { icon: 'calendar', title: 'Art Exhibitions', text: 'Upcoming & past events', href: '/exhibitions' },
  { icon: 'brush', title: 'Art Workshops', text: 'Learn from experts', href: '/exhibitions' },
  { icon: 'ticket', title: 'Stall Bookings', text: 'Showcase your products', href: '/book-your-stall' },
  { icon: 'news', title: 'Media Coverage', text: 'News, press & stories', href: '/blog' },
] as const

export const demoAbout = {
  title: 'Celebrating',
  accent: 'Art & Creativity',
  text: 'The Haat of Art brings together artists, collectors, enthusiasts and creative businesses to celebrate art in all its forms. We create platforms, experiences and opportunities for the art community.',
  caption: 'A glimpse of The Haat of Art',
  duration: '02:15',
  image: '/demo/glimpse.jpg',
  cta: { label: 'Our Journey', href: '/about' },
  stats: [
    { value: '50+', label: 'Exhibitions Conducted', icon: 'trophy' },
    { value: '10+', label: 'Years of Experience', icon: 'star' },
    { value: '1000+', label: 'Artists Showcased', icon: 'users' },
    { value: '50K+', label: 'Art Lovers & Visitors', icon: 'heart' },
  ],
}

export const demoArtists = [
  { id: 'a1', name: 'Aarav Sharma', role: 'Painter', image: '/demo/artist1.jpg' },
  { id: 'a2', name: 'Neha Kapoor', role: 'Sculptor', image: '/demo/artist2.jpg' },
  { id: 'a3', name: 'Rohan Mehta', role: 'Digital Artist', image: '/demo/artist3.jpg' },
  { id: 'a4', name: 'Isha Verma', role: 'Handicrafts', image: '/demo/artist4.jpg' },
  { id: 'a5', name: 'Kabir Nair', role: 'Muralist', image: '/demo/artist5.jpg' },
  { id: 'a6', name: 'Meera Iyer', role: 'Illustrator', image: '/demo/artist6.jpg' },
]

export const demoBlogs = [
  { id: 'b1', title: 'How to Start Your Art Collection', date: '2026-10-13', readTime: '5 min read', image: '/demo/blog1.jpg' },
  { id: 'b2', title: 'The Role of Art in Modern Society', date: '2026-09-28', readTime: '6 min read', image: '/demo/blog2.jpg' },
  { id: 'b3', title: 'Art Techniques for Beginners', date: '2026-09-16', readTime: '4 min read', image: '/demo/blog3.jpg' },
]

export const demoPartners = [
  { name: 'NESCO', style: 'nesco' },
  { name: 'ITC HOTELS', style: 'itc' },
  { name: 'TAI', style: 'tai' },
  { name: 'INDORE SPORTS CLUB', style: 'indore' },
  { name: 'PHOENIX', style: 'phoenix' },
  { name: 'THE PARK', style: 'park' },
]

export const demoFooter = {
  tagline: 'A platform where Artists, Art Lovers and Opportunities come together.',
  contact: {
    address: 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India',
    phone: '+91 7304645333 | 8779798244',
    email: 'contact@thehaatofart.com',
  },
}
