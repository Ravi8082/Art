import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { apiBaseUrl, formatDate, getBlogPost, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'
import { BlogArticle } from '@/components/blog/blog-sections'
import { demoBlogs } from '@/lib/demo-blogs'

export const dynamic = 'force-dynamic'

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const demo = demoBlogs.find((b) => b.slug === id && b.published)
  if (demo) {
    const { shell } = await getShell()
    return (
      <PublicShell {...shell}>
        <BlogArticle title={demo.title} />
      </PublicShell>
    )
  }
  const [{ shell }, post] = await Promise.all([getShell(), getBlogPost(id)])
  if (!post) notFound()
  return (
    <PublicShell {...shell}>
      <article className="blog-post">
        <p className="public-kicker">{formatDate(post.publishedAt)}{post.author && ` · ${post.author}`}</p>
        <h1>{post.title}</h1>
        {post.coverUrl && <img src={`${apiBaseUrl}${post.coverUrl}`} alt="" />}
        <div className="prose">{post.body.split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        <Link className="underlined-link" href="/blog">All posts <ArrowUpRight size={14} /></Link>
      </article>
    </PublicShell>
  )
}
