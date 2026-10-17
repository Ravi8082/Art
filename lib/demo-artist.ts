// DEMO CONTENT — artist names, artworks, prices, plans and statuses are sample placeholders.
// Registration, OTP, uploads, subscriptions, payments, moderation and emails are NOT connected to a backend yet.
export const ARTIST_DEMO_NOTE = 'Demo preview: names, artworks, prices, plans and statuses are sample content. Registration, OTP, uploads, payments and moderation are not connected to a backend yet.'

export const artistBenefits = [
  { title: '2 Free Artwork Listings', sub: 'To get started', icon: '🖼' },
  { title: 'Reach Art Lovers', sub: 'Across India', icon: '♡' },
  { title: 'Exhibition Opportunities', sub: 'Online & Offline', icon: '🏛' },
  { title: 'Build Your Brand', sub: 'With THOA', icon: '✎' },
]

export const artworks = [
  { slug: 'colors-of-mumbai', title: 'Colors of Mumbai', medium: 'Acrylic on Canvas', category: 'Painting', price: '₹ 15,000', status: 'Published', image: '/demo/art-city.jpg', artist: 'Priya Sharma', date: '10 Oct 2025' },
  { slug: 'natures-grace', title: 'Nature’s Grace', medium: 'Mixed Media', category: 'Mixed Media', price: '₹ 12,000', status: 'Pending Review', image: '/demo/art-bloom.jpg', artist: 'Neha Kapoor', date: '10 Oct 2025' },
  { slug: 'urban-reflections', title: 'Urban Reflections', medium: 'Oil on Canvas', category: 'Painting', price: '₹ 18,000', status: 'Published', image: '/demo/art-gaze.jpg', artist: 'Rohan Mehta', date: '9 Oct 2025' },
  { slug: 'divine-light', title: 'Divine Light', medium: 'Acrylic', category: 'Painting', price: '₹ 9,500', status: 'Rejected', image: '/demo/art-lotus.jpg', artist: 'Amit Verma', date: '8 Oct 2025' },
]

export const adminRows = [
  { id: 1, ...artworks[0], status: 'Pending' },
  { id: 2, slug: 'divine-light', title: 'Divine Light', artist: 'Anish Verma', category: 'Painting', date: '10 Oct 2025', status: 'Approved', image: '/demo/art-mandala.jpg' },
  { id: 3, slug: 'natures-grace', title: 'Nature’s Grace', artist: 'Neha Kapoor', category: 'Mixed Media', date: '9 Oct 2025', status: 'Pending', image: '/demo/art-bloom.jpg' },
  { id: 4, slug: 'urban-reflections', title: 'Urban Reflections', artist: 'Rohit Mehta', category: 'Painting', date: '8 Oct 2025', status: 'Rejected', image: '/demo/art-gaze.jpg' },
]

export const plans = [
  { name: 'Free Artist', price: '₹ 0', per: 'Lifetime', features: ['2 artwork listings', 'Artist profile', 'Public gallery listing', 'Participation updates'], cta: 'Current Plan', current: true },
  { name: 'Artist Plus', price: '₹ 499', per: '/month', features: ['Up to 20 artwork listings', 'Featured in artist directory', 'Priority support', 'Exhibition invitations', 'Social media promotion'], cta: 'Subscribe Now', rec: true },
  { name: 'Featured Artist', price: '₹ 999', per: '/month', features: ['Unlimited artwork listings', 'Featured placement (labelled)', 'Dedicated artist page', 'Priority exhibition access', 'Marketing support', 'Analytics & insights'], cta: 'Subscribe Now' },
]

export const profileTabs = ['Artworks', 'About', 'Exhibitions', 'News & Blogs']
export const profileStats = [['12', 'Artworks'], ['5', 'Exhibitions'], ['Painting, Mural, Mixed Media', 'Categories'], ['Mumbai', 'Location']]

export const dashStats = [['2/2', 'Free Artworks Used'], ['0', 'Additional Slots (Needs Subscription)'], ['0', 'Pending Review'], ['2', 'Published Artworks']]

export const stepNames = ['Register', 'Verify Email', 'Complete Profile']
export const adminNav = ['Dashboard', 'User Management', 'Artists', 'Artworks', 'Blogs', 'Exhibitions', 'Subscriptions', 'Payments', 'Notifications', 'Settings']
export const artistNav = [['Dashboard', '/artist/dashboard'], ['My Profile', '/artist/profile'], ['My Artworks', '/artist/dashboard'], ['Add New Artwork', '/artist/artworks/new'], ['My Subscriptions', '/artist/plans'], ['Payment History', '/artist/plans'], ['Messages', '/artist/dashboard'], ['Settings', '/artist/dashboard']] as const

export const demoArtists = [
  { name: 'Priya Sharma', category: 'Painting', city: 'Mumbai', image: '/demo/artist1.jpg' },
  { name: 'Rohan Mehta', category: 'Mural', city: 'Pune', image: '/demo/artist2.jpg' },
  { name: 'Neha Kapoor', category: 'Mixed Media', city: 'Delhi', image: '/demo/artist3.jpg' },
  { name: 'Amit Verma', category: 'Sculpture', city: 'Indore', image: '/demo/artist4.jpg' },
  { name: 'Sneha Jain', category: 'Folk Art', city: 'Jaipur', image: '/demo/artist5.jpg' },
  { name: 'Karan Desai', category: 'Graffiti', city: 'Bengaluru', image: '/demo/artist6.jpg' },
]

export const galleryCategories = ['All', 'Painting', 'Mixed Media', 'Sculpture', 'Folk Art', 'Handicrafts'] as const
export const demoGallery = [
  { id: 'g1', title: 'Colors of Mumbai', artist: 'Priya Sharma', category: 'Painting', medium: 'Acrylic on Canvas', image: '/demo/art-city.jpg' },
  { id: 'g2', title: 'Nature’s Grace', artist: 'Neha Kapoor', category: 'Mixed Media', medium: 'Mixed Media', image: '/demo/art-bloom.jpg' },
  { id: 'g3', title: 'Urban Reflections', artist: 'Rohan Mehta', category: 'Painting', medium: 'Oil on Canvas', image: '/demo/art-gaze.jpg' },
  { id: 'g4', title: 'Divine Light', artist: 'Amit Verma', category: 'Folk Art', medium: 'Acrylic', image: '/demo/art-lotus.jpg' },
  { id: 'g5', title: 'Mandala Bloom', artist: 'Sneha Jain', category: 'Folk Art', medium: 'Ink on Paper', image: '/demo/art-mandala.jpg' },
  { id: 'g6', title: 'Evening Dusk', artist: 'Karan Desai', category: 'Painting', medium: 'Acrylic', image: '/demo/art-dusk.jpg' },
  { id: 'g7', title: 'Tree of Life', artist: 'Priya Sharma', category: 'Mixed Media', medium: 'Mixed Media', image: '/demo/art-tree.jpg' },
  { id: 'g8', title: 'Tidal Colours', artist: 'Neha Kapoor', category: 'Painting', medium: 'Watercolor', image: '/demo/art-tidal.jpg' },
  { id: 'g9', title: 'Stone Stories', artist: 'Amit Verma', category: 'Sculpture', medium: 'Stone', image: '/demo/hl-sculpture.jpg' },
  { id: 'g10', title: 'Handmade Colours', artist: 'Sneha Jain', category: 'Handicrafts', medium: 'Handmade', image: '/demo/hl-colors.jpg' },
  { id: 'g11', title: 'Indian Origin', artist: 'Rohan Mehta', category: 'Folk Art', medium: 'Acrylic', image: '/demo/hl-indian-origin.jpg' },
  { id: 'g12', title: 'Craft Corner', artist: 'Karan Desai', category: 'Handicrafts', medium: 'Mixed', image: '/demo/ind-craft.jpg' },
] as const
