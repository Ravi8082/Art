import { PublicShell } from '@/components/public-shell'
import { ArtistHero, ArtistMembership, ArtistSpotlight } from '@/components/artist/artist-pages'
import { ArtistDirectory } from '@/components/artist/artist-directory'
import { getFeaturedArtistDirectory } from '@/lib/booking-server'

export const metadata = { title: 'Curated Artist Roster | The Haat of Art', description: 'Meet the artists shaping India’s living canvas through painting, sculpture, folk art and contemporary practice.', alternates: { canonical: '/artists' } }

export const revalidate = 30

export default async function ArtistsPage() {
  const artists = await getFeaturedArtistDirectory()
  const spotlightArtist = artists.find((artist) => artist.isSpotlight)
  return (
    <PublicShell>
      <ArtistHero />
      <ArtistSpotlight artist={spotlightArtist} />
      <ArtistMembership />
      <section id="artists-directory" className="ar-dir">
        <div className="ar-directory-heading">
          <p className="ar-editorial-kicker">The 2026 roster</p>
          <h2>Featured Artists</h2>
          <p>Distinct practices, collected in one place. Find the artist whose work speaks to you.</p>
        </div>
        {artists.length ? <ArtistDirectory artists={artists} /> : <p className="gx-empty">Artist profiles will appear here once they are published.</p>}
      </section>
    </PublicShell>
  )
}
