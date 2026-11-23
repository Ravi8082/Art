import Link from 'next/link'
import { SafeImage } from '@/components/home/safe-image'
import { approvalFlow } from '@/lib/demo-blogs'
import { BlogSubmissionForm } from './blog-submission-form'

export function BlogHero() {
  return (
    <section className="bl-hero">
      <SafeImage src="/media/exhibition-gallery.jpeg" alt="Artwork displayed in an exhibition" />
      <div><h1>Blogs</h1><p>Stories, insights and inspiration from the world of art.</p></div>
    </section>
  )
}

export function ShareStoryCTA() {
  return (
    <section className="bl-cta">
      <div className="bl-cta-art" aria-hidden="true"><span /><i /></div>
      <div className="bl-cta-text"><h2>Share Your Art Story</h2><p>Artists, writers and art lovers can submit their blogs. Get your story featured on The Haat of Art.</p></div>
      <Link className="bl-cta-btn" href="/blog#submit">Submit Blog →</Link>
    </section>
  )
}

export function BlogWorkflow() {
  return (
    <section className="bw-wrap" id="submit">
      <div className="bw-card"><h2>Submit your story</h2>
        <p className="bw-form-intro">Anyone can share an art story. An admin will review it, and it will appear here only after approval.</p>
        <BlogSubmissionForm />
      </div>
      <div className="bw-card"><h2>Approval Flow &amp; Emails</h2>
        <ol className="bw-flow">{approvalFlow.map((s, i) => <li key={s.title}><i>{i + 1}</i><span><b>{s.title}</b><small>{s.text}</small></span></li>)}</ol>
      </div>
      <p className="bw-note">An email update is sent to the address you provide when an admin approves or rejects your submission.</p>
    </section>
  )
}
