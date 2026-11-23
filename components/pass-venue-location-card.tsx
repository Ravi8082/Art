'use client'

import { useState } from 'react'
import { CalendarDays, Check, Copy, MapPin } from 'lucide-react'
import type { LiveEvent } from '@/lib/indore-live'
import styles from './visitor-pass-booking.module.css'

function googleCalendarDateTime(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}${part('month')}${part('day')}T${part('hour')}${part('minute')}${part('second')}`
}

export function PassVenueLocationCard({ event, address }: { event: LiveEvent; address: string }) {
  const [copyStatus, setCopyStatus] = useState('')
  const hasSingleVenue = !/multiple exhibition venues|pan india/i.test(`${event.venue} ${event.city}`)
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`
  const mapEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
  const timeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  })
  const timing = `${timeFormatter.format(new Date(event.startsAt))} – ${timeFormatter.format(new Date(event.endsAt))}`

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopyStatus('Venue address copied.')
    } catch {
      setCopyStatus('Could not copy automatically. Select the address above to copy it.')
    }
  }

  const calendarParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${googleCalendarDateTime(event.startsAt)}/${googleCalendarDateTime(event.endsAt)}`,
    ctz: 'Asia/Kolkata',
    details: 'The Haat of Art exhibition. Check your visitor pass for entry details.',
    location: address,
  })
  const calendarHref = `https://calendar.google.com/calendar/render?${calendarParams.toString()}`

  return (
    <aside className={styles.sidebar} aria-labelledby="venue-location-title">
      <div className={styles.sidebarContent}>
        <div>
          <p className={styles.sidebarKicker}>Plan your visit</p>
          <h2 className={styles.sidebarTitle} id="venue-location-title">Venue &amp; Location</h2>
        </div>
        <p className={styles.address}><MapPin size={15} aria-hidden="true" /> {address}</p>
        <div className={styles.mapFrame}>
          {hasSingleVenue ? (
            <iframe
              src={mapEmbedUrl}
              title={`Map of ${address}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className={styles.mapPlaceholder}>
              <MapPin size={22} aria-hidden="true" />
              <p>Venue maps will be available when city-specific tour locations are confirmed.</p>
            </div>
          )}
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoCard}>
            <strong>Gate entry</strong>
            <span>Follow exhibition signs at the venue entrance.</span>
          </div>
          <div className={styles.infoCard}>
            <strong>Parking</strong>
            <span>Availability is subject to venue rules.</span>
          </div>
          <div className={styles.infoCard}>
            <strong>Exhibition timings</strong>
            <span>{timing} · India Standard Time</span>
          </div>
          <div className={styles.infoCard}>
            <strong>Exhibition dates</strong>
            <span>{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.startsAt))} – {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(event.endsAt))}</span>
          </div>
        </div>
        <div className={styles.sidebarActions}>
          {hasSingleVenue && <a className={styles.actionPrimary} href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <MapPin size={14} aria-hidden="true" /></a>}
          <button className={styles.actionSecondary} type="button" onClick={() => void copyAddress()}>
            {copyStatus.startsWith('Venue address') ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            Copy Venue Address
          </button>
          <a className={styles.actionSecondary} href={calendarHref} target="_blank" rel="noopener noreferrer">
            <CalendarDays size={14} aria-hidden="true" /> Add to Google Calendar
          </a>
        </div>
        <p className={styles.copyStatus} role="status" aria-live="polite">{copyStatus}</p>
      </div>
    </aside>
  )
}
