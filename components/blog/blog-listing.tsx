'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { formatDate, type BlogSummary } from '@/lib/api'
import { isPlaceholderContent } from '@/lib/content-quality'

const PAGE_SIZE = 9
// Public base only: server and browser must render identical URLs (empty = same-origin proxy).
const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

type BlogCard = {
  slug: string
  title: string
  excerpt: string
  image: string | null
  category: string
  tag: string
  author: string
  date: string
}

export function BlogListing({ posts }: { posts: BlogSummary[] }) {
  const [cat, setCat] = useState<string>('All')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const blogCategories = ['All', 'Stories']
  const hasPublishedStories = posts.some((post) => !isPlaceholderContent(post.title, post.excerpt, post.author))
  const items = useMemo<BlogCard[]>(() => [
    ...posts.map((post) => ({
      slug: post.id,
      title: post.title,
      excerpt: post.excerpt,
      image: post.coverUrl ? `${apiBaseUrl}${post.coverUrl}` : null,
      category: 'Stories',
      tag: 'Story',
      author: post.author?.trim() || '',
      date: post.publishedAt ? formatDate(post.publishedAt) : '',
    })),
  ].filter((b) =>
    !isPlaceholderContent(b.title, b.excerpt, b.author)
    && (cat === 'All' || b.category === cat)
    && (!q.trim() || (b.title + b.excerpt).toLowerCase().includes(q.trim().toLowerCase()))), [cat, posts, q])
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  return (
    <section className="bl-wrap">
      <div className="bl-filters">
        <div className="bl-pills">
          {blogCategories.map((c) => <button key={c} className={c === cat ? 'is-active' : ''} onClick={() => { setCat(c); setPage(1) }}>{c}</button>)}
        </div>
        <label className="bl-search"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search blogs..." aria-label="Search blogs" /><Search size={15} /></label>
      </div>
      {shown.length === 0 ? <p className="events-message">{hasPublishedStories ? 'No stories match your search.' : 'No stories have been published yet.'}</p> : (
        <div className="bl-grid">
          {shown.map((b) => (
            <article className="bl-card" key={b.slug}>
              <Link href={`/blog/${b.slug}`} className="bl-img" aria-label={`Read ${b.title}`}>
                {b.image ? <SafeImage src={b.image} alt={`${b.title} cover`} /> : <div className="bl-img-empty" aria-hidden="true" />}
                <span>{b.tag}</span>
              </Link>
              <div className="bl-body">
                <h3><Link href={`/blog/${b.slug}`}>{b.title}</Link></h3>
                <p>{b.excerpt}</p>
                <div className="bl-meta">
                  <span className="bl-author">{b.author && <span className="bl-author-fallback" aria-hidden="true">{b.author.charAt(0).toUpperCase()}</span>}<span>{b.author && <b>{b.author}</b>}{b.date && <small>{b.date}</small>}</span></span>
                  <Link href={`/blog/${b.slug}`} className="bl-more">Read More →</Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {pages > 1 && <div className="bl-pages">{Array.from({ length: pages }, (_, i) => <button key={i} className={i + 1 === current ? 'is-active' : ''} onClick={() => setPage(i + 1)} aria-label={`Page ${i + 1}`}>{i + 1}</button>)}</div>}
    </section>
  )
}
