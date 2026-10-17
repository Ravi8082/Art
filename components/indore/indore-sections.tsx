import Link from 'next/link'
import { ArrowRight, Hand, MapPin, Palette, Sparkles, Store, UserRound, Users } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { indoreCollage, indoreFaces, indoreFloor, indoreInfo, indoreInside, indoreWhy } from '@/lib/demo-indore'

const whyIcons = { artists: Palette, live: Sparkles, workshop: Hand, craft: Store, meet: UserRound, space: Users }

export function Collage() {
  return (
    <div className="in-collage">
      <div className="in-main"><SafeImage src={indoreCollage.main.src} alt={indoreCollage.main.alt} /></div>
      {indoreCollage.tiles.map((t) => <div className="in-tile" key={t.src}><SafeImage src={t.src} alt={t.alt} /></div>)}
    </div>
  )
}

export function WhyVisit() {
  return (
    <section className="in-section">
      <h2 className="in-h2">Why Visit <em>The Haat of Art?</em></h2>
      <div className="in-why">
        {indoreWhy.map((w) => { const Icon = whyIcons[w.icon as keyof typeof whyIcons]; return <div key={w.text}><Icon size={26} /><span><strong>{w.title}</strong>{w.text}</span></div> })}
      </div>
    </section>
  )
}

function Heading({ title, accent, cta }: { title: string; accent: string; cta?: { label: string; href: string } }) {
  return (
    <div className="in-head">
      <h2 className="in-h2">{title} <em>{accent}</em></h2>
      {cta && <Link className="th-btn-outline" href={cta.href}>{cta.label} <ArrowRight size={13} /></Link>}
    </div>
  )
}

export function PhotoStrip({ data, label }: { data: typeof indoreFaces; label: string }) {
  return (
    <section className="in-section">
      <Heading title={data.title} accent={data.accent} cta={data.cta} />
      <div className="in-strip">{data.images.map((src, i) => <SafeImage key={src + i} src={src} alt={`${label} ${i + 1} (demo image)`} />)}</div>
    </section>
  )
}

export const FacesSection = () => <PhotoStrip data={indoreFaces} label="Guests at a past edition" />
export const FloorSection = () => <PhotoStrip data={indoreFloor} label="Moment from the exhibition floor" />

export function InsideHall() {
  return (
    <section className="in-section">
      <Heading title={indoreInside.title} accent={indoreInside.accent} />
      <div className="in-inside">
        {indoreInside.items.map((it) => <figure key={it.label}><SafeImage src={it.src} alt={`${it.label} (demo image)`} /><figcaption>{it.label}</figcaption></figure>)}
      </div>
    </section>
  )
}

export function VenueCard() {
  const v = indoreInfo.venue
  return (
    <div className="in-card in-venue">
      <SafeImage src={v.image} alt="Venue building (demo image)" />
      <div>
        <h3>{v.title}</h3>
        <strong>{v.name}</strong>
        <p>{v.address}</p>
        <a className="th-btn-outline th-btn-sm" href={v.cta.href} target="_blank" rel="noreferrer"><MapPin size={12} /> {v.cta.label}</a>
      </div>
    </div>
  )
}
