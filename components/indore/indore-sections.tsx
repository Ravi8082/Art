import { Hand, MapPin, Palette, Sparkles, Store, UserRound, Users } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import type { IndoreView } from '@/lib/indore-live'

const whyItems = [
  { icon: Palette, title: 'Original artwork', text: 'Across disciplines' },
  { icon: Sparkles, title: 'Live creativity', text: 'At the exhibition' },
  { icon: Hand, title: 'Hands-on learning', text: 'Through workshops' },
  { icon: Store, title: 'Independent makers', text: 'And art collectives' },
  { icon: UserRound, title: 'Meet artists', text: 'And hear their stories' },
  { icon: Users, title: 'A shared space', text: 'For art and community' },
]

export function Collage() {
  return (
    <div className="in-collage">
      <div className="in-main"><SafeImage src="/media/visual-art.jpeg" alt="Artwork in a gallery setting" /></div>
      {[
        ['/media/live-mural.jpeg', 'Live mural artwork'],
        ['/media/sculpture.jpeg', 'Sculptural artwork'],
        ['/media/artifacts.jpeg', 'Artisan-made objects'],
        ['/media/installation.jpeg', 'Art installation'],
      ].map(([src, alt]) => <div className="in-tile" key={src}><SafeImage src={src} alt={alt} /></div>)}
    </div>
  )
}

export function WhyVisit() {
  return (
    <section className="in-section">
      <h2 className="in-h2">Why Visit <em>The Haat of Art?</em></h2>
      <div className="in-why">
        {whyItems.map(({ icon: Icon, title, text }) => <div key={title}><Icon size={26} /><span><strong>{title}</strong>{text}</span></div>)}
      </div>
    </section>
  )
}

export function VenueCard({ view }: { view: IndoreView | null }) {
  if (!view) return null
  const v = view.info.venue
  return (
    <div className="in-card in-venue">
      <SafeImage src={v.image} alt="Artwork displayed at an exhibition" />
      <div>
        <h3>{v.title}</h3>
        <strong>{v.name}</strong>
        <p>{v.address}</p>
        <a className="th-btn-outline th-btn-sm" href={v.cta.href} target="_blank" rel="noreferrer"><MapPin size={12} /> {v.cta.label}</a>
      </div>
    </div>
  )
}
