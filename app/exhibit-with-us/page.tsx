import { PublicShell } from '@/components/public-shell'
import { ExhibitHero } from '@/components/exhibit/exhibit-hero'
import { MentorSection, ParticipateBanner, PricingSection, PromoSection, StatsSection, WhyExhibit } from '@/components/exhibit/exhibit-sections'
import { getExhibitInfo, getShell } from '@/lib/api'
import { buildPricing, buildStats } from '@/lib/exhibit-live'
import { exhibitSections, type ExhibitSectionId } from '@/lib/demo-exhibit'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibit With Us – Art Fest Stalls for Artists | The Haat of Art', description: 'Join The Haat of Art art fest as an exhibitor. Reach collectors, galleries and art lovers with a stall at our art exhibitions.', alternates: { canonical: '/exhibit-with-us' } }

export default async function ExhibitWithUsPage() {
  const [{ shell }, info] = await Promise.all([getShell(), getExhibitInfo()])
  const sections = exhibitSections.filter((s) => s.enabled).sort((a, b) => a.order - b.order)
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
      {sections.map((s) => renderers[s.id]())}
    </PublicShell>
  )
}
