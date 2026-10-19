import crypto from 'node:crypto'
import { pool } from '../db/pool.js'
import { sendEmail, secureToken, hashToken } from './mailer.js'

const MAX_ATTEMPTS = 5
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 50)
const CONCURRENCY = Number(process.env.OUTBOX_CONCURRENCY ?? 10)
const IDLE_MS = Number(process.env.OUTBOX_IDLE_MS ?? 2000)
const UNSUBSCRIBE_PLACEHOLDER = '{{UNSUBSCRIBE_URL}}'

const publicUrl = (path: string) => new URL(path, process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000').toString()

// Backoff in seconds before the next attempt: 1 min, 5 min, 15 min, 1 h.
export const retryDelaySeconds = (attempts: number) => [60, 300, 900, 3600][Math.min(attempts - 1, 3)] ?? 3600

// Set-based enqueue: millions of rows are created by one INSERT…SELECT, never loaded into Node memory.
export async function enqueueSubscribers(subject: string, body: string) {
  const [result] = await pool.query<any>(
    `INSERT INTO email_outbox(id,recipient_email,subject,body,subscriber_id)
     SELECT UUID(),email,?,CONCAT(?,CHAR(10),CHAR(10),'Unsubscribe: ',?),id
     FROM newsletter_subscribers WHERE unsubscribed_at IS NULL`,
    [subject, body, UNSUBSCRIBE_PLACEHOLDER],
  )
  return Number(result.affectedRows)
}

export async function enqueueConsentedVisitors(subject: string, body: string) {
  const [result] = await pool.query<any>(
    `INSERT INTO email_outbox(id,recipient_email,subject,body)
     SELECT UUID(),v.email,?,?
     FROM visitor_profiles v
     WHERE v.marketing_consent=1
       AND NOT EXISTS (SELECT 1 FROM newsletter_subscribers s WHERE s.email=v.email)`,
    [subject, body],
  )
  return Number(result.affectedRows)
}

const artistAudienceWhere = `u.status='ACTIVE' AND (
    EXISTS (SELECT 1 FROM artist_profiles ap WHERE ap.user_id=u.id)
    OR EXISTS (SELECT 1 FROM exhibition_applications ea WHERE ea.user_id=u.id)
    OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.name='ARTIST'))
  AND NOT EXISTS (SELECT 1 FROM newsletter_subscribers s WHERE s.email=u.email)
  AND NOT EXISTS (SELECT 1 FROM visitor_profiles v WHERE v.email=u.email AND v.marketing_consent=1)`

// Artists with an account, profile or earlier stall application; people already reached as subscribers or visitors are skipped.
export async function enqueueArtists(subject: string, body: string) {
  const [result] = await pool.query<any>(
    `INSERT INTO email_outbox(id,recipient_email,subject,body)
     SELECT UUID(),u.email,?,? FROM users u WHERE ${artistAudienceWhere}`,
    [subject, body],
  )
  return Number(result.affectedRows)
}

export async function countAudience() {
  const [[row]] = await pool.query<any[]>(
    `SELECT
       (SELECT COUNT(*) FROM newsletter_subscribers WHERE unsubscribed_at IS NULL) subscribers,
       (SELECT COUNT(*) FROM visitor_profiles v WHERE v.marketing_consent=1
          AND NOT EXISTS (SELECT 1 FROM newsletter_subscribers s WHERE s.email=v.email)) visitors,
       (SELECT COUNT(*) FROM users u WHERE ${artistAudienceWhere}) artists`)
  return { subscribers: Number(row.subscribers), visitors: Number(row.visitors), artists: Number(row.artists) }
}

async function claimBatch() {
  const claimToken = crypto.randomUUID()
  await pool.query(
    `UPDATE email_outbox
     SET status='SENDING',claim_token=?,locked_until=DATE_ADD(NOW(),INTERVAL 5 MINUTE),attempts=attempts+1
     WHERE (status='PENDING' AND next_attempt_at<=NOW()) OR (status='SENDING' AND locked_until<NOW())
     ORDER BY next_attempt_at LIMIT ?`,
    [claimToken, BATCH_SIZE],
  )
  const [rows] = await pool.query<any[]>(
    `SELECT id,recipient_email email,subject,body,subscriber_id subscriberId,attempts
     FROM email_outbox WHERE claim_token=? AND status='SENDING'`,
    [claimToken],
  )
  return rows
}

async function deliver(row: any) {
  let text: string = row.body
  if (row.subscriberId) {
    const token = secureToken()
    await pool.query('INSERT INTO newsletter_unsubscribe_tokens(token_hash,subscriber_id) VALUES (?,?)', [hashToken(token), row.subscriberId])
    text = text.replace(UNSUBSCRIBE_PLACEHOLDER, publicUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`))
  }
  try {
    const result = await sendEmail(row.email, row.subject, text)
    if (!result.configured) throw new Error('SMTP not configured')
    if (!result.accepted) throw new Error('Email provider did not accept the recipient')
    await pool.query("UPDATE email_outbox SET status='SENT',sent_at=NOW(),claim_token=NULL,locked_until=NULL,body='',last_error=NULL WHERE id=?", [row.id])
  } catch (error) {
    const message = (error instanceof Error ? error.message : 'Provider failure').slice(0, 500)
    if (row.attempts >= MAX_ATTEMPTS) {
      await pool.query("UPDATE email_outbox SET status='FAILED',claim_token=NULL,locked_until=NULL,last_error=? WHERE id=?", [message, row.id])
    } else {
      await pool.query(
        "UPDATE email_outbox SET status='PENDING',claim_token=NULL,locked_until=NULL,last_error=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? SECOND) WHERE id=?",
        [message, retryDelaySeconds(row.attempts), row.id],
      )
    }
  }
}

async function runPool<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await work(items[next++] as T).catch((error) => console.error('[outbox]', error instanceof Error ? error.message : 'unknown'))
  })
  await Promise.all(workers)
}

export async function processOutboxOnce() {
  const batch = await claimBatch()
  await runPool(batch, CONCURRENCY, deliver)
  return batch.length
}

export function startOutboxWorker() {
  if (process.env.OUTBOX_WORKER === 'off') return () => undefined
  let stopped = false
  let timer: NodeJS.Timeout | undefined
  const tick = async () => {
    let processed = 0
    try { processed = await processOutboxOnce() } catch (error) { console.error('[outbox]', error instanceof Error ? error.message : 'unknown') }
    if (!stopped) timer = setTimeout(tick, processed >= BATCH_SIZE ? 0 : IDLE_MS)
  }
  timer = setTimeout(tick, IDLE_MS)
  return () => { stopped = true; if (timer) clearTimeout(timer) }
}
