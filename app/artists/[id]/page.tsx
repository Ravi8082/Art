import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { apiBaseUrl, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'

export const dynamic = 'force-dynamic'

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
