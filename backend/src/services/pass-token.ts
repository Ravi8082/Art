import crypto from 'node:crypto'

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

export function hashPassToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
