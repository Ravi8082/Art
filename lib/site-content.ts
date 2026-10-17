export type SiteContent = {
  text: Record<string, string>
  artists: { id: string; name: string; city: string; bio: string; photoUrl: string | null }[]
  artworks: { id: string; title: string; description: string; artistName: string; artistId: string | null; url: string }[]
}

export const textFields = [
  { key: 'heroKicker', label: 'Hero small heading', fallback: 'A living platform for Indian contemporary art', multiline: false },
  { key: 'heroLine1', label: 'Hero title — line 1', fallback: 'Where art', multiline: false },
  { key: 'heroAccent', label: 'Hero title — highlighted line', fallback: 'comes alive.', multiline: false },
  { key: 'heroIntro', label: 'Hero intro paragraph', fallback: 'The Haat of Art brings artists, collectors and curious minds together through exhibitions, experiences and conversations that stay with you.', multiline: true },
  { key: 'featuredKicker', label: 'Featured works small heading', fallback: 'Featured works', multiline: false },
  { key: 'featuredLine1', label: 'Featured works title — line 1', fallback: 'Fresh from', multiline: false },
  { key: 'featuredAccent', label: 'Featured works title — highlighted line', fallback: 'the studio.', multiline: false },
  { key: 'statementLine1', label: 'About title — line 1', fallback: 'Not just a gallery.', multiline: false },
  { key: 'statementAccent', label: 'About title — highlighted line', fallback: 'A meeting place.', multiline: false },
  { key: 'statementText', label: 'About paragraph', fallback: 'We believe art belongs in the middle of conversation. In 2018, we began building a platform where emerging voices and established practices could meet on equal ground.', multiline: true },
  { key: 'footerLocations', label: 'Footer locations', fallback: 'Mumbai · New Delhi · Online', multiline: false },
] as const

export const contactTextFields = [
  { key: 'contactHeroTitle', label: 'Hero heading', fallback: "Let's Create Something", multiline: false },
  { key: 'contactHeroAccent', label: 'Hero heading — highlighted word', fallback: 'Together.', multiline: false },
  { key: 'contactHeroIntro', label: 'Hero subtitle', fallback: 'Stall bookings, artist collaborations, partnerships or a simple question about an upcoming haat — send it across and a real person from our team will reply.', multiline: true },
  { key: 'contactAddress', label: 'Office address', fallback: 'The Haat of Art, Art District, Indore, Madhya Pradesh 452001, India', multiline: true },
  { key: 'contactPhone', label: 'Phone', fallback: '+91 90000 00000', multiline: false },
  { key: 'contactEmail', label: 'Public email', fallback: 'hello@thehaatofart.com', multiline: false },
  { key: 'contactHours', label: 'Business hours', fallback: 'Tue – Sun · 10:00 – 19:00 (Mon closed for installs)', multiline: false },
  { key: 'contactMapUrl', label: 'Google Maps link', fallback: 'https://www.google.com/maps/search/?api=1&query=Indore+Madhya+Pradesh', multiline: false },
  { key: 'contactInstagram', label: 'Instagram link', fallback: 'https://instagram.com', multiline: false },
  { key: 'contactFacebook', label: 'Facebook link', fallback: 'https://facebook.com', multiline: false },
  { key: 'contactLinkedin', label: 'LinkedIn link', fallback: 'https://linkedin.com', multiline: false },
  { key: 'contactPartnersTitle', label: 'Mentors / partners heading', fallback: 'Mentors & Partners', multiline: false },
  { key: 'contactPartnersText', label: 'Mentors / partners text', fallback: 'The haat is built with the support of our institutional mentors, city partners and material sponsors. Their teams answer booking and sponsorship queries directly.', multiline: true },
  { key: 'contactNotice', label: 'Privacy notice under the form', fallback: 'We use your details only to respond to this enquiry. Nothing is shared with third parties, and you can ask us to delete your enquiry at any time.', multiline: true },
] as const
