'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, MapPin, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { DirectoryArtist, DirectoryArtwork } from '@/lib/booking-server'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const workFilters = ['All Works', 'Available', 'Exhibition Pieces'] as const
type WorkFilter = (typeof workFilters)[number]
type InquiryStatus = 'idle' | 'sending' | 'sent' | 'error'

function artworkStatusLabel(status: DirectoryArtwork['status']) {
  if (status === 'EXHIBITION_PIECE') return 'Exhibition Piece'
  return status === 'SOLD' ? 'Sold' : 'Available'
}

function formatPrice(amount: number | null) {
  return amount === null
    ? 'Price on Request'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

function listMediums(medium: string) {
  return medium.split(/,|&/).map((part) => part.trim()).filter(Boolean)
}

export function ArtistMonograph({
  artist,
  artworks,
  moreArtists,
}: {
  artist: DirectoryArtist
  artworks: DirectoryArtwork[]
  moreArtists: DirectoryArtist[]
}) {
  const [workFilter, setWorkFilter] = useState<WorkFilter>('All Works')
  const [selectedArtwork, setSelectedArtwork] = useState<DirectoryArtwork | null>(null)
  const [inquiryArtwork, setInquiryArtwork] = useState<DirectoryArtwork | null>(null)
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [followed, setFollowed] = useState(false)
  const [inquiryStatus, setInquiryStatus] = useState<InquiryStatus>('idle')
  const [inquiryError, setInquiryError] = useState('')
  const [inquiryRef, setInquiryRef] = useState('')
  const [message, setMessage] = useState('')

  function displayWorkTitle(work: DirectoryArtwork) {
    const artistPrefix = `${artist.displayName} — `
    return work.title.startsWith(artistPrefix) ? work.title.slice(artistPrefix.length) : work.title
  }

  useEffect(() => {
    if (!selectedArtwork && !inquiryOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedArtwork(null)
        setInquiryOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedArtwork, inquiryOpen])

  const visibleWorks = artworks.filter((work) => {
    if (workFilter === 'Available') return work.status === 'AVAILABLE'
    if (workFilter === 'Exhibition Pieces') return work.status === 'EXHIBITION_PIECE'
    return true
  })

  function openInquiry(work: DirectoryArtwork | null = null) {
    setSelectedArtwork(null)
    setInquiryArtwork(work)
    setInquiryStatus('idle')
    setInquiryError('')
    setInquiryRef('')
    setMessage(work
      ? `I am interested in learning more about “${displayWorkTitle(work)}” and its availability.`
      : `I would like to discuss a commission or learn more about ${artist.displayName}’s practice.`)
    setInquiryOpen(true)
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inquiryStatus === 'sending') return
    const data = new FormData(event.currentTarget)
    setInquiryStatus('sending')
    setInquiryError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(data.get('name') ?? '').trim(),
          email: String(data.get('email') ?? '').trim().toLowerCase(),
          phone: String(data.get('phone') ?? '').trim(),
          category: 'Artist',
          subject: `Artist enquiry — ${artist.displayName}${inquiryArtwork ? ` — ${displayWorkTitle(inquiryArtwork)}` : ''}`,
          message: `${message.trim()}\n\nArtist: ${artist.displayName}${inquiryArtwork ? `\nArtwork: ${displayWorkTitle(inquiryArtwork)}` : ''}`,
          consent: data.get('consent') === 'on',
        }),
      })
      const payload = await response.json().catch(() => null) as { refCode?: string; error?: string } | null
      if (!response.ok || !payload?.refCode) {
        throw new Error(payload?.error || 'Your enquiry could not be recorded. Please try again.')
      }
      setInquiryRef(payload.refCode)
      setInquiryStatus('sent')
    } catch (error) {
      setInquiryError(error instanceof Error ? error.message : 'We could not reach the server. Please try again.')
      setInquiryStatus('error')
    }
  }

  return (
    <div className="am-page" id="artist-monograph">
      <section className="am-hero" aria-labelledby="am-artist-title">
        <div className="am-hero-copy">
          <Link className="am-back" href="/artists"><ArrowLeft size={16} aria-hidden="true" /> Back to All Artists</Link>
          <p className="am-kicker">{artist.rosterBadge || 'Curated Artist'} <span aria-hidden="true">·</span> {artist.medium}</p>
          <h1 id="am-artist-title">{artist.displayName}</h1>
          <p className="am-location">{artist.city}{artist.state ? `, ${artist.state}` : ''}</p>
          {artist.artistStatement && <blockquote className="am-quote">“{artist.artistStatement}”</blockquote>}
          <div className="am-metrics" aria-label="Artist profile highlights">
            <div><strong>{artist.artworkCount}</strong><span>Exhibited Works</span></div>
            <div><strong>{artist.activeSince}</strong><span>Active Since</span></div>
            <div><strong>{artist.city}</strong><span>Studio, India</span></div>
          </div>
          <div className="am-hero-actions">
            <button type="button" className="am-button am-button-primary" onClick={() => openInquiry()}>Inquire / Commission <ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" className={`am-button am-button-outline${followed ? ' is-followed' : ''}`} aria-pressed={followed} onClick={() => setFollowed((value) => !value)}>
              {followed ? 'Following Artist ♥' : 'Follow Artist ♡'}
            </button>
          </div>
        </div>
        <figure className="am-hero-portrait">
          <img src={artist.portraitUrl} alt={`Portrait of ${artist.displayName}`} />
          <figcaption>{artist.displayName} · {artist.city}</figcaption>
        </figure>
      </section>

      <section className="am-practice" aria-labelledby="am-practice-title">
        <div className="am-practice-copy">
          <p className="am-section-kicker">The artist</p>
          <h2 id="am-practice-title">Biography &amp; Artistic Practice</h2>
          <p>{artist.bio}</p>
          <p>{artist.practiceDetail}</p>
        </div>
        <aside className="am-details" aria-label={`${artist.displayName} profile details`}>
          <div>
            <h3>Mediums &amp; Materials</h3>
            <ul className="am-tags">{listMediums(artist.medium).map((medium) => <li key={medium}>{medium}</li>)}</ul>
          </div>
          <div>
            <h3>Core Themes</h3>
            <ul className="am-list">{artist.coreThemes.map((theme) => <li key={theme}>{theme}</li>)}</ul>
          </div>
          <div>
            <h3>Exhibitions &amp; Recognition</h3>
            <ul className="am-list">{artist.exhibitionHistory.map((entry) => <li key={entry}>{entry}</li>)}</ul>
          </div>
          <div>
            <h3>Studio Location</h3>
            <p className="am-studio"><MapPin size={16} aria-hidden="true" /> {[artist.city, artist.state, 'India'].filter(Boolean).join(', ')}</p>
          </div>
        </aside>
      </section>

      <section className="am-works" aria-labelledby="am-works-title">
        <header className="am-works-heading">
          <div>
            <p className="am-section-kicker">A considered selection</p>
            <h2 id="am-works-title">Selected Works</h2>
          </div>
          <div className="am-work-filters" role="group" aria-label="Filter selected works">
            {workFilters.map((filter) => (
              <button key={filter} type="button" className={workFilter === filter ? 'is-active' : ''} aria-pressed={workFilter === filter} onClick={() => setWorkFilter(filter)}>{filter}</button>
            ))}
          </div>
        </header>
        {visibleWorks.length ? (
          <div className="am-work-grid">
            {visibleWorks.map((work) => (
              <article className="am-work-card" key={work.id}>
                <button className="am-work-image" type="button" onClick={() => setSelectedArtwork(work)} aria-label={`View ${displayWorkTitle(work)} artwork details`}>
                  <img src={work.imageUrl} alt={displayWorkTitle(work)} loading="lazy" />
                  <span className={`am-work-status is-${work.status.toLowerCase().replace('_', '-')}`}>{artworkStatusLabel(work.status)}</span>
                </button>
                <div className="am-work-copy">
                  <h3>{displayWorkTitle(work)}</h3>
                  <p>{[work.medium, work.dimensions, work.year].filter(Boolean).join(' · ')}</p>
                  <div className="am-work-footer"><strong>{formatPrice(work.priceAmount)}</strong><button type="button" onClick={() => openInquiry(work)}>Inquire <span aria-hidden="true">→</span></button></div>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="am-empty">No works match this filter. Choose another selection to continue exploring.</p>}
      </section>

      {moreArtists.length > 0 && (
        <section className="am-more" aria-labelledby="am-more-title">
          <div className="am-more-heading"><p className="am-section-kicker">The 2026 roster</p><h2 id="am-more-title">More Artists to Discover</h2></div>
          <div className="am-more-grid">
            {moreArtists.map((other) => (
              <Link className="am-more-card" href={`/artists/${other.slug}`} key={other.id}>
                <img src={other.portraitUrl} alt={`Portrait of ${other.displayName}`} loading="lazy" />
                <span><strong>{other.displayName}</strong><small>{other.city} · {other.medium}</small></span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link className="am-roster-link" href="/artists">Explore the full roster <ArrowRight size={16} aria-hidden="true" /></Link>
        </section>
      )}

      {selectedArtwork && (
        <div className="am-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedArtwork(null) }}>
          <section className="am-lightbox" role="dialog" aria-modal="true" aria-labelledby="am-lightbox-title">
            <button className="am-modal-close" type="button" onClick={() => setSelectedArtwork(null)} aria-label="Close artwork details"><X size={20} /></button>
            <div className="am-lightbox-image"><img src={selectedArtwork.imageUrl} alt={displayWorkTitle(selectedArtwork)} /></div>
            <div className="am-lightbox-copy">
              <p className="am-section-kicker">{artworkStatusLabel(selectedArtwork.status)} · {selectedArtwork.medium}</p>
              <h2 id="am-lightbox-title">{displayWorkTitle(selectedArtwork)}</h2>
              <p>{selectedArtwork.description}</p>
              <dl><div><dt>Dimensions</dt><dd>{selectedArtwork.dimensions || 'On request'}</dd></div><div><dt>Price</dt><dd>{formatPrice(selectedArtwork.priceAmount)}</dd></div></dl>
              <button type="button" className="am-button am-button-primary" onClick={() => openInquiry(selectedArtwork)}>Inquire about this work <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </section>
        </div>
      )}

      {inquiryOpen && (
        <div className="am-modal-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && inquiryStatus !== 'sending') setInquiryOpen(false) }}>
          <section className="am-inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="am-inquiry-title">
            <button className="am-modal-close" type="button" onClick={() => setInquiryOpen(false)} aria-label="Close inquiry form" disabled={inquiryStatus === 'sending'}><X size={20} /></button>
            {inquiryStatus === 'sent' ? (
              <div className="am-inquiry-success" role="status">
                <span aria-hidden="true">✓</span><p className="am-section-kicker">Message received</p>
                <h2 id="am-inquiry-title">Thank you for reaching out.</h2>
                <p>Your enquiry reference is <strong>{inquiryRef}</strong>. The Haat of Art team will be in touch.</p>
                <button type="button" className="am-button am-button-primary" onClick={() => setInquiryOpen(false)}>Close</button>
              </div>
            ) : (
              <>
                <p className="am-section-kicker">Collector enquiry</p>
                <h2 id="am-inquiry-title">{inquiryArtwork ? 'Inquire about this work' : 'Inquire / Commission'}</h2>
                <p className="am-inquiry-context">{artist.displayName}{inquiryArtwork ? ` · ${displayWorkTitle(inquiryArtwork)}` : ''}</p>
                <form className="am-inquiry-form" onSubmit={submitInquiry}>
                  <label>Your name<input name="name" autoComplete="name" maxLength={160} required /></label>
                  <label>Email address<input name="email" type="email" autoComplete="email" maxLength={255} required /></label>
                  <label>Phone <span>(optional)</span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>
                  <label>Message<textarea name="message" rows={4} minLength={10} maxLength={5000} required value={message} onChange={(event) => setMessage(event.target.value)} /></label>
                  <label className="am-consent"><input name="consent" type="checkbox" required /><span>I agree that The Haat of Art may contact me about this enquiry.</span></label>
                  <button type="submit" className="am-button am-button-primary" disabled={inquiryStatus === 'sending'}>{inquiryStatus === 'sending' ? 'Sending…' : 'Send enquiry'} <ArrowRight size={16} aria-hidden="true" /></button>
                  {inquiryStatus === 'error' && <p className="am-form-error" role="alert">{inquiryError}</p>}
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
