import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { highlightsHero } from '@/lib/demo-highlights'

export function HighlightsHero() {
  return (
    <section className="hl-hero">
      <SafeImage src={highlightsHero.image} alt="Art studio with a painter at work (demo image)" fallback="/media/exhibition-gallery.jpeg" />
      <div className="hl-hero-copy">
        <h1>{highlightsHero.title}</h1>
        <p>{highlightsHero.text}</p>
        <Link className="th-btn" href={highlightsHero.cta.href}>{highlightsHero.cta.label} <ArrowRight size={14} /></Link>
      </div>
    </section>
  )
}
