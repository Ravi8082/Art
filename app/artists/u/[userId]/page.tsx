import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { apiBaseUrl } from '@/lib/api'
import { getPublicArtist } from '@/lib/booking-server'
import { PublicShell } from '@/components/public-shell'

export const dynamic = 'force-dynamic'

export default async function PublicArtistPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const data = await getPublicArtist(userId)
  if (!data) notFound()
  const { profile, artworks } = data
  const place = [profile.city, profile.state].filter(Boolean).join(', ')
  const links = [['Website', profile.websiteUrl], ['Instagram', profile.instagramUrl], ['Facebook', profile.facebookUrl]].filter(([, href]) => href)
  return (
    <PublicShell>
      <section className="artist-profile">
        {profile.photoUrl && <img src={`${apiBaseUrl}${profile.photoUrl}`} alt={profile.displayName} />}
        <div>
          <p className="public-kicker">{[profile.artStyle, place].filter(Boolean).join(' · ') || 'Artist'}</p>
          <h1>{profile.displayName}</h1>
          {profile.headline && <p><strong>{profile.headline}</strong></p>}
          {profile.bio && <p>{profile.bio}</p>}
          <p>{links.map(([label, href]) => <a key={label} className="underlined-link" href={href} target="_blank" rel="noopener noreferrer nofollow" style={{ marginRight: 16 }}>{label}</a>)}</p>
          <Link className="underlined-link" href="/artists">All artists <ArrowUpRight size={14} /></Link>
        </div>
      </section>
      <section className="page-section">
        <h2 className="page-subtitle">Works by {profile.displayName}</h2>
        {artworks.length === 0 ? <p className="events-message">No works have been added yet.</p>
          : <div className="featured-grid">{artworks.map((work) => <figure className="featured-card" key={work.id}><img src={`${apiBaseUrl}${work.imageUrl}`} alt={work.title} loading="lazy" /><figcaption><strong>{work.title}</strong><span>{[work.medium, work.dimensions, work.year].filter(Boolean).join(' · ')}</span>{work.description && <span>{work.description}</span>}</figcaption></figure>)}</div>}
      </section>
    </PublicShell>
  )
}
