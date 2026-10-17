import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import { pool } from './pool.js'

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)

  const directory = new URL('./migrations/', import.meta.url)
  const migrations = (await readdir(directory))
    .filter((name) => /^\d{3}_.+\.sql$/.test(name))
    .sort()

  for (const name of migrations) {
    const [applied] = await pool.query<any[]>('SELECT name FROM schema_migrations WHERE name=?', [name])
    if (applied.length) continue

    const sql = await readFile(new URL(name, directory), 'utf8')
    await pool.query(sql)
    await pool.query('INSERT INTO schema_migrations(name) VALUES (?)', [name])
    console.log(`Applied migration ${name}`)
  }

  console.log('Database migrations complete')
} finally {
  await pool.end()
}
