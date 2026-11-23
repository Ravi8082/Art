import { PublicShell } from '@/components/public-shell'
import { HighlightsHero } from '@/components/highlights/highlights-hero'
import { HighlightSection } from '@/components/highlights/highlight-section'
import { BookStallCTA } from '@/components/highlights/book-stall-cta'
import { apiBaseUrl, getEvents, getShell } from '@/lib/api'
import { isPlaceholderContent } from '@/lib/content-quality'

export const revalidate = 30
export const metadata = { title: 'Art Fest Highlights – Photos & Moments | The Haat of Art', description: 'Relive the best moments from The Haat of Art art fests and exhibitions: artists, visitors, live art and workshops.', alternates: { canonical: '/highlights' } }

export default async function HighlightsPage() {
  const [{ shell }, events] = await Promise.all([getShell(), getEvents()])
  const items = (events ?? []).filter((event) => !isPlaceholderContent(event.title, event.description)).flatMap((event) => {
    const cover = event.media.find((item) => item.mediaType === 'IMAGE')
    return cover ? [{
      id: event.id,
      title: event.title,
      description: event.description,
      image: `${apiBaseUrl}${cover.url}`,
    }] : []
  })
  return (
    <PublicShell {...shell} footerVariant="highlights">
      <HighlightsHero />
      <section className="hl-list">
        <h2 className="hl-title"><i /><span>Highlights</span><i /></h2>
        {items.map((item) => <HighlightSection key={item.id} item={item} />)}
        {!items.length && <p className="events-message">No exhibition highlights have been published yet.</p>}
      </section>
      <BookStallCTA />
    </PublicShell>
  )
}
