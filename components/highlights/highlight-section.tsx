import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'

export type HighlightCard = { id: string; title: string; description: string; image: string }

export function HighlightSection({ item }: { item: HighlightCard }) {
  return (
    <article className="hl-card is-left">
      <div className="hl-img"><SafeImage src={item.image} alt={`${item.title} exhibition`} /></div>
      <div className="hl-text">
        <h3>{item.title}</h3>
        <p>{item.description}</p>
        <Link className="th-btn-outline th-btn-sm" href="/exhibitions">Explore exhibitions <ArrowRight size={12} /></Link>
      </div>
    </article>
  )
}
