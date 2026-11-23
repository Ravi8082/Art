import type { MetadataRoute } from 'next'
import { getBlogPosts, getContent } from '@/lib/api'
import { getPublicArtists } from '@/lib/booking-server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thehaatofart.com'

export const revalidate = 60

const pages: Array<[string, number, MetadataRoute.Sitemap[number]['changeFrequency']]> = [
  ['/', 1, 'weekly'],
  ['/exhibitions', 0.9, 'weekly'],
  ['/exhibitions/events', 0.9, 'weekly'],
  ['/indore', 0.9, 'weekly'],
  ['/book-your-stall', 0.9, 'weekly'],
  ['/exhibit-with-us', 0.8, 'monthly'],
  ['/artist', 0.8, 'monthly'],
  ['/highlights', 0.7, 'monthly'],
  ['/gallery', 0.7, 'weekly'],
  ['/artists', 0.7, 'weekly'],
  ['/blog', 0.7, 'weekly'],
  ['/about', 0.6, 'monthly'],
  ['/contact', 0.6, 'monthly'],
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, content, publicArtists] = await Promise.all([getBlogPosts(), getContent(), getPublicArtists()])
  const staticPages = pages.map(([path, priority, changeFrequency]) => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  }))
  const blogPages = (posts ?? []).map((post) => {
    const publishedAt = new Date(post.publishedAt)
    return {
      url: `${siteUrl}/blog/${encodeURIComponent(post.id)}`,
      ...(Number.isNaN(publishedAt.getTime()) ? {} : { lastModified: publishedAt }),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }
  })
  const artistPages = content.artists.map((artist) => ({
    url: `${siteUrl}/artists/${encodeURIComponent(artist.id)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))
  const publicArtistPages = publicArtists.map((artist) => ({
    url: `${siteUrl}/artists/u/${encodeURIComponent(artist.userId)}`,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }))

  return [...staticPages, ...blogPages, ...artistPages, ...publicArtistPages]
}
