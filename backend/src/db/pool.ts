import 'dotenv/config'
import mysql from 'mysql2/promise'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// DB_* variables take precedence; legacy MYSQL_* names keep existing local setups working.
function dbEnv(primary: string, legacy: string) {
  return process.env[primary] ?? process.env[legacy]
}

const config = {
  host: dbEnv('DB_HOST', 'MYSQL_HOST'),
  port: dbEnv('DB_PORT', 'MYSQL_PORT'),
  database: dbEnv('DB_NAME', 'MYSQL_DATABASE'),
  user: dbEnv('DB_USER', 'MYSQL_USER'),
  password: dbEnv('DB_PASSWORD', 'MYSQL_PASSWORD'),
}
const missing = [
  ['DB_HOST', config.host], ['DB_PORT', config.port], ['DB_NAME', config.database],
  ['DB_USER', config.user], ['DB_PASSWORD', config.password],
].filter(([, value]) => value === undefined).map(([name]) => name)
if (missing.length) throw new Error(`Missing required database environment variable(s): ${missing.join(', ')}`)

// TLS with certificate verification; never disabled. Use DB_SSL_CA (file path) or DB_SSL_CA_PEM (inline PEM).
function buildSsl(): mysql.SslOptions | undefined {
  if (!/^(1|true|required)$/i.test(process.env.DB_SSL ?? '')) return undefined
  const inlinePem = process.env.DB_SSL_CA_PEM?.replace(/\\n/g, '\n')
  const caPath = process.env.DB_SSL_CA
  const ca = inlinePem || (caPath ? readFileSync(resolve(caPath), 'utf8') : undefined)
  if (!ca) throw new Error('DB_SSL is enabled but neither DB_SSL_CA nor DB_SSL_CA_PEM is set')
  return { ca, rejectUnauthorized: true, minVersion: 'TLSv1.2' }
}

export const pool = mysql.createPool({
  host: config.host,
  port: Number(config.port),
  database: config.database,
  user: config.user,
  password: config.password,
  ssl: buildSsl(),
  waitForConnections: true,
  connectionLimit: Math.max(5, Number(process.env.DB_POOL_SIZE ?? 30)),
  queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 2000),
  connectTimeout: 10_000,
  enableKeepAlive: true,
  // Only the migration runner needs multi-statement SQL; keep it off for request handling.
  multipleStatements: process.argv.some((arg) => arg.includes('migrate')),
})

export async function withTransaction<T>(work: (connection: mysql.PoolConnection) => Promise<T>) {
  const connection = await pool.getConnection()
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result }
  catch (error) { await connection.rollback(); throw error }
  finally { connection.release() }
}
