import { PublicShell } from '@/components/public-shell'
import { BlogHero, BlogWorkflow, ShareStoryCTA } from '@/components/blog/blog-sections'
import { BlogListing } from '@/components/blog/blog-listing'
import { getBlogPosts, getShell } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Art Blog – Stories, Tips & Art Fest News | The Haat of Art', description: 'Stories, insights and tips for artists and art lovers, plus news from The Haat of Art art fests and exhibitions.', alternates: { canonical: '/blog' } }

export default async function BlogPage() {
  const [{ shell }, posts] = await Promise.all([getShell(), getBlogPosts()])
  return (
    <PublicShell {...shell}>
      <BlogHero />
      <BlogListing posts={posts ?? []} />
      <ShareStoryCTA />
      <BlogWorkflow />
    </PublicShell>
  )
}
