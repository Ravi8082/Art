import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  // SECURITY: A fresh 128-bit nonce allows only the trusted inline scripts emitted for this request.
  const nonce = randomBytes(16).toString('base64')
  const isDevelopment = process.env.NODE_ENV === 'development'
  const apiOrigins = [
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim(),
    process.env.BACKEND_API_URL?.trim(),
  ].filter((value): value is string => Boolean(value))
  const allowedApiOrigins = apiOrigins.length
    ? [...new Set(apiOrigins.map((value) => new URL(value).origin))]
    : ['http://localhost:4000']
  // SECURITY: Next DevTools injects style blocks only during development; production remains nonce-only.
  const stylePolicy = isDevelopment
    ? "style-src 'self' 'unsafe-inline'"
    : `style-src 'self' 'nonce-${nonce}'`
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    stylePolicy,
    // SECURITY: Existing React components use style attributes; keep this exception scoped to CSS, never scripts.
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${allowedApiOrigins.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${allowedApiOrigins.join(' ')}`,
    `media-src 'self' data: blob: ${allowedApiOrigins.join(' ')}`,
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')

  // SECURITY: Forward the policy and nonce to both Next rendering and the browser for nonce-aware script output and enforcement.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
