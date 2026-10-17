'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Users, Building2, Eye, Palette } from 'lucide-react'
import { demoHero } from '@/lib/demo-home-content'
import { SafeImage } from './safe-image'

const icons = { users: Users, map: Building2, eye: Eye, palette: Palette }

export function HeroSection({ slides }: { slides: { src: string; alt: string }[] }) {
  const list = slides.length ? slides : demoHero.slides
  const [slide, setSlide] = useState(0)
  useEffect(() => {
    if (list.length < 2) return
    const timer = setInterval(() => setSlide((i) => (i + 1) % list.length), 6000)
    return () => clearInterval(timer)
  }, [list.length])
  const go = (step: number) => setSlide((i) => (i + step + list.length) % list.length)

  return (
    <section className="th-hero" id="top">
      <i className="th-brush" aria-hidden />
      <div className="th-hero-media">
        {list.map((s, i) => <SafeImage key={s.src} src={s.src} alt={s.alt} className={i === slide ? 'is-active' : ''} fallback="/media/hero-exhibition.jpg" />)}
      </div>
      <div className="th-hero-copy">
        <p className="th-eyebrow">India&apos;s Biggest<br />Art Exhibition</p>
        <h1>{demoHero.title}<br /><span>of</span> <em>{demoHero.accent}</em></h1>
        <p className="th-hero-text">{demoHero.text}</p>
        <div className="th-hero-actions">
          <Link className="th-btn" href={demoHero.primaryCta.href}>{demoHero.primaryCta.label} <ArrowRight size={14} /></Link>
          <Link className="th-btn-outline th-btn-lg" href={demoHero.secondaryCta.href}>{demoHero.secondaryCta.label}</Link>
        </div>
        <div className="th-chips">
          {demoHero.stats.map((s) => {
            const Icon = icons[s.icon as keyof typeof icons]
            return <div key={s.label}><Icon size={20} /><span><strong>{s.value}</strong><small>{s.label}</small></span></div>
          })}
        </div>
      </div>
      <div className="th-hero-badge"><span>Art<br />Connects<br />People</span></div>
      <button className="th-arrow th-arrow-l" onClick={() => go(-1)} aria-label="Previous slide"><ChevronLeft size={18} /></button>
      <button className="th-arrow th-arrow-r" onClick={() => go(1)} aria-label="Next slide"><ChevronRight size={18} /></button>
      <div className="th-dots">{list.map((s, i) => <button key={s.src} className={i === slide ? 'is-active' : ''} onClick={() => setSlide(i)} aria-label={`Slide ${i + 1}`} />)}</div>
    </section>
  )
}
