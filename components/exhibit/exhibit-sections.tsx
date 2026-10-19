import Link from 'next/link'
import { ArrowRight, BadgeIndianRupee, Handshake, Megaphone, Palette, ShieldCheck, Image as ImageIcon, MapPin, Users, Share2 } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { exhibitMentor, exhibitParticipate, exhibitPromos, exhibitWhy, type PricingTable } from '@/lib/demo-exhibit'

const benefitIcons = { sales: BadgeIndianRupee, network: Handshake, media: Megaphone, brand: Palette, support: ShieldCheck }
const statIcons = { artwork: ImageIcon, venue: MapPin, audience: Users, network: Share2 }

export function WhyExhibit() {
  return (
    <section className="ex-why">
      <div className="ex-why-img"><SafeImage src={exhibitWhy.image} alt="Visitors at an art stall (demo image)" /></div>
      <div>
        <h2 className="ex-h2">{exhibitWhy.title} <em>{exhibitWhy.accent}</em> {exhibitWhy.after}</h2>
        <p className="ex-why-text">{exhibitWhy.text}</p>
        <div className="ex-benefits">
          {exhibitWhy.benefits.map((b) => {
            const Icon = benefitIcons[b.icon as keyof typeof benefitIcons]
            return <div key={b.title}><Icon size={22} /><strong>{b.title}</strong><span>{b.text}</span></div>
          })}
        </div>
      </div>
    </section>
  )
}

export function PricingSection({ table }: { table: PricingTable }) {
  return (
    <section className="ex-pricing">
      <div className="ex-pricing-main">
        <h2 className="ex-h2">{table.title} <em>{table.accent}</em></h2>
        {table.note && <p className="ex-note">{table.note}</p>}
        <div className="ex-table" role="table">
          <div className="ex-tr ex-th" role="row">
            {['From (Month)', 'To (Month)', 'Stall Size', 'Stall Price (INR)', 'Includes'].map((h) => <span key={h} role="columnheader">{h}</span>)}
          </div>
          {table.rows.map((r) => (
            <div className="ex-tr" role="row" key={r.from + r.size}>
              <span role="cell" data-label="From (Month)">{r.from}</span>
              <span role="cell" data-label="To (Month)">{r.to}</span>
              <span role="cell" data-label="Stall Size">{r.size}</span>
              <span role="cell" data-label="Stall Price (INR)">{r.price}</span>
              <span role="cell" data-label="Includes">{r.includes}</span>
            </div>
          ))}
        </div>
        <Link className="th-btn th-btn-lg" href={table.cta.href}>{table.cta.label} <ArrowRight size={14} /></Link>
      </div>
      <div className="ex-pricing-img"><SafeImage src={table.image} alt="Exhibition stalls (demo image)" /></div>
    </section>
  )
}

export function MentorSection() {
  return (
    <section className="ex-mentor">
      <div className="ex-mentor-img"><SafeImage src={exhibitMentor.image} alt="Mentor portrait (demo image)" /></div>
      <div>
        <h3>{exhibitMentor.heading}</h3>
        <h2>{exhibitMentor.name}</h2>
        <p>{exhibitMentor.text}</p>
      </div>
    </section>
  )
}

export function StatsSection({ stats }: { stats: { icon: string; label: string; value: string; text: string }[] }) {
  return (
    <section className="ex-stats">
      {stats.map((s) => {
        const Icon = statIcons[s.icon as keyof typeof statIcons]
        return <div key={s.label}><span className="ex-stat-icon"><Icon size={22} /></span><div><h4>{s.label}</h4><strong>{s.value}</strong><p>{s.text}</p></div></div>
      })}
    </section>
  )
}

export function PromoSection() {
  return (
    <section className="ex-promos">
      {exhibitPromos.map((p) => (
        <div key={p.title}><SafeImage src={p.image} alt={`${p.title} (demo image)`} /><div><h4>{p.title}</h4><p>{p.text}</p></div></div>
      ))}
    </section>
  )
}

export function ParticipateBanner() {
  const p = exhibitParticipate
  return (
    <section className="ex-participate">
      <div className="ex-part-copy">
        <h2>{p.title}</h2>
        <p>{p.text}</p>
        <Link className="th-btn th-btn-lg" href={p.register.href}>{p.register.label} <ArrowRight size={14} /></Link>
      </div>
      <div className="ex-part-photos">
        {p.images.map((src, i) => <SafeImage key={src} src={src} alt={`Exhibition moment ${i + 1} (demo image)`} />)}
      </div>
      <Link className="th-btn th-btn-lg ex-part-book" href={p.book.href}>{p.book.label} <ArrowRight size={14} /></Link>
    </section>
  )
}
