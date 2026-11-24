import { pool } from '../db/pool.js'

const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

export function startAnalyticsRetentionCleanup() {
  let running = false
  const cleanExpiredEvents = async () => {
    if (running) return
    running = true
    try {
      await pool.query('DELETE FROM site_analytics_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)')
    } catch (error) {
      console.error('[analytics-retention]', error instanceof Error ? error.message : 'Cleanup failed')
    } finally {
      running = false
    }
  }

  void cleanExpiredEvents()
  const timer = setInterval(() => { void cleanExpiredEvents() }, RETENTION_INTERVAL_MS)
  return () => clearInterval(timer)
}
