// DEMO CONTENT ONLY. Every guest and testimonial below is a fictional placeholder
// used when the backend has no rows yet. The names are invented and do not describe
// any real person. Real entries come from Admin Panel > Guests & feedback.
import type { PublicGuest, PublicGuestFeedback } from './api'

export const demoGuests: PublicGuest[] = [
  { id: 'demo-g1', name: 'Meera Iyengar', role: 'Classical Dancer', eventName: 'Monsoon Art Fair 2025', bio: 'Odissi dancer with four decades of stage work across India and Europe. She opened the fair with a recital that tied movement phrasing to the brushwork of the miniature gallery.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 1, active: true },
  { id: 'demo-g2', name: 'Farhan Qureshi', role: 'Muralist', eventName: 'Urban Walls Festival 2025', bio: 'Paints large-format walls across six cities and leads the youth wall programme. His four-storey piece for the festival was completed live over nine days.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 2, active: true },
  { id: 'demo-g3', name: 'Anupama Rao', role: 'Textile Historian', eventName: 'Weave & Wander 2025', bio: 'Documents handloom clusters across Maharashtra and Goa. She curated the weave pavilion and walked patrons through thirty years of revival work.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 3, active: true },
  { id: 'demo-g4', name: 'Jaswinder Kaur', role: 'Sculptor', eventName: 'Indore Sculpture Park 2025', bio: 'Works in bronze and reclaimed steel. Her outdoor installation took eleven months to cast and now anchors the north lawn of the park.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 4, active: true },
  { id: 'demo-g5', name: 'Dev Arora', role: 'Documentary Photographer', eventName: 'River Stories Exhibition 2025', bio: 'Has followed the rivers of South Asia for eighteen years. His large-format prints formed the closing room of the River Stories show.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 5, active: true },
  { id: 'demo-g6', name: 'Nalini Menon', role: 'Curator & Critic', eventName: 'Bengaluru Curators Forum 2025', bio: 'Independent curator working with public galleries. She chaired the forum panel on how curators commission new work for shared spaces.', photoUrl: null, instagramUrl: null, websiteUrl: null, sortOrder: 6, active: true },
]

export const demoGuestFeedback: PublicGuestFeedback[] = [
  { id: 'demo-f1', guestId: null, guestName: null, authorName: 'Ananya Rao', authorRole: 'Collector, Bengaluru', message: 'I came for one gallery and left with three artists on my wall. The walkthroughs were honest about pricing, which nobody does.', rating: 5, sortOrder: 1, active: true },
  { id: 'demo-f2', guestId: null, guestName: null, authorName: 'Imran Sheikh', authorRole: 'Studio owner, Hyderabad', message: 'The stall layout gave my ceramics the same footfall as the established names. Organised, calm and genuinely well lit.', rating: 5, sortOrder: 2, active: true },
  { id: 'demo-f3', guestId: null, guestName: null, authorName: 'Devika Menon', authorRole: 'Teacher, Kochi', message: 'I brought thirty students and every one of them found something to sketch. The workshop staff kept the materials going all afternoon.', rating: 4, sortOrder: 3, active: true },
  { id: 'demo-f4', guestId: null, guestName: null, authorName: 'Sandeep Bhatia', authorRole: 'First-time visitor', message: 'Halfway through the weekend the crowd thinned and the halls felt like a private show. Best two days I have spent with art this year.', rating: 5, sortOrder: 4, active: true },
]
