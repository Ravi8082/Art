'use client'

import { useState } from 'react'

export function SafeImage({
  src,
  fallback = '/media/exhibition-gallery.jpeg',
  alt,
  className,
  loading = 'lazy',
  fetchPriority,
}: {
  src?: string
  fallback?: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
}) {
  const [failed, setFailed] = useState(false)
  return <img src={failed || !src ? fallback : src} alt={alt} className={className} loading={loading} fetchPriority={fetchPriority} onError={() => setFailed(true)} />
}
