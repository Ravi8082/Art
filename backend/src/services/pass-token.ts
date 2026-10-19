import crypto from 'node:crypto'
import { z } from 'zod'

const passIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function passTokenForId(passId: string, secret: string) {
  const signature = crypto.createHmac('sha256', secret).update(passId).digest('base64url')
  return `${passId}.${signature}`
}

export function passIdFromToken(token: string, secret: string) {
  const segments = token.split('.')
  const passId = segments[0]
  const signature = segments[1]
  if (segments.length !== 2 || !passId || !passIdPattern.test(passId) || !signature || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null
  const expected = crypto.createHmac('sha256', secret).update(passId).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null
  return passId
}

const referenceAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const referencePattern = /^[A-Z0-9]{12}$/

// The QR code carries only this opaque reference; everything else is fetched from the database on scan.
export function newReferenceCode() {
  const bytes = crypto.randomBytes(12)
  return Array.from(bytes, (byte) => referenceAlphabet[byte % referenceAlphabet.length]).join('')
}

export function referenceFromScannedValue(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/[\s-]/g, '')
  const candidate = cleaned.startsWith('HOA') && cleaned.length === 15 ? cleaned.slice(3) : cleaned
  return referencePattern.test(candidate) ? candidate : null
}

export const referenceQrValue = (reference: string) => `HOA-${reference}`

export function hashPassToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function tokenFromScannedValue(value: string) {
  const parsedUrl = z.string().url().safeParse(value)
  if (!parsedUrl.success) return value
  const scannedUrl = new URL(parsedUrl.data)
  const passPath = '/visitor/pass/'
  if ((scannedUrl.protocol === 'http:' || scannedUrl.protocol === 'https:') && scannedUrl.pathname.startsWith(passPath)) {
    return scannedUrl.pathname.slice(passPath.length)
  }
  return value
}
