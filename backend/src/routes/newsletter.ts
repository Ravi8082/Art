import crypto from 'node:crypto'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { Router } from 'express'
import { pool } from '../db/pool.js'
import { queueEmail, secureToken, hashToken } from '../services/mailer.js'
import { enqueueSubscribers, enqueueConsentedVisitors } from '../services/outbox.js'

export const newsletterRouter = Router()

const subscribeLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const publicUrl = (path: string) => new URL(path, process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').toString()

async function createUnsubscribeToken(subscriberId: string) {
  const token = secureToken()
  await pool.query(
    'INSERT INTO newsletter_unsubscribe_tokens(token_hash,subscriber_id) VALUES (?,?)',
    [hashToken(token), subscriberId],
  )
  return token
}

newsletterRouter.post('/subscribe', subscribeLimit, async (req, res, next) => {
  try {
    const input = z.object({ email: z.string().trim().toLowerCase().email().max(255) }).strict().parse(req.body)
    const id = crypto.randomUUID()
    await pool.query(
      `INSERT INTO newsletter_subscribers(id,email)
       VALUES (?,?)
       ON DUPLICATE KEY UPDATE
         subscribed_at=IF(unsubscribed_at IS NULL,subscribed_at,NOW()),
         unsubscribed_at=NULL`,
      [id, input.email],
    )
    const [subscribers] = await pool.query<any[]>('SELECT id FROM newsletter_subscribers WHERE email=?', [input.email])
    const token = await createUnsubscribeToken(subscribers[0].id)
    const unsubscribeUrl = publicUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)
    let mailState: 'sent' | 'not_configured' | 'failed' = 'failed'
    try {
      const mail = await queueEmail(
        input.email,
        'Thanks for subscribing — The Haat of Art',
        `Thank you for subscribing to The Haat of Art newsletter. We’ll email you when new art stories and updates are published.\n\nTo unsubscribe at any time, visit: ${unsubscribeUrl}`,
      )
      mailState = mail.delivered ? 'sent' : mail.reason === 'SMTP not configured' ? 'not_configured' : 'failed'
    } catch (error) {
      console.error('Newsletter confirmation email failed', { email: input.email, error })
    }
    res.status(201).json({
      ok: true,
      message: 'Thank you for subscribing! We’ll email you when there are new updates.',
      confirmationEmail: mailState,
    })
  } catch (error) {
    next(error)
  }
})

newsletterRouter.post('/unsubscribe', async (req, res, next) => {
  try {
    const input = z.object({ token: z.string().min(20).max(200) }).safeParse(req.body)
    if (!input.success) return res.status(400).type('text/plain').send('Invalid unsubscribe link.')
    const [result] = await pool.query<any>(
      `UPDATE newsletter_subscribers s
       JOIN newsletter_unsubscribe_tokens t ON t.subscriber_id=s.id
       SET s.unsubscribed_at=NOW(),t.used_at=NOW()
       WHERE t.token_hash=? AND t.used_at IS NULL AND s.unsubscribed_at IS NULL`,
      [hashToken(input.data.token)],
    )
    res.status(result.affectedRows ? 200 : 404).type('text/plain').send(
      result.affectedRows ? 'You have been unsubscribed from The Haat of Art newsletter.' : 'This link is invalid or the subscription is already inactive.',
    )
  } catch (error) {
    next(error)
  }
})

export async function notifyNewsletterSubscribers(post: { id: string; title: string; excerpt: string }) {
  const articleUrl = publicUrl(`/blog/${encodeURIComponent(post.id)}`)
  const body = [
    `A new story from The Haat of Art: ${post.title}`,
    post.excerpt,
    `Read the story: ${articleUrl}`,
  ].filter(Boolean).join('\n\n')
  await enqueueSubscribers(`New from The Haat of Art: ${post.title}`, body)
}

// Emails every active subscriber and consenting visitor once per event about registration for the pass.
export async function announceEvent(eventId: string, { force = false } = {}) {
  const [claim] = await pool.query<any>(
    `UPDATE events SET announced_at=NOW() WHERE id=? AND status IN ('APPROVED','PUBLISHED')${force ? '' : ' AND announced_at IS NULL'}`,
    [eventId],
  )
  if (!claim.affectedRows) return { queued: 0 }
  const [[event]] = await pool.query<any[]>(
    'SELECT slug,title,description,city,state,venue,starts_at startsAt,ends_at endsAt FROM events WHERE id=?', [eventId])
  const registerUrl = publicUrl(`/pass/${encodeURIComponent(event.slug)}`)
  const place = [event.venue, event.city, event.state].filter(Boolean).join(', ')
  const when = new Date(event.startsAt).toDateString() === new Date(event.endsAt).toDateString()
    ? new Date(event.startsAt).toDateString()
    : `${new Date(event.startsAt).toDateString()} – ${new Date(event.endsAt).toDateString()}`
  const body = [
    `Upcoming exhibition: ${event.title}`,
    `When: ${when}`,
    `Where: ${place}`,
    event.description,
    `Register for your free entry pass: ${registerUrl}`,
    'Your QR pass is active only on the day of the exhibition and works for a single entry.',
  ].join('\n\n')
  const subject = `Upcoming exhibition: ${event.title}`

  // Emails are queued in the outbox and delivered by the background worker in rate-limited batches.
  const subscribers = await enqueueSubscribers(subject, body)
  const visitors = await enqueueConsentedVisitors(subject,
    `${body}\n\nYou receive this because you agreed to updates when registering. Reply to this email to opt out.`)
  return { queued: subscribers + visitors }
}
