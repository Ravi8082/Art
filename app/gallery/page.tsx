import { apiBaseUrl, getInvitedGuests, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'
import { GalleryPageContent } from '@/components/gallery/gallery-page-content'
import { getFeaturedArtistDirectory, getCuratedGallery, getExhibitionArchive, getGalleryUpcomingEditions } from '@/lib/booking-server'
import { getGalleryConfig } from '@/lib/gallery-config'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Art Gallery | The Haat of Art', description: 'Explore The Haat of Art exhibition archive: editions, cities, photography, films and featured artists.', alternates: { canonical: '/gallery' } }

export default async function GalleryPage() {
  const [galleryConfig, [{ shell }, artworks, roster, editions, upcomingEditions], invitedGuests] = await Promise.all([
    getGalleryConfig(),
    Promise.all([
      getShell(),
      getCuratedGallery(),
      getFeaturedArtistDirectory(),
      getExhibitionArchive(),
      getGalleryUpcomingEditions(),
    ]),
    getInvitedGuests('gallery'),
  ])
  const featuredSlugs = ['vikramaditya-rathore', 'pratibha-yadav', 'aarav-deshmukh', 'saroj']
  const featuredArtists = featuredSlugs
    .map((slug) => roster.find((artist) => artist.slug === slug))
    .filter((artist) => artist !== undefined)
    .map((artist) => ({
      id: artist.id,
      slug: artist.slug,
      displayName: artist.displayName,
      city: artist.city,
      medium: artist.medium,
      portraitUrl: artist.portraitUrl,
    }))
  const hasArchiveFilm = editions.some((edition) => edition.media.some((media) => media.mediaType === 'VIDEO'))
  return (
    <PublicShell {...shell}>
      <div className="gallery-page">
        <section className="ga-page-hero">
          <div className="ga-page-hero-copy">
            <p className="gc-eyebrow">The Haat of Art · Exhibition Archive</p>
            <h1>Exhibitions, in their own time.</h1>
            <p>A living record of the artists, places and encounters that shape each edition of The Haat of Art.</p>
            <div className="ga-page-hero-meta"><span>{editions.length} editions</span><span>{new Set(editions.map((edition) => edition.city)).size} cities</span><span>{hasArchiveFilm ? 'Photography & film' : 'Exhibition photography'}</span></div>
          </div>
        </section>
        <GalleryPageContent
          artworks={artworks}
          editions={editions}
          upcomingEditions={upcomingEditions}
          featuredArtists={featuredArtists}
          showCuratedArtworks={galleryConfig.showCuratedArtworks}
          invitedGuests={invitedGuests}
        />
      </div>
    </PublicShell>
  )
}
