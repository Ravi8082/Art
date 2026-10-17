import { PublicShell } from '@/components/public-shell'
import { getPublishedAbout, getShell, apiBaseUrl } from '@/lib/api'
import { aboutHero, aboutSections, aboutTeam, aboutPartners } from '@/lib/demo-about'
import { ABOUT_DEMO_NOTE } from '@/lib/demo-about'
import type { AboutSection } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'About · The Haat of Art' }

function mediaUrl(path: string | null) {
  return path ? `${apiBaseUrl}${path}` : null
}

function splitAccent(title: string, fallbackLast = true) {
  const parts = title.trim().split(' ')
  if (!fallbackLast || parts.length < 2) return { main: title, accent: '' }
  const accent = parts.pop()!
  return { main: parts.join(' '), accent }
}

function SectionBody({ html, fallback }: { html: string | null; fallback: string }) {
  if (html) return <div className="ab-body" dangerouslySetInnerHTML={{ __html: html }} />
  return <div className="ab-body"><p>{fallback}</p></div>
}

export default async function AboutPage() {
  const [{ shell }, published] = await Promise.all([getShell(), getPublishedAbout()])
  const state = published?.state ?? null
  const byKey = new Map<string, AboutSection>((state?.sections ?? []).map((section) => [section.sectionKey, section]))
  const hero = byKey.get('hero')
  const foundation = byKey.get('foundation')
  const company = byKey.get('company')
  const demoFoundation = aboutSections[0]
  const demoCompany = aboutSections[1]

  const heroTitle = hero?.title || aboutHero.title
  const { main, accent } = splitAccent(heroTitle)
  const heroImage = mediaUrl(hero?.imageUrl ?? null) ?? aboutHero.image
  const heroSubtitle = hero?.subtitle || aboutHero.subtitle

  const textSections = [
    { config: foundation, demo: demoFoundation },
    { config: company, demo: demoCompany },
  ].filter(({ config }) => !config || Number(config.visible) === 1)

  const team = state?.team?.length
    ? state.team.filter((member) => Number(member.active) === 1)
    : aboutTeam.map((member) => ({ id: String(member.id), name: member.name, designation: member.role, bio: member.bio, photoUrl: null, facebookUrl: null, linkedinUrl: null, instagramUrl: null, sortOrder: member.id, active: 1 }))
  const teamIsDemo = !state?.team?.length

  const partners = state?.partners?.length
    ? state.partners.filter((partner) => Number(partner.active) === 1)
    : aboutPartners.map((partner) => ({ id: String(partner.id), name: partner.name, category: partner.category, websiteUrl: null, logoUrl: null, sortOrder: partner.id, active: 1 }))
  const partnersIsDemo = !state?.partners?.length

  const renderTextSection = ({ config, demo }: typeof textSections[number]) => {
    const title = config?.title || demo.title
    const image = mediaUrl(config?.imageUrl ?? null) ?? demo.image
    const position = config ? config.imagePosition : demo.reverse ? 'left' : 'right'
    return (
      <section key={demo.id} className="ab-text" data-position={position}>
        <div className="ab-text-media"><img src={image} alt={title} loading="lazy" /></div>
        <div className="ab-text-copy">
          <h2>{title}</h2>
          <SectionBody html={config?.bodyHtml || null} fallback={demo.body} />
        </div>
      </section>
    )
  }

  return (
    <PublicShell {...shell}>
      <div className="ab-page">
        <section className="ab-hero">
          <div className="ab-hero-copy">
            <h1>{main} <em>{accent}</em></h1>
            <p>{heroSubtitle}</p>
          </div>
          <div className="ab-hero-media"><img src={heroImage} alt={heroTitle} /></div>
        </section>

        {textSections.map((section) => renderTextSection(section))}

        <section className="ab-team">
          <h2>Our <em>Team</em></h2>
          <div className="ab-team-grid">
            {team.map((member) => (
              <article className="ab-member" key={member.id} tabIndex={0} aria-label={`${member.name} — hover or focus to read more`}>
                <div className="ab-member-inner">
                  <div className="ab-member-face ab-member-front">
                    {member.photoUrl
                      ? <img src={`${apiBaseUrl}${member.photoUrl}`} alt={member.name} loading="lazy" />
                      : teamIsDemo
                        ? <img src={(aboutTeam.find((m) => String(m.id) === member.id) ?? aboutTeam[0]).image} alt={member.name} loading="lazy" />
                        : <i className="ab-member-placeholder">{member.name.slice(0, 1)}</i>}
                    <strong>{member.name}</strong>
                    <small>{member.designation}</small>
                  </div>
                  <div className="ab-member-face ab-member-back">
                    <strong>{member.name}</strong>
                    <small>{member.designation}</small>
                    <p>{member.bio || 'Associated with The Haat of Art. Reach out via the contact page to know more.'}</p>
                    <div className="ab-member-social">
                      {member.facebookUrl && <a href={member.facebookUrl} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on Facebook`}>f</a>}
                      {member.linkedinUrl && <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn`}>in</a>}
                      {member.instagramUrl && <a href={member.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on Instagram`}>ig</a>}
                      <span className="ab-member-hint">Hover / tap to flip back</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="ab-partners">
          <h2>Event <em>Partners</em></h2>
          <div className="ab-partner-grid">
            {partners.map((partner) => (
              <article className="ab-partner" key={partner.id}>
                {partner.logoUrl
                  ? <img src={`${apiBaseUrl}${partner.logoUrl}`} alt={partner.name} loading="lazy" />
                  : <span className="ab-partner-mark">{partner.name.slice(0, 2).toUpperCase()}</span>}
                <strong>{partner.name}</strong>
                {partner.category && <small>{partner.category}</small>}
              </article>
            ))}
          </div>
        </section>

        <section className="ab-cta">
          <a href="/exhibit-with-us">Book Your Stall →</a>
        </section>

        {!published && <p className="th-demo-note">{ABOUT_DEMO_NOTE}</p>}
      </div>
    </PublicShell>
  )
}
