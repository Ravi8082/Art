import 'dotenv/config'
import mysql from 'mysql2/promise'

const requiredEnv = ['MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'] as const
for (const name of requiredEnv) {
  if (process.env[name] === undefined) throw new Error(`Missing required database environment variable: ${name}`)
}

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT),
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
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
