// Compares schema + row counts between local (backend/.env) and cloud (DOTENV env file given as argv[2]). Read-only.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

const load = (file) => dotenv.parse(readFileSync(file))
const connect = (e) => mysql.createConnection({
  host: e.DB_HOST ?? e.MYSQL_HOST, port: Number(e.DB_PORT ?? e.MYSQL_PORT), database: e.DB_NAME ?? e.MYSQL_DATABASE,
  user: e.DB_USER ?? e.MYSQL_USER, password: e.DB_PASSWORD ?? e.MYSQL_PASSWORD,
  ssl: /^(1|true)$/i.test(e.DB_SSL ?? '') ? { ca: readFileSync(resolve(e.DB_SSL_CA), 'utf8'), rejectUnauthorized: true } : undefined,
})

async function snapshot(c) {
  const [t] = await c.query("SELECT TABLE_NAME n, TABLE_TYPE ty FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY 1")
  const counts = {}
  for (const { n, ty } of t) if (ty === 'BASE TABLE') counts[n] = (await c.query(`SELECT COUNT(*) c FROM \`${n}\``))[0][0].c
  const [fk] = await c.query("SELECT CONSTRAINT_NAME n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='FOREIGN KEY'")
  const [pk] = await c.query("SELECT TABLE_NAME n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_TYPE='PRIMARY KEY'")
  const [ix] = await c.query("SELECT DISTINCT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()")
  const [cols] = await c.query("SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()")
  return { counts, fks: fk.length, pks: pk.length, idx: ix.length, cols: cols[0].c, objects: t.length }
}

const local = await connect(load(resolve('.env')))
const cloud = await connect(load(resolve(process.argv[2])))
const a = await snapshot(local), b = await snapshot(cloud)
await local.end(); await cloud.end()

const names = [...new Set([...Object.keys(a.counts), ...Object.keys(b.counts)])].sort()
let diffs = 0
for (const n of names) if (a.counts[n] !== b.counts[n]) { diffs++; console.log(`DIFF ${n}: local=${a.counts[n]} cloud=${b.counts[n]}`) }
const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0)
console.log(`tables: local=${Object.keys(a.counts).length} cloud=${Object.keys(b.counts).length}`)
console.log(`total rows: local=${sum(a.counts)} cloud=${sum(b.counts)}`)
for (const k of ['objects', 'fks', 'pks', 'idx', 'cols']) console.log(`${k}: local=${a[k]} cloud=${b[k]}`)
console.log(`table count diffs: ${diffs}`)
