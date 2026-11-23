'use client'

import Link from 'next/link'
import { MapPin, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DirectoryArtist } from '@/lib/booking-server'

const categories = ['All Artists', 'Acrylic & Oil', 'Watercolor', 'Mixed Media', 'Charcoal & Ink', 'Sculpture', 'Folk & Heritage'] as const
const initialArtistCount = 6

function matchesCategory(medium: string, category: (typeof categories)[number]) {
  const normalized = medium.toLowerCase()
  if (category === 'All Artists') return true
  if (category === 'Acrylic & Oil') return /acrylic|oil|impasto/.test(normalized)
  if (category === 'Watercolor') return /watercolou?r|botanical/.test(normalized)
  if (category === 'Mixed Media') return /mixed media|resin/.test(normalized)
  if (category === 'Charcoal & Ink') return /charcoal|ink|sketch/.test(normalized)
  if (category === 'Sculpture') return /sculpture|ceramic|terracotta/.test(normalized)
  return /folk|heritage|miniature|madhubani|tribal/.test(normalized)
}

export function ArtistDirectory({ artists }: { artists: DirectoryArtist[] }) {
  const [category, setCategory] = useState<(typeof categories)[number]>('All Artists')
  const [city, setCity] = useState('All Cities')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const cities = useMemo(() => [...new Set(artists.map((artist) => artist.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [artists])
  const filtersActive = category !== 'All Artists' || city !== 'All Cities' || Boolean(search.trim())
  const visibleArtists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return artists.filter((artist) => {
      if (city !== 'All Cities' && artist.city !== city) return false
      if (!matchesCategory(artist.medium, category)) return false
      return !query || [artist.displayName, artist.city, artist.medium, artist.specialty, artist.bio]
        .some((value) => value.toLocaleLowerCase().includes(query))
    })
  }, [artists, category, city, search])
  const isExpanded = filtersActive || showAll
  const displayedArtists = isExpanded ? visibleArtists : visibleArtists.slice(0, initialArtistCount)

  function clearFilters() {
    setCategory('All Artists')
    setCity('All Cities')
    setSearch('')
    setShowAll(false)
  }

  function toggleFavorite(artistId: string) {
    setFavoriteIds((current) => current.includes(artistId)
      ? current.filter((id) => id !== artistId)
      : [...current, artistId])
  }

  return (
    <>
      <div className="ad-filters">
        <div className="ad-categories" role="group" aria-label="Filter artists by medium">
          {categories.map((entry) => (
            <button key={entry} type="button" className={category === entry ? 'is-active' : ''}
              aria-pressed={category === entry} onClick={() => setCategory(entry)}>{entry}</button>
          ))}
        </div>
        <div className="ad-filter-controls">
          <label className="ad-city-filter">
            <span className="sr-only">Filter artists by city</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option>All Cities</option>
              {cities.map((entry) => <option key={entry}>{entry}</option>)}
            </select>
          </label>
          <label className="ad-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search artists by name or style</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search artists by name or style..." />
          </label>
        </div>
      </div>
      <div className="ad-results-bar" aria-live="polite">
        <p>Showing <strong>{displayedArtists.length}</strong> of <strong>{artists.length}</strong> Curated Artists</p>
        {filtersActive && <button type="button" onClick={clearFilters}>Clear all filters</button>}
      </div>
      {displayedArtists.length ? (
        <>
          <div className="ad-grid">
            {displayedArtists.map((artist) => {
              const isFavorite = favoriteIds.includes(artist.id)
              return (
                <article className="ad-card" key={artist.id}>
                  <div className="ad-portrait-frame">
                    {artist.portraitUrl
                      ? <img className="ad-portrait-image" src={artist.portraitUrl} alt={`Portrait of ${artist.displayName}`} loading="lazy" />
                      : <div className="ad-portrait-monogram" role="img" aria-label={`Portrait of ${artist.displayName} not yet available`}><span>{artist.displayName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span></div>}
                    {artist.rosterBadge && <span className="ad-roster-badge">{artist.rosterBadge}</span>}
                    <button
                      type="button"
                      className="ad-favorite"
                      aria-label={isFavorite ? `Remove ${artist.displayName} from favorites` : `Add ${artist.displayName} to favorites`}
                      aria-pressed={isFavorite}
                      onClick={() => toggleFavorite(artist.id)}
                    >{isFavorite ? '♥' : '♡'}</button>
                  </div>
                  <Link className="ad-card-link" href={`/artists/${artist.slug}`} aria-label={`View ${artist.displayName}'s artist profile`}>
                    <div className="ad-card-body">
                      <h3>{artist.displayName}</h3>
                      <p className="ad-card-meta">
                        <MapPin size={15} aria-hidden="true" />
                        <span>{artist.city}</span>
                        <span className="ad-meta-separator" aria-hidden="true">·</span>
                        <span className="ad-meta-medium">{artist.medium}</span>
                      </p>
                      <p className="ad-specialty">{artist.specialty}</p>
                      <div className="ad-card-footer">
                        <span>{artist.artworkCount} Exhibited Works</span>
                        <span className="ad-portfolio">View Artist Profile <span aria-hidden="true">→</span></span>
                      </div>
                    </div>
                  </Link>
                </article>
              )
            })}
          </div>
          {!filtersActive && visibleArtists.length > initialArtistCount && (
            <button
              type="button"
              className="ad-view-all"
              aria-expanded={showAll}
              onClick={() => setShowAll((expanded) => !expanded)}
            >
              {showAll ? `Show Featured ${initialArtistCount} Artists ↑` : `Explore All ${artists.length} Roster Artists ↓`}
            </button>
          )}
        </>
      ) : <p className="ad-empty">No artists match those filters. Try another medium, city or search.</p>}
    </>
  )
}
