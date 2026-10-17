import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { demoArtists } from '@/lib/demo-home-content'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'

export type ArtistCard = { id: string; name: string; role: string; image?: string }

export function FeaturedArtists({ items }: { items: ArtistCard[] }) {
  const artists = items.length ? items : demoArtists
  return (
    <section className="th-section" id="artists">
      <SectionHeading before="Featured" accent="Artists" subtitle="Meet the talented artists who make The Haat of Art special." cta={{ label: 'View All Artists', href: '/artists' }} />
      <div className="th-artists">
        {artists.slice(0, 6).map((artist, i) => (
          <Link className="th-artist" href="/artists" key={artist.id}>
            <SafeImage src={artist.image} alt={artist.name} fallback={demoArtists[i % demoArtists.length].image} />
            <div><span><b>{artist.name}</b><small>{artist.role}</small></span><i><ArrowRight size={12} /></i></div>
          </Link>
        ))}
      </div>
    </section>
  )
}
