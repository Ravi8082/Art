'use client'

import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MagneticLink } from '@/components/motion/magnetic-link'
import { HomepageIconView } from '@/components/home/homepage-icon'
import type { HomepageContent, HomepageHeroMedia } from '@/lib/homepage-content'

export function HeroSection({
  slides,
  title,
  accent,
  eyebrow,
  intro,
  features,
  video,
  useFallbackSlides = true,
}: {
  slides: { image: string; alt: string; caption?: string }[]
  title: string
  accent: string
  eyebrow: string
  intro: string
  features: HomepageContent['heroFeatures']
  video: HomepageHeroMedia['video']
  useFallbackSlides?: boolean
}) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [failedSlides, setFailedSlides] = useState<Record<number, boolean>>({})
  const [videoFailed, setVideoFailed] = useState(false)
  const reduceMotion = useReducedMotion()
  const fallbackImage = '/media/exhibition-gallery.jpeg'
  const gallerySlides = slides.length > 0
    ? slides
    : useFallbackSlides ? [{ image: fallbackImage, alt: 'Visitors discovering art at The Haat of Art' }] : []
  const showVideo = video.enabled && Boolean(video.url) && !videoFailed
  const titleWords = `${title} ${accent}`.trim().split(/\s+/)

  useEffect(() => {
    if (reduceMotion || showVideo || gallerySlides.length < 2) return
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % gallerySlides.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [gallerySlides.length, reduceMotion, showVideo])

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, Math.max(0, gallerySlides.length - 1)))
  }, [gallerySlides.length])

  useEffect(() => setVideoFailed(false), [video.url])

  return (
    <section className="th-hero th-hero-editorial th-hero-immersive" id="top">
      <div className={`th-hero-media${showVideo ? ' is-video-enabled' : ''}`}>
        {showVideo && <video
          className="th-hero-video"
          src={video.url}
          poster={video.posterUrl || undefined}
          autoPlay={video.autoplay}
          muted
          loop={video.loop}
          playsInline
          controls={!video.autoplay}
          onError={() => setVideoFailed(true)}
        />}
        {gallerySlides.map((slide, index) => (
          <Image
            key={`${slide.image}-${index}`}
            src={failedSlides[index] ? fallbackImage : slide.image}
            className={index === activeSlide ? 'is-active' : ''}
            alt={index === activeSlide ? slide.alt : ''}
            aria-hidden={index !== activeSlide}
            fill
            sizes="100vw"
            unoptimized
            preload={index === 0}
            loading="eager"
            fetchPriority={index === 0 ? 'high' : 'auto'}
            onError={() => {
              if (!failedSlides[index]) setFailedSlides((current) => ({ ...current, [index]: true }))
            }}
          />
        ))}
        {!showVideo && gallerySlides[activeSlide]?.caption && <p className="th-hero-caption">{gallerySlides[activeSlide].caption}</p>}
      </div>
      <div className="th-hero-overlay" aria-hidden="true" />
      <motion.div className="th-hero-copy">
        <p className="th-eyebrow">{eyebrow}</p>
        <h1 aria-label={`${title} ${accent}`}>
          {titleWords.map((word, index) => (
            <motion.span
              className="th-hero-word"
              key={`${word}-${index}`}
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: reduceMotion ? 0 : 0.08 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
            >
              {word}{index < titleWords.length - 1 ? ' ' : ''}
            </motion.span>
          ))}
        </h1>
        <p className="th-hero-text">
          {intro}
        </p>
        <div className="th-hero-actions">
          <MagneticLink className="th-btn" href="/exhibitions">Explore Exhibitions <ArrowRight size={16} /></MagneticLink>
          <MagneticLink className="th-hero-glass-btn" href="/exhibitions">Exhibit With Us</MagneticLink>
        </div>
      </motion.div>
      <div className="th-hero-trustbar" aria-label="The Haat of Art at a glance">
        {features.map((feature, index) => (
          <div key={`${feature.title}-${index}`}>
            <HomepageIconView name={feature.icon} size={16} />
            <span><strong>{feature.title}</strong><small>{feature.subtitle}</small></span>
          </div>
        ))}
      </div>
    </section>
  )
}
