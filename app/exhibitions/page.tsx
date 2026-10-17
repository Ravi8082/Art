import { PublicShell } from '@/components/public-shell'
import { ExhibitHero } from '@/components/exhibit/exhibit-hero'
import { MentorSection, ParticipateBanner, PricingSection, PromoSection, StatsSection, WhyExhibit } from '@/components/exhibit/exhibit-sections'
import { getShell } from '@/lib/api'
import { EXHIBIT_DEMO_NOTE, exhibitPricing, exhibitSections, type ExhibitSectionId } from '@/lib/demo-exhibit'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibit With Us · The Haat of Art' }

const renderers: Record<ExhibitSectionId, () => React.ReactNode> = {
  why: () => <WhyExhibit key="why" />,
  standard: () => <PricingSection key="standard" table={exhibitPricing[0]} />,
  premium: () => <PricingSection key="premium" table={exhibitPricing[1]} />,
  mentor: () => <MentorSection key="mentor" />,
  stats: () => <StatsSection key="stats" />,
  promo: () => <PromoSection key="promo" />,
  participate: () => <ParticipateBanner key="participate" />,
}

export default async function ExhibitionsPage() {
  const { shell } = await getShell()
  const sections = exhibitSections.filter((section) => section.enabled).sort((a, b) => a.order - b.order)
  return (
    <PublicShell {...shell}>
      <ExhibitHero />
      {sections.map((section) => renderers[section.id]())}
      <p className="th-demo-note">{EXHIBIT_DEMO_NOTE}</p>
    </PublicShell>
  )
}
