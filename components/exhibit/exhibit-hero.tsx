'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { exhibitHero } from '@/lib/exhibit-content'
import { MagneticLink } from '@/components/motion/magnetic-link'

type ExhibitHeroSlide = { image: string; alt: string }

export function ExhibitHero({
  slides = exhibitHero.slides,
  eyebrow = exhibitHero.eyebrow,
  title = exhibitHero.title,
  accent = exhibitHero.accent,
  text = exhibitHero.text,
  ctaHref = exhibitHero.cta.href,
  secondaryHref = '#stall-categories',
}: {
  slides?: ExhibitHeroSlide[]
  eyebrow?: string
  title?: string[]
  accent?: string
  text?: string
  ctaHref?: string
  secondaryHref?: string
}) {
  const [slide, setSlide] = useState(0)

  return (
    <section className="ex-hero">
      <div className="ex-hero-media">
        {slides.map((s, i) => (
          <SafeImage
            key={s.image}
            src={s.image}
            fallback="/media/exhibition-gallery.jpeg"
            alt={i === slide ? s.alt : ''}
            className={i === slide ? 'is-active' : ''}
            loading={i === 0 ? 'eager' : 'lazy'}
            fetchPriority={i === 0 ? 'high' : 'auto'}
          />
        ))}
      </div>
      <div className="ex-hero-copy">
        <p className="th-eyebrow">{eyebrow}</p>
        <h1>{title.map((line) => <span key={line}>{line}<br /></span>)}<em>{accent}</em></h1>
        <p className="ex-hero-text">{text}</p>
        <MagneticLink className="th-btn th-btn-lg" href={ctaHref}>{exhibitHero.cta.label} <ArrowRight size={14} /></MagneticLink>
        <Link className="th-btn-outline th-btn-lg ex-hero-secondary" href={secondaryHref}>View Stall Specs</Link>
      </div>
      {slides.length > 1 && <div className="th-dots" role="tablist" aria-label="Hero slides">
        {slides.map((s, i) => <button key={s.image} type="button" className={i === slide ? 'is-active' : ''} aria-label={`Show slide ${i + 1}`} aria-pressed={i === slide} onClick={() => setSlide(i)} />)}
      </div>}
    </section>
  )
}
