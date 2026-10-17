import { PublicShell } from '@/components/public-shell'
import { BlogHero, BlogWorkflow, ShareStoryCTA } from '@/components/blog/blog-sections'
import { BlogListing } from '@/components/blog/blog-listing'
import { getBlogPosts, getShell } from '@/lib/api'
import { BLOG_DEMO_NOTE } from '@/lib/demo-blogs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Blogs · The Haat of Art' }

export default async function BlogPage() {
  const [{ shell }, posts] = await Promise.all([getShell(), getBlogPosts()])
  return (
    <PublicShell {...shell}>
      <BlogHero />
      <BlogListing posts={posts ?? []} />
      <ShareStoryCTA />
      <BlogWorkflow />
      <p className="th-demo-note">{BLOG_DEMO_NOTE}</p>
    </PublicShell>
  )
}
