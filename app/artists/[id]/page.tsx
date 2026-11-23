import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { apiBaseUrl, getShell } from '@/lib/api'
import { getArtistDirectory, getArtistDirectoryProfile } from '@/lib/booking-server'
import { PublicShell } from '@/components/public-shell'
import { ArtistMonograph } from '@/components/artist/artist-monograph'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const directory = await getArtistDirectoryProfile(id)
  if (directory) {
    return {
      title: `${directory.artist.displayName} · The Haat of Art`,
      description: directory.artist.bio.slice(0, 160),
      alternates: { canonical: `/artists/${encodeURIComponent(id)}` },
    }
  }
  const artist = (await getShell()).content.artists.find((item) => item.id === id)
  if (!artist) return { robots: { index: false, follow: true } }
  return {
    title: `${artist.name} · The Haat of Art`,
    description: artist.bio.slice(0, 160),
    alternates: { canonical: `/artists/${encodeURIComponent(id)}` },
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const directory = await getArtistDirectoryProfile(id)
  if (directory) {
    const { artist, artworks } = directory
    const moreArtists = (await getArtistDirectory()).filter((item) => item.id !== artist.id).slice(0, 3)
    return (
      <PublicShell>
        <ArtistMonograph artist={artist} artworks={artworks} moreArtists={moreArtists} />
      </PublicShell>
    )
  }
  const { content, shell } = await getShell()
  const artist = content.artists.find((item) => item.id === id)
  if (!artist) notFound()
  const works = content.artworks.filter((work) => work.artistId === id)
  return (
    <PublicShell {...shell}>
      <section className="artist-profile">
        {artist.photoUrl && <img src={`${apiBaseUrl}${artist.photoUrl}`} alt={artist.name} />}
        <div><p className="public-kicker">{artist.city || 'Artist'}</p><h1>{artist.name}</h1><p>{artist.bio}</p><Link className="underlined-link" href="/artists">All artists <ArrowUpRight size={14} /></Link></div>
      </section>
      <section className="page-section">
        <h2 className="page-subtitle">Works by {artist.name}</h2>
        {works.length === 0 ? <p className="events-message">No works have been added for this artist yet.</p>
          : <div className="featured-grid">{works.map((work) => <figure className="featured-card" key={work.id}><img src={`${apiBaseUrl}${work.url}`} alt={work.title} loading="lazy" /><figcaption><strong>{work.title}</strong>{work.description && <span>{work.description}</span>}</figcaption></figure>)}</div>}
      </section>
    </PublicShell>
  )
}
