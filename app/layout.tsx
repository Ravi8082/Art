import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import './home.css'
import './role-dashboard.css'
import { getShell, getSiteSettings } from '@/lib/api'
import { themeCss } from '@/lib/site-settings'
import { SiteSettingsProvider } from '@/components/site-settings-provider'
import { SiteChrome } from '@/components/site-chrome'
import { PwaRegistration } from '@/components/pwa-registration'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-jakarta', display: 'swap' })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-cormorant', display: 'swap' })

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thehaatofart.com'
const siteTitle = 'The Haat of Art | Art Fest, Art Exhibition & Artist Stalls in India'
const siteDescription = 'The Haat of Art is an Indian art fest and exhibition platform. Book artist stalls, get free visitor passes, meet artists and discover paintings, crafts and live art at art festivals in Indore, Mumbai and more.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: '%s' },
  description: siteDescription,
  applicationName: 'The Haat of Art',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'The Haat of Art',
  },
  keywords: [
    'The Haat of Art', 'Haat of Art', 'art fest', 'art festival India', 'art exhibition', 'art fair India', 'art exhibition Indore',
    'art fest Indore', 'art exhibition Mumbai', 'book art stall', 'artist stall booking', 'exhibit your art', 'art exhibition near me',
    'free visitor pass art exhibition', 'Indian contemporary art', 'handicraft exhibition', 'art and craft fest', 'artists platform India',
  ],
  openGraph: {
    type: 'website', siteName: 'The Haat of Art', title: siteTitle, description: siteDescription, locale: 'en_IN',
    images: [{ url: '/media/logo.png', alt: 'The Haat of Art' }],
  },
  twitter: { card: 'summary_large_image', title: siteTitle, description: siteDescription, images: ['/media/logo.png'] },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  icons: {
    icon: '/media/logo.png',
    shortcut: '/media/logo.png',
    apple: '/icons/apple-touch-icon.png',
  },
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
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#FAF8F5',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [settings, { shell }] = await Promise.all([getSiteSettings(), getShell()])
  return (
    <html lang="en" className={`${jakarta.variable} ${cormorant.variable}`}>
      <head><style id="site-theme" dangerouslySetInnerHTML={{ __html: themeCss(settings.theme) }} /></head>
      <body className="antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <PwaRegistration />
        <SiteSettingsProvider value={settings}>
          <SiteChrome logoUrl={shell.logoUrl} logoAlt={shell.logoAlt} footerLocations={shell.footerLocations}>{children}</SiteChrome>
        </SiteSettingsProvider>
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
