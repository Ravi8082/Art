import { PublicShell } from '@/components/public-shell'

export default function AboutLoading() {
  return (
    <PublicShell homepage>
      <main className="about-ref about-ref-skeleton" aria-label="Loading About page" aria-busy="true">
        <section className="about-ref-hero">
          <div className="about-ref-hero-copy">
            <span className="about-skeleton about-skeleton-kicker" />
            <span className="about-skeleton about-skeleton-title" />
            <span className="about-skeleton about-skeleton-copy" />
          </div>
        </section>
        <section className="about-ref-story">
          <span className="about-skeleton about-skeleton-image" />
          <div className="about-skeleton-story-copy">
            <span className="about-skeleton about-skeleton-kicker" />
            <span className="about-skeleton about-skeleton-title" />
            <span className="about-skeleton about-skeleton-copy" />
            <span className="about-skeleton about-skeleton-copy" />
          </div>
        </section>
        <section className="about-ref-impact">
          {Array.from({ length: 5 }, (_, index) => <span className="about-skeleton about-skeleton-metric" key={index} />)}
        </section>
      </main>
    </PublicShell>
  )
}
