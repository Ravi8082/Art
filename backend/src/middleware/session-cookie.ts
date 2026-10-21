import type { CookieOptions } from 'express'

export const SESSION_COOKIE_MAX_AGE_MS = 15 * 60 * 1000

// No Domain attribute: the cookie is bound to the host that served the response, so behind the Vercel
// same-origin proxy it belongs to the Vercel site and is never sent to the Render hostname.
export function sessionCookieOptions(env: NodeJS.ProcessEnv = process.env): CookieOptions {
  return { httpOnly: true, signed: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: SESSION_COOKIE_MAX_AGE_MS }
}
