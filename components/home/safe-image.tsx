'use client'

import { useState } from 'react'

export function SafeImage({ src, fallback = '/media/exhibition-gallery.jpeg', alt, className }: { src?: string; fallback?: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return <img src={failed || !src ? fallback : src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />
}
