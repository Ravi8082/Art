'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import type { ExhibitInfo, PublicExhibitionStallCatalog } from '@/lib/api'

type StallType = PublicExhibitionStallCatalog['stallTypes'][number]
type Edition = PublicExhibitionStallCatalog['editions'][number]

const stallSlugs: Record<string, string> = {
  COMPACT: 'compact',
  STANDARD: 'standard',
  GROUP: 'group',
  GALLERY: 'gallery',
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

function editionLabel(edition: Edition) {
  const isTour = /india.*tour|tour.*india/i.test(edition.title)
  const city = isTour ? 'India Tour' : edition.city || edition.venue || edition.title
  const date = edition.startsAt
    ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(edition.startsAt))
    : ''
  return [city, date].filter(Boolean).join(' · ')
}

function taxFor(price: number, taxRate: number) {
  return Math.round((price * taxRate + Number.EPSILON) * 100) / 100
}

export function StallCategoriesSection({
  types,
  editions,
}: {
  types: StallType[] | ExhibitInfo['stallTypes']
  editions: Edition[]
}) {
  const [selectedEventId, setSelectedEventId] = useState('')
  const selectedEdition = editions.find((edition) => edition.eventId === selectedEventId)

  return (
    <section className="ex-pricing" id="stall-categories">
      <div className="ex-pricing-main">
        <h2 className="ex-h2">Stall Categories &amp; Specifications</h2>
        <p className="ex-note ex-city-tariff-note">Stall tariffs vary by exhibition city, venue tier, and edition dates. Select your preferred city during booking to view live Admin-configured rates.</p>
        <div className="ex-city-selector" role="group" aria-label="Preview city-specific stall tariffs">
          <button
            type="button"
            className={`ex-city-pill${selectedEventId ? '' : ' is-active'}`}
            aria-pressed={!selectedEventId}
            onClick={() => setSelectedEventId('')}
          >
            All Cities (Dynamic Tariff)
          </button>
          {editions.map((edition) => (
            <button
              type="button"
              className={`ex-city-pill${selectedEventId === edition.eventId ? ' is-active' : ''}`}
              aria-pressed={selectedEventId === edition.eventId}
              key={edition.eventId}
              onClick={() => setSelectedEventId(edition.eventId)}
            >
              {editionLabel(edition)}
            </button>
          ))}
        </div>
        {!editions.length && <p className="ex-city-selector-note">City rates will appear when an upcoming edition is published by the Exhibition Admin.</p>}
        {selectedEdition && !Object.keys(selectedEdition.rates).length && (
          <p className="ex-city-selector-note" role="status">City-specific tariffs for {editionLabel(selectedEdition)} have not been published yet.</p>
        )}
        <div className="ex-pricing-cards">
          {types.map((type) => {
            const code = type.code.toUpperCase()
            const slug = stallSlugs[code] ?? code.toLowerCase()
            const widthM = Number(type.widthM)
            const depthM = Number(type.depthM)
            const area = Number((widthM * depthM).toFixed(1))
            const rate = selectedEdition?.rates[code]
            const inclusions = (type.includes || 'Inclusions to be confirmed by the Exhibition Admin')
              .split(/\s*[,;]\s*/).filter(Boolean)
            const tax = rate ? taxFor(rate.price, rate.taxRate) : 0

            return (
              <article className={`ex-price-card${code === 'GROUP' ? ' is-popular' : ''}`} key={type.id}>
                {code === 'GROUP' && <span className="ex-price-popular">Most Popular</span>}
                <h3>{type.name}</h3>
                <p className="ex-price-size">{widthM}m × {depthM}m · {area} SQM</p>
                <p className={`ex-city-tariff-badge${rate ? '' : ' is-unpublished'}`}>
                  {rate
                    ? <><strong>{inr.format(rate.price)}</strong><span> + {inr.format(tax)} GST</span></>
                    : selectedEdition
                      ? 'City tariff announced soon · Request quote'
                      : 'City-Specific Tariff · Live Rate on Selection'}
                </p>
                {rate && <p className="ex-city-tariff-total">{inr.format(rate.price + tax)} total including GST</p>}
                <p className="ex-city-tariff-subtext">Rates set per city by Exhibition Admin</p>
                <ul>
                  {inclusions.map((item) => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}
                </ul>
                <Link className="th-btn ex-price-book" href={`/book-your-stall?stall=${encodeURIComponent(slug)}`}>Book This Stall <ArrowRight size={15} /></Link>
              </article>
            )
          })}
          {!types.length && <p className="ex-note">Stall categories are being updated. Please check back soon.</p>}
        </div>
      </div>
    </section>
  )
}
