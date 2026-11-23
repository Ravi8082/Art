import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { apiBaseUrl, formatDate, getBlogPost, getShell } from '@/lib/api'
import { PublicShell } from '@/components/public-shell'
import { isPlaceholderContent } from '@/lib/content-quality'

export const revalidate = 30

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = await getBlogPost(id)
  if (!post || isPlaceholderContent(post.title, post.excerpt, post.body)) return { robots: { index: false, follow: true } }
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${encodeURIComponent(id)}` },
    openGraph: { type: 'article', title: post.title, description: post.excerpt, url: `/blog/${encodeURIComponent(id)}` },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ shell }, post] = await Promise.all([getShell(), getBlogPost(id)])
  if (!post || isPlaceholderContent(post.title, post.excerpt, post.body)) notFound()
  return (
    <PublicShell {...shell}>
      <article className="blog-post">
        <p className="public-kicker">{formatDate(post.publishedAt)}{post.author && ` · ${post.author}`}</p>
        <h1>{post.title}</h1>
        {post.coverUrl && <img src={`${apiBaseUrl}${post.coverUrl}`} alt="" />}
        <div className="prose">{post.body.split(/\n+/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        {post.media && post.media.some((item) => item.url !== post.coverUrl) && (
          <div className="blog-media">
            {post.media.filter((item) => item.url !== post.coverUrl).map((item) => item.mediaType === 'VIDEO'
              ? <video key={item.id} src={`${apiBaseUrl}${item.url}`} controls preload="metadata" playsInline />
              : <img key={item.id} src={`${apiBaseUrl}${item.url}`} alt={post.title} loading="lazy" />)}
          </div>
        )}
        <Link className="underlined-link" href="/blog">All posts <ArrowUpRight size={14} /></Link>
      </article>
    </PublicShell>
  )
}
