'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Check, CircleDollarSign } from 'lucide-react'
import type { ExhibitInfo, PublicExhibitionStallCatalog } from '@/lib/api'
import styles from './stall-prospectus.module.css'

type StallType = Omit<ExhibitInfo['stallTypes'][number], 'price' | 'taxRate'> & {
  price: number | null
  taxRate: number | null
}
type Edition = PublicExhibitionStallCatalog['editions'][number]
type CategoryFilter = 'ALL' | 'INDIVIDUAL' | 'GROUP'

const categories: { id: CategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All Stalls' },
  { id: 'INDIVIDUAL', label: 'Individual Artists' },
  { id: 'GROUP', label: 'Groups & Galleries' },
]

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

function formatEdition(edition: Edition) {
  const title = `${edition.title} ${edition.city}`
  const city = /pan.?india|tour/i.test(title) ? 'Pan-India Tour' : edition.city || edition.venue || edition.title
  return `${city} · ${formatDate(edition.startsAt)} – ${formatDate(edition.endsAt)}`
}

function formatArea(type: StallType) {
  const area = Number(type.widthM) * Number(type.depthM)
  return Number.isInteger(area) ? String(area) : area.toFixed(1)
}

function formatMeters(value: number) {
  const meters = Number(value)
  return Number.isInteger(meters) ? String(meters) : meters.toFixed(1)
}

function taxAmount(price: number, taxRate: number) {
  return Math.round((price * taxRate + Number.EPSILON) * 100) / 100
}

export function StallProspectus({
  types,
  editions,
  openStalls,
}: {
  types: StallType[]
  editions: Edition[]
  openStalls: number | null
}) {
  const [category, setCategory] = useState<CategoryFilter>('ALL')
  const [selectedEditionId, setSelectedEditionId] = useState('')
  const edition = editions.find((item) => item.eventId === selectedEditionId)
  const visibleTypes = types.filter((type) => (
    category === 'ALL'
      || (category === 'INDIVIDUAL' && type.category === 'INDIVIDUAL')
      || (category === 'GROUP' && type.category !== 'INDIVIDUAL')
  ))
  const firstEdition = editions[0]
  const lastEdition = editions[editions.length - 1]
  const editionWindow = firstEdition && lastEdition
    ? `${formatDate(firstEdition.startsAt)} – ${formatDate(lastEdition.endsAt)}`
    : 'Select an upcoming edition'
  const heading = category === 'INDIVIDUAL'
    ? 'Stall Rates for Individual Artists'
    : category === 'GROUP'
      ? 'Stall Rates for Groups & Galleries'
      : 'Choose a stall for your practice'
  const hasOpenStalls = openStalls !== null && openStalls > 0

  return (
    <section className={styles.section} id="stall-specs" aria-labelledby="stall-prospectus-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>A clear view of your next exhibition</p>
            <h2 id="stall-prospectus-title">Exhibition Stall Rates</h2>
            <p className={styles.intro}>Compare spaces, inclusions and Admin-published tariffs before choosing an edition.</p>
          </div>
          <div className={styles.availability} role="status">
            <span className={`${styles.liveDot}${hasOpenStalls ? '' : ` ${styles.noAvailability}`}`} />
            <span>
              <strong>Live availability</strong>
              <small>{openStalls === null ? 'Check current inventory during booking' : `${openStalls} prime stalls open across upcoming editions`}</small>
            </span>
          </div>
        </header>

        <div className={styles.filters}>
          <div className={styles.tabs} role="group" aria-label="Filter stall categories">
            {categories.map((item) => (
              <button
                type="button"
                key={item.id}
                className={category === item.id ? styles.activeTab : ''}
                aria-pressed={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className={styles.editionFilter}>
            <CalendarDays size={17} aria-hidden="true" />
            <span>Edition dates</span>
            <select value={selectedEditionId} onChange={(event) => setSelectedEditionId(event.target.value)}>
              <option value="">All upcoming · {editionWindow}</option>
              {editions.map((item) => <option value={item.eventId} key={item.eventId}>{formatEdition(item)}</option>)}
            </select>
          </label>
        </div>

        <h3 className={styles.categoryHeading}>{heading}</h3>
        {edition && !Object.keys(edition.rates).length && (
          <p className={styles.rateNotice} role="status">
            City-specific tariffs for {formatEdition(edition)} have not been published yet. Please check again or contact the team.
          </p>
        )}
        {editions.length === 0 && (
          <p className={styles.rateNotice} role="status">No upcoming edition dates are published yet. Current base tariffs are shown where available.</p>
        )}

        <div className={styles.cards}>
          {visibleTypes.map((type) => {
            const code = type.code.toUpperCase()
            const publishedRate = edition?.rates[code]
            const baseRate = type.price !== null && type.taxRate !== null
              ? { price: Number(type.price), taxRate: Number(type.taxRate) }
              : undefined
            const rate = publishedRate ?? baseRate
            const tax = rate ? taxAmount(rate.price, rate.taxRate) : 0
            const inclusions = (type.includes || '').split(/\s*[,;]\s*/).filter(Boolean)

            return (
              <article className={styles.card} key={type.id}>
                <div className={styles.cardTopline}>
                  <span>{type.category === 'INDIVIDUAL' ? 'Individual Artist' : type.category === 'GALLERY' ? 'Gallery' : 'Group & Gallery'}</span>
                  {rate && <span className={styles.rateBadge}><CircleDollarSign size={14} />{publishedRate ? 'Edition rate' : 'Base tariff'}</span>}
                </div>
                <h3>{type.name}</h3>
                <p className={styles.dimensions}>{formatMeters(type.widthM)}m × {formatMeters(type.depthM)}m <span>({formatArea(type)} SQM)</span></p>
                {rate ? (
                  <>
                    <div className={styles.priceBreakdown}>
                      <strong>{currency.format(rate.price)}</strong>
                      <span>+ {currency.format(tax)} GST</span>
                    </div>
                    <p className={styles.totalPrice}>= {currency.format(rate.price + tax)} total</p>
                  </>
                ) : (
                  <p className={styles.unpublishedRate}>Tariff not published for this edition</p>
                )}
                {rate && !publishedRate && editions.length > 0 && (
                  <p className={styles.rateCaption}>
                    {edition ? 'Base tariff shown; the city-specific rate is not published yet.' : 'Choose an edition to see its city-specific rate.'}
                  </p>
                )}
                <div className={styles.inclusions}>
                  <strong>Included with your stall</strong>
                  <ul>
                    {(inclusions.length ? inclusions : ['Inclusions confirmed during booking']).map((item) => (
                      <li key={item}><Check size={15} aria-hidden="true" />{item}</li>
                    ))}
                  </ul>
                </div>
                <Link className={styles.bookButton} href="/book-stall">
                  Book This Stall <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </article>
            )
          })}
          {visibleTypes.length === 0 && <p className={styles.rateNotice}>Stall options for this category are being updated.</p>}
        </div>
      </div>
    </section>
  )
}
