'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { SafeImage } from '@/components/home/safe-image'
import { apiBaseUrl, formatDate, type BlogSummary } from '@/lib/api'
import { blogCategories, demoBlogs } from '@/lib/demo-blogs'

const PAGE_SIZE = 9

type BlogCard = {
  slug: string
  title: string
  excerpt: string
  image: string
  category: string
  tag: string
  author: string
  authorImage: string
  date: string
}

export function BlogListing({ posts }: { posts: BlogSummary[] }) {
  const [cat, setCat] = useState<string>('All')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const items = useMemo<BlogCard[]>(() => [
    ...posts.map((post) => ({
      slug: post.id,
      title: post.title,
      excerpt: post.excerpt,
      image: post.coverUrl ? `${apiBaseUrl}${post.coverUrl}` : '/demo/blog1.jpg',
      category: 'Community Stories',
      tag: 'Community Stories',
      author: post.author,
      authorImage: '/demo/artist1.jpg',
      date: formatDate(post.publishedAt),
    })),
    ...demoBlogs.filter((blog) => blog.published).sort((a, b) => a.order - b.order),
  ]
    .filter((b) => (cat === 'All' || b.category === cat) && (!q.trim() || (b.title + b.excerpt).toLowerCase().includes(q.trim().toLowerCase()))), [cat, posts, q])
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
      {shown.length === 0 ? <p className="events-message">No blogs match your search.</p> : (
        <div className="bl-grid">
          {shown.map((b) => (
            <article className="bl-card" key={b.slug}>
              <Link href={`/blog/${b.slug}`} className="bl-img"><SafeImage src={b.image} alt={b.image.startsWith('/demo/') ? `${b.title} (demo image)` : `${b.title} cover`} /><span>{b.tag}</span></Link>
              <div className="bl-body">
                <h3><Link href={`/blog/${b.slug}`}>{b.title}</Link></h3>
                <p>{b.excerpt}</p>
                <div className="bl-meta">
                  <span className="bl-author"><SafeImage src={b.authorImage} alt="" /><span><b>{b.author}</b><small>{b.date}</small></span></span>
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
