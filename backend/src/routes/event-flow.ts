import { raw, Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { cachePublic } from '../middleware/cache.js'
import { supportedMediaTypes } from '../services/media-validation.js'
import { recordAudit } from '../services/audit.js'
import { storeAsset } from './about.js'

export const eventFlowRouter = Router()
export const adminEventFlowRouter = Router()

const manage = [requireAuth, requirePermission('content:manage')] as const
const phaseIds = ['pre-event', 'inauguration', 'showcase', 'felicitation', 'closing'] as const
const imageTypes = [...supportedMediaTypes].filter(([, kind]) => kind === 'IMAGE').map(([type]) => type)
const imageBody = raw({ type: imageTypes, limit: '25mb' })

const phaseSchema = z.object({
  id: z.enum(phaseIds),
  number: z.string().trim().min(1).max(8),
  title: z.string().trim().min(1).max(180),
  timeframe: z.string().trim().min(1).max(140),
  audience: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
  introduction: z.string().trim().min(1).max(1000),
  activities: z.array(z.string().trim().min(1).max(500)).min(1).max(16),
  imageUrl: z.string().trim().max(600),
}).strict()

const scheduleItemSchema = z.object({
  period: z.enum(['Morning', 'Afternoon', 'Evening']),
  time: z.string().trim().min(1).max(80),
  activity: z.string().trim().min(1).max(300),
}).strict()

const scheduleDaySchema = z.object({
  day: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  items: z.array(scheduleItemSchema).min(1).max(16),
}).strict()

const contentSchema = z.object({
  kicker: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(240),
  subtitle: z.string().trim().min(1).max(2000),
  phases: z.array(phaseSchema).length(5),
  schedule: z.array(scheduleDaySchema).length(3),
  ctaTitle: z.string().trim().min(1).max(240),
}).strict().superRefine((content, context) => {
  const ids = content.phases.map((phase) => phase.id)
  if (new Set(ids).size !== phaseIds.length || phaseIds.some((id) => !ids.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['phases'], message: 'The five standard exhibition phases are required.' })
  }
})

type EventFlowContent = z.infer<typeof contentSchema>

async function getContent() {
  const [rows] = await pool.query<any[]>('SELECT kicker,title,subtitle,phases_json phasesJson,schedule_json scheduleJson,cta_title ctaTitle FROM event_flow_content WHERE id=1')
  if (!rows[0]) return null
  const phases = typeof rows[0].phasesJson === 'string' ? JSON.parse(rows[0].phasesJson) : rows[0].phasesJson
  const schedule = typeof rows[0].scheduleJson === 'string' ? JSON.parse(rows[0].scheduleJson) : rows[0].scheduleJson
  return contentSchema.parse({
    kicker: rows[0].kicker,
    title: rows[0].title,
    subtitle: rows[0].subtitle,
    ctaTitle: rows[0].ctaTitle,
    phases,
    schedule,
  })
}

eventFlowRouter.get('/', cachePublic(30), async (_req, res, next) => {
  try {
    const content = await getContent()
    if (!content) return res.status(404).json({ error: 'Event flow content has not been configured.' })
    res.json(content)
  } catch (error) {
    next(error)
  }
})

adminEventFlowRouter.get('/', ...manage, async (_req, res, next) => {
  try {
    const content = await getContent()
    if (!content) return res.status(404).json({ error: 'Event flow content has not been configured.' })
    res.set('Cache-Control', 'no-store')
    res.json(content)
  } catch (error) {
    next(error)
  }
})

adminEventFlowRouter.put('/', ...manage, async (req: AuthRequest, res, next) => {
  try {
    const content = contentSchema.parse(req.body) satisfies EventFlowContent
    await pool.query(`
      UPDATE event_flow_content
      SET kicker=?,title=?,subtitle=?,phases_json=?,schedule_json=?,cta_title=?
      WHERE id=1
    `, [content.kicker, content.title, content.subtitle, JSON.stringify(content.phases), JSON.stringify(content.schedule), content.ctaTitle])
    await recordAudit(req.user!.id, 'event_flow.update', 'event_flow_content', '1', {
      phaseCount: content.phases.length,
      scheduleDayCount: content.schedule.length,
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

adminEventFlowRouter.put('/phases/:phaseId/photo', ...manage, imageBody, async (req: AuthRequest, res, next) => {
  try {
    const phaseId = z.enum(phaseIds).safeParse(req.params.phaseId)
    if (!phaseId.success) return res.status(400).json({ error: 'Invalid exhibition phase.' })
    const content = await getContent()
    if (!content) return res.status(404).json({ error: 'Event flow content has not been configured.' })
    const stored = await storeAsset(pool, req, 'event-flow-photo', req.user!.id)
    if (!stored.ok) return res.status(stored.status).json({ error: stored.error })
    const phases = content.phases.map((phase) => phase.id === phaseId.data
      ? { ...phase, imageUrl: `/api/about/media/${stored.id}` }
      : phase)
    await pool.query('UPDATE event_flow_content SET phases_json=? WHERE id=1', [JSON.stringify(phases)])
    await recordAudit(req.user!.id, 'event_flow.photo', 'event_flow_content', '1', { phaseId: phaseId.data, assetId: stored.id })
    res.json({ imageUrl: `/api/about/media/${stored.id}` })
  } catch (error) {
    next(error)
  }
})
