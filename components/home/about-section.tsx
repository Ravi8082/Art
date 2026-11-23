import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function AboutSection({
  image,
  alt,
  videoUrl,
  title,
  accent,
  text,
}: {
  image?: string
  alt: string
  videoUrl?: string | null
  title: string
  accent: string
  text: string
}) {
  return (
    <section className="th-about th-about-editorial">
      <div className="th-about-video">
        {videoUrl
          ? <video src={videoUrl} poster={image || '/media/exhibition-gallery.jpeg'} controls playsInline preload="none" aria-label="The Haat of Art introduction video" />
          : <img src={image || '/media/exhibition-gallery.jpeg'} alt={alt} loading="lazy" />}
      </div>
      <div className="th-about-panel">
        <h2>{title} <em>{accent}</em></h2>
        <p>{text}</p>
        <Link className="th-btn-white" href="/about">Know More About Us <ArrowRight size={16} /></Link>
      </div>
    </section>
  )
}
