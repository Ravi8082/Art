'use client'

import Link from 'next/link'
import { ArrowRight, MapPin } from 'lucide-react'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'

export type ArtistCard = {
  id: string
  slug?: string
  name: string
  role: string
  city?: string
  specialty?: string
  image?: string
  artworkImage?: string
  artworkCount?: number
}

export function FeaturedArtists({ items }: { items: ArtistCard[] }) {
  if (!items.length) return null
  const renderArtists = (duplicate = false) => items.map((artist) => (
    <article
      className="th-artist"
      role="listitem"
      key={`${duplicate ? 'duplicate-' : ''}${artist.id}`}
    >
      <Link className="th-artist-card-link" href={artist.slug ? `/artists/${artist.slug}` : `/artists/u/${artist.id}`} prefetch={false} tabIndex={duplicate ? -1 : undefined}>
        <div className="th-artist-artwork">
          <SafeImage
            src={artist.image || artist.artworkImage}
            alt={artist.image ? `${artist.name} portrait` : `${artist.name}'s signature artwork`}
            fallback={artist.artworkImage || '/media/visual-art.jpeg'}
          />
          <span className="th-artist-medium">{artist.role}</span>
          {artist.artworkCount != null && <span className="th-artist-artwork-count">{artist.artworkCount} Artworks</span>}
        </div>
        <div className="th-artist-identity">
          <span className="th-artist-copy">
            <b>{artist.name}</b>
            {artist.city && <small><MapPin size={13} aria-hidden="true" />{artist.city}</small>}
          </span>
        </div>
        {artist.specialty && <p className="th-artist-specialty">{artist.specialty}</p>}
        <span className="th-artist-profile-link">
          <span>View Portfolio</span>
          <ArrowRight size={16} aria-hidden="true" />
        </span>
      </Link>
    </article>
  ))

  return (
    <section className="th-section th-artists-section" id="artists">
      <SectionHeading
        before="Meet Our"
        accent="Featured Artists"
        subtitle="A diverse community of creators — from emerging talents to established names and specially-abled artists."
        cta={{ label: 'View More Artists', href: '/artists' }}
      />
      <div
        className="th-artists"
        role="region"
        aria-label="Featured artists"
        tabIndex={0}
        style={{ '--homepage-artist-duration': `${Math.max(30, items.length * 6)}s` } as React.CSSProperties}
      >
        <div className="th-artists-track">
          <div className="th-artists-group" role="list" aria-label="Featured artists">
            {renderArtists()}
          </div>
          <div className="th-artists-group" role="list" aria-hidden="true" inert>
            {renderArtists(true)}
          </div>
        </div>
      </div>
    </section>
  )
}
