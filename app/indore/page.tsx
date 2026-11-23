import { PublicShell } from '@/components/public-shell'
import { CityQuickSwitch, EventDetails, IndoreHero, PassForm, VisitorSteps } from '@/components/indore/indore-client'
import { Collage, VenueCard, WhyVisit } from '@/components/indore/indore-sections'
import { UpcomingExhibitions } from '@/components/indore/upcoming-exhibitions'
import { apiBaseUrl, getShell } from '@/lib/api'
import { resolveIndoreView, type LiveEvent } from '@/lib/indore-live'

export const revalidate = 30
export const metadata = { title: 'Visitor Passes & Upcoming Exhibitions | The Haat of Art', description: 'Find the nearest Haat of Art exhibition, choose a visitor pass, and get your digital QR reservation.', alternates: { canonical: '/indore' } }

async function upcomingExhibitions(): Promise<{ events: LiveEvent[]; error: string | null }> {
  const response = await fetch(`${apiBaseUrl}/api/exhibitions/nearest`, { next: { revalidate: 30 } }).catch(() => null)
  if (!response) {
    console.error('Visitor exhibition listings could not reach the API')
    return { events: [], error: 'Visitor exhibition listings are temporarily unavailable. Please try again shortly.' }
  }
  if (!response.ok) {
    console.error('Visitor exhibition listings API request failed', { status: response.status })
    return { events: [], error: 'Visitor exhibition listings are temporarily unavailable. Please try again shortly.' }
  }
  const data = await response.json() as { nearest: LiveEvent | null; events: LiveEvent[] }
  if (!Array.isArray(data.events)) {
    console.error('Visitor exhibition listings API returned an invalid response')
    return { events: [], error: 'Visitor exhibition listings are temporarily unavailable. Please try again shortly.' }
  }
  return {
    events: data.events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    error: null,
  }
}

export default async function IndorePage() {
  const [{ shell }, feed] = await Promise.all([getShell(), upcomingExhibitions()])
  const events = feed.events
  const nearest = events[0] ?? null
  const view = resolveIndoreView(nearest)
  return (
    <PublicShell {...shell}>
      <IndoreHero events={events} initialEventSlug={nearest?.slug ?? ''} />
      {feed.error && <p className="in-feed-error" role="alert">{feed.error}</p>}
      <CityQuickSwitch events={events} nearestSlug={nearest?.slug ?? ''} />
      <VisitorSteps />
      <section className="in-pass"><Collage /><PassForm events={events} initialEventSlug={nearest?.slug ?? ''} /></section>
      <UpcomingExhibitions events={events} />
      <WhyVisit />
      {view && <section className="in-info in-info-compact"><VenueCard view={view} /><EventDetails view={view} /></section>}
    </PublicShell>
  )
}
