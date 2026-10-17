// DEMO CONTENT — pre-published editorial examples. Community submissions require admin approval.
export const BLOG_DEMO_NOTE = 'Community blog submissions are reviewed by an admin and appear here only after approval.'

export const blogCategories = ['All', 'Community Stories', 'Art Techniques', 'Artist Stories', 'Exhibition Highlights', 'Handicrafts', 'Events', 'Tips & Guides'] as const

export type DemoBlog = {
  slug: string
  title: string
  excerpt: string
  image: string
  category: Exclude<(typeof blogCategories)[number], 'All' | 'Community Stories'>
  tag: string
  author: string
  authorImage: string
  date: string
  published: boolean
  order: number
}

export const demoBlogs: DemoBlog[] = [
  { slug: 'step-into-a-world-of-fine-artwork', title: 'Step Into a World of Fine Artwork at The Haat of Art, Mumbai', excerpt: 'A journey through colours, creativity and culture at India’s most vibrant art exhibition.', image: '/demo/ind-main.jpg', category: 'Artist Stories', tag: 'Artist Stories', author: 'Priya Sharma', authorImage: '/demo/artist1.jpg', date: '12 Oct 2025', published: true, order: 1 },
  { slug: 'brushstrokes-of-bhakti', title: 'Brushstrokes of Bhakti | Krishna Painting At The Haat of Art', excerpt: 'Exploring how traditional themes inspire contemporary artists.', image: '/demo/art-lotus.jpg', category: 'Art Techniques', tag: 'Art Techniques', author: 'Rohan Mehta', authorImage: '/demo/artist2.jpg', date: '8 Oct 2025', published: true, order: 2 },
  { slug: 'mumbai-art-exhibition-2025', title: 'Mumbai Art Exhibition 2025 | A Celebration of Creativity', excerpt: 'Artists, collectors and art lovers came together for an unforgettable experience.', image: '/demo/event-mumbai.jpg', category: 'Exhibition Highlights', tag: 'Exhibition Highlights', author: 'Neha Kapoor', authorImage: '/demo/artist3.jpg', date: '29 Sep 2025', published: true, order: 3 },
  { slug: 'mosaic-art-exhibition-2025', title: 'Mosaic Art Exhibition 2025 | Timeless Craft', excerpt: 'Discover the beauty of mosaic art and traditional techniques.', image: '/demo/ind-craft.jpg', category: 'Handicrafts', tag: 'Handicrafts', author: 'Amit Verma', authorImage: '/demo/artist4.jpg', date: '20 Sep 2025', published: true, order: 4 },
  { slug: 'glass-painting-where-color-meets-clarity', title: 'Glass Painting: Where Color Meets Clarity', excerpt: 'A beginner’s guide to creating stunning glass art pieces.', image: '/demo/hl-paint.jpg', category: 'Art Techniques', tag: 'Art Techniques', author: 'Sneha Jain', authorImage: '/demo/artist5.jpg', date: '18 Sep 2025', published: true, order: 5 },
  { slug: 'celebrating-fine-art-in-mumbai', title: 'Celebrating Fine Art in Mumbai: An Unmissable 3-Day Experience', excerpt: 'Highlights from an inspiring exhibition filled with art, culture and innovation.', image: '/demo/ex-crowd1.jpg', category: 'Events', tag: 'Events', author: 'Karan Desai', authorImage: '/demo/artist6.jpg', date: '12 Sep 2025', published: true, order: 6 },
  { slug: 'living-room-art', title: 'Living Room Art: Style Your Space with Depth, Soul & Personality', excerpt: 'How the right artwork can completely transform your living space.', image: '/demo/hl-home.jpg', category: 'Tips & Guides', tag: 'Home Decor', author: 'Meera Iyer', authorImage: '/demo/artist1.jpg', date: '5 Sep 2025', published: true, order: 7 },
  { slug: 'flower-painting-natures-poetry', title: 'Flower Painting: Nature’s Poetry on Canvas', excerpt: 'A step-by-step guide to creating beautiful floral art.', image: '/demo/art-mandala.jpg', category: 'Art Techniques', tag: 'Art Techniques', author: 'Aarti Singh', authorImage: '/demo/artist2.jpg', date: '1 Sep 2025', published: true, order: 8 },
  { slug: 'kalamkari-painting', title: 'Kalamkari Painting: Timeless Indian Art for Modern Walls', excerpt: 'The rich heritage of a decorative art form and its relevance today.', image: '/demo/hl-indian-origin.jpg', category: 'Artist Stories', tag: 'Artist Stories', author: 'Vikram Rao', authorImage: '/demo/artist3.jpg', date: '26 Aug 2025', published: true, order: 9 },
  { slug: 'colour-theory-for-beginners', title: 'Colour Theory for Beginners: Mixing Palettes That Work', excerpt: 'Simple rules to choose and blend colours with confidence.', image: '/demo/hl-colors.jpg', category: 'Tips & Guides', tag: 'Tips & Guides', author: 'Priya Sharma', authorImage: '/demo/artist4.jpg', date: '20 Aug 2025', published: true, order: 10 },
  { slug: 'sculpture-corner-highlights', title: 'Sculpture Corner: Highlights From The Hall', excerpt: 'Stone, metal and clay pieces that stopped visitors in their tracks.', image: '/demo/hl-sculpture.jpg', category: 'Exhibition Highlights', tag: 'Exhibition Highlights', author: 'Neha Kapoor', authorImage: '/demo/artist5.jpg', date: '14 Aug 2025', published: true, order: 11 },
  { slug: 'city-in-colour', title: 'City in Colour: Urban Landscapes by Young Artists', excerpt: 'How a new generation paints the rhythm of Indian cities.', image: '/demo/art-city.jpg', category: 'Artist Stories', tag: 'Artist Stories', author: 'Rohan Mehta', authorImage: '/demo/artist6.jpg', date: '8 Aug 2025', published: true, order: 12 },
]

export const featuredPost = demoBlogs[0]

export const blogDetail = {
  breadcrumb: ['Home', 'Blogs'],
  author: 'Priya Sharma',
  authorImage: '/demo/artist1.jpg',
  date: '12 Oct 2025',
  category: 'Artist Stories',
  video: '/demo/ind-paint.jpg',
  gallery: ['/demo/ex-crowd2.jpg', '/demo/art-gaze.jpg', '/demo/art-bloom.jpg', '/demo/art-dusk.jpg', '/demo/art-tree.jpg'],
  galleryMore: 8,
  paragraphs: [
    'The Haat of Art brings together a vibrant community of artists, art lovers and collectors under one roof. From traditional paintings and sculptures to modern contemporary art, the exhibition offers a unique platform to explore, learn and connect. In this blog, we take you through the highlights, inspiring artworks and unforgettable moments from the Mumbai edition.',
  ],
  highlightsIntro: 'Artists from across India showcased their creativity through diverse art forms including paintings, sculptures, installations and handicrafts.',
  highlightImages: ['/demo/ex-crowd1.jpg', '/demo/hl-sculpture.jpg', '/demo/ex-group.jpg'],
  tags: ['Art Exhibition', 'Mumbai', 'Artist Community', 'Fine Art', 'Art Lovers'],
  related: [
    { title: 'Brushstrokes of Bhakti | Krishna Painting At The Haat of Art', date: '8 Oct 2025', image: '/demo/art-lotus.jpg', slug: 'brushstrokes-of-bhakti' },
    { title: 'Mumbai Art Exhibition 2025 | A Celebration of Creativity', date: '29 Sep 2025', image: '/demo/event-mumbai.jpg', slug: 'mumbai-art-exhibition-2025' },
    { title: 'Glass Painting: Where Color Meets Clarity', date: '18 Sep 2025', image: '/demo/hl-paint.jpg', slug: 'glass-painting-where-color-meets-clarity' },
    { title: 'Flower Painting: Nature’s Poetry on Canvas', date: '1 Sep 2025', image: '/demo/art-mandala.jpg', slug: 'flower-painting-natures-poetry' },
  ],
}

export const blogRoles = [
  { role: 'Visitor', text: 'Register with email & OTP, read and like blogs, can submit blogs for review.', icon: 'V' },
  { role: 'Artist', text: 'Submits blogs, uploads images, videos and other media, track submission status.', icon: 'A' },
  { role: 'Content Manager', text: 'Review, edit and manage blog content and media.', icon: 'C' },
  { role: 'Admin', text: 'Approve or reject blogs, manage categories, tags and featured blogs.', icon: 'S' },
] as const

export const blogFormFields = ['Title', 'Category', 'Blog Content (Rich Text Editor)', 'Upload Images (Multiple)', 'Upload Video (YouTube/Direct)', 'Add Document (PDF Optional)', 'Tags'] as const

export const approvalFlow = [
  { title: 'User Submits Blog', text: 'Status: Pending Review' },
  { title: 'Admin Reviews', text: 'Approve or Reject' },
  { title: 'Email Notification', text: 'If Approved: “Your blog has been approved!” If Rejected: “Your blog has not been approved” (with reason, if provided)' },
] as const

export const blogRoleNote = 'Demo preview of the planned workflow — OTP, submission, review and email notifications are not implemented yet.'
