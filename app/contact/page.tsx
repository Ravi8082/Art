import { PublicShell } from '@/components/public-shell'
import { ContactForm } from '@/components/contact-form'
import { ContactIntro } from '@/components/contact-intro'
import { apiBaseUrl, getHomepageMedia, getShell } from '@/lib/api'
import { CONTACT_DEMO_NOTE, contactDetails, contactHero, contactNotice, contactPartners } from '@/lib/demo-contact'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Contact · The Haat of Art' }

export default async function ContactPage() {
  const [{ content, shell }, media] = await Promise.all([getShell(), getHomepageMedia()])
  const value = (key: string, fallback: string) => content.text[key]?.trim() || fallback
  const banner = media?.contactHero ? `${apiBaseUrl}${media.contactHero.url}` : contactHero.image
  const bannerAlt = media?.contactHero?.altText || 'The Haat of Art gallery floor'
  const mapUrl = value('contactMapUrl', contactDetails.mapUrl)
  const embedMap = mapUrl.includes('output=embed')
  const isDemo = !content.text.contactAddress && !content.text.contactHeroTitle && !media?.contactHero
  const socials = [
    ['Instagram', value('contactInstagram', '')],
    ['Facebook', value('contactFacebook', '')],
    ['LinkedIn', value('contactLinkedin', '')],
  ].filter(([, url]) => url) as [string, string][]

  return (
    <PublicShell {...shell}>
      <ContactIntro />
      <div className="ct-page">
        <section className="ct-hero">
          <div className="ct-hero-copy">
            <p className="public-kicker">Say hello</p>
            <h1>{value('contactHeroTitle', contactHero.title)} <em>{value('contactHeroAccent', contactHero.accent)}</em></h1>
            <p className="ct-hero-intro">{value('contactHeroIntro', contactHero.intro)}</p>
            <div className="ct-ctas">
              <a href="#enquiry-form">Send an enquiry ↓</a>
              <a href="/exhibit-with-us">Book a stall</a>
              <a href="/artists">Artist collaborations</a>
              <a href="/partners">Partnerships</a>
            </div>
          </div>
          <div className="ct-hero-media">
            <img src={banner} alt={bannerAlt} />
            <span className="ct-hero-tag">Indore · Mumbai · Online</span>
          </div>
        </section>

        <section className="ct-cards">
          <article><strong>Visit the studio</strong><p>{value('contactAddress', contactDetails.address)}</p></article>
          <article><strong>Call us</strong><p><a href={`tel:${value('contactPhone', contactDetails.phone).replace(/\s/g, '')}`}>{value('contactPhone', contactDetails.phone)}</a></p></article>
          <article><strong>Write to us</strong><p><a href={`mailto:${value('contactEmail', contactDetails.email)}`}>{value('contactEmail', contactDetails.email)}</a></p></article>
          <article><strong>Business hours</strong><p>{value('contactHours', contactDetails.hours)}</p></article>
        </section>

        <section className="ct-main" id="enquiry-form">
          <div className="ct-form-panel">
            <h2>Tell us what you have in <em>mind.</em></h2>
            <p className="ct-muted">Every field except the mobile number and attachment is required. You will get an enquiry reference ID on the next screen.</p>
            <ContactForm />
            <p className="ct-notice">{value('contactNotice', contactNotice)}</p>
          </div>
          <aside className="ct-side">
            <h3>Where your message goes</h3>
            <ol className="ct-flow">
              <li><strong>Recorded instantly</strong><span>Your enquiry is stored with a reference ID — no OTP, no waiting.</span></li>
              <li><strong>Routed to a person</strong><span>Stall bookings, artists, media and sponsorships each reach the right desk.</span></li>
              <li><strong>Answered in 2 working days</strong><span>Follow-ups are tracked so nothing gets quietly forgotten.</span></li>
            </ol>
            <div className="ct-socials">
              {socials.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}
              {!socials.length && <span>Social links appear here once published from the Admin Panel.</span>}
            </div>
          </aside>
        </section>

        <section className="ct-map">
          <div className="ct-map-copy">
            <h2>Find the <em>haat.</em></h2>
            <p>{value('contactAddress', contactDetails.address)}</p>
            <a className="public-button dark" href={mapUrl} target="_blank" rel="noopener noreferrer">Get directions</a>
          </div>
          {embedMap
            ? <iframe className="ct-map-frame" src={mapUrl} title="The Haat of Art location" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
            : <div className="ct-map-frame ct-map-placeholder"><span>{value('contactHours', contactDetails.hours)}</span><small>Set a Google Maps embed link in the Admin Panel to show the live map here.</small></div>}
        </section>

        {content.text.contactPartnersText && (
          <section className="ct-partners">
            <h2>{value('contactPartnersTitle', contactPartners.title)}</h2>
            <p>{content.text.contactPartnersText}</p>
          </section>
        )}

        {isDemo && <p className="th-demo-note">{CONTACT_DEMO_NOTE}</p>}
      </div>
    </PublicShell>
  )
}
