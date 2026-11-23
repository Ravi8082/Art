import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'

export function HighlightsHero() {
  return (
    <section className="hl-hero">
      <SafeImage src="/media/installation.jpeg" alt="A contemporary art installation" />
      <div className="hl-hero-copy">
        <h1>Exhibition Highlights</h1>
        <p>Explore published moments from The Haat of Art exhibitions.</p>
        <Link className="th-btn" href="/exhibitions">Explore exhibitions <ArrowRight size={14} /></Link>
      </div>
    </section>
  )
}
