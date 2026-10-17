// The banner and gallery remain demo content until they are connected to managed event media.
// Free-pass registration uses the published Indore exhibition and verifies the visitor by email OTP.

export const INDORE_DEMO_NOTE = 'Exhibition photos and some page details are demo content. Free entry pass registration is active and requires email verification; event updates and reminders are not available yet.'

export const indoreEvent = {
  eyebrow: 'The Haat of Art',
  title: 'Comes to Indore',
  accent: 'Three Days, Free.',
  text: 'An unforgettable art experience with 500+ artists, unique artworks, live demonstrations, workshops and much more.',
  startsAt: '2027-01-24T10:00:00+05:30',
  dates: '24th - 26th Jan 2027',
  venue: 'Abhay Prashal Sports Club, Indore, Madhya Pradesh',
  timing: '10:00 AM - 8:00 PM',
  badge: 'Free Entry for Visitors',
  heroImage: '/demo/ind-hero.jpg',
  ctas: { stall: { label: 'Book Your Stall', href: '/exhibit-with-us' }, visitor: { label: 'Visitor Registration', href: '#register' } },
}

export const indoreCollage = {
  main: { src: '/demo/ind-main.jpg', alt: 'Smiling visitor holding a catalogue in front of mandala artworks (demo image)' },
  tiles: [
    { src: '/demo/ex-crowd1.jpg', alt: 'Visitors in the exhibition hall (demo image)' },
    { src: '/demo/ex-stall1.jpg', alt: 'Art stall with portraits (demo image)' },
    { src: '/demo/ex-stall2.jpg', alt: 'Gallery stall (demo image)' },
    { src: '/demo/ex-crowd2.jpg', alt: 'Visitors viewing artworks (demo image)' },
  ],
}

export const indoreForm = {
  title: 'Get Your', accent: 'Free Entry Pass',
  subtitle: "Register now and be part of India's most vibrant art exhibition.",
  cities: ['Indore', 'Bhopal', 'Ujjain', 'Dewas', 'Other'],
  attendingAs: ['Visitor', 'Art Lover / Collector', 'Artist', 'Student', 'Interior Designer / Architect'],
  consent: 'I would like to receive updates about upcoming exhibitions, events and art news from The Haat of Art.',
  button: 'Get Free Entry Pass',
  note: 'We will send a 6-digit verification code to your email. Your free entry QR pass is created after you verify it.',
}

export const indoreWhy = [
  { icon: 'artists', title: '500+', text: 'Artists & Artworks' },
  { icon: 'live', title: 'Live Art', text: 'Demonstrations' },
  { icon: 'workshop', title: 'Interactive', text: 'Workshops' },
  { icon: 'craft', title: 'Unique', text: 'Handicrafts' },
  { icon: 'meet', title: 'Meet', text: 'Renowned Artists' },
  { icon: 'space', title: 'Art for', text: 'Every Space' },
]

export const indoreFaces = {
  title: 'Faces from our', accent: 'last editions', cta: { label: 'View All Photos', href: '/gallery' },
  images: ['/demo/ex-group.jpg', '/demo/ind-group1.jpg', '/demo/ind-group2.jpg', '/demo/ex-crowd1.jpg', '/demo/ind-group3.jpg', '/demo/ex-crowd2.jpg'],
}

export const indoreInside = {
  title: "What's", accent: 'inside the hall',
  items: [
    { label: 'Paintings', src: '/demo/ind-paint.jpg' },
    { label: 'Sculptures', src: '/demo/ind-sculpt.jpg' },
    { label: 'Handicrafts', src: '/demo/ind-craft.jpg' },
    { label: 'Art Stalls', src: '/demo/ex-stall1.jpg' },
    { label: 'Live Workshops', src: '/demo/hl-workshop.jpg' },
    { label: 'Meet Artists', src: '/demo/ex-crowd1.jpg' },
  ],
}

export const indoreFloor = {
  title: 'From', accent: 'the floor', cta: { label: 'View All Moments', href: '/gallery' },
  images: ['/demo/ind-group2.jpg', '/demo/ex-group.jpg', '/demo/ind-group3.jpg', '/demo/ex-crowd2.jpg', '/demo/ind-group1.jpg', '/demo/ex-stall2.jpg'],
}

export const indoreInfo = {
  venue: { title: 'Venue', name: 'Abhay Prashal Sports Club', address: 'Race Course Road, Indore, Madhya Pradesh, India', image: '/demo/ind-venue.jpg', cta: { label: 'View on Map', href: 'https://www.google.com/maps/search/?api=1&query=Abhay+Prashal+Sports+Club+Indore' } },
  details: { title: 'Event Details', dates: '24th - 26th Jan 2027', timing: '10:00 AM - 8:00 PM', entry: 'Free Entry for Visitors' },
  updates: { title: 'Get Updates for Next Exhibitions', text: 'Be the first to know about our upcoming exhibitions, artist opportunities and art events.', button: 'Subscribe' },
}
