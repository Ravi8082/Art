'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { CalendarDays, Camera, Check, ChevronLeft, ChevronRight, ImagePlus, Maximize2, MapPin, Play, UploadCloud, X } from 'lucide-react'
import type { ExhibitionArchiveEdition, ExhibitionArchiveMedia } from '@/lib/booking-server'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileSize = 50 * 1024 * 1024
type MediaKind = 'IMAGE' | 'VIDEO'

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return `Request failed (${response.status})`
}

function durationLabel(seconds: number | null) {
  if (seconds === null) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function resolveMediaUrl(url: string | null) {
  if (!url) return ''
  return url.startsWith('/api/exhibition-archive/') ? `${apiBaseUrl}${url}` : url
}

function editionYear(edition: ExhibitionArchiveEdition) {
  return edition.startDate?.slice(0, 4) ?? edition.monthLabel.match(/\d{4}/)?.[0] ?? ''
}

function compactMonthLabel(label: string) {
  const monthAbbreviations: Record<string, string> = {
    January: 'Jan', February: 'Feb', March: 'Mar', April: 'Apr', May: 'May', June: 'Jun',
    July: 'Jul', August: 'Aug', September: 'Sept', October: 'Oct', November: 'Nov', December: 'Dec',
  }
  return label.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (month) => monthAbbreviations[month])
}

function editionDateLabel(edition: ExhibitionArchiveEdition) {
  if (!edition.dateIsExact || !edition.startDate) return compactMonthLabel(edition.monthLabel)
  const start = new Date(`${edition.startDate}T00:00:00Z`)
  const end = edition.endDate ? new Date(`${edition.endDate}T00:00:00Z`) : null
  const day = new Intl.DateTimeFormat('en', { day: 'numeric', timeZone: 'UTC' })
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
  const fullDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (!end || end.getTime() === start.getTime()) return fullDate.format(start)
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${month.format(start)} ${day.format(start)}–${day.format(end)}, ${start.getUTCFullYear()}`
  }
  return `${fullDate.format(start)} – ${fullDate.format(end)}`
}

function editionSortDate(edition: ExhibitionArchiveEdition) {
  if (edition.startDate) return edition.startDate
  const year = editionYear(edition)
  return year ? `${year}-01-01` : ''
}

function editionPillLabel(edition: ExhibitionArchiveEdition, editions: ExhibitionArchiveEdition[]) {
  const matchingCityMonth = editions.filter((item) => item.city === edition.city && item.monthLabel === edition.monthLabel)
  const disambiguator = matchingCityMonth.length > 1 && edition.startDate ? ` · ${edition.startDate}` : ''
  return `${edition.city} · ${compactMonthLabel(edition.monthLabel)}${disambiguator}`
}

function mediaFromResponse(value: unknown): ExhibitionArchiveMedia | null {
  if (!value || typeof value !== 'object') return null
  const media = value as Record<string, unknown>
  if (
    typeof media.id !== 'string'
    || typeof media.editionId !== 'string'
    || (media.mediaType !== 'IMAGE' && media.mediaType !== 'VIDEO')
    || (media.sourceType !== 'ASSET' && media.sourceType !== 'UPLOAD' && media.sourceType !== 'YOUTUBE')
    || typeof media.caption !== 'string'
  ) return null
  return {
    id: media.id,
    editionId: media.editionId,
    mediaType: media.mediaType,
    sourceType: media.sourceType as ExhibitionArchiveMedia['sourceType'],
    sourceUrl: typeof media.sourceUrl === 'string' ? media.sourceUrl : null,
    mimeType: typeof media.mimeType === 'string' ? media.mimeType : null,
    caption: media.caption,
    artistName: typeof media.artistName === 'string' ? media.artistName : '',
    stallName: typeof media.stallName === 'string' ? media.stallName : '',
    altText: typeof media.altText === 'string' ? media.altText : '',
    durationSeconds: typeof media.durationSeconds === 'number' ? media.durationSeconds : null,
    sortOrder: typeof media.sortOrder === 'number' ? media.sortOrder : 0,
    url: typeof media.url === 'string' ? media.url : null,
    embedUrl: typeof media.embedUrl === 'string' ? media.embedUrl : null,
  }
}

function parseExhibitionArchive(value: unknown): ExhibitionArchiveEdition[] {
  if (!Array.isArray(value)) throw new Error('The exhibition archive returned an invalid response.')
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('The exhibition archive returned an invalid edition.')
    const edition = item as Record<string, unknown>
    const media = Array.isArray(edition.media) ? edition.media.map(mediaFromResponse) : null
    if (
      typeof edition.id !== 'string'
      || typeof edition.editionKey !== 'string'
      || typeof edition.title !== 'string'
      || typeof edition.editionNumber !== 'string'
      || typeof edition.city !== 'string'
      || typeof edition.monthLabel !== 'string'
      || (typeof edition.startDate !== 'string' && edition.startDate !== null)
      || (typeof edition.endDate !== 'string' && edition.endDate !== null)
      || typeof edition.dateIsExact !== 'boolean'
      || typeof edition.venue !== 'string'
      || typeof edition.artistCount !== 'number'
      || !media
      || media.some((item) => item === null)
    ) throw new Error('The exhibition archive returned an invalid edition.')
    return { ...edition, media } as ExhibitionArchiveEdition
  })
}

function ArchiveLightbox({ edition, media, mediaCount, onClose, onNavigate }: {
  edition: ExhibitionArchiveEdition
  media: ExhibitionArchiveMedia
  mediaCount: number
  onClose: () => void
  onNavigate: (direction: -1 | 1) => void
}) {
  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') onNavigate(-1)
      if (event.key === 'ArrowRight') onNavigate(1)
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [onClose, onNavigate])

  return (
    <div className="ga-lightbox" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="ga-lightbox-dialog" role="dialog" aria-modal="true" aria-label={`${edition.city} exhibition media`}>
        <button type="button" className="ga-lightbox-close" onClick={onClose} aria-label="Close media viewer"><X size={21} /></button>
        <div className="ga-lightbox-stage">
          {media.mediaType === 'IMAGE' && media.url
            ? <img src={resolveMediaUrl(media.url)} alt={media.altText || media.caption} />
            : media.embedUrl
              ? <iframe src={`${media.embedUrl}?autoplay=1&rel=0`} title={media.caption} allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen />
              : media.url
                ? <video src={resolveMediaUrl(media.url)} autoPlay playsInline controls />
                : <p className="ga-empty-media">This media file is unavailable.</p>}
          {mediaCount > 1 && <>
            <button type="button" className="ga-lightbox-nav is-previous" onClick={() => onNavigate(-1)} aria-label="Previous exhibition media"><ChevronLeft size={25} /></button>
            <button type="button" className="ga-lightbox-nav is-next" onClick={() => onNavigate(1)} aria-label="Next exhibition media"><ChevronRight size={25} /></button>
          </>}
        </div>
        <div className="ga-lightbox-caption">
          <div><p>{edition.city} · {editionDateLabel(edition)}{media.stallName ? ` · Stall ${media.stallName}` : ''}</p><h2>{media.caption}</h2><span>{media.artistName ? `Artist: ${media.artistName}` : 'Exhibition archive'}{mediaCount > 1 ? ` · ${mediaCount} archive moments` : ''}</span></div>
          <button type="button" onClick={(event) => {
            const stage = event.currentTarget.closest('.ga-lightbox-dialog')?.querySelector('.ga-lightbox-stage')
            if (stage?.requestFullscreen) void stage.requestFullscreen()
          }} aria-label="View media fullscreen"><Maximize2 size={17} /></button>
        </div>
      </section>
    </div>
  )
}

export function ExhibitionArchive({ initialEditions }: { initialEditions: ExhibitionArchiveEdition[] }) {
  const [editions, setEditions] = useState(initialEditions)
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeYear, setActiveYear] = useState('all')
  const [activeCity, setActiveCity] = useState('all')
  const [activeMedia, setActiveMedia] = useState<{ edition: ExhibitionArchiveEdition; media: ExhibitionArchiveMedia; index: number } | null>(null)
  const [uploadEdition, setUploadEdition] = useState<ExhibitionArchiveEdition | null>(null)
  const [authStatus, setAuthStatus] = useState<'checking' | 'signed-in' | 'signed-out'>('checking')
  const [authCheckKey, setAuthCheckKey] = useState(0)
  const [uploadKind, setUploadKind] = useState<MediaKind>('IMAGE')
  const [mediaSource, setMediaSource] = useState<'file' | 'youtube'>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [artistName, setArtistName] = useState('')
  const [stallName, setStallName] = useState('')
  const [altText, setAltText] = useState('')
  const [duration, setDuration] = useState('')
  const [editionChoice, setEditionChoice] = useState('')
  const [newEdition, setNewEdition] = useState({ title: '', editionNumber: '', city: '', startDate: '', endDate: '', venue: '', artistCount: '0' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setEditions(initialEditions), [initialEditions])

  const sortedEditions = useMemo(() => [...editions].sort((a, b) => {
    const dateOrder = editionSortDate(b).localeCompare(editionSortDate(a))
    return dateOrder || a.city.localeCompare(b.city) || a.id.localeCompare(b.id)
  }), [editions])
  const years = useMemo(() => [...new Set(sortedEditions.map(editionYear).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [sortedEditions])
  const cities = useMemo(() => [...new Set(sortedEditions.map((edition) => edition.city))].sort((a, b) => a.localeCompare(b)), [sortedEditions])
  const visibleEditions = useMemo(() => sortedEditions.filter((edition) => (
    (activeFilter === 'all' || edition.id === activeFilter)
    && (activeYear === 'all' || editionYear(edition) === activeYear)
    && (activeCity === 'all' || edition.city === activeCity)
  )), [activeCity, activeFilter, activeYear, sortedEditions])

  useEffect(() => {
    let active = true
    setAuthStatus('checking')
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include', headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!active) return
        if (response.status === 401) {
          setAuthStatus('signed-out')
          return
        }
        if (!response.ok) throw new Error(`Admin session could not be verified (${response.status}).`)
        const payload: unknown = await response.json()
        if (
          !payload
          || typeof payload !== 'object'
          || !('user' in payload)
          || !payload.user
          || typeof payload.user !== 'object'
          || !('isAdmin' in payload.user)
        ) throw new Error('Admin session verification returned an invalid response.')
        setAuthStatus(payload.user.isAdmin === true ? 'signed-in' : 'signed-out')
      })
      .catch((error: unknown) => {
        if (active) {
          console.error('Gallery admin session verification failed.', error)
          setAuthStatus('signed-out')
        }
      })
    return () => { active = false }
  }, [uploadEdition, authCheckKey])

  useEffect(() => {
    let active = true
    const refreshArchive = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/exhibition-archive`, {
          cache: 'no-store',
          headers: { accept: 'application/json' },
        })
        if (!response.ok) throw new Error(await responseError(response))
        const latestEditions = parseExhibitionArchive(await response.json())
        if (active) {
          setEditions(latestEditions)
          setError('')
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'The exhibition archive could not be refreshed.')
      }
    }
    window.addEventListener('gallery:refresh-archive', refreshArchive)
    return () => {
      active = false
      window.removeEventListener('gallery:refresh-archive', refreshArchive)
    }
  }, [])

  useEffect(() => {
    if (!uploadEdition && !activeMedia) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setUploadEdition(null)
        setActiveMedia(null)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [uploadEdition, activeMedia, busy])

  function resetUploader() {
    setUploadEdition(null)
    setUploadKind('IMAGE')
    setMediaSource('file')
    setSelectedFile(null)
    setYoutubeUrl('')
    setCaption('')
    setArtistName('')
    setStallName('')
    setAltText('')
    setDuration('')
    setEditionChoice('')
    setNewEdition({ title: '', editionNumber: '', city: '', startDate: '', endDate: '', venue: '', artistCount: '0' })
    setError('')
  }

  function navigateMedia(direction: -1 | 1) {
    setActiveMedia((current) => {
      if (!current) return current
      const index = (current.index + direction + current.edition.media.length) % current.edition.media.length
      return { ...current, index, media: current.edition.media[index] }
    })
  }

  async function submitMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!uploadEdition || busy) return
    setBusy(true)
    setError('')
    try {
      let edition = editionChoice === 'new'
        ? uploadEdition
        : editions.find((item) => item.id === editionChoice) ?? uploadEdition
      if (editionChoice === 'new') {
        if (!newEdition.startDate) throw new Error('Choose the exact start date for this edition.')
        const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(`${newEdition.startDate}T00:00:00Z`))
        const editionResponse = await fetch(`${apiBaseUrl}/api/exhibition-archive/editions`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newEdition,
            monthLabel,
            endDate: newEdition.endDate || null,
            artistCount: Number(newEdition.artistCount),
          }),
        })
        if (!editionResponse.ok) throw new Error(await responseError(editionResponse))
        const created: unknown = await editionResponse.json()
        if (!created || typeof created !== 'object' || !('id' in created) || typeof created.id !== 'string') {
          throw new Error('The edition API returned an invalid response.')
        }
        edition = {
          id: created.id,
          editionKey: 'editionKey' in created && typeof created.editionKey === 'string' ? created.editionKey : '',
          title: newEdition.title,
          editionNumber: newEdition.editionNumber,
          city: newEdition.city,
          monthLabel,
          startDate: newEdition.startDate,
          endDate: newEdition.endDate || null,
          dateIsExact: true,
          venue: newEdition.venue,
          artistCount: Number(newEdition.artistCount) || 0,
          media: [],
        }
        setUploadEdition(edition)
        setEditionChoice(edition.id)
        setEditions((current) => [...current, edition])
        setActiveFilter(edition.id)
      }

      let response: Response
      if (mediaSource === 'youtube' && uploadKind === 'VIDEO') {
        response = await fetch(`${apiBaseUrl}/api/exhibition-archive/editions/${edition.id}/videos`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: youtubeUrl.trim(),
            caption: caption.trim(),
            artistName: artistName.trim(),
            stallName: stallName.trim(),
            altText: altText.trim(),
            durationSeconds: duration.trim() ? Number(duration) : null,
          }),
        })
      } else {
        if (!selectedFile) throw new Error('Choose a photo or MP4 video to upload.')
        const validTypes = uploadKind === 'IMAGE'
          ? ['image/jpeg', 'image/png', 'image/webp']
          : ['video/mp4']
        if (!validTypes.includes(selectedFile.type)) throw new Error('Use a JPG, PNG or WebP photo, or an MP4 video.')
        if (selectedFile.size > maxFileSize) throw new Error('The media file must be 50 MB or smaller.')
        response = await fetch(`${apiBaseUrl}/api/exhibition-archive/editions/${edition.id}/media`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': selectedFile.type,
            'X-Caption': encodeURIComponent(caption.trim()),
            'X-Artist-Name': encodeURIComponent(artistName.trim()),
            'X-Stall-Name': encodeURIComponent(stallName.trim()),
            'X-Alt-Text': encodeURIComponent(altText.trim()),
            'X-Duration-Seconds': encodeURIComponent(uploadKind === 'VIDEO' ? duration.trim() : ''),
          },
          body: selectedFile,
        })
      }
      if (!response.ok) throw new Error(await responseError(response))
      const savedMedia = mediaFromResponse(await response.json())
      if (!savedMedia) throw new Error('The media API returned an invalid response.')
      setEditions((current) => current.map((item) => item.id === edition.id
        ? { ...item, media: [savedMedia, ...item.media] }
        : item))
      setActiveFilter(edition.id)
      resetUploader()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The media upload could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="ga-archive" aria-labelledby="ga-archive-title">
      <header className="ga-archive-intro">
        <div><p className="gc-eyebrow">From the exhibition floor</p><h2 id="ga-archive-title">Exhibition Editions &amp; Archive</h2><p>Photographs and moving images, organised by edition—not confused with works available to collect.</p></div>
        <span className="ga-archive-count"><Camera size={15} aria-hidden="true" /> {sortedEditions.reduce((total, edition) => total + edition.media.length, 0)} archive moments</span>
      </header>

      <div className="ga-edition-filter-bar">
        <div className="ga-edition-filters" role="group" aria-label="Filter exhibition editions">
          <button type="button" className={activeFilter === 'all' && activeYear === 'all' && activeCity === 'all' ? 'is-active' : ''} aria-pressed={activeFilter === 'all' && activeYear === 'all' && activeCity === 'all'} onClick={() => { setActiveFilter('all'); setActiveYear('all'); setActiveCity('all') }}>All Editions</button>
          {sortedEditions.map((edition) => (
            <button type="button" key={edition.id} className={activeFilter === edition.id ? 'is-active' : ''} aria-pressed={activeFilter === edition.id} onClick={() => { setActiveFilter(edition.id); setActiveYear('all'); setActiveCity('all') }}>
              {editionPillLabel(edition, sortedEditions)}
            </button>
          ))}
        </div>
        <div className="ga-edition-selects">
          <label>Year<select aria-label="Filter by year" value={activeYear} onChange={(event) => { setActiveYear(event.target.value); setActiveFilter('all') }}><option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label>City<select aria-label="Filter by city" value={activeCity} onChange={(event) => { setActiveCity(event.target.value); setActiveFilter('all') }}><option value="all">All cities</option>{cities.map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
        </div>
      </div>
      {error && !uploadEdition && <p className="ga-archive-error" role="alert">{error}</p>}

      {visibleEditions.length ? visibleEditions.map((edition) => (
        <section className="ga-edition" key={edition.id} aria-labelledby={`ga-edition-${edition.id}`}>
          <header className="ga-edition-header">
            <div className="ga-edition-heading">
              <p className="ga-edition-date"><CalendarDays size={14} aria-hidden="true" /> {edition.editionNumber ? `Edition ${edition.editionNumber} · ${edition.city}` : `Exhibition Edition · ${edition.city}`}</p>
              <h2 id={`ga-edition-${edition.id}`}>{edition.title}</h2>
              <p className="ga-edition-venue"><MapPin size={14} aria-hidden="true" /> {editionDateLabel(edition)} · {edition.venue}</p>
            </div>
            <div className="ga-edition-meta">
              <span className="ga-edition-media-count"><strong>{edition.media.filter((media) => media.mediaType === 'IMAGE').length} Photos · {edition.media.filter((media) => media.mediaType === 'VIDEO').length} Highlight Films</strong></span>
              {authStatus === 'signed-in' && <button type="button" onClick={() => { setAuthStatus('checking'); setUploadEdition(edition); setEditionChoice(edition.id) }}><UploadCloud size={15} aria-hidden="true" /> + Upload Media to This Edition</button>}
            </div>
          </header>

          {edition.media.length ? (
            <div className="ga-media-grid">
              {edition.media.map((media, index) => {
                const leadMedia = edition.media.find((item) => item.mediaType === 'VIDEO') ?? edition.media[0]
                const isLead = media.id === leadMedia.id
                const aspectClass = isLead ? 'is-lead' : index % 4 === 1 ? 'is-portrait' : 'is-landscape'
                return (
                <button type="button" className={`ga-media-card ${aspectClass}${media.mediaType === 'VIDEO' ? ' is-video' : ''}`} key={media.id} onClick={() => setActiveMedia({ edition, media, index })}>
                  <span className="ga-media-image">
                    {media.mediaType === 'IMAGE' && media.url
                      ? <img src={resolveMediaUrl(media.url)} alt={media.altText || media.caption} loading="lazy" />
                      : <span className="ga-video-poster"><span><Play size={22} fill="currentColor" aria-hidden="true" /></span></span>}
                    {isLead && media.mediaType === 'VIDEO' && <span className="ga-film-badge"><Play size={11} fill="currentColor" aria-hidden="true" /> Watch Edition Film{media.durationSeconds !== null ? ` · ${durationLabel(media.durationSeconds)}` : ''}</span>}
                    <span className={media.mediaType === 'VIDEO' ? 'ga-media-type is-video' : 'ga-media-type'}>{media.mediaType === 'VIDEO' ? <><Play size={11} fill="currentColor" aria-hidden="true" /> Highlight Film</> : <><Camera size={11} aria-hidden="true" /> Exhibition Photo</>}</span>
                    {media.mediaType === 'VIDEO' && media.durationSeconds !== null && !isLead && <span className="ga-media-duration">{durationLabel(media.durationSeconds)}</span>}
                  </span>
                  <span className="ga-media-copy">
                    <span className="ga-media-caption">{media.caption}</span>
                    <span className="ga-media-context">{edition.city.toUpperCase()} · {edition.monthLabel.toUpperCase()}{media.stallName ? ` · STALL ${media.stallName.toUpperCase()}` : ''}{media.artistName ? ` · ${media.artistName}` : ''}</span>
                  </span>
                </button>
                )
              })}
            </div>
          ) : <p className="ga-empty-edition">No exhibition media has been published for this edition yet.</p>}
        </section>
      )) : <p className="ga-empty-edition">No exhibition editions match these filters.</p>}

      {uploadEdition && (
        <div className="ga-upload-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !busy) resetUploader() }}>
          <section className="ga-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="ga-upload-title">
            <header><div><p className="gc-eyebrow">Edition archive · Admin managed</p><h2 id="ga-upload-title">Upload Exhibition Media</h2><p>Photos and video moments stay separate from the artwork marketplace.</p></div><button type="button" onClick={resetUploader} disabled={busy} aria-label="Close upload dialog"><X size={20} /></button></header>
            {authStatus === 'checking'
              ? <p className="ga-upload-status">Checking your admin session…</p>
              : authStatus === 'signed-out'
                ? <div className="ga-upload-auth"><p>Sign in with an authorised admin account to add or publish exhibition media.</p><Link href="/dashboard" target="_blank" rel="noopener noreferrer">Go to Admin Dashboard <span aria-hidden="true">→</span></Link><button type="button" onClick={() => { setAuthStatus('checking'); setAuthCheckKey((key) => key + 1) }}>Check admin session again</button></div>
                : (
                  <form onSubmit={submitMedia}>
                    <label className="ga-field">Edition<select value={editionChoice || uploadEdition.id} onChange={(event) => setEditionChoice(event.target.value)}><option value={uploadEdition.id}>{editionPillLabel(uploadEdition, editions)}</option>{editions.filter((edition) => edition.id !== uploadEdition.id).map((edition) => <option key={edition.id} value={edition.id}>{editionPillLabel(edition, editions)}</option>)}<option value="new">+ Add New Edition</option></select></label>
                    {editionChoice === 'new' && <div className="ga-new-edition-fields">
                      <label className="ga-field">Edition title<input required minLength={2} maxLength={180} value={newEdition.title} onChange={(event) => setNewEdition({ ...newEdition, title: event.target.value })} /></label>
                      <label className="ga-field">Edition number<input maxLength={40} placeholder="e.g. XVIII" value={newEdition.editionNumber} onChange={(event) => setNewEdition({ ...newEdition, editionNumber: event.target.value })} /></label>
                      <label className="ga-field">City<input required minLength={2} maxLength={120} value={newEdition.city} onChange={(event) => setNewEdition({ ...newEdition, city: event.target.value })} /></label>
                      <label className="ga-field">Start date<input type="date" required value={newEdition.startDate} onChange={(event) => setNewEdition({ ...newEdition, startDate: event.target.value, endDate: newEdition.endDate && newEdition.endDate < event.target.value ? '' : newEdition.endDate })} /></label>
                      <label className="ga-field">End date<input type="date" min={newEdition.startDate || undefined} value={newEdition.endDate} onChange={(event) => setNewEdition({ ...newEdition, endDate: event.target.value })} /></label>
                      <label className="ga-field">Venue<input required minLength={2} maxLength={220} value={newEdition.venue} onChange={(event) => setNewEdition({ ...newEdition, venue: event.target.value })} /></label>
                      <label className="ga-field">Artist count<input type="number" min={0} max={5000} value={newEdition.artistCount} onChange={(event) => setNewEdition({ ...newEdition, artistCount: event.target.value })} /></label>
                    </div>}
                    <div className="ga-form-row">
                      <label className="ga-field">Media type<select value={uploadKind} onChange={(event) => { const kind = event.target.value as MediaKind; setUploadKind(kind); if (kind === 'IMAGE') setMediaSource('file') }}><option value="IMAGE">Exhibition photo</option><option value="VIDEO">Event highlight video</option></select></label>
                      {uploadKind === 'VIDEO' && <label className="ga-field">Video source<select value={mediaSource} onChange={(event) => setMediaSource(event.target.value as 'file' | 'youtube')}><option value="file">Upload MP4</option><option value="youtube">YouTube / Shorts link</option></select></label>}
                    </div>
                    {mediaSource === 'youtube' && uploadKind === 'VIDEO'
                      ? <label className="ga-field">YouTube video URL<input type="url" required placeholder="https://youtu.be/…" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} /></label>
                      : <label className="ga-upload-drop"><ImagePlus size={22} aria-hidden="true" /><strong>{selectedFile ? selectedFile.name : uploadKind === 'IMAGE' ? 'Choose a photo' : 'Choose an MP4 highlight video'}</strong><span>JPG, PNG, WebP or MP4 · maximum 50 MB</span><input type="file" accept={uploadKind === 'IMAGE' ? 'image/jpeg,image/png,image/webp' : 'video/mp4'} required onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)} /></label>}
                    {uploadKind === 'VIDEO' && <label className="ga-field">Duration in seconds<input type="number" min={0} max={3600} required value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="e.g. 45" /></label>}
                    <label className="ga-field">Caption<input required minLength={2} maxLength={240} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Describe this exhibition moment" /></label>
                    <div className="ga-form-row"><label className="ga-field">Artist / exhibitor name<input maxLength={140} value={artistName} onChange={(event) => setArtistName(event.target.value)} /></label><label className="ga-field">Stall name or number<input maxLength={80} value={stallName} onChange={(event) => setStallName(event.target.value)} placeholder="e.g. B4" /></label></div>
                    <label className="ga-field">Accessibility description<input maxLength={255} value={altText} onChange={(event) => setAltText(event.target.value)} /></label>
                    {error && <p className="ga-upload-error" role="alert">{error}</p>}
                    <button className="ga-upload-submit" type="submit" disabled={busy}>{busy ? 'Saving to archive…' : <><Check size={16} aria-hidden="true" /> Add to this edition’s archive</>}</button>
                  </form>
                )}
          </section>
        </div>
      )}

      {activeMedia && <ArchiveLightbox
        edition={activeMedia.edition}
        media={activeMedia.media}
        mediaCount={activeMedia.edition.media.length}
        onClose={() => setActiveMedia(null)}
        onNavigate={navigateMedia}
      />}
    </section>
  )
}
