import Link from 'next/link'
import { SafeImage } from '@/components/home/safe-image'
import { approvalFlow, blogDetail as d } from '@/lib/demo-blogs'
import { BlogSubmissionForm } from './blog-submission-form'

export function BlogHero() {
  return (
    <section className="bl-hero">
      <SafeImage src="/demo/ex-hero.jpg" alt="Art studio brushes (demo image)" />
      <div><h1>Blogs</h1><p>Stories, insights and inspiration from the world of art.</p></div>
    </section>
  )
}

export function ShareStoryCTA() {
  return (
    <section className="bl-cta">
      <div className="bl-cta-art" aria-hidden="true"><span /><i /></div>
      <div className="bl-cta-text"><h3>Share Your Art Story</h3><p>Artists, writers and art lovers can submit their blogs. Get your story featured on The Haat of Art.</p></div>
      <Link className="bl-cta-btn" href="/blog#submit">Submit Blog →</Link>
    </section>
  )
}

export function BlogArticle({ title }: { title: string }) {
  return (
    <section className="bd-wrap">
      <div className="bd-main">
        <nav className="bd-crumb" aria-label="Breadcrumb"><Link href="/">Home</Link> › <Link href="/blog">Blogs</Link> › <span>{title}</span></nav>
        <h1>{title}</h1>
        <div className="bd-by"><SafeImage src={d.authorImage} alt="" /><b>By {d.author}</b><span>📅 {d.date}</span><em>{d.category}</em></div>
        <div className="bd-video"><SafeImage src={d.video} alt="Artist painting (demo image)" /><button aria-label="Play video (demo)" type="button">▶</button></div>
        <div className="bd-thumbs">{d.gallery.map((g, i) => <SafeImage key={g} src={g} alt={`Gallery ${i + 1} (demo image)`} />)}<span>+{d.galleryMore}</span></div>
        {d.paragraphs.map((p) => <p className="bd-p" key={p}>{p}</p>)}
        <h2>Highlights from the Exhibition</h2>
        <p className="bd-p">{d.highlightsIntro}</p>
        <div className="bd-hl">{d.highlightImages.map((g, i) => <SafeImage key={g} src={g} alt={`Exhibition highlight ${i + 1} (demo image)`} />)}</div>
        <div className="bd-tags"><span>Tags:</span>{d.tags.map((t) => <em key={t}>{t}</em>)}<span className="bd-share">Share: <b className="fb">f</b><b className="x">x</b><b className="in">in</b><b className="wa">w</b></span></div>
        <div className="bd-nav">
          <Link href="/blog/mosaic-art-exhibition-2025"><small>‹ Previous Blog</small><b>Mosaic Art Exhibition 2025 | Timeless Craft</b></Link>
          <Link href="/blog/brushstrokes-of-bhakti"><small>Next Blog ›</small><b>Brushstrokes of Bhakti | Krishna Painting At The Haat of Art</b></Link>
        </div>
      </div>
      <aside className="bd-side">
        <h4>Related Blogs</h4>
        {d.related.map((r) => <Link key={r.slug} href={`/blog/${r.slug}`} className="bd-rel"><SafeImage src={r.image} alt="" /><span><b>{r.title}</b><small>{r.date}</small></span></Link>)}
      </aside>
    </section>
  )
}

export function BlogWorkflow() {
  return (
    <section className="bw-wrap" id="submit">
      <div className="bw-card"><h3>Submit your story</h3>
        <p className="bw-form-intro">Anyone can share an art story. An admin will review it, and it will appear here only after approval.</p>
        <BlogSubmissionForm />
      </div>
      <div className="bw-card"><h3>Approval Flow &amp; Emails</h3>
        <ol className="bw-flow">{approvalFlow.map((s, i) => <li key={s.title}><i>{i + 1}</i><span><b>{s.title}</b><small>{s.text}</small></span></li>)}</ol>
      </div>
      <p className="bw-note">An email update is sent to the address you provide when an admin approves or rejects your submission.</p>
    </section>
  )
}
