'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { exhibitHero } from '@/lib/demo-exhibit'

export function ExhibitHero() {
  const slides = exhibitHero.slides
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setSlide((i) => (i + 1) % slides.length), 6000)
    return () => clearInterval(timer)
  }, [slides.length])

  return (
    <section className="ex-hero">
      <div className="ex-hero-media">
        {slides.map((s, i) => <SafeImage key={s.image} src={s.image} alt={s.alt} className={i === slide ? 'is-active' : ''} />)}
      </div>
      <div className="ex-hero-copy">
        <p className="th-eyebrow">{exhibitHero.eyebrow}</p>
        <h1>{exhibitHero.title.map((l) => <span key={l}>{l}<br /></span>)}<em>{exhibitHero.accent}</em></h1>
        <p className="ex-hero-text">{exhibitHero.text}</p>
        <Link className="th-btn th-btn-lg" href={exhibitHero.cta.href}>{exhibitHero.cta.label} <ArrowRight size={14} /></Link>
      </div>
      <div className="th-dots" role="tablist" aria-label="Hero slides">
        {slides.map((s, i) => <button key={s.image} className={i === slide ? 'is-active' : ''} aria-label={`Show slide ${i + 1}`} onClick={() => setSlide(i)} />)}
      </div>
    </section>
  )
}
