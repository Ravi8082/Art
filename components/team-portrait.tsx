'use client'

import { useState } from 'react'

export function TeamPortrait({
  src,
  alt,
  initials,
  className,
  imageClassName,
  fallbackClassName,
  minimumResolution = 400,
}: {
  src: string | null
  alt: string
  initials: string
  className: string
  imageClassName: string
  fallbackClassName: string
  minimumResolution?: number
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [invalidSrc, setInvalidSrc] = useState<string | null>(null)
  const showImage = Boolean(src && loadedSrc === src)

  return (
    <span className={className}>
      {src && invalidSrc !== src && (
        <img
          className={imageClassName}
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth < minimumResolution || image.naturalHeight < minimumResolution) {
              setInvalidSrc(src)
              return
            }
            setLoadedSrc(src)
          }}
          onError={() => setInvalidSrc(src)}
          style={{ opacity: showImage ? 1 : 0 }}
        />
      )}
      {!showImage && <span className={fallbackClassName} aria-hidden="true"><span>{initials}</span></span>}
    </span>
  )
}
