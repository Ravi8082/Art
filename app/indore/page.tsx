import { PublicShell } from '@/components/public-shell'
import { EventDetails, IndoreHero, PassForm, UpdatesForm } from '@/components/indore/indore-client'
import { Collage, FacesSection, FloorSection, InsideHall, VenueCard, WhyVisit } from '@/components/indore/indore-sections'
import { apiBaseUrl, getShell } from '@/lib/api'
import { INDORE_DEMO_NOTE } from '@/lib/demo-indore'
import { resolveIndoreView, type LiveEvent } from '@/lib/indore-live'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Upcoming Exhibition · The Haat of Art' }

// The next exhibition that is open for registration, managed from the admin dashboard.
async function nextEvent() {
  const response = await fetch(`${apiBaseUrl}/api/passes/public/events`, { cache: 'no-store' }).catch(() => null)
  if (!response?.ok) return null
  const { events } = await response.json() as { events: LiveEvent[] }
  const slug = events[0]?.slug
  if (!slug) return null
  const detail = await fetch(`${apiBaseUrl}/api/passes/public/events/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null)
  if (!detail?.ok) return null
  return (await detail.json() as { event: LiveEvent }).event
}

export default async function IndorePage() {
  const [{ shell }, event] = await Promise.all([getShell(), nextEvent()])
  const view = resolveIndoreView(event)
  return (
    <PublicShell {...shell}>
      <IndoreHero view={view} />
      <section className="in-pass"><Collage /><PassForm eventSlug={view.slug} /></section>
      <WhyVisit />
      <FacesSection />
      <InsideHall />
      <FloorSection />
      <section className="in-info"><VenueCard view={view} /><EventDetails view={view} /><UpdatesForm /></section>
      <p className="th-demo-note">{INDORE_DEMO_NOTE}</p>
    </PublicShell>
  )
}
