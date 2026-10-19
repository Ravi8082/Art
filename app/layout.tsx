import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Poppins, Playfair_Display } from 'next/font/google'
import './globals.css'
import './home.css'
import './role-dashboard.css'
import { getSiteSettings } from '@/lib/api'
import { themeCss } from '@/lib/site-settings'
import { SiteSettingsProvider } from '@/components/site-settings-provider'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins', display: 'swap' })
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'], style: ['normal', 'italic'], variable: '--font-playfair', display: 'swap' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thehaatofart.com'
const siteTitle = 'The Haat of Art | Art Fest, Art Exhibition & Artist Stalls in India'
const siteDescription = 'The Haat of Art is an Indian art fest and exhibition platform. Book artist stalls, get free visitor passes, meet artists and discover paintings, crafts and live art at art festivals in Indore, Mumbai and more.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: '%s' },
  description: siteDescription,
  applicationName: 'The Haat of Art',
  keywords: [
    'The Haat of Art', 'Haat of Art', 'art fest', 'art festival India', 'art exhibition', 'art fair India', 'art exhibition Indore',
    'art fest Indore', 'art exhibition Mumbai', 'book art stall', 'artist stall booking', 'exhibit your art', 'art exhibition near me',
    'free visitor pass art exhibition', 'Indian contemporary art', 'handicraft exhibition', 'art and craft fest', 'artists platform India',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website', siteName: 'The Haat of Art', url: '/', title: siteTitle, description: siteDescription, locale: 'en_IN',
    images: [{ url: '/media/logo.png', alt: 'The Haat of Art' }],
  },
  twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription, images: ['/media/logo.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: { icon: '/media/logo.png', shortcut: '/media/logo.png', apple: '/media/logo.png' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization', '@id': `${siteUrl}/#org`, name: 'The Haat of Art', alternateName: 'Haat of Art', url: siteUrl,
      logo: `${siteUrl}/media/logo.png`, email: 'contact@thehaatofart.com',
      address: { '@type': 'PostalAddress', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', addressCountry: 'IN' },
    },
    { '@type': 'WebSite', '@id': `${siteUrl}/#site`, url: siteUrl, name: 'The Haat of Art', inLanguage: 'en-IN', publisher: { '@id': `${siteUrl}/#org` } },
  ],
}
export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fff9f2',
  userScalable: false,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await getSiteSettings()
  return (
    <html lang="en" className={`${poppins.variable} ${playfair.variable}`}>
      <head><style id="site-theme" dangerouslySetInnerHTML={{ __html: themeCss(settings.theme) }} /></head>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <SiteSettingsProvider value={settings}>{children}</SiteSettingsProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
