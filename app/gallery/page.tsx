import { apiBaseUrl, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'
import { FeaturedArtists, GalleryGrid, type UploadedWork } from '@/components/gallery/gallery-grid'
import { DemoNote } from '@/components/artist/artist-pages'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Art Gallery – Paintings by Indian Artists | The Haat of Art', description: 'Browse paintings and artworks by Indian artists featured at The Haat of Art art fests and exhibitions.', alternates: { canonical: '/gallery' } }

export default async function GalleryPage() {
  const { content, shell } = await getShell()
  const artistWorks: UploadedWork[] = await fetch(`${apiBaseUrl}/api/artist-profile/public/gallery`, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() as Promise<(UploadedWork & { url: string })[]> : [])
    .then((rows) => rows.map((w) => ({ ...w, description: w.description ?? '', url: `${apiBaseUrl}${w.url}`, avatarUrl: w.avatarUrl ? `${apiBaseUrl}${w.avatarUrl}` : null })))
    .catch(() => [])
  const uploaded: UploadedWork[] = [
    ...artistWorks,
    ...content.artworks.map((w) => ({ id: w.id, title: w.title, artistName: w.artistName ?? '', description: w.description ?? '', url: `${apiBaseUrl}${w.url}` })),
  ]
  return (
    <PublicShell {...shell}>
      <section className="gx-hero" style={{ backgroundImage: 'linear-gradient(90deg,#f1dfcb 0%,#f1dfcbe6 38%,#f1dfcb00 75%),url(/demo/hero1.jpg)' }}>
        <div>
          <h1>Explore a World<br />of <em>Art &amp; Creativity</em></h1>
          <p>Discover unique artworks from talented artists across India. Paintings, sculptures, handicrafts and more.</p>
          <div className="gx-stats"><span><b>{uploaded.length + 12}</b>Artworks</span><span><b>6</b>Artists</span><span><b>5</b>Art Categories</span></div>
        </div>
      </section>
      <GalleryGrid uploaded={uploaded} />
      <FeaturedArtists />
      <DemoNote />
    </PublicShell>
  )
}
