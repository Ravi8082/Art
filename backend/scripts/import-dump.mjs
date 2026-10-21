// Imports a mysqldump file into the database configured by the env file in DOTENV_CONFIG_PATH.
// Safety: aborts if the target has any objects, strips DROP statements, stops on first error, never prints secrets.
// Usage (from backend/): $env:DOTENV_CONFIG_PATH=".env.aiven"; node scripts/import-dump.mjs <dump.sql> <path-to-mysql.exe>
import 'dotenv/config'
import { createReadStream, createWriteStream, openSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import mysql from 'mysql2/promise'

const [dump, mysqlExe] = process.argv.slice(2)
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL_CA } = process.env
const ca = resolve(DB_SSL_CA)

const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT), database: DB_NAME, user: DB_USER, password: DB_PASSWORD, ssl: { ca: (await import('node:fs')).readFileSync(ca, 'utf8'), rejectUnauthorized: true } })
const [[{ n }]] = await conn.query('SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')
await conn.end()
if (n !== 0) { console.error(`Target ${DB_NAME} is not empty (${n} objects). Aborting.`); process.exit(2) }

const dir = mkdtempSync(join(tmpdir(), 'import-'))
const filtered = join(dir, 'filtered.sql')
const out = createWriteStream(filtered)
let dropped = 0
for await (const line of createInterface({ input: createReadStream(dump, 'utf8'), crlfDelay: Infinity })) {
  if (/^DROP (TABLE|VIEW|DATABASE)/i.test(line)) { dropped++; continue }
  out.write(line + '\n')
}
await new Promise((r) => out.end(r))
console.log(`Stripped ${dropped} DROP statements`)

const cnf = join(dir, 'client.cnf')
writeFileSync(cnf, `[client]\nuser=${DB_USER}\npassword="${DB_PASSWORD}"\nhost=${DB_HOST}\nport=${DB_PORT}\nssl-mode=VERIFY_CA\nssl-ca=${ca.replace(/\\/g, '/')}\ndefault-character-set=utf8mb4\n`)
try {
  const input = openSync(filtered, 'r')
  const r = spawnSync(mysqlExe, [`--defaults-extra-file=${cnf}`, DB_NAME], { stdio: [input, 'inherit', 'pipe'], encoding: 'utf8', maxBuffer: 1 << 26 })
  const err = (r.stderr || '').split('\n').filter((l) => !/password on the command line/i.test(l)).join('\n').replaceAll(DB_PASSWORD, '***')
  if (err.trim()) console.error(err.trim().slice(0, 3000))
  console.log(r.status === 0 ? 'Import finished (exit 0)' : `Import FAILED (exit ${r.status})`)
  process.exitCode = r.status ?? 1
} finally { rmSync(dir, { recursive: true, force: true }) }
