import Link from 'next/link'
import { PublicShell } from '@/components/public-shell'
import { SafeImage } from '@/components/home/safe-image'
import { ArtistHero, DemoNote } from '@/components/artist/artist-pages'
import { demoArtists } from '@/lib/demo-artist'
import { apiBaseUrl } from '@/lib/api'
import { getPublicArtists } from '@/lib/booking-server'

export const metadata = { title: 'Featured Indian Artists | The Haat of Art', description: 'Meet the painters, sculptors and craftspeople exhibiting at The Haat of Art art fests across India.', alternates: { canonical: '/artists' } }

export const dynamic = 'force-dynamic'

export default async function ArtistsPage() {
  const artists = await getPublicArtists()
  return (
    <PublicShell>
      <ArtistHero />
      <section className="ar-dir">
        <h2>Featured Artists</h2>
        <div className="ar-dir-grid">
          {artists.map((a) => (
            <Link key={a.userId} href={`/artists/u/${a.userId}`} className="ar-dir-card">
              <SafeImage src={a.imageUrl ? `${apiBaseUrl}${a.imageUrl}` : '/demo/art-gaze.jpg'} alt={a.displayName} />
              <b>{a.displayName}</b><small>{[a.artStyle || a.headline, a.city].filter(Boolean).join(' · ')}</small>
            </Link>
          ))}
          {demoArtists.map((a) => (
            <Link key={a.name} href="/artist/profile" className="ar-dir-card">
              <SafeImage src={a.image} alt={`${a.name} (demo)`} />
              <b>{a.name}</b><small>{a.category} · {a.city}</small>
            </Link>
          ))}
        </div>
      </section>
      <DemoNote />
    </PublicShell>
  )
}
