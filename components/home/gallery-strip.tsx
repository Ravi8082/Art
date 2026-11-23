'use client'

import Link from 'next/link'
import { ArrowRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SafeImage } from './safe-image'

export type GalleryCard = { id: string; image: string; alt: string }

export function GalleryStrip({ items }: { items: GalleryCard[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selectedImage, setSelectedImage] = useState<GalleryCard | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (selectedImage && !dialog.open) dialog.showModal()
    if (!selectedImage && dialog.open) dialog.close()
  }, [selectedImage])

  if (!items.length) return null

  return (
    <section className="th-section th-gallery-section" id="gallery">
      <div className="th-centered-heading"><h2>Glimpses from <em>our Exhibitions</em></h2></div>
      <div className="th-gallery-strip">
        {items.slice(0, 5).map((item) => (
          <button type="button" className="th-gallery-item" key={item.id} aria-label={`Preview: ${item.alt}`} onClick={() => setSelectedImage(item)}>
            <SafeImage src={item.image} alt={item.alt} />
          </button>
        ))}
      </div>
      <div className="th-gallery-footer">
        <Link className="th-gallery-footer-link" href="/gallery">
          View More
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <dialog
        className="th-gallery-lightbox"
        ref={dialogRef}
        aria-label="Gallery image preview"
        onCancel={() => setSelectedImage(null)}
        onClose={() => setSelectedImage(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSelectedImage(null)
        }}
      >
        {selectedImage && (
          <>
            <button type="button" className="th-gallery-lightbox-close" aria-label="Close image preview" onClick={() => setSelectedImage(null)}><X size={20} /></button>
            <SafeImage src={selectedImage.image} alt={selectedImage.alt} loading="eager" />
            <p>{selectedImage.alt}</p>
          </>
        )}
      </dialog>
    </section>
  )
}
