import { PublicShell } from '@/components/public-shell'
import { ExhibitHero } from '@/components/exhibit/exhibit-hero'
import { MentorSection, ParticipateBanner, PromoSection, StatsSection, VenueSection, WhyExhibit } from '@/components/exhibit/exhibit-sections'
import { StallProspectus } from '@/components/exhibit/stall-prospectus'
import { apiBaseUrl, getEvents, getExhibitInfo, getExhibitionStallCatalog, getHomepageContent, getHomepageMedia, getShell } from '@/lib/api'
import { buildStats } from '@/lib/exhibit-live'
import { exhibitHero, exhibitParticipate, exhibitSections } from '@/lib/exhibit-content'

export const revalidate = 30
export const metadata = { title: 'Exhibit With Us – Art Fest Stalls for Artists | The Haat of Art', description: 'Join The Haat of Art art fest as an exhibitor. Reach collectors, galleries and art lovers with a stall at our art exhibitions.', alternates: { canonical: '/exhibit-with-us' } }

export default async function ExhibitWithUsPage() {
  const [{ shell }, info, stallCatalog, homepageMedia, homepageContent, events] = await Promise.all([
    getShell(),
    getExhibitInfo(),
    getExhibitionStallCatalog(),
    getHomepageMedia(),
    getHomepageContent(),
    getEvents(),
  ])
  const mediaUrl = (key: string, fallback: string) => {
    const url = homepageMedia?.[key]?.url
    return url ? (url.startsWith('http') ? url : `${apiBaseUrl}${url}`) : fallback
  }
  const sections = exhibitSections.filter((s) => s.enabled).sort((a, b) => a.order - b.order)
  const enabled = new Set(sections.map((section) => section.id))
  const stallTypes = info?.stallTypes ?? (stallCatalog?.stallTypes ?? []).map((type) => ({
    ...type,
    price: null,
    taxRate: null,
  }))

  return (
    <PublicShell {...shell}>
      <div className="exhibitor-landing exhibitor-prospectus">
        <ExhibitHero
          slides={exhibitHero.slides}
          eyebrow="Exhibitions"
          title={['Exhibit With']}
          accent="The Haat of Art"
          text="Showcase your work at India's premier platform for art, culture and creative dialogue."
          ctaHref="/book-stall"
          secondaryHref="/stall-specs"
        />
        {enabled.has('why') && <WhyExhibit image={mediaUrl('glimpse', '/media/exhibition-gallery.jpeg')} alt={homepageMedia?.glimpse?.altText || 'Visitors exploring artwork in an exhibition gallery'} landing />}
        {enabled.has('stats') && info && <StatsSection stats={buildStats(info)} />}
        {(enabled.has('standard') || enabled.has('premium')) && (
          <StallProspectus
            types={stallTypes}
            editions={stallCatalog?.editions ?? []}
            openStalls={info?.stats.openStalls ?? null}
          />
        )}
        {enabled.has('mentor') && <MentorSection mentor={homepageContent.mentor} image={mediaUrl('mentor', '')} />}
        {enabled.has('promo') && (
          <>
            <VenueSection events={events ?? []} image={mediaUrl('exhibition1', '/media/exhibition-gallery.jpeg')} />
            <PromoSection landing />
          </>
        )}
        {enabled.has('participate') && <ParticipateBanner landing images={[
          mediaUrl('gallery1', exhibitParticipate.images[0]),
          mediaUrl('gallery2', exhibitParticipate.images[1]),
          mediaUrl('gallery3', exhibitParticipate.images[2]),
        ]} />}
      </div>
    </PublicShell>
  )
}
