import Link from 'next/link'
import { ArrowRight, Store } from 'lucide-react'

export function BookStallCTA() {
  return (
    <section className="hl-cta">
      <Store size={54} strokeWidth={1.4} />
      <div><h2>Show your work at The Haat of Art</h2><p>Explore stall options for an upcoming exhibition.</p></div>
      <Link className="hl-cta-btn" href="/exhibit-with-us">Explore stall options <ArrowRight size={14} /></Link>
    </section>
  )
}
