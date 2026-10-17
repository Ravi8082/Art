'use client'

import { useEffect, useRef, useState } from 'react'
import { AtSign, Link2, Sparkles, X } from 'lucide-react'
import { demoGuests } from '@/lib/demo-guests'
import type { PublicGuest } from '@/lib/api'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'

export type GuestCard = PublicGuest & { image?: string }

const demoPhotos = ['/demo/art-gaze.jpg', '/demo/art-bloom.jpg', '/demo/art-lotus.jpg', '/demo/art-tree.jpg', '/demo/art-dusk.jpg', '/demo/art-mandala.jpg']

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function GuestTile({ guest, index, onOpen }: { guest: GuestCard; index: number; onOpen: (guest: GuestCard) => void }) {
  const tile = useRef<HTMLDivElement>(null)

  function track(event: React.PointerEvent<HTMLDivElement>) {
    const el = tile.current
    if (!el || event.pointerType !== 'mouse') return
    const box = el.getBoundingClientRect()
    const px = (event.clientX - box.left) / box.width - 0.5
    const py = (event.clientY - box.top) / box.height - 0.5
    el.style.setProperty('--tilt-x', `${(-py * 14).toFixed(2)}deg`)
    el.style.setProperty('--tilt-y', `${(px * 16).toFixed(2)}deg`)
  }

  function reset() {
    tile.current?.style.setProperty('--tilt-x', '0deg')
    tile.current?.style.setProperty('--tilt-y', '0deg')
  }

  return (
    <div
      className="gs-tile"
      ref={tile}
      onPointerMove={track}
      onPointerLeave={reset}
      style={{ '--gs-delay': `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="gs-tile-3d">
        <div className="gs-photo">
          {guest.image
            ? <SafeImage src={guest.image} alt={guest.name} fallback={demoPhotos[index % demoPhotos.length]} />
            : <span className="gs-monogram">{initials(guest.name)}</span>}
          <span className="gs-shine" aria-hidden />
        </div>
        <div className="gs-veil">
          <b>{guest.name}</b>
          {guest.role && <small>{guest.role}</small>}
          <p>{guest.bio || 'No profile note has been added for this guest yet.'}</p>
        </div>
        <button
          type="button"
          className="gs-read"
          onClick={() => onOpen(guest)}
          aria-label={`Read more about ${guest.name}`}
        >Read</button>
      </div>
      <div className="gs-caption">
        <strong>{guest.name}</strong>
        {guest.role && <small>{guest.role}</small>}
        {guest.eventName && <em>{guest.eventName}</em>}
      </div>
    </div>
  )
}

function GuestDialog({ guest, onClose }: { guest: GuestCard; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused?.focus()
    }
  }, [onClose])

  return (
    <div className="gs-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="gs-sheet" role="dialog" aria-modal="true" aria-label={`About ${guest.name}`}>
        <button ref={closeRef} type="button" className="gs-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        <div className="gs-sheet-media">
          {guest.image
            ? <SafeImage src={guest.image} alt={guest.name} fallback={demoPhotos[guest.sortOrder % demoPhotos.length]} />
            : <span className="gs-monogram is-large">{initials(guest.name)}</span>}
        </div>
        <div className="gs-sheet-body">
          <p className="th-eyebrow">Guest profile</p>
          <h3>{guest.name}</h3>
          {guest.role && <p className="gs-sheet-role">{guest.role}</p>}
          {guest.eventName && <p className="gs-sheet-event">{guest.eventName}</p>}
          <p className="gs-sheet-bio">{guest.bio || 'No profile note has been added for this guest yet.'}</p>
          <div className="gs-sheet-links">
            {guest.instagramUrl && <a href={guest.instagramUrl} target="_blank" rel="noopener noreferrer"><AtSign size={14} /> Instagram</a>}
            {guest.websiteUrl && <a href={guest.websiteUrl} target="_blank" rel="noopener noreferrer"><Link2 size={14} /> Website</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GuestsSection({ items, apiBaseUrl }: { items: GuestCard[]; apiBaseUrl: string }) {
  const guests = (items.length ? items : demoGuests).map((guest) => ({
    ...guest,
    image: guest.photoUrl ? `${apiBaseUrl}${guest.photoUrl}` : undefined,
  }))
  const [open, setOpen] = useState<GuestCard | null>(null)

  return (
    <section className="th-section gs-section" id="guests">
      <SectionHeading before="All Guests" accent="So Far" subtitle="Every guest who has stood in our halls — hover a portrait to read about them." />
      <p className="gs-hint"><Sparkles size={12} /> Move over a portrait, or press Tab and Enter to open a profile</p>
      <div className="gs-grid">
        {guests.slice(0, 12).map((guest, index) => <GuestTile key={guest.id} guest={guest} index={index} onOpen={setOpen} />)}
      </div>
      {open && <GuestDialog guest={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
