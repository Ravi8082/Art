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

export const app = express()
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser(process.env.COOKIE_SECRET ?? 'development-cookie-secret'))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }))
app.get('/health', async (_req, res) => {
  try {
    const { pool } = await import('./db/pool.js')
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'ok' })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' })
  }
})
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
app.listen(port, () => console.log(`Haat backend listening on ${port}`))
