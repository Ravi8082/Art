/** @type {import('next').NextConfig} */
// Same-origin API proxy: when BACKEND_API_URL is set (e.g. the Render URL), the browser calls /api/* on the
// frontend's own origin and Next forwards it to the backend. The session cookie therefore belongs to the
// frontend host, and the backend's CSRF Origin check sees the frontend origin.
const backendUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, '')

const nextConfig = {
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // With the proxy enabled and no explicit public URL, browser code uses relative /api/... URLs.
  env: backendUrl && process.env.NEXT_PUBLIC_BACKEND_API_URL === undefined ? { NEXT_PUBLIC_BACKEND_API_URL: '' } : {},
  async rewrites() {
    return backendUrl ? [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }] : []
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
