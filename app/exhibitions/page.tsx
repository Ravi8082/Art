import { PublicShell } from '@/components/public-shell'
import { ExhibitHero } from '@/components/exhibit/exhibit-hero'
import { ExhibitorJourney, ExhibitorRoiStrip, MentorSection, ParticipateBanner, PromoSection, StatsSection, WhyExhibit } from '@/components/exhibit/exhibit-sections'
import { StallCategoriesSection } from '@/components/exhibit/stall-categories-section'
import { apiBaseUrl, getExhibitInfo, getExhibitionStallCatalog, getHomepageContent, getHomepageMedia, getInvitedGuests, getMediaPartners, getPublishedAbout, getShell } from '@/lib/api'
import { InvitedGuestsMarquee } from '@/components/invited-guests-marquee'
import { MediaAlliancesMarquee } from '@/components/media-alliances-marquee'
import { defaultHomepageContent } from '@/lib/homepage-content'
import { buildStats } from '@/lib/exhibit-live'
import { exhibitHero, exhibitParticipate, exhibitSections, type ExhibitSectionId } from '@/lib/exhibit-content'
import { ScrollReveal } from '@/components/motion/scroll-reveal'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Exhibit Your Art & Book Stalls at Art Fests in India | The Haat of Art', description: 'Showcase your art at The Haat of Art exhibitions. Review stall specifications and choose an exhibition to view its live city-specific tariff.', alternates: { canonical: '/exhibitions' } }


export default async function ExhibitionsPage() {
  const [{ shell }, info, stallCatalog, media, homepageContent, about, invitedGuests, mediaPartners] = await Promise.all([
    getShell(), getExhibitInfo(), getExhibitionStallCatalog(), getHomepageMedia(), getHomepageContent(), getPublishedAbout(), getInvitedGuests('exhibitions'), getMediaPartners('exhibitions'),
  ])
  const mediaUrl = (key: string, fallback = '') => {
    const url = media?.[key]?.url
    return url ? (url.startsWith('http') ? url : `${apiBaseUrl}${url}`) : fallback
  }
  const stallTypes = stallCatalog?.stallTypes ?? info?.stallTypes.map(({ id, code, name, category, widthM, depthM, includes }) => ({
    id, code, name, category, widthM, depthM, includes,
  })) ?? []
  const aboutMentor = about?.state.team.find((member) => member.isFeaturedMentor && member.isActive)
  const mentor = aboutMentor
    ? { visible: homepageContent.mentor.visible, name: aboutMentor.name, title: 'OUR MENTOR', bio: aboutMentor.bio }
    : { ...defaultHomepageContent.mentor, visible: homepageContent.mentor.visible, title: 'OUR MENTOR' }
  const sections = exhibitSections.filter((section) => section.enabled).sort((a, b) => a.order - b.order)
  const renderers: Record<ExhibitSectionId, () => React.ReactNode> = {
    why: () => <><WhyExhibit image="/media/hero-exhibition.jpg" alt="Visitors exploring The Haat of Art gallery" /><InvitedGuestsMarquee page="exhibitions" guests={invitedGuests} /></>,
    standard: () => <><ExhibitorRoiStrip /><ExhibitorJourney /><StallCategoriesSection types={stallTypes} editions={stallCatalog?.editions ?? []} /><MediaAlliancesMarquee page="exhibitions" partners={mediaPartners} /></>,
    premium: () => null,
    mentor: () => <MentorSection key="mentor" mentor={mentor} image={mediaUrl('mentor')} />,
    stats: () => info ? <StatsSection key="stats" stats={buildStats(info)} /> : null,
    promo: () => <PromoSection key="promo" />,
    participate: () => <ParticipateBanner key="participate" images={[
      mediaUrl('gallery1', exhibitParticipate.images[0]),
      mediaUrl('gallery2', exhibitParticipate.images[1]),
      mediaUrl('gallery3', exhibitParticipate.images[2]),
    ]} />,
  }
  return (
    <div id="exhibitions-page" className="exhibitions-page exhibitor-landing">
      <PublicShell {...shell}>
        <ExhibitHero slides={exhibitHero.slides.slice(0, 1)} />
        {sections.map((section) => <ScrollReveal key={section.id}>{renderers[section.id]()}</ScrollReveal>)}
      </PublicShell>
    </div>
  )
}
