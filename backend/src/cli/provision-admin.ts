import 'dotenv/config'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { pool, withTransaction } from '../db/pool.js'
const [email, password, fullName = 'Platform Administrator'] = process.argv.slice(2)
if (!email || !password || password.length < 16) throw new Error('Usage: pnpm provision-admin admin@example.com <password 16+ chars> [full name]')
const id = crypto.randomUUID(); const passwordHash = await bcrypt.hash(password, 12)
await withTransaction(async (db) => { await db.query('INSERT INTO users(id,email,password_hash,full_name,status,email_verified_at) VALUES (?,?,?,? ,\'ACTIVE\',NOW())', [id,email.toLowerCase(),passwordHash,fullName]); const [role] = await db.query<any[]>('SELECT id FROM roles WHERE name=\'SUPER_ADMIN\''); await db.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [id,role[0].id]) })
await pool.end(); console.log(`Provisioned ${email}`)
