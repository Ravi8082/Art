import crypto from 'node:crypto'
import type { PoolConnection } from 'mysql2/promise'
import { pool, withTransaction } from '../db/pool.js'
import { hashMobileRefreshToken, issueMobileAccessToken, newMobileRefreshToken } from './mobile-tokens.js'

export { hashMobileRefreshToken, issueMobileAccessToken, newMobileRefreshToken } from './mobile-tokens.js'

const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000

function makeTokenPair(userId: string, sessionVersion: number) {
  return {
    accessToken: issueMobileAccessToken(userId, sessionVersion),
    refreshToken: newMobileRefreshToken(),
    expiresIn: 15 * 60,
  }
}

async function insertRefreshSession(
  connection: PoolConnection,
  userId: string,
  refreshToken: string,
) {
  const expiresAt = new Date(Date.now() + refreshLifetimeMs)
  await connection.query(
    'INSERT INTO refresh_sessions(id,user_id,token_hash,expires_at) VALUES (?,?,?,?)',
    [crypto.randomUUID(), userId, hashMobileRefreshToken(refreshToken), expiresAt],
  )
}

export async function createMobileSession(userId: string, sessionVersion: number) {
  const tokens = makeTokenPair(userId, sessionVersion)
  await withTransaction(async (connection) => {
    await insertRefreshSession(connection, userId, tokens.refreshToken)
  })
  return tokens
}

export async function rotateMobileSession(refreshToken: string) {
  const tokenHash = hashMobileRefreshToken(refreshToken)
  return withTransaction(async (connection) => {
    const [sessions] = await connection.query<any[]>(
      `SELECT session.id,session.user_id userId,session.expires_at expiresAt,
          session.revoked_at revokedAt,account.status,account.session_version sessionVersion
       FROM refresh_sessions session
       JOIN users account ON account.id=session.user_id
       WHERE session.token_hash=?
       FOR UPDATE`,
      [tokenHash],
    )
    const session = sessions[0]
    if (!session) return null

    if (session.revokedAt) {
      await connection.query(
        'UPDATE refresh_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',
        [session.userId],
      )
      return null
    }

    const isExpired = new Date(session.expiresAt).getTime() <= Date.now()
    if (session.status !== 'ACTIVE' || isExpired) {
      await connection.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE id=?', [session.id])
      return null
    }

    await connection.query('UPDATE refresh_sessions SET revoked_at=NOW() WHERE id=?', [session.id])
    const tokens = makeTokenPair(session.userId, Number(session.sessionVersion))
    await insertRefreshSession(connection, session.userId, tokens.refreshToken)
    return tokens
  })
}

export async function revokeMobileSession(refreshToken: string) {
  await pool.query(
    'UPDATE refresh_sessions SET revoked_at=NOW() WHERE token_hash=? AND revoked_at IS NULL',
    [hashMobileRefreshToken(refreshToken)],
  )
}
