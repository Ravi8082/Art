'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Play, MapPin, Trophy, Star, Users, Heart } from 'lucide-react'
import { demoAbout } from '@/lib/demo-home-content'
import { SafeImage } from './safe-image'

const icons = { trophy: Trophy, star: Star, users: Users, heart: Heart }

export function AboutSection({ image, alt, videoUrl }: { image?: string; alt?: string; videoUrl?: string | null }) {
  const [playing, setPlaying] = useState(false)
  return (
    <section className="th-about">
      <div className="th-about-video">
        {playing && videoUrl
          ? <video src={videoUrl} controls autoPlay playsInline />
          : <>
            <SafeImage src={image ?? demoAbout.image} alt={alt ?? demoAbout.caption} fallback={demoAbout.image} />
            <button className="th-play" onClick={() => videoUrl && setPlaying(true)} aria-label={videoUrl ? 'Play video' : 'Demo video not uploaded yet'} title={videoUrl ? 'Play video' : 'Demo: video not uploaded yet'}><Play size={22} fill="currentColor" /></button>
            <div className="th-about-caption"><span><MapPin size={13} /> {demoAbout.caption}</span><span>{demoAbout.duration}</span></div>
          </>}
      </div>
      <div className="th-about-panel">
        <div>
          <h2>{demoAbout.title}<br /><em>{demoAbout.accent}</em></h2>
          <p>{demoAbout.text}</p>
          <Link className="th-btn-white" href={demoAbout.cta.href}>{demoAbout.cta.label} <ArrowRight size={14} /></Link>
        </div>
        <ul>
          {demoAbout.stats.map((s) => {
            const Icon = icons[s.icon as keyof typeof icons]
            return <li key={s.label}><span><Icon size={18} /></span><div><strong>{s.value}</strong><small>{s.label}</small></div></li>
          })}
        </ul>
      </div>
    </section>
  )
}
