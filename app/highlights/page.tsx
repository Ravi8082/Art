import { PublicShell } from '@/components/public-shell'
import { HighlightsHero } from '@/components/highlights/highlights-hero'
import { HighlightSection } from '@/components/highlights/highlight-section'
import { BookStallCTA } from '@/components/highlights/book-stall-cta'
import { getShell } from '@/lib/api'
import { demoHighlights } from '@/lib/demo-highlights'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Art Fest Highlights – Photos & Moments | The Haat of Art', description: 'Relive the best moments from The Haat of Art art fests and exhibitions: artists, visitors, live art and workshops.', alternates: { canonical: '/highlights' } }

export default async function HighlightsPage() {
  const { shell } = await getShell()
  const items = demoHighlights.filter((h) => h.published).sort((a, b) => a.order - b.order)
  return (
    <PublicShell {...shell} footerVariant="highlights">
      <HighlightsHero />
      <section className="hl-list">
        <h2 className="hl-title"><i /><span>Highlights</span><i /></h2>
        {items.map((item) => <HighlightSection key={item.id} item={item} />)}
      </section>
      <BookStallCTA />
    </PublicShell>
  )
}
