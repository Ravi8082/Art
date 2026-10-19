import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { ZodError } from 'zod'
import { authRouter } from './routes/auth.js'
import { homepageRouter } from './routes/homepage.js'
import { contentRouter } from './routes/content.js'
import { newsletterRouter } from './routes/newsletter.js'
import { eventsRouter } from './routes/events.js'
import { aboutRouter } from './routes/about.js'
import { enquiriesRouter } from './routes/enquiries.js'
import { guestsRouter } from './routes/guests.js'
import { bookingsRouter } from './routes/bookings.js'
import { dashboardRouter } from './routes/dashboard.js'
import { passesRouter } from './routes/passes.js'
import { artistProfileRouter } from './routes/artist-profile.js'
import { accountRouter } from './routes/account.js'
import { teamRouter } from './routes/team.js'
import { visitorReportRouter } from './routes/visitor-report.js'
import { siteSettingsRouter } from './routes/site-settings.js'
import { startOutboxWorker } from './services/outbox.js'

const isProduction = process.env.NODE_ENV === 'production'
const weakSecret = (value?: string) => !value || value.length < 32 || value.startsWith('replace-with') || value === 'development-cookie-secret'
if (isProduction && (weakSecret(process.env.COOKIE_SECRET) || weakSecret(process.env.JWT_SECRET))) {
  throw new Error('COOKIE_SECRET and JWT_SECRET must be set to strong random values (32+ characters) in production')
}

export const app = express()
app.disable('x-powered-by')
// Number of reverse proxies/load balancers in front of the app, so rate limits see the real client IP.
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser(process.env.COOKIE_SECRET ?? 'development-cookie-secret'))
app.get('/health', async (_req, res) => {
  try {
    const { pool } = await import('./db/pool.js')
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})
// Server-rendered pages call the API from one IP, so the global ceiling is per minute and generous; sensitive routes have their own tight limits.
app.use(rateLimit({ windowMs: 60 * 1000, limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 600), standardHeaders: true, legacyHeaders: false }))
app.use('/api/auth', authRouter)
app.use('/api/homepage', homepageRouter)
app.use('/api/content', contentRouter)
app.use('/api/newsletter', newsletterRouter)
app.use('/api/events', eventsRouter)
app.use('/api/about', aboutRouter)
app.use('/api/enquiries', enquiriesRouter)
app.use('/api/guests', guestsRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/passes', passesRouter)
app.use('/api/artist-profile', artistProfileRouter)
app.use('/api/account', accountRouter)
app.use('/api/team', teamRouter)
app.use('/api/visitor-report', visitorReportRouter)
app.use('/api/site-settings', siteSettingsRouter)
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request', issues: error.issues })
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
const server = app.listen(port, () => console.log(`Haat backend listening on ${port}`))
server.keepAliveTimeout = 65_000
server.headersTimeout = 66_000
const stopOutbox = startOutboxWorker()

const shutdown = () => {
  stopOutbox()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
