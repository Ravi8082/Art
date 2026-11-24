import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import { authRouter } from './routes/auth.js'
import { homepageRouter } from './routes/homepage.js'
import { contentRouter } from './routes/content.js'
import { newsletterRouter } from './routes/newsletter.js'
import { eventsRouter } from './routes/events.js'
import { aboutRouter, adminAboutRouter } from './routes/about.js'
import { enquiriesRouter } from './routes/enquiries.js'
import { guestsRouter } from './routes/guests.js'
import { adminInvitedGuestsRouter, invitedGuestsRouter } from './routes/invited-guests.js'
import { adminEventFlowRouter, eventFlowRouter } from './routes/event-flow.js'
import { bookingsRouter } from './routes/bookings.js'
import { dashboardRouter } from './routes/dashboard.js'
import { passesRouter } from './routes/passes.js'
import { artistProfileRouter } from './routes/artist-profile.js'
import { artistDirectoryRouter } from './routes/artist-directory.js'
import { exhibitionArchiveRouter } from './routes/exhibition-archive.js'
import { accountRouter } from './routes/account.js'
import { teamRouter } from './routes/team.js'
import { visitorReportRouter } from './routes/visitor-report.js'
import { contactSettingsRouter, highlightsRouter, siteSettingsRouter } from './routes/site-settings.js'
import { exhibitionsRouter, visitorPassesRouter } from './routes/visitor-passes.js'
import { conciergeRouter } from './routes/concierge.js'
import { adminMediaPartnersRouter, mediaPartnersRouter } from './routes/media-partners.js'
import { analyticsRouter } from './routes/analytics.js'
import { startOutboxWorker } from './services/outbox.js'
import { startAnalyticsRetentionCleanup } from './services/analytics-retention.js'
import createRateLimit, { closeRateLimitStore, connectRateLimitStore, ipKeyGenerator } from './services/rate-limit.js'

const isProduction = process.env.NODE_ENV === 'production'
const placeholderSecret = (value?: string) => {
  const normalized = value?.trim().toLowerCase()
  return !normalized || normalized.length < 32 || ['change_me', 'changeme', 'xxxx', 'test'].includes(normalized) || normalized.startsWith('replace-with') || normalized.startsWith('your-')
}
if (isProduction) {
  const invalidSecrets = ['COOKIE_SECRET', 'JWT_SECRET'].filter((key) => placeholderSecret(process.env[key]))
  if (invalidSecrets.length) {
    throw new Error(`Production secret(s) must be strong random values (32+ characters): ${invalidSecrets.join(', ')}`)
  }
  if (process.env.COOKIE_SECRET === process.env.JWT_SECRET) {
    throw new Error('COOKIE_SECRET and JWT_SECRET must be different values in production')
  }
  const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim()
  if (!frontendOrigin) throw new Error('FRONTEND_ORIGIN must be explicitly configured in production')
  let parsedFrontendOrigin: URL
  try { parsedFrontendOrigin = new URL(frontendOrigin) }
  catch { throw new Error('FRONTEND_ORIGIN must be a valid HTTPS origin in production') }
  if (parsedFrontendOrigin.protocol !== 'https:' || parsedFrontendOrigin.origin !== frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN must be an HTTPS origin without a path or trailing slash')
  }
  const trustProxyHops = Number(process.env.TRUST_PROXY)
  if (!/^\d+$/.test(process.env.TRUST_PROXY ?? '') || !Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 10) {
    throw new Error('TRUST_PROXY must be the configured numeric proxy hop count in production')
  }
}

export const app = express()
app.disable('x-powered-by')
// Number of reverse proxies/load balancers in front of the app, so rate limits see the real client IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY)
// SECURITY: Helmet sets browser security headers; DENY prevents clickjacking and CORP permits public media from the frontend origin.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  noSniff: true,
}))
// SECURITY: Production requires one exact HTTPS frontend origin; never enable credentialed wildcard CORS.
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000', credentials: true, maxAge: 86_400 }))
// CSRF defence in depth on top of SameSite cookies: browsers always send Origin on cross-site writes, so reject any that is not our frontend.
const allowedOrigin = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').replace(/\/$/, '')
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (origin && origin.replace(/\/$/, '') !== allowedOrigin) return res.status(403).json({ error: 'Cross-origin request blocked' })
  next()
})
// SECURITY: Bound JSON parsing to limit memory/CPU exhaustion from oversized request bodies.
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser(process.env.COOKIE_SECRET ?? 'development-cookie-secret'))
function rateLimitUserId(req: express.Request) {
  const token = req.signedCookies?.session
  if (typeof token !== 'string') return undefined
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? '', { algorithms: ['HS256'] })
    return typeof payload === 'object' && typeof payload.sub === 'string' && !('purpose' in payload)
      ? payload.sub
      : undefined
  } catch {
    return undefined
  }
}
app.get('/health', async (_req, res) => {
  try {
    const { pool } = await import('./db/pool.js')
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})
// SECURITY: Read-only page data fans out server-side, so allow higher read caps while keeping writes strict; identity remains normalized IP or verified JWT subject.
app.use('/api', createRateLimit({
  windowMs: 60 * 1000,
  limit: (req) => {
    const authenticated = Boolean(rateLimitUserId(req))
    const readOnly = ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    if (readOnly) return authenticated ? 300 : 120
    return authenticated ? 100 : 20
  },
  keyGenerator: (req) => {
    const userId = rateLimitUserId(req)
    return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? '0.0.0.0')}`
  },
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
}))
app.use('/api/auth', authRouter)
app.use('/api/homepage', homepageRouter)
app.use('/api/content', contentRouter)
app.use('/api/newsletter', newsletterRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/events', eventsRouter)
app.use('/api/about', aboutRouter)
app.use('/api/admin/about', adminAboutRouter)
app.use('/api/enquiries', enquiriesRouter)
app.use('/api/guests', guestsRouter)
app.use('/api/invited-guests', invitedGuestsRouter)
app.use('/api/admin/invited-guests', adminInvitedGuestsRouter)
app.use('/api/event-flow', eventFlowRouter)
app.use('/api/admin/event-flow', adminEventFlowRouter)
app.use('/api/media-partners', mediaPartnersRouter)
app.use('/api/admin/media-partners', adminMediaPartnersRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/passes', passesRouter)
app.use('/api/artist-profile', artistProfileRouter)
app.use('/api/artists', artistDirectoryRouter)
app.use('/api/exhibition-archive', exhibitionArchiveRouter)
app.use('/api/account', accountRouter)
app.use('/api/team', teamRouter)
app.use('/api/visitor-report', visitorReportRouter)
app.use('/api/site-settings', siteSettingsRouter)
app.use('/api/settings/contact', contactSettingsRouter)
app.use('/api/highlights', highlightsRouter)
app.use('/api/exhibitions', exhibitionsRouter)
app.use('/api/contact', enquiriesRouter)
app.use('/api/visitor-passes', visitorPassesRouter)
app.use('/api/concierge', conciergeRouter)
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request' })
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' })
  }
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : 'Request failed'
    return res.status(error.status).json({ error: message })
  }
  console.error('[backend]', error instanceof Error ? error.message : 'unknown error')
  return res.status(500).json({ error: 'Internal server error' })
})

const port = Number(process.env.PORT ?? 4000)
async function startBackend() {
  await connectRateLimitStore()
  const server = app.listen(port, () => console.log(`Haat backend listening on ${port}`))
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
  const stopOutbox = startOutboxWorker()
  const stopAnalyticsRetention = startAnalyticsRetentionCleanup()

  const shutdown = () => {
    stopOutbox()
    stopAnalyticsRetention()
    server.close(() => {
      void closeRateLimitStore().then(() => process.exit(0)).catch(() => {
        console.error('[backend] Rate-limit Redis shutdown failed')
        process.exit(1)
      })
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void startBackend().catch((error: unknown) => {
  console.error('[backend] Startup failed', error instanceof Error ? error.message : 'unknown error')
  process.exit(1)
})
