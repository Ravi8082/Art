import Link from 'next/link'
import { PublicShell } from '@/components/public-shell'
import { SafeImage } from '@/components/home/safe-image'
import { ArtistHero, DemoNote } from '@/components/artist/artist-pages'
import { demoArtists } from '@/lib/demo-artist'

export const metadata = { title: 'Artists · The Haat of Art' }

export default function ArtistsPage() {
  return (
    <PublicShell>
      <ArtistHero />
      <section className="ar-dir">
        <h2>Featured Artists</h2>
        <div className="ar-dir-grid">
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
