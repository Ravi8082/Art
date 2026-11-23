import Link from 'next/link'
import { ArrowRight, BadgeIndianRupee, Check, Handshake, Megaphone, Palette, ShieldCheck, Image as ImageIcon, MapPin, Users, Share2, PanelsTopLeft, Globe2 } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { exhibitParticipate, exhibitPromos, exhibitWhy, type PricingTable } from '@/lib/exhibit-content'
import { formatDate, type PublicEvent } from '@/lib/api'
import type { ExhibitInfo } from '@/lib/api'
import type { HomepageContent } from '@/lib/homepage-content'
import { TiltCard3D } from '@/components/motion/tilt-card-3d'

const benefitIcons = { sales: BadgeIndianRupee, network: Handshake, media: Megaphone, brand: Palette, support: ShieldCheck, footfall: Users }
const statIcons = { artwork: ImageIcon, venue: MapPin, audience: Users, network: Share2 }

export function ExhibitorJourney() {
  const steps = [
    { number: '01', title: 'Choose Your City & Stall Size' },
    { number: '02', title: 'Curatorial Review & Instant Confirmation' },
    { number: '03', title: 'Turnkey Setup & 0% Sales Commission' },
  ]

  return (
    <section className="ex-journey" aria-labelledby="ex-journey-title">
      <div className="ex-journey-heading">
        <p className="th-eyebrow">A clear path to the show floor</p>
        <h2 id="ex-journey-title">How Exhibiting Works <span>(3 Simple Steps)</span></h2>
      </div>
      <ol className="ex-journey-steps">
        {steps.map((step) => (
          <li key={step.number}>
            <span className="ex-journey-number">{step.number}</span>
            <h3>{step.title}</h3>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ExhibitorRoiStrip() {
  const guarantees = [
    { icon: BadgeIndianRupee, title: '0% Sales Commission', text: 'Artists keep full sale proceeds' },
    { icon: PanelsTopLeft, title: 'Turnkey Ready Booths', text: 'Spotlights, furniture & fascia board included' },
    { icon: Users, title: 'Targeted Buyer Footfall', text: 'Collectors, architects & corporate buyers' },
    { icon: Globe2, title: 'Year-Round Online Listing', text: 'Featured on the THOA Artist Roster & Gallery' },
  ]

  return (
    <section className="exhibitor-roi" aria-labelledby="exhibitor-roi-title">
      <div className="exhibitor-roi-heading">
        <p className="th-eyebrow">Exhibitor ROI &amp; Inclusions</p>
        <h2 id="exhibitor-roi-title">More than a space to show your work</h2>
      </div>
      <div className="exhibitor-roi-grid">
        {guarantees.map(({ icon: Icon, title, text }) => (
          <article className="exhibitor-roi-item" key={title}>
            <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
            <div><h3>{title}</h3><p>{text}</p></div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function WhyExhibit({ image, alt, landing = false }: { image?: string; alt?: string; landing?: boolean } = {}) {
  const benefits = landing
    ? [
      { icon: 'network', title: 'High Audience Reach', text: 'Meet collectors and art lovers' },
      { icon: 'media', title: 'Professional Promotion', text: 'Build visibility for your work' },
      { icon: 'support', title: 'Curated Art Community', text: 'Connect with artists and curators' },
      { icon: 'brand', title: 'Sales & Brand Visibility', text: 'Showcase your work to new audiences' },
    ]
    : exhibitWhy.benefits

  return (
    <section className="ex-why">
      <div className="ex-why-img"><SafeImage src={image ?? exhibitWhy.image} alt={alt ?? 'Visitors exploring an art exhibition'} /></div>
      <div>
        <h2 className="ex-h2">{exhibitWhy.title} <em>{exhibitWhy.accent}</em> {exhibitWhy.after}</h2>
        <p className="ex-why-text">{exhibitWhy.text}</p>
        <div className="ex-benefits">
          {benefits.map((b) => {
            const Icon = benefitIcons[b.icon as keyof typeof benefitIcons]
            return <TiltCard3D className="ex-benefit-tilt" key={b.title}><div><Icon size={22} /><strong>{b.title}</strong><span>{b.text}</span></div></TiltCard3D>
          })}
        </div>
      </div>
    </section>
  )
}

export function PricingSection({ table, compact = false }: { table: PricingTable; compact?: boolean }) {
  if (!compact) {
    return (
      <section className="ex-pricing" id={table.id === 'standard' ? 'stall-rates' : `stall-rates-${table.id}`}>
        <div className="ex-pricing-main">
          <h2 className="ex-h2">{table.title} <em>{table.accent}</em></h2>
          {table.note && <p className="ex-note ex-tour-note">{table.note}</p>}
          <div className="ex-pricing-cards">
            {table.rows.map((row) => {
              const [name, size] = row.size.split(' · ')
              const [price, tax] = row.price.split(' + ')
              const inclusions = row.includes.split(/\s*[,;]\s*/).filter(Boolean)
              const popular = /group stall/i.test(name)
              return (
                <article className={`ex-price-card${popular ? ' is-popular' : ''}`} key={`${name}-${size}`}>
                  {popular && <span className="ex-price-popular">Most Popular</span>}
                  <h3>{name}</h3>
                  {size && <p className="ex-price-size">{size}</p>}
                  <p className="ex-price-value"><strong>{price}</strong><span>{tax ? `+ ${tax}` : '+ 18% GST'}</span></p>
                  <ul>
                    {inclusions.map((item) => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}
                  </ul>
                  <Link className="th-btn ex-price-book" href={table.cta.href}>{table.cta.label} <ArrowRight size={15} /></Link>
                </article>
              )
            })}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="ex-pricing ex-pricing-compact" id={table.id === 'standard' ? 'stall-rates' : `stall-rates-${table.id}`}>
      <div className="ex-pricing-main">
        <h2 className="ex-h2">{table.title} <em>{table.accent}</em></h2>
        {table.note && <p className="ex-note">{table.note}</p>}
        <TiltCard3D className="ex-pricing-tilt">
          <div className="ex-table" role="table">
            <div className="ex-tr ex-th" role="row">
              {['From', 'To', 'Stall Size', 'Stall Price (INR)', 'Includes', 'Booking'].map((heading) => <span key={heading} role="columnheader">{heading}</span>)}
            </div>
            {table.rows.map((row) => (
              <div className="ex-tr" role="row" key={row.from + row.size}>
                <span role="cell" data-label="From">{row.from}</span>
                <span role="cell" data-label="To">{row.to}</span>
                <span role="cell" data-label="Stall Size">{row.size}</span>
                <span role="cell" data-label="Stall Price (INR)">{row.price}</span>
                <span role="cell" data-label="Includes">{row.includes}</span>
                <span role="cell" data-label="Booking"><Link className="th-btn th-btn-sm" href={table.cta.href}>{table.cta.label} <ArrowRight size={14} /></Link></span>
              </div>
            ))}
          </div>
        </TiltCard3D>
      </div>
    </section>
  )
}

export function MentorSection({ mentor, image }: { mentor?: HomepageContent['mentor']; image?: string } = {}) {
  if (!mentor?.visible) return null

  return (
    <section className="ex-mentor">
      <TiltCard3D className="ex-mentor-tilt">
        {image && <div className="ex-mentor-img"><SafeImage src={image} alt={`Portrait of ${mentor.name}`} /></div>}
        <div>
          <h2>{mentor.title}</h2>
          <h3>{mentor.name}</h3>
          <p>{mentor.bio}</p>
        </div>
      </TiltCard3D>
    </section>
  )
}

export function StatsSection({ stats }: { stats: { icon: string; label: string; value: string; text: string }[] }) {
  return (
    <section className="ex-stats">
      {stats.map((s) => {
        const Icon = statIcons[s.icon as keyof typeof statIcons]
        const isAvailability = s.label.startsWith('Prime Stalls')
        return <div key={s.label} className={isAvailability ? 'ex-stat-availability' : undefined}><span className="ex-stat-icon"><Icon size={22} /></span><div><h3>{s.label}</h3><strong>{s.value}</strong><p>{s.text}</p></div></div>
      })}
    </section>
  )
}

export function VenueSection({ events, image }: {
  events: Pick<PublicEvent, 'id' | 'title' | 'venue' | 'city' | 'startsAt' | 'endsAt'>[]
  image: string
}) {
  const upcoming = events
    .filter((event) => new Date(event.endsAt).getTime() >= Date.now())
    .slice(0, 3)

  if (!upcoming.length) return null

  return (
    <section className="ex-venue">
      <div className="ex-venue-img"><SafeImage src={image} alt="Artwork and visitors at an exhibition" /></div>
      <div className="ex-venue-content">
        <p className="th-eyebrow">Across India</p>
        <h2 className="ex-h2">Upcoming <em>Exhibition Locations</em></h2>
        <ul className="ex-venue-list">
          {upcoming.map((event) => {
            const isTour = /pan.?india|tour/i.test(`${event.title} ${event.city}`)
            const tourCities = isTour
              ? (event.city.match(/pan.?india\s*[—–:-]\s*(.*)/i)?.[1] ?? '').split(/,\s*|\s+and\s+/i).filter(Boolean)
              : []
            return (
              <li key={event.id}>
                <MapPin size={18} aria-hidden="true" />
                <span>
                  <strong>{isTour ? 'Pan India Tour' : event.city || event.venue}</strong>
                  {tourCities.length > 0 && <span className="ex-venue-cities" aria-label="Tour cities">{tourCities.map((city) => <span key={city}>{city}</span>)}</span>}
                  <small>{[event.venue, formatDate(event.startsAt)].filter(Boolean).join(' · ')}</small>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function PromoSection({ landing = false }: { landing?: boolean } = {}) {
  const promos = landing
    ? [{
      title: 'Personalized Promotions',
      text: 'Each artist receives tailored promotions across social and digital platforms to maximize visibility.',
    }]
    : exhibitPromos

  return (
    <section className="ex-promos">
      {promos.map((p, index) => (
        <article key={p.title}>
          <span className="ex-promo-icon" aria-hidden="true">{index === 0 ? <Megaphone size={24} /> : <Globe2 size={24} />}</span>
          <div><h3>{p.title}</h3><p>{p.text}</p></div>
        </article>
      ))}
    </section>
  )
}

export function ParticipateBanner({ images, landing = false }: { images?: string[]; landing?: boolean } = {}) {
  const p = exhibitParticipate
  const photos = images ?? p.images

  return (
    <section className="ex-participate">
      <div className="ex-part-copy">
        <p className="th-eyebrow">Take part in our next edition</p>
        <h2>{landing ? 'Want to Participate?' : p.title}</h2>
        <p>{landing ? 'Register as an artist and book your stall at an upcoming exhibition.' : p.text}</p>
        <div className="ex-part-actions">
          <Link className="th-btn th-btn-lg ex-part-book" href={landing ? '/book-stall' : p.book.href}>{p.book.label} <ArrowRight size={14} /></Link>
          <Link className="th-btn-outline th-btn-lg ex-part-enquire" href={landing ? '/artist/register' : p.register.href}>{landing ? 'Register Now' : p.register.label} <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div className="ex-part-photos">
        {photos.map((src, i) => <SafeImage key={src} src={src} alt={['Artists presenting work at an exhibition', 'Visitors discovering art in a gallery', 'Artwork displayed in an exhibition space'][i] ?? 'Art exhibition at The Haat of Art'} />)}
      </div>
    </section>
  )
}
