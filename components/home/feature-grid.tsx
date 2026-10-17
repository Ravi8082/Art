import Link from 'next/link'
import { Palette, Users, CalendarDays, Brush, Ticket, Newspaper } from 'lucide-react'
import { demoFeatures } from '@/lib/demo-home-content'
import { SectionHeading } from './section-heading'

const icons = { palette: Palette, users: Users, calendar: CalendarDays, brush: Brush, ticket: Ticket, news: Newspaper }

export function FeatureGrid() {
  return (
    <section className="th-section">
      <SectionHeading before="Discover" accent="The Haat of Art" subtitle="Art, culture, creativity and opportunities – all in one platform." />
      <div className="th-features">
        {demoFeatures.map(({ icon, title, text, href }) => {
          const Icon = icons[icon]
          return (
            <Link className="th-feature" href={href} key={title}>
              <Icon size={30} strokeWidth={1.6} />
              <b>{title}</b>
              <small>{text}</small>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
