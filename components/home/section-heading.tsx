import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function SectionHeading({ before, accent, subtitle, cta }: { before: string; accent: string; subtitle?: string; cta?: { label: string; href: string } }) {
  return (
    <div className="th-heading">
      <div>
        <h2>{before} <em>{accent}</em></h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {cta && <Link className="th-btn-outline" href={cta.href}>{cta.label} <ArrowRight size={14} /></Link>}
    </div>
  )
}
