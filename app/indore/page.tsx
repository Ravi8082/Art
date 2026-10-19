import { PublicShell } from '@/components/public-shell'
import { EventDetails, IndoreHero, PassForm, UpdatesForm } from '@/components/indore/indore-client'
import { Collage, FacesSection, FloorSection, InsideHall, VenueCard, WhyVisit } from '@/components/indore/indore-sections'
import { UpcomingExhibitions } from '@/components/indore/upcoming-exhibitions'
import { apiBaseUrl, getShell } from '@/lib/api'
import { resolveIndoreView, type LiveEvent } from '@/lib/indore-live'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Art Fest & Art Exhibition in Indore – Free Visitor Pass | The Haat of Art', description: 'Get your free visitor pass for The Haat of Art art fest in Indore. Paintings, crafts, live art, workshops and meet the artists.', alternates: { canonical: '/indore' } }

async function openEvents() {
  const response = await fetch(`${apiBaseUrl}/api/passes/public/events`, { cache: 'no-store' }).catch(() => null)
  if (!response?.ok) return []
  return (await response.json() as { events: LiveEvent[] }).events
}

// The next exhibition that is open for registration, managed from the admin dashboard.
async function nextEvent(events: LiveEvent[]) {
  const slug = events[0]?.slug
  if (!slug) return null
  const detail = await fetch(`${apiBaseUrl}/api/passes/public/events/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null)
  if (!detail?.ok) return null
  return (await detail.json() as { event: LiveEvent }).event
}

export default async function IndorePage() {
  const [{ shell }, events] = await Promise.all([getShell(), openEvents()])
  const event = await nextEvent(events)
  const view = resolveIndoreView(event)
  return (
    <PublicShell {...shell}>
      <IndoreHero view={view} />
      <section className="in-pass"><Collage /><PassForm events={events} /></section>
      <UpcomingExhibitions events={events} />
      <WhyVisit />
      <FacesSection />
      <InsideHall />
      <FloorSection />
      <section className="in-info"><VenueCard view={view} /><EventDetails view={view} /><UpdatesForm /></section>
    </PublicShell>
  )
}
