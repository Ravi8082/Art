import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HomepageContent } from '@/lib/homepage-content'
import { SafeImage } from './safe-image'

const categoryImages = [
  '/media/visual-art.jpeg',
  '/media/exhibition-gallery.jpeg',
  '/media/sculpture.jpeg',
  '/media/live-mural.jpeg',
  '/media/artifacts.jpeg',
  '/media/ceramics.jpg',
]

const categoryNotes = [
  'Discover original paintings, sculpture and contemporary ideas shaped by artists across India.',
  'Step into a considered exhibition of distinctive voices, materials and perspectives.',
  'Meet the educators and institutions nurturing the next generation of creative practice.',
  'Explore the studios where experimentation, craft and new bodies of work take shape.',
  'Encounter objects and artifacts that carry the memory of place, tradition and making.',
  'Experience an inclusive art community where every artist and point of view belongs.',
]

export function FeatureGrid({ items }: { items: HomepageContent['categories'] }) {
  if (!items.length) return null

  return (
    <section className="th-section th-feature-section home-flow-section">
      <h2 className="th-category-title"><span>Explore</span><strong>Art Spaces</strong></h2>
      <div className="th-space-cards">
        {items.slice(0, 6).map(({ title, href }, index) => (
          <article className="th-space-item" key={title}>
            <div className="th-space-visual">
              <SafeImage
                src={categoryImages[index]}
                alt={`${title} at The Haat of Art`}
              />
              <span className="th-space-badge">{String(index + 1).padStart(2, '0')} · ART SPACE</span>
            </div>
            <div className="th-space-body">
              <h3>{title}</h3>
              <p>{categoryNotes[index] ?? 'Explore the people, places and ideas at the heart of The Haat of Art.'}</p>
              <Link href={href} className="th-space-link">
                Explore Space <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
