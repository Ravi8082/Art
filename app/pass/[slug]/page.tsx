import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CalendarDays, MapPin } from 'lucide-react'
import Link from 'next/link'
import { PublicShell } from '@/components/public-shell'
import { PassForm } from '@/components/indore/indore-client'
import { PassVenueLocationCard } from '@/components/pass-venue-location-card'
import { apiBaseUrl, formatDate, getShell } from '@/lib/api'
import type { LiveEvent } from '@/lib/indore-live'
import styles from '@/components/visitor-pass-booking.module.css'

export const revalidate = 30

async function getPassEvent(slug: string): Promise<LiveEvent | null> {
  const response = await fetch(`${apiBaseUrl}/api/exhibitions/nearest`, { next: { revalidate: 30 } }).catch(() => null)
  if (!response?.ok) return null
  const result = await response.json() as { events: LiveEvent[] }
  return result.events.find((event) => event.slug === slug) ?? null
}

function formatVenueAddress(event: LiveEvent) {
  if (/multiple exhibition venues/i.test(event.venue) || /pan india/i.test(event.city)) {
    return 'Multiple city venues · India Art Exhibition Tour'
  }
  if (/palace grounds/i.test(event.venue) && /bengaluru/i.test(event.city)) {
    return 'Palace Grounds, Jayamahal Main Rd, Bengaluru'
  }
  const parts: string[] = []
  for (const value of [event.venue, event.city, event.state]) {
    const part = value.trim()
    if (!part) continue
    const normalized = part.toLocaleLowerCase()
    if (parts.some((existing) => {
      const current = existing.toLocaleLowerCase()
      return current.includes(normalized) || normalized.includes(current)
    })) continue
    parts.push(part)
  }
  return parts.join(', ')
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const event = await getPassEvent(slug)
  if (!event) return { robots: { index: false, follow: true } }
  return {
    title: `${event.title} · Free entry pass`,
    description: event.description,
    alternates: { canonical: `/pass/${encodeURIComponent(slug)}` },
  }
}

export default async function EventPassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { shell } = await getShell()
  const event = await getPassEvent(slug)
  if (!event) notFound()
  const sameDay = formatDate(event.startsAt) === formatDate(event.endsAt)
  const venueAddress = formatVenueAddress(event)
  const eventLocationLabel = /pan india/i.test(event.city) ? 'India Art Exhibition Tour' : event.city
  return (
    <PublicShell {...shell}>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link href="/exhibitions">Exhibitions</Link><span aria-hidden="true">/</span><span>Visitor pass</span>
            </nav>
            <p className={styles.kicker}>Visitor pass · {eventLocationLabel}</p>
            <h1 className={styles.title}>{event.title}</h1>
            <p className={styles.description}>{event.description}</p>
            <div className={styles.heroMeta}>
              <span><CalendarDays size={16} aria-hidden="true" />{sameDay ? formatDate(event.startsAt) : `${formatDate(event.startsAt)} – ${formatDate(event.endsAt)}`}</span>
              <span><MapPin size={16} aria-hidden="true" />{venueAddress}</span>
            </div>
            <p className={styles.heroNote}>Your QR pass is valid for one entry on the selected exhibition day.</p>
          </div>
        </header>
        <div className={styles.main}>
          <div className={styles.layout}>
            <div className={styles.formColumn}>
              <PassForm events={[event]} initialEventSlug={event.slug} experience="detail" />
            </div>
            <div className={styles.sidebarColumn}>
              <PassVenueLocationCard event={event} address={venueAddress} />
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
