export type SiteContent = {
  text: Record<string, string>
  artists: { id: string; name: string; city: string; bio: string; photoUrl: string | null }[]
  artworks: { id: string; title: string; description: string; artistName: string; artistId: string | null; url: string }[]
}

export const textFields = [
  { key: 'heroKicker', label: 'Hero small heading', fallback: 'The Haat of Art', multiline: false },
  { key: 'heroLine1', label: 'Hero title — line 1', fallback: 'Celebrating', multiline: false },
  { key: 'heroAccent', label: 'Hero title — highlighted line', fallback: 'Indian Art & Artists', multiline: false },
  { key: 'heroIntro', label: 'Hero intro paragraph', fallback: 'A vibrant platform that brings together diverse artists, art forms, cultures and communities through exhibitions, live performances and workshops.', multiline: true },
  { key: 'statementLine1', label: 'About title — line 1', fallback: 'About The Haat of', multiline: false },
  { key: 'statementAccent', label: 'About title — highlighted line', fallback: 'Art', multiline: false },
  { key: 'statementText', label: 'About paragraph', fallback: 'The Haat of Art is a purpose-driven platform that brings together artists from diverse backgrounds and art forms through curated exhibitions, live performances and workshops. We provide a common space for emerging, established and specially-abled artists to showcase their work, connect with art lovers and grow within a vibrant art community.', multiline: true },
  { key: 'footerLocations', label: 'Footer locations', fallback: 'Mumbai · New Delhi · Online', multiline: false },
] as const

export const contactTextFields = [
  { key: 'contactHeroTitle', label: 'Hero heading', fallback: "Let's talk about", multiline: false },
  { key: 'contactHeroAccent', label: 'Hero heading — highlighted word', fallback: 'art.', multiline: false },
  { key: 'contactHeroIntro', label: 'Hero subtitle', fallback: 'Stall bookings, artist collaborations, partnerships or a simple question about an upcoming haat — send it across and a real person from our team will reply.', multiline: true },
  { key: 'contactAddress', label: 'Office address', fallback: 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India', multiline: true },
  { key: 'contactPhone', label: 'Phone', fallback: '+91 7304645333 | +91 8779798244', multiline: false },
  { key: 'contactEmail', label: 'Public email', fallback: 'contact@thehaatofart.com', multiline: false },
  { key: 'contactHours', label: 'Business hours', fallback: 'Mon – Sat: 10:00 AM – 6:00 PM', multiline: false },
  { key: 'contactMapUrl', label: 'Google Maps link', fallback: '', multiline: false },
  { key: 'contactInstagram', label: 'Instagram link', fallback: '', multiline: false },
  { key: 'contactFacebook', label: 'Facebook link', fallback: '', multiline: false },
  { key: 'contactLinkedin', label: 'LinkedIn link', fallback: '', multiline: false },
  { key: 'contactPartnersTitle', label: 'Mentors / partners heading', fallback: 'Mentors & Partners', multiline: false },
  { key: 'contactPartnersText', label: 'Mentors / partners text', fallback: 'The haat is built with the support of our institutional mentors, city partners and material sponsors. Their teams answer booking and sponsorship queries directly.', multiline: true },
  { key: 'contactNotice', label: 'Privacy notice under the form', fallback: 'We use your details only to respond to this enquiry. Nothing is shared with third parties, and you can ask us to delete your enquiry at any time.', multiline: true },
] as const
