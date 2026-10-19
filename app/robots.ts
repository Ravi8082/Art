import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thehaatofart.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin-demo', '/artist/', '/login', '/password-reset', '/visitor/pass/', '/newsletter/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
