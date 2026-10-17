import { PublicShell } from '@/components/public-shell'
import { EventDetails, IndoreHero, PassForm, UpdatesForm } from '@/components/indore/indore-client'
import { Collage, FacesSection, FloorSection, InsideHall, VenueCard, WhyVisit } from '@/components/indore/indore-sections'
import { getShell } from '@/lib/api'
import { INDORE_DEMO_NOTE } from '@/lib/demo-indore'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Indore Exhibition · The Haat of Art' }

export default async function IndorePage() {
  const { shell } = await getShell()
  return (
    <PublicShell {...shell}>
      <IndoreHero />
      <section className="in-pass"><Collage /><PassForm /></section>
      <WhyVisit />
      <FacesSection />
      <InsideHall />
      <FloorSection />
      <section className="in-info"><VenueCard /><EventDetails /><UpdatesForm /></section>
      <p className="th-demo-note">{INDORE_DEMO_NOTE}</p>
    </PublicShell>
  )
}
