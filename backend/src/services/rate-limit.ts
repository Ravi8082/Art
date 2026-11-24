import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { createClient } from 'redis'

const redisUrl = process.env.REDIS_URL?.trim()
if (process.env.NODE_ENV === 'production' && !redisUrl) {
  throw new Error('REDIS_URL must be configured in production for shared rate limiting')
}
if (redisUrl) {
  let protocol: string
  try { protocol = new URL(redisUrl).protocol }
  catch { throw new Error('REDIS_URL must be a valid Redis URL') }
  if (!['redis:', 'rediss:'].includes(protocol)) throw new Error('REDIS_URL must use the redis:// or rediss:// protocol')
  if (process.env.NODE_ENV === 'production' && protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use TLS (rediss://) in production')
  }
}

const redisClient = redisUrl ? createClient({ url: redisUrl }) : null
redisClient?.on('error', () => console.error('[rate-limit-store] Redis client error'))

let storeNumber = 0

export default function createRateLimit(options: Partial<Options>) {
  const store = redisClient
    ? new RedisStore({
        // SECURITY: Distinct deterministic prefixes keep endpoint quotas isolated and consistent across replicas.
        prefix: `haat:rate-limit:${storeNumber++}:`,
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      })
    : undefined

  // SECURITY: Production uses Redis so limits cannot reset on process restart; memory storage is development/test only.
  return rateLimit({ ...options, ...(store ? { store } : {}) })
}

export async function connectRateLimitStore() {
  if (!redisClient) return
  try {
    if (!redisClient.isOpen) await redisClient.connect()
    await redisClient.ping()
  } catch {
    throw new Error('Unable to connect to the configured rate-limit Redis store')
  }
}

export async function closeRateLimitStore() {
  if (redisClient?.isOpen) await redisClient.quit()
}

export { ipKeyGenerator }
