import { PublicShell } from '@/components/public-shell'
import { ExhibitHero } from '@/components/exhibit/exhibit-hero'
import { MentorSection, ParticipateBanner, PricingSection, PromoSection, StatsSection, WhyExhibit } from '@/components/exhibit/exhibit-sections'
import { getExhibitInfo, getShell } from '@/lib/api'
import { buildPricing, buildStats } from '@/lib/exhibit-live'
import { exhibitSections, type ExhibitSectionId } from '@/lib/demo-exhibit'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibit Your Art & Book Stalls at Art Fests in India | The Haat of Art', description: 'Showcase and sell your art at The Haat of Art exhibitions and art fests. See stall rates, premium stall options and book your stall online.', alternates: { canonical: '/exhibitions' } }


export default async function ExhibitionsPage() {
  const [{ shell }, info] = await Promise.all([getShell(), getExhibitInfo()])
  const sections = exhibitSections.filter((section) => section.enabled).sort((a, b) => a.order - b.order)
  const tables = buildPricing(info)
  const renderers: Record<ExhibitSectionId, () => React.ReactNode> = {
    why: () => <WhyExhibit key="why" />,
    standard: () => tables.standard ? <PricingSection key="standard" table={tables.standard} /> : null,
    premium: () => tables.premium ? <PricingSection key="premium" table={tables.premium} /> : null,
    mentor: () => <MentorSection key="mentor" />,
    stats: () => info ? <StatsSection key="stats" stats={buildStats(info)} /> : null,
    promo: () => <PromoSection key="promo" />,
    participate: () => <ParticipateBanner key="participate" />,
  }
  return (
    <PublicShell {...shell}>
      <ExhibitHero />
      {sections.map((section) => renderers[section.id]())}
    </PublicShell>
  )
}
