import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thehaatofart.com'

const pages: Array<[string, number, MetadataRoute.Sitemap[number]['changeFrequency']]> = [
  ['/', 1, 'weekly'],
  ['/exhibitions', 0.9, 'weekly'],
  ['/indore', 0.9, 'weekly'],
  ['/book-your-stall', 0.9, 'weekly'],
  ['/exhibit-with-us', 0.8, 'monthly'],
  ['/highlights', 0.7, 'monthly'],
  ['/gallery', 0.7, 'weekly'],
  ['/artists', 0.7, 'weekly'],
  ['/blog', 0.7, 'weekly'],
  ['/about', 0.6, 'monthly'],
  ['/contact', 0.6, 'monthly'],
  ['/visitor/register', 0.6, 'monthly'],
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return pages.map(([path, priority, changeFrequency]) => ({ url: `${siteUrl}${path}`, lastModified, changeFrequency, priority }))
}
