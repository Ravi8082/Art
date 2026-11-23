'use client'

import { useEffect, useRef, useState } from 'react'
import { AtSign, ArrowUpRight, Link2, X } from 'lucide-react'
import type { PublicGuest } from '@/lib/api'
import { SectionHeading } from './section-heading'

export type GuestCard = PublicGuest

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()
}

function GuestTile({ guest, onOpen }: { guest: GuestCard; onOpen: (guest: GuestCard) => void }) {
  return (
    <article className="gs-tile">
      <div className="gs-photo"><span className="gs-monogram">{initials(guest.name)}</span></div>
      <div className="gs-caption">
        <strong>{guest.name}</strong>
        {guest.role && <small>{guest.role}</small>}
        {guest.eventName && <em>{guest.eventName}</em>}
      </div>
      <button type="button" className="gs-read" onClick={() => onOpen(guest)} aria-label={`Read more about ${guest.name}`}>
        <ArrowUpRight size={16} />
      </button>
    </article>
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
          <span className="gs-monogram is-large">{initials(guest.name)}</span>
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

export function GuestsSection({ items }: { items: GuestCard[] }) {
  const guests = items
  const [open, setOpen] = useState<GuestCard | null>(null)

  if (!guests.length) return null

  return (
    <section className="th-section gs-section" id="guests">
      <SectionHeading before="In Good" accent="Company" subtitle="Artists, curators and guests who have contributed to our exhibitions." />
      <div className="gs-grid">
        {guests.slice(0, 6).map((guest) => <GuestTile key={guest.id} guest={guest} onOpen={setOpen} />)}
      </div>
      {open && <GuestDialog guest={open} onClose={() => setOpen(null)} />}
    </section>
  )
}
