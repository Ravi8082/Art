import Link from 'next/link'
import { demoBlogs } from '@/lib/demo-home-content'
import { SafeImage } from './safe-image'
import { SectionHeading } from './section-heading'

export type BlogCard = { id: string; title: string; image?: string; date?: string; readTime?: string; href: string }

function fmt(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export function BlogSection({ items }: { items: BlogCard[] }) {
  const posts = items.length ? items : demoBlogs.map((b) => ({ ...b, href: '/blog' }))
  return (
    <div className="th-spot-main">
      <SectionHeading before="In the" accent="Spotlight" subtitle="Stories, insights and inspiration from the world of art." cta={{ label: 'View All Blogs', href: '/blog' }} />
      <div className="th-blogs">
        {posts.slice(0, 3).map((post, i) => (
          <Link className="th-blog" href={post.href} key={post.id}>
            <SafeImage src={post.image} alt={post.title} fallback={demoBlogs[i % 3].image} />
            <div>
              <b>{post.title}</b>
              <small>{fmt(post.date)}{post.readTime ? ` • ${post.readTime}` : ''}</small>
              <span>Read More →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
