'use client'

import { useRef, useState } from 'react'
import { ArrowRight, Building2, Clock3, Handshake, Mail, MapPin, MessageCircle, Palette, Phone } from 'lucide-react'
import { ContactForm } from '@/components/contact-form'
import type { PublicContactSettings } from '@/lib/api'

const departments = [
  {
    title: 'Exhibition & Stall Desk',
    description: 'Stall bookings, event editions and visitor enquiries.',
    category: 'Exhibition/Stall Booking',
    Icon: Building2,
  },
  {
    title: 'Artist Curation & Roster',
    description: 'Artist profiles, portfolio submissions and roster support.',
    category: 'Artist',
    Icon: Palette,
  },
  {
    title: 'Brand & Gallery Partnerships',
    description: 'Sponsorship, venues and cultural collaborations.',
    category: 'Partnership',
    Icon: Handshake,
  },
]

type ContactConciergeProps = {
  contact: PublicContactSettings
  notice?: string
}

export function ContactConcierge({ contact, notice }: ContactConciergeProps) {
  const [category, setCategory] = useState('General')
  const formSection = useRef<HTMLElement | null>(null)

  function chooseDepartment(value: string) {
    setCategory(value)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    formSection.current?.scrollIntoView({ behavior, block: 'start' })
  }

  return (
    <>
      <section className="ct-departments" aria-labelledby="ct-departments-title">
        <div className="ct-departments-heading">
          <p className="ct-section-kicker">Choose your desk</p>
          <h2 id="ct-departments-title">A good conversation starts here.</h2>
        </div>
        <div className="ct-department-grid">
          {departments.map(({ title, description, category: value, Icon }) => (
            <button
              className={`ct-department-card${category === value ? ' is-selected' : ''}`}
              type="button"
              key={value}
              aria-pressed={category === value}
              onClick={() => chooseDepartment(value)}
            >
              <span className="ct-department-icon"><Icon size={20} strokeWidth={1.5} aria-hidden="true" /></span>
              <span className="ct-department-copy">
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <ArrowRight className="ct-department-arrow" size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      <section className="ct-main" id="enquiry-form" ref={formSection} aria-labelledby="ct-form-title">
        <div className="ct-form-panel">
          <p className="ct-section-kicker">Your enquiry</p>
          <h2 id="ct-form-title">Tell us what you have in <em>mind.</em></h2>
          <p className="ct-muted">Every field except the mobile number and attachment is required. You will get an enquiry reference ID on the next screen.</p>
          <ContactForm category={category} onCategoryChange={setCategory} />
          {notice && <p className="ct-notice">{notice}</p>}
        </div>

        <aside className="ct-side" aria-labelledby="ct-side-title">
          <p className="ct-section-kicker">Our promise</p>
          <h3 id="ct-side-title">Where your message goes</h3>
          <ol className="ct-flow">
            <li><strong>Recorded instantly</strong><span>Your enquiry is stored with a reference ID — no OTP, no waiting.</span></li>
            <li><strong>Routed to a person</strong><span>Stall bookings, artists, media and sponsorships each reach the right desk.</span></li>
            <li><strong>Answered in 2 working days</strong><span>Follow-ups are tracked so nothing gets quietly forgotten.</span></li>
          </ol>

          <section className="ct-direct-desk" aria-labelledby="ct-direct-desk-title">
            <p className="ct-direct-kicker"><MapPin size={13} aria-hidden="true" /> Visit & Direct Mumbai Desk</p>
            <h4 id="ct-direct-desk-title">The Haat of Art Foundation</h4>
            <address>{contact.address}</address>
            <dl>
              <div>
                <dt><Phone size={13} aria-hidden="true" /> Direct Phone & WhatsApp</dt>
                <dd>
                  {contact.phones.map((phone, index) => (
                    <span key={`${phone}-${index}`}>
                      {index > 0 && <span aria-hidden="true"> · </span>}
                      <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt><Mail size={13} aria-hidden="true" /> Email</dt>
                <dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd>
              </div>
              <div>
                <dt><Clock3 size={13} aria-hidden="true" /> Hours</dt>
                <dd>{contact.hours}</dd>
              </div>
            </dl>
          </section>

          <div className="ct-socials">
            {contact.socialLinks.map(({ label, url }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}
            <a className="ct-whatsapp-link" href="https://wa.me/917304645333" target="_blank" rel="noopener noreferrer">
              <MessageCircle size={15} aria-hidden="true" /> Chat on WhatsApp (+91 7304645333) ↗
            </a>
          </div>
        </aside>
      </section>
    </>
  )
}
