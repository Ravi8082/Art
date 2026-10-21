// Read-only inspection of a MySQL database (local or Aiven). Uses the same DB_* variables as the backend.
// Usage (from backend/): node scripts/check-db.mjs [--counts]
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'

const env = (a, b) => process.env[a] ?? process.env[b]
const ssl = /^(1|true|required)$/i.test(process.env.DB_SSL ?? '')
  ? { ca: process.env.DB_SSL_CA_PEM?.replace(/\\n/g, '\n') || readFileSync(resolve(process.env.DB_SSL_CA), 'utf8'), rejectUnauthorized: true, minVersion: 'TLSv1.2' }
  : undefined

const conn = await mysql.createConnection({
  host: env('DB_HOST', 'MYSQL_HOST'), port: Number(env('DB_PORT', 'MYSQL_PORT')),
  database: env('DB_NAME', 'MYSQL_DATABASE'), user: env('DB_USER', 'MYSQL_USER'),
  password: env('DB_PASSWORD', 'MYSQL_PASSWORD'), ssl, connectTimeout: 15000,
})
try {
  await conn.query('SET SESSION TRANSACTION READ ONLY')
  const [[info]] = await conn.query('SELECT VERSION() AS version, DATABASE() AS db')
  console.log(`Connected: MySQL ${info.version}, database ${info.db}, TLS ${ssl ? 'on (verified)' : 'off'}`)
  const [tables] = await conn.query(
    "SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME")
  console.log(`Objects in database: ${tables.length}`)
  for (const t of tables) {
    let count = ''
    if (process.argv.includes('--counts') && t.type === 'BASE TABLE') {
      const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${t.name}\``)
      count = `  rows=${row.c}`
    }
    console.log(`  ${t.name} (${t.type})${count}`)
  }
} finally { await conn.end() }
