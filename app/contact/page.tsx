import { PublicShell } from '@/components/public-shell'
import { ContactConcierge } from '@/components/contact-concierge'
import { ContactIntro } from '@/components/contact-intro'
import { apiBaseUrl, getContactSettings, getHomepageMedia, getShell } from '@/lib/api'

export const revalidate = 30
export const metadata = { title: 'Contact The Haat of Art – Stalls, Collaborations & Enquiries', description: 'Contact The Haat of Art for stall bookings, artist collaborations, sponsorship and partnership enquiries.', alternates: { canonical: '/contact' } }

export default async function ContactPage() {
  const [{ content, shell }, media, contactSettings] = await Promise.all([getShell(), getHomepageMedia(), getContactSettings()])
  const value = (key: string, fallback = '') => content.text[key]?.trim() || fallback
  const bannerUrl = media?.contactHero?.url
  const banner = bannerUrl
    ? bannerUrl.startsWith('http') ? bannerUrl : `${apiBaseUrl}${bannerUrl}`
    : '/media/exhibition-gallery.jpeg'
  const bannerAlt = media?.contactHero?.altText || 'Artwork displayed in an exhibition'
  const fallbackPhones = value('contactPhone', '+91 7304645333 | +91 8779798244')
    .split(/[|,\n;]+/)
    .map((phone) => phone.trim())
    .filter(Boolean)
  const contact = contactSettings ?? {
    address: value('contactAddress', 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India'),
    phones: fallbackPhones.length ? fallbackPhones : ['+91 7304645333', '+91 8779798244'],
    email: value('contactEmail', 'contact@thehaatofart.com'),
    hours: value('contactHours', 'Mon – Sat: 10:00 AM – 6:00 PM'),
    socialLinks: [],
  }
  const mapUrl = value('contactMapUrl')
  const address = contact.address || 'C-503, Mayro House, Behind Crystal Plaza, Veera Desai, Andheri (West), Mumbai, India'
  const officeHours = contact.hours || 'Mon – Sat: 10:00 AM – 6:00 PM'
  const directionsUrl = 'https://maps.google.com/?q=C-503+Mayro+House+Veera+Desai+Andheri+West+Mumbai'
  const embedMapUrl = mapUrl.includes('output=embed')
    ? mapUrl
    : 'https://maps.google.com/maps?q=C-503+Mayro+House+Veera+Desai+Andheri+West+Mumbai&output=embed'

  return (
    <PublicShell {...shell}>
      <ContactIntro />
      <div className="ct-page">
        <section className="ct-hero">
          <div className="ct-hero-copy">
            <p className="public-kicker">Say hello · Indore · Mumbai · Online</p>
            <h1>{value('contactHeroTitle', "Let's talk about")} <em>{value('contactHeroAccent', 'art.')}</em></h1>
            <p className="ct-hero-intro">{value('contactHeroIntro', 'For stall bookings, artist collaborations, partnerships, or questions about an upcoming exhibition, send our team a message.')}</p>
            <div className="ct-ctas">
              <a href="#enquiry-form">Send an enquiry ↓</a>
              <a href="/exhibitions">Book a stall</a>
              <a href="/artists">Artist collaborations</a>
              <a href="#enquiry-form">Partnerships</a>
            </div>
          </div>
          <div className="ct-hero-media">
            <img src={banner} alt={bannerAlt} />
          </div>
        </section>

        <ContactConcierge
          contact={contact}
          notice={content.text.contactNotice?.trim() || undefined}
        />

        <section className="ct-map ct-location-card" aria-labelledby="ct-map-title">
          <div className="ct-map-copy ct-location-copy">
            <p className="ct-section-kicker">Visit our studio</p>
            <h2 id="ct-map-title">Find the <em>haat.</em></h2>
            <address>{address}</address>
            <p className="ct-location-landmark">Behind Crystal Plaza, Veera Desai Road, Andheri West</p>
            <p className="ct-location-hours"><strong>Office hours</strong><span>{officeHours}</span></p>
            <a className="public-button dark ct-map-directions" href={directionsUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps ↗
            </a>
          </div>
          <div className="ct-location-embed">
            <iframe
              className="ct-map-frame"
              src={embedMapUrl}
              title="Google Maps: The Haat of Art, Veera Desai, Andheri West, Mumbai"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>

        {content.text.contactPartnersText && (
          <section className="ct-partners">
            <h2>{value('contactPartnersTitle', 'Our Partners')}</h2>
            <p>{content.text.contactPartnersText}</p>
          </section>
        )}

      </div>
    </PublicShell>
  )
}
