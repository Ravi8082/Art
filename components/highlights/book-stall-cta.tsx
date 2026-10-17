import Link from 'next/link'
import { ArrowRight, Store } from 'lucide-react'
import { highlightsCta } from '@/lib/demo-highlights'

export function BookStallCTA() {
  return (
    <section className="hl-cta">
      <Store size={54} strokeWidth={1.4} />
      <div><h2>{highlightsCta.title}</h2><p>{highlightsCta.text}</p></div>
      <Link className="hl-cta-btn" href={highlightsCta.href}>{highlightsCta.label} <ArrowRight size={14} /></Link>
    </section>
  )
}
