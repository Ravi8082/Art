// DEMO CONTENT ONLY. Titles, descriptions and images are placeholders until the
// Admin Panel / Content Manager is connected. The shape below is what the backend
// should later return: upload/replace `image`, edit text, reorder via `order`,
// and publish/hide via `published`. No upload or database storage exists yet.

export type HighlightItem = {
  id: string
  title: string
  description: string
  image: string
  imagePosition: 'left' | 'right'
  buttonLabel: string
  buttonHref: string
  order: number
  published: boolean
}

export const highlightsHero = {
  title: 'Highlights',
  text: 'Explore the vibrant experiences, art forms and creative activities at The Haat of Art.',
  image: '/media/installation.jpeg',
  cta: { label: 'Book Your Stall', href: '/exhibit-with-us' },
}

export const highlightsCta = {
  title: 'Book Your Stall Now',
  text: "Be a part of India's vibrant art community",
  label: 'Book Your Stall',
  href: '/exhibit-with-us',
}

export const demoHighlights: HighlightItem[] = [
  { id: 'h1', title: 'Art Stalls, Sculptures, 3D Modern Art', description: 'The exhibition will be displaying a rich form of art by artists and galleries from across India, including sculptures, contemporary designs, and 3D modern art that showcase creativity in its many forms.', image: '/demo/hl-sculpture.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/exhibitions', order: 1, published: true },
  { id: 'h2', title: 'Live Performance', description: 'Various forms of live performances will be a central attraction at the event, including music, dance, painting and art demonstrations by talented artists.', image: '/demo/hl-performance.jpg', imagePosition: 'right', buttonLabel: 'Read Full More', buttonHref: '/exhibitions', order: 2, published: true },
  { id: 'h3', title: 'Indian Origin', description: 'Art in the origin of art, tradition, and heritage, which has inspired generations. This section celebrates Indian art forms, folk traditions, and cultural expressions from different regions of the country.', image: '/demo/hl-indian-origin.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/gallery', order: 3, published: true },
  { id: 'h4', title: 'Paint My Stuff', description: 'Get your own items painted by talented artists at the event. From T-shirts and tote bags to notebooks and accessories, bring your stuff and make it uniquely yours.', image: '/demo/hl-paint.jpg', imagePosition: 'right', buttonLabel: 'Read Full More', buttonHref: '/exhibitions', order: 4, published: true },
  { id: 'h5', title: 'Graffiti', description: 'Experience the energy and creativity of live graffiti art by emerging and established artists, with vibrant murals and urban art installations.', image: '/demo/hl-graffiti.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/gallery', order: 5, published: true },
  { id: 'h6', title: 'Hand Made Colors, Papers', description: 'Explore handmade colours, natural dyes, and artisanal papers crafted by independent artists and collectives. A unique chance to see and shop eco-friendly art materials.', image: '/demo/hl-colors.jpg', imagePosition: 'right', buttonLabel: 'Read Full More', buttonHref: '/exhibitions', order: 6, published: true },
  { id: 'h7', title: 'Workshops', description: 'Take part in a range of art workshops led by expert artists. Learn new techniques, experiment with different mediums, and discover your creative side.', image: '/demo/hl-workshop.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/exhibitions', order: 7, published: true },
  { id: 'h8', title: 'Object For Home', description: 'Discover a curated collection of artistic and handcrafted objects for your home, including decor pieces, pottery, paintings, and unique art essentials.', image: '/demo/hl-home.jpg', imagePosition: 'right', buttonLabel: 'Read Full More', buttonHref: '/gallery', order: 8, published: true },
  { id: 'h9', title: 'Art for Every Wall', description: "Find a wide variety of original and unique artworks perfect for every space. From traditional to contemporary styles, there's something for every art lover.", image: '/demo/hl-wall.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/gallery', order: 9, published: true },
  { id: 'h10', title: 'House Of Emerge', description: 'A platform for upcoming and emerging artists to showcase their work, connect with art lovers and gain visibility in the art community.', image: '/demo/hl-emerge.jpg', imagePosition: 'right', buttonLabel: 'Read Full More', buttonHref: '/artists', order: 10, published: true },
  { id: 'h11', title: 'Legendary Artist', description: 'Meet and explore the works of legendary artists whose contributions have shaped the art world. A tribute to their creativity, vision and lasting impact.', image: '/demo/hl-legend.jpg', imagePosition: 'left', buttonLabel: 'Read Full More', buttonHref: '/artists', order: 11, published: true },
]
