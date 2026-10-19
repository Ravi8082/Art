import { notFound } from 'next/navigation'
import { CalendarDays, MapPin } from 'lucide-react'
import { PublicShell } from '@/components/public-shell'
import { PassForm } from '@/components/indore/indore-client'
import { apiBaseUrl, formatDate, getShell } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Get your free entry pass · The Haat of Art' }

type PassEvent = { slug: string; title: string; description: string; city: string; state: string; venue: string; startsAt: string; endsAt: string }

export default async function EventPassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { shell } = await getShell()
  const response = await fetch(`${apiBaseUrl}/api/passes/public/events/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null)
  if (!response?.ok) notFound()
  const { event } = await response.json() as { event: PassEvent }
  const sameDay = formatDate(event.startsAt) === formatDate(event.endsAt)
  return (
    <PublicShell {...shell}>
      <section className="in-hero" style={{ minHeight: 'auto', padding: '48px 24px' }}>
        <div className="in-hero-copy">
          <p className="th-eyebrow">Free entry pass</p>
          <h1>{event.title}</h1>
          <p className="in-hero-text">{event.description}</p>
          <ul className="in-meta">
            <li><CalendarDays size={16} />{sameDay ? formatDate(event.startsAt) : `${formatDate(event.startsAt)} – ${formatDate(event.endsAt)}`}</li>
            <li><MapPin size={16} />{[event.venue, event.city, event.state].filter(Boolean).join(', ')}</li>
          </ul>
          <p className="in-hero-text">Your QR pass becomes active only on the day of the exhibition and works for a single entry.</p>
        </div>
      </section>
      <section className="in-pass"><PassForm eventSlug={event.slug} /></section>
    </PublicShell>
  )
}
