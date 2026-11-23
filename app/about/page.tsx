import { Handshake, Leaf, Palette, Users } from 'lucide-react'
import type { Metadata } from 'next'
import { PublicShell } from '@/components/public-shell'
import { AboutTeamCarousel } from '@/components/about-team-carousel'
import { InvitedGuestsMarquee } from '@/components/invited-guests-marquee'
import { MutualValueSection } from '@/components/mutual-value-section'
import { PartnerInquiryTrigger } from '@/components/partner-inquiry'
import Link from 'next/link'
import { getPublishedAbout, getShell, apiBaseUrl, getInvitedGuests, getMediaPartners } from '@/lib/api'
import type { AboutSection } from '@/lib/api'
import { MediaAlliancesMarquee } from '@/components/media-alliances-marquee'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const published = await getPublishedAbout()
  const sections = published?.state.sections ?? []
  const settings = published?.state.settings
  const description = settings?.storyBodyHtml
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    title: settings?.heroTitle?.trim() || sections.find((section) => section.sectionKey === 'hero')?.title?.trim() || 'About The Haat of Art',
    ...(description ? { description: description.slice(0, 320) } : {}),
    alternates: { canonical: '/about' },
  }
}

function mediaUrl(path: string | null) {
  return path ? `${apiBaseUrl}${path}` : null
}

function SectionBody({ html }: { html: string | null }) {
  const sectionHtml = html?.replace(/<(\/?)h1(?=[\s>])/gi, '<$1h2')
  return sectionHtml ? <div className="about-ref-body" dangerouslySetInnerHTML={{ __html: sectionHtml }} /> : null
}

const featureIcons = [Palette, Users, Handshake, Leaf]

function partnerInitials(name: string) {
  const words = name.match(/[A-Za-z0-9]+/g) ?? []
  const firstWord = words[0]
  if (!firstWord) return 'TH'
  if (firstWord.length <= 3 && words.length > 1) return firstWord.toUpperCase()
  if (words.length === 1) return firstWord.slice(0, 2).toUpperCase()
  return words.slice(0, 3).map((word) => word[0]).join('').toUpperCase()
}

export default async function AboutPage() {
  const [{ shell }, published, invitedGuests, mediaPartners] = await Promise.all([
    getShell(), getPublishedAbout(), getInvitedGuests('about'), getMediaPartners('about'),
  ])
  const state = published?.state
  const settings = state?.settings
  const sections = new Map<string, AboutSection>((state?.sections ?? []).map((section) => [section.sectionKey, section]))
  const company = sections.get('company')
  const teamSection = sections.get('team')
  const partnersSection = sections.get('partners')
  const cta = sections.get('cta')
  const vision = state?.visionMission.find((section) => section.sectionKey === 'vision' && section.isVisible)
  const mission = state?.visionMission.find((section) => section.sectionKey === 'mission' && section.isVisible)
  const metrics = (state?.metrics ?? []).filter((metric) => metric.isVisible)
  const milestones = (state?.milestones ?? []).filter((milestone) => milestone.isVisible)
  const ecosystemCards = (state?.ecosystemCards ?? []).filter((card) => card.isVisible)
  const team = (state?.team ?? []).filter((member) => member.isActive)
  const partners = (state?.partners ?? []).filter((partner) => partner.isActive)

  return (
    <PublicShell {...shell} homepage>
      <div className="about-ref">
        {settings?.heroVisible && (
          <section className="about-ref-hero">
            {mediaUrl(settings.heroImageUrl) && <img src={mediaUrl(settings.heroImageUrl)!} alt="" />}
            <div className="about-ref-hero-copy">
              <span className="about-ref-eyebrow">{settings.heroKicker}</span>
              <h1>{settings.heroTitle}</h1>
              <p>{settings.heroSubtitle}</p>
            </div>
          </section>
        )}
        {settings && !settings.heroVisible && <h1 className="about-ref-visually-hidden">{settings.heroTitle}</h1>}

        {!settings && <p className="about-ref-unavailable" role="alert">About information is temporarily unavailable. Please try again shortly.</p>}

        {settings?.storyVisible && (
          <section className="about-ref-story">
            <div className="about-ref-story-image">
              {mediaUrl(settings.storyImageUrl)
                ? <img src={mediaUrl(settings.storyImageUrl)!} alt={settings.storyHeading} loading="lazy" />
                : <div className="about-ref-image-empty" aria-hidden="true"><Palette size={48} /></div>}
            </div>
            <div className="about-ref-story-copy">
              {settings.storyKicker && <span className="about-ref-eyebrow">{settings.storyKicker}</span>}
              <h2>{settings.storyHeading}</h2>
              <SectionBody html={settings.storyBodyHtml} />
              {settings.storyTags.length > 0 && (
                <ul className="about-ref-features">
                  {settings.storyTags.map((label, index) => {
                    const Icon = featureIcons[index % featureIcons.length]
                    return <li key={`${label}-${index}`}><Icon aria-hidden="true" size={24} /><span>{label}</span></li>
                  })}
                </ul>
              )}
            </div>
          </section>
        )}

        {metrics.length > 0 && (
          <section className="about-ref-impact" aria-label="Foundation impact and milestones">
            {metrics.map((metric) => (
              <div className="about-ref-impact-item" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}{metric.sublabel && <> · {metric.sublabel}</>}</span>
              </div>
            ))}
          </section>
        )}

        {settings?.journeyVisible && milestones.length > 0 && (
          <section className="about-ref-journey" aria-labelledby="about-ref-journey-title">
            <header className="about-ref-journey-heading">
              <span className="about-ref-eyebrow">{settings.journeyKicker}</span>
              <h2 id="about-ref-journey-title">{settings.journeyHeading}</h2>
            </header>
            <ol className="about-ref-journey-list">
              {milestones.map((milestone) => (
                <li key={milestone.id}>
                  <span className="about-ref-journey-period">{milestone.yearRange}</span>
                  <h3>{milestone.title}</h3>
                  {milestone.description && <p>{milestone.description}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {(vision || mission) && (
          <section className="about-ref-purpose" aria-label="Our vision and mission">
            {vision && (
              <article>
                <span className="about-ref-purpose-number">{String(vision.sortOrder).padStart(2, '0')} · {vision.title}</span>
                <h2>{vision.title}</h2>
                <SectionBody html={vision.bodyHtml} />
              </article>
            )}
            {mission && (
              <article>
                <span className="about-ref-purpose-number">{String(mission.sortOrder).padStart(2, '0')} · {mission.title}</span>
                <h2>{mission.title}</h2>
                <SectionBody html={mission.bodyHtml} />
              </article>
            )}
          </section>
        )}

        {settings && ecosystemCards.length > 0 && (
          <MutualValueSection
            kicker={settings.ecosystemKicker}
            title={settings.ecosystemHeading}
            subtitle={settings.ecosystemSubtitle}
            cards={ecosystemCards}
          />
        )}

        {company && Number(company.visible) === 1 && (company.title || company.bodyHtml) && (
          <section className="about-ref-company">
            {mediaUrl(company.imageUrl) && <img src={mediaUrl(company.imageUrl)!} alt={company.title} loading="lazy" />}
            <div>
              {company.subtitle && <span className="about-ref-eyebrow">{company.subtitle}</span>}
              <h2>{company.title}</h2>
              <SectionBody html={company.bodyHtml} />
            </div>
          </section>
        )}

        {teamSection && Number(teamSection.visible) === 1 && team.length > 0 && (
          <section className="about-ref-section">
            <header className="about-ref-section-heading">
              <span className="about-ref-eyebrow">{teamSection.title}</span>
              <h2>{teamSection.title}</h2>
              {teamSection.subtitle && <p>{teamSection.subtitle}</p>}
            </header>
            <AboutTeamCarousel members={team} apiBaseUrl={apiBaseUrl} />
          </section>
        )}

        <InvitedGuestsMarquee page="about" guests={invitedGuests} />

        {partnersSection && Number(partnersSection.visible) === 1 && partners.length > 0 && (
          <section className="about-ref-section about-ref-partners">
            <header className="about-ref-section-heading">
              <span className="about-ref-eyebrow">{partnersSection.title}</span>
              <h2>{partnersSection.title}</h2>
              {partnersSection.subtitle && <p>{partnersSection.subtitle}</p>}
            </header>
            <div className="about-ref-partner-grid">
              {partners.map((partner) => {
                const content = (
                  <>
                    <span className={`about-ref-partner-emblem ${partner.logoUrl ? 'has-logo' : 'is-monogram'}`}>
                      {partner.logoUrl
                        ? <img src={`${apiBaseUrl}${partner.logoUrl}`} alt="" loading="lazy" />
                        : <span className="about-ref-partner-mark" aria-hidden="true">{partner.shortCode || partnerInitials(partner.name)}</span>}
                    </span>
                    <strong>{partner.name}</strong>
                    {partner.category && <small>{partner.category}</small>}
                  </>
                )
                return partner.websiteUrl
                  ? <a className="about-ref-partner" href={partner.websiteUrl} key={partner.id} target="_blank" rel="noopener noreferrer">{content}</a>
                  : <article className="about-ref-partner" key={partner.id}>{content}</article>
              })}
            </div>
          </section>
        )}

        <MediaAlliancesMarquee page="about" partners={mediaPartners} />

        {cta && Number(cta.visible) === 1 && (cta.title || cta.subtitle) && (
          <section className="about-ref-cta">
            <div><h2>{cta.title}</h2><p>{cta.subtitle}</p></div>
            {cta.buttonLabel && (
              cta.linkUrl?.startsWith('http')
                ? <a className="about-ref-cta-button" href={cta.linkUrl} target="_blank" rel="noopener noreferrer">{cta.buttonLabel}<span aria-hidden="true">→</span></a>
                : cta.linkUrl
                  ? <Link className="about-ref-cta-button" href={cta.linkUrl}>{cta.buttonLabel}<span aria-hidden="true">→</span></Link>
                  : <PartnerInquiryTrigger className="about-ref-cta-button">{cta.buttonLabel}<span aria-hidden="true">→</span></PartnerInquiryTrigger>
            )}
          </section>
        )}
      </div>
    </PublicShell>
  )
}
