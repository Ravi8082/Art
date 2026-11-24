'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { PublicShell } from '@/components/public-shell'

export function SiteChrome({
  children,
  logoUrl,
  logoAlt,
  footerLocations,
}: {
  children: ReactNode
  logoUrl?: string
  logoAlt?: string
  footerLocations?: string
}) {
  const pathname = usePathname()
  const homepage = pathname === '/' || pathname === '/about'
  const homepageChromePaths = ['/exhibitions', '/book-your-stall', '/highlights', '/indore', '/visitor/register', '/visitor/pass', '/gallery', '/artists', '/blog', '/contact', '/login', '/password-reset', '/artist/register', '/artist/verify', '/privacy-policy', '/terms-and-conditions']
  const homeChrome = homepage || homepageChromePaths.some((route) => pathname === route || pathname.startsWith(`${route}/`))

  return (
    <PublicShell
      logoUrl={logoUrl}
      logoAlt={logoAlt}
      footerLocations={footerLocations || 'Mumbai · New Delhi · Online'}
      homepage={homepage}
      homeChrome={homeChrome}
      footerVariant={pathname === '/highlights' ? 'highlights' : 'default'}
    >
      {children}
    </PublicShell>
  )
}
