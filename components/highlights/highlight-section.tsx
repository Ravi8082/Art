import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import type { HighlightItem } from '@/lib/demo-highlights'

export function HighlightSection({ item }: { item: HighlightItem }) {
  return (
    <article className={`hl-card ${item.imagePosition === 'right' ? 'is-right' : 'is-left'}`}>
      <div className="hl-img"><SafeImage src={item.image} alt={`${item.title} (demo image)`} fallback="/media/exhibition-gallery.jpeg" /></div>
      <div className="hl-text">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <Link className="th-btn-outline th-btn-sm" href={item.buttonHref}>{item.buttonLabel} <ArrowRight size={12} /></Link>
      </div>
    </article>
  )
}
