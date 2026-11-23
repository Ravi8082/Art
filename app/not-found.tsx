import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { PublicShell } from '@/components/public-shell'

export const metadata: Metadata = {
  title: 'Page not found · The Haat of Art',
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return (
    <PublicShell>
      <section className="not-found-page">
        <p className="public-kicker">404 · Lost in the gallery?</p>
        <h1>This page isn&apos;t on display.</h1>
        <p>The link may have changed, or the page may have been moved. Let&apos;s get you back to the art.</p>
        <div>
          <Link className="th-btn-outline" href="/"><ArrowLeft size={16} /> Back home</Link>
          <Link className="underlined-link" href="/exhibitions">Explore exhibitions <ArrowRight size={16} /></Link>
        </div>
      </section>
    </PublicShell>
  )
}
