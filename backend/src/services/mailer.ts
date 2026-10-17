import nodemailer from 'nodemailer'
import { sendWhatsApp, sendWhatsAppToEmail } from './whatsapp.js'

const transport = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
}) : null

export async function sendEmail(to: string, subject: string, text: string) {
  if (!transport) return { configured: false, accepted: false }
  const result = await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.MAIL_FROM ?? 'Haat of Art <no-reply@localhost>', to, subject, text })
  return { configured: true, accepted: result.accepted.includes(to) }
}

export async function queueEmail(to: string, template: string, text: string, options: { whatsapp?: 'always' | 'consented' | 'off'; whatsappPhone?: string } = {}) {
  const mode = options.whatsapp ?? 'always'
  if (mode !== 'off') {
    const message = `${template}\n\n${text}`
    const task = options.whatsappPhone
      ? sendWhatsApp(options.whatsappPhone, message)
      : sendWhatsAppToEmail(to, message, { requireConsent: mode === 'consented' })
    void task.catch(() => undefined)
  }
  const id = crypto.randomUUID()
  const { pool } = await import('../db/pool.js')
  await pool.query('INSERT INTO email_delivery_records(id,recipient_email,template,status) VALUES (?,?,?,\'QUEUED\')', [id, to, template])
  try {
    const result = await sendEmail(to, template, text)
    if (!result.configured) {
      await pool.query("UPDATE email_delivery_records SET status='FAILED',last_error=?,attempts=attempts+1 WHERE id=?", ['SMTP not configured', id])
      return { id, delivered: false, reason: 'SMTP not configured' }
    }
    if (!result.accepted) {
      await pool.query("UPDATE email_delivery_records SET status='FAILED',last_error=?,attempts=attempts+1 WHERE id=?", ['Email provider did not accept the recipient', id])
      return { id, delivered: false, reason: 'Email provider did not accept the recipient' }
    }
    await pool.query('UPDATE email_delivery_records SET status=\'SENT\',sent_at=NOW(),attempts=attempts+1 WHERE id=?', [id])
    return { id, delivered: true }
  } catch (error) {
    await pool.query('UPDATE email_delivery_records SET status=\'FAILED\',last_error=?,attempts=attempts+1 WHERE id=?', [error instanceof Error ? error.message : 'Provider failure', id])
    return { id, delivered: false, reason: 'Provider failure' }
  }
}

import crypto from 'node:crypto'

export const hashToken = (value: string) => crypto.createHash('sha256').update(value).digest('hex')
export const secureToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
export const otpCode = () => crypto.randomInt(100000, 1000000).toString()
export const hashOtp = hashToken
export const otpExpiry = () => new Date(Date.now() + 5 * 60 * 1000)
export const otpCooldown = () => new Date(Date.now() - 60 * 1000)
export const otpMessage = (code: string) => `Your Haat of Art verification code is ${code}. It expires in 5 minutes.`

export async function createOtp(userId: string, purpose: 'VERIFY_EMAIL' | 'LOGIN' | 'RESET_PASSWORD', email: string) {
  const { pool } = await import('../db/pool.js')
  const code = otpCode()
  const [recent] = await pool.query<any[]>('SELECT id FROM otp_challenges WHERE user_id=? AND purpose=? AND created_at > ? AND consumed_at IS NULL LIMIT 1', [userId, purpose, otpCooldown()])
  if (recent.length) throw Object.assign(new Error('Please wait before requesting another code'), { status: 429 })
  await pool.query('UPDATE otp_challenges SET consumed_at=NOW() WHERE user_id=? AND purpose=? AND consumed_at IS NULL', [userId, purpose])
  const id = crypto.randomUUID()
  await pool.query('INSERT INTO otp_challenges(id,user_id,purpose,code_hash,expires_at) VALUES (?,?,?,?,?)', [id, userId, purpose, hashOtp(code), otpExpiry()])
  const delivery = await queueEmail(email, 'Haat of Art verification code', otpMessage(code))
  if (!delivery.delivered) await pool.query('UPDATE otp_challenges SET consumed_at=NOW() WHERE id=?', [id])
  return delivery
}

export async function verifyOtp(userId: string, purpose: string, code: string) {
  const { pool } = await import('../db/pool.js')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.query<any[]>('SELECT id,code_hash,attempts FROM otp_challenges WHERE user_id=? AND purpose=? AND consumed_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1 FOR UPDATE', [userId, purpose])
    const challenge = rows[0]
    if (!challenge || challenge.attempts >= 5) { await connection.rollback(); return false }
    if (hashOtp(code) !== challenge.code_hash) { await connection.query('UPDATE otp_challenges SET attempts=attempts+1 WHERE id=?', [challenge.id]); await connection.commit(); return false }
    await connection.query('UPDATE otp_challenges SET consumed_at=NOW() WHERE id=?', [challenge.id])
    await connection.commit(); return true
  } catch (error) { await connection.rollback(); throw error } finally { connection.release() }
}

export async function sendQrEmail(email: string, token: string, eventTitle: string) {
  return queueEmail(email, 'Your Haat of Art QR pass', `Your pass for ${eventTitle}: ${token}`)
}

export async function retryEmail(id: string) {
  const { pool } = await import('../db/pool.js')
  const [rows] = await pool.query<any[]>('SELECT * FROM email_delivery_records WHERE id=? AND status=\'FAILED\' AND attempts < 5', [id])
  if (!rows[0]) return false
  await pool.query('UPDATE email_delivery_records SET status=\'QUEUED\' WHERE id=?', [id])
  return true
}

export { sendEmail as deliverEmail }
export type MailResult = { id: string; delivered: boolean; reason?: string }
