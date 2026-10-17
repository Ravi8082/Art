export const ABOUT_DEMO_NOTE = 'Demo content — publish the About page from Dashboard → Content Management → About Page to replace it with real content.'

export const aboutHero = { title: 'About Us', subtitle: 'A platform where artists, art lovers and opportunities come together.', image: '/demo/ex-hero.jpg' }

export const aboutSections = [
  {
    id: 'foundation', title: 'The Haat of Art Foundation', image: '/demo/ex-group.jpg', reverse: false,
    body: 'The Haat of Art Foundation is a purpose-driven initiative dedicated to supporting emerging artists, craftspeople and art enthusiasts across India. With a strong vision to preserve and promote art, literature and sustainable growth, the foundation works as a bridge between artists and opportunities by providing platforms for exposure, recognition and growth through exhibitions, community-driven programs and collaborations with public and private entities.',
  },
  {
    id: 'company', title: 'Exhobuzz Pvt Ltd', image: '/demo/ex-crowd1.jpg', reverse: true,
    body: 'Exhobuzz Pvt Ltd is a private exhibition organizing company led by a team of entrepreneurs with extensive experience spanning business, technology, media and event management. The company operates across diverse sectors including art, expos, conferences and large-scale exhibitions, and actively supports emerging talent through structured collaborations and on-ground infrastructure.',
  },
] as const

export type TeamMember = { id: number; name: string; role: string; bio: string; image: string; active: boolean }
export const aboutTeam: TeamMember[] = [
  { id: 1, name: 'Vindu Dara Singh', role: 'Mentor', bio: 'Mentors the platform\'s vision, guiding artists and curators toward meaningful exhibitions and opportunities.', image: '/demo/artist2.jpg', active: true },
  { id: 2, name: 'Mrs. Madhuri Yadav', role: 'Addl. Director', bio: 'Leads operations and partnerships, connecting the foundation with institutions, sponsors and communities.', image: '/demo/artist3.jpg', active: true },
  { id: 3, name: 'Pranav Nag', role: 'IT Head / CTO', bio: 'Builds and runs the technology behind the platform — from artist portals to exhibition systems.', image: '/demo/artist4.jpg', active: true },
  { id: 4, name: 'C. A. Mohit Kumawat', role: 'Finance Advisor', bio: 'Keeps the foundation\'s growth sustainable with careful financial planning and governance.', image: '/demo/artist5.jpg', active: true },
  { id: 5, name: 'Adv. Vinod Shah', role: 'Legal Advisor', bio: 'Handles legal frameworks, contracts and compliance for artists, events and collaborations.', image: '/demo/artist6.jpg', active: true },
]

export type Partner = { id: number; name: string; category: string; mark: string; active: boolean }
export const aboutPartners: Partner[] = [
  { id: 1, name: 'Exhobuzz', category: 'Organizer', mark: 'EX', active: true },
  { id: 2, name: 'KB', category: 'Organizer', mark: 'KB', active: true },
  { id: 3, name: 'FitFilm', category: 'Media Partner', mark: 'FF', active: true },
  { id: 4, name: 'KPCT Foundation', category: 'CSR Association', mark: 'KP', active: true },
  { id: 5, name: 'Hospitality Partner', category: 'Hospitality Partner', mark: 'HP', active: true },
  { id: 6, name: 'UAPL', category: 'Support Partner', mark: 'UA', active: true },
  { id: 7, name: 'AIM Foundation', category: 'Knowledge Partner', mark: 'AI', active: true },
  { id: 8, name: 'Event Partner', category: 'Event Partner', mark: 'EP', active: true },
  { id: 9, name: 'Global Media', category: 'Media Partner', mark: 'GM', active: true },
  { id: 10, name: 'IEIA', category: 'Industry Partner', mark: 'IE', active: true },
]
