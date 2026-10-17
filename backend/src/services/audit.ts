import { pool } from '../db/pool.js'

export async function recordAudit(actorUserId: string | null, action: string, entityType: string, entityId?: string | string[] | null, metadata?: Record<string, unknown>) {
  const normalizedId = Array.isArray(entityId) ? entityId[0] ?? null : entityId ?? null
  await pool.query('INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)', [
    actorUserId, action, entityType, normalizedId, metadata ? JSON.stringify(metadata) : null,
  ])
}
