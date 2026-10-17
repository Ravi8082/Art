import crypto from 'node:crypto'
import { raw, Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { hasValidMediaSignature } from '../services/media-validation.js'
import { queueEmail } from '../services/mailer.js'
import { recordAudit } from '../services/audit.js'

export const enquiriesRouter = Router()

const categories = ['General', 'Exhibition/Stall Booking', 'Artist', 'Partnership', 'Media', 'Sponsorship', 'Technical Support'] as const
const statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_REPLY', 'RESOLVED', 'CLOSED', 'SPAM'] as const
const openStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_REPLY'] as const
const priorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const
const adminOnly = [requireAuth, requirePermission('enquiries:manage')] as const
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const attachmentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const attachmentBody = raw({ type: attachmentTypes, limit: '5mb' })

const submitLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
const attachmentLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false })

function hasValidFileSignature(contentType: string, data: Buffer) {
  if (contentType === 'application/pdf') return data.subarray(0, 5).toString('latin1').startsWith('%PDF-')
  return hasValidMediaSignature(contentType, data)
}

function newRefCode() {
  const now = new Date()
  const period = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let suffix = ''
  for (let index = 0; index < 4; index += 1) suffix += alphabet[crypto.randomInt(alphabet.length)]
  return `ENQ-${period}-${suffix}`
}

const submitSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().regex(/^[0-9+()\s-]{0,30}$/).default(''),
  category: z.enum(categories).default('General'),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10).max(5000),
  consent: z.literal(true, { error: 'Please accept the privacy notice before sending your message.' }),
})

async function notifyAdmins(refCode: string, input: { name: string; email: string; category: string; subject: string }) {
  const [rows] = await pool.query<any[]>(`
    SELECT DISTINCT u.email FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.status='ACTIVE' AND r.name IN ('SUPER_ADMIN','ADMIN') LIMIT 10`)
  const body = `New contact enquiry ${refCode}\n\nName: ${input.name}\nEmail: ${input.email}\nCategory: ${input.category}\nSubject: ${input.subject}\n\nOpen the Admin Panel Contact Manager to respond.`
  for (const row of rows) await queueEmail(row.email, `New contact enquiry — ${refCode}`, body).catch(() => undefined)
}

export async function insertEnquiry(input: { name: string; email: string; phone?: string; category?: string; subject: string; message: string }) {
  const id = crypto.randomUUID()
  let refCode = newRefCode()
  for (let attempt = 0; ; attempt += 1) {
    try {
      await pool.query(
        "INSERT INTO contact_enquiries(id,ref_code,name,email,phone,category,subject,message,status,priority) VALUES (?,?,?,?,?,?,?,?,'NEW','NORMAL')",
        [id, refCode, input.name, input.email, input.phone ?? '', input.category ?? 'General', input.subject, input.message])
      break
    } catch (error) {
      if (attempt >= 4 || (error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error
      refCode = newRefCode()
    }
  }
  await pool.query("INSERT INTO enquiry_messages(id,enquiry_id,direction,body) VALUES (?,?, 'INCOMING', ?)", [crypto.randomUUID(), id, input.message])
  return { id, refCode }
}

export async function notifyEnquiryCreation(refCode: string, input: { name: string; email: string; category?: string; subject: string }) {
  void (async () => {
    await queueEmail(input.email, 'We received your enquiry — The Haat of Art',
      `Hello ${input.name},\n\nThank you for contacting The Haat of Art. Your enquiry ${refCode} ("${input.subject}") has been recorded and our team will respond shortly.\n\nThis confirmation does not require a reply.`).catch(() => undefined)
    await notifyAdmins(refCode, { ...input, category: input.category ?? 'General' }).catch(() => undefined)
  })()
}

enquiriesRouter.post('/', submitLimit, async (req, res, next) => {
  try {
    const parsed = submitSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Please check your details and try again.' })
    const input = parsed.data

    // Duplicate protection: the same person sending the same subject minutes apart reuses their enquiry.
    const [duplicates] = await pool.query<any[]>(
      "SELECT ref_code refCode FROM contact_enquiries WHERE email=? AND subject=? AND created_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1",
      [input.email, input.subject])
    if (duplicates[0]) return res.status(200).json({ ok: true, duplicate: true, refCode: duplicates[0].refCode })

    const { id, refCode } = await insertEnquiry(input)
    notifyEnquiryCreation(refCode, input)

    res.status(201).json({ ok: true, id, refCode })
  } catch (error) { next(error) }
})

enquiriesRouter.post('/:id/attachment', attachmentLimit, attachmentBody, async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isUuid.test(String(id))) return res.status(400).json({ error: 'Invalid enquiry reference' })
    const [rows] = await pool.query<any[]>(
      "SELECT id FROM contact_enquiries WHERE id=? AND status='NEW' AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE)", [id])
    if (!rows.length) return res.status(400).json({ error: 'This enquiry can no longer accept attachments.' })
    const contentType = req.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() ?? ''
    if (!attachmentTypes.includes(contentType)) return res.status(415).json({ error: 'Only PDF, JPG, PNG, WebP or GIF attachments are allowed.' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Attachment file is required.' })
    if (req.body.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'Attachments must be 5 MB or smaller.' })
    if (!hasValidFileSignature(contentType, req.body)) return res.status(415).json({ error: 'File content does not match its type.' })
    const fileName = z.string().trim().min(1).max(255).parse(req.get('x-file-name') || 'attachment')
    const [existing] = await pool.query<any[]>('SELECT COUNT(*) count FROM enquiry_attachments WHERE enquiry_id=?', [id])
    if (Number(existing[0].count) >= 3) return res.status(409).json({ error: 'This enquiry already has the maximum of three attachments.' })
    await pool.query('INSERT INTO enquiry_attachments(id,enquiry_id,file_name,mime_type,byte_size,data) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), id, fileName, contentType, req.body.length, req.body])
    res.status(201).json({ ok: true, fileName, byteSize: req.body.length })
  } catch (error) { next(error) }
})

enquiriesRouter.get('/staff', ...adminOnly, async (_req, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT u.id, u.full_name fullName, u.email, GROUP_CONCAT(r.name) roles
      FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
      WHERE u.status='ACTIVE' AND r.name IN ('SUPER_ADMIN','ADMIN','SUPPORT_AGENT','REGISTRATION_MANAGER')
      GROUP BY u.id, u.full_name, u.email ORDER BY u.full_name`)
    res.json({ staff: rows.map((row: any) => ({ ...row, roles: String(row.roles).split(',') })) })
  } catch (error) { next(error) }
})

enquiriesRouter.get('/export.csv', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(`
      SELECT e.ref_code refCode, e.name, e.email, e.phone, e.category, e.subject, e.message, e.status, e.priority,
             a.full_name assignedTo, e.follow_up_at followUpAt, e.created_at createdAt, e.updated_at updatedAt
      FROM contact_enquiries e LEFT JOIN users a ON a.id=e.assigned_to
      ORDER BY e.created_at DESC LIMIT 5000`)
    const columns = ['refCode', 'name', 'email', 'phone', 'category', 'subject', 'message', 'status', 'priority', 'assignedTo', 'followUpAt', 'createdAt', 'updatedAt']
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [columns.join(','), ...rows.map((row: any) => columns.map((key) => escape(row[key])).join(','))].join('\r\n')
    await recordAudit(req.user!.id, 'enquiries.export', 'contact_enquiry', null, { rows: rows.length })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="contact-enquiries-${Date.now()}.csv"`)
    res.send(csv)
  } catch (error) { next(error) }
})

enquiriesRouter.get('/', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const query = z.object({
      q: z.string().trim().max(120).optional(),
      status: z.enum(statuses).optional(),
      category: z.string().trim().max(60).optional(),
      priority: z.enum(priorities).optional(),
      assigned: z.enum(['me', 'unassigned']).optional(),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      sort: z.enum(['created', 'updated', 'priority', 'status', 'followUp']).default('created'),
      page: z.coerce.number().int().min(1).max(200).default(1),
      pageSize: z.coerce.number().int().min(5).max(100).default(20),
    }).parse(req.query)

    const where: string[] = []
    const args: unknown[] = []
    if (query.q) {
      where.push('(e.ref_code LIKE ? OR e.name LIKE ? OR e.email LIKE ? OR e.subject LIKE ?)')
      const like = `%${query.q}%`
      args.push(like, like, like, like)
    }
    if (query.status) { where.push('e.status=?'); args.push(query.status) }
    if (query.category) { where.push('e.category=?'); args.push(query.category) }
    if (query.priority) { where.push('e.priority=?'); args.push(query.priority) }
    if (query.assigned === 'me') { where.push('e.assigned_to=?'); args.push(req.user!.id) }
    if (query.assigned === 'unassigned') where.push('e.assigned_to IS NULL')
    if (query.from) { where.push('DATE(e.created_at) >= ?'); args.push(query.from) }
    if (query.to) { where.push('DATE(e.created_at) <= ?'); args.push(query.to) }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const orderBy = query.sort === 'priority'
      ? "FIELD(e.priority,'URGENT','HIGH','NORMAL','LOW'), e.created_at DESC"
      : query.sort === 'status' ? 'e.status, e.created_at DESC'
      : query.sort === 'updated' ? 'e.updated_at DESC'
      : query.sort === 'followUp' ? 'e.follow_up_at IS NULL, e.follow_up_at ASC'
      : 'e.created_at DESC'

    const [rows] = await pool.query<any[]>(
      `SELECT e.id, e.ref_code refCode, e.name, e.email, e.phone, e.category, e.subject, e.status, e.priority,
              e.assigned_to assignedTo, a.full_name assignedToName, e.follow_up_at followUpAt, e.resolved_at resolvedAt,
              e.created_at createdAt, e.updated_at updatedAt,
              (SELECT COUNT(*) FROM enquiry_attachments t WHERE t.enquiry_id=e.id) attachmentCount
       FROM contact_enquiries e LEFT JOIN users a ON a.id=e.assigned_to
       ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...args, query.pageSize, (query.page - 1) * query.pageSize])
    const [countRows] = await pool.query<any[]>(`SELECT COUNT(*) total FROM contact_enquiries e ${clause}`, args)
    const [stats] = await pool.query<any[]>(`
      SELECT COUNT(*) total,
             SUM(status='NEW') newCount,
             SUM(status='NEW' AND assigned_to IS NULL) unassignedCount,
             SUM(status IN ('ASSIGNED','IN_PROGRESS','WAITING_FOR_REPLY')) inProgressCount,
             SUM(status IN ('RESOLVED','CLOSED')) resolvedCount,
             SUM(status='SPAM') spamCount,
             SUM(follow_up_at IS NOT NULL AND follow_up_at < NOW() AND status IN (${openStatuses.map(() => '?').join(',')})) overdueCount
      FROM contact_enquiries`, [...openStatuses])

    res.json({
      enquiries: rows.map((row: any) => ({ ...row, overdue: row.followUpAt && new Date(row.followUpAt) < new Date() && openStatuses.includes(row.status) })),
      total: Number(countRows[0].total),
      page: query.page,
      pageSize: query.pageSize,
      stats: {
        total: Number(stats[0].total),
        new: Number(stats[0].newCount ?? 0),
        unassigned: Number(stats[0].unassignedCount ?? 0),
        inProgress: Number(stats[0].inProgressCount ?? 0),
        resolved: Number(stats[0].resolvedCount ?? 0),
        spam: Number(stats[0].spamCount ?? 0),
        overdue: Number(stats[0].overdueCount ?? 0),
      },
    })
  } catch (error) { next(error) }
})

enquiriesRouter.get('/:id', ...adminOnly, async (req, res, next) => {
  try {
    if (!isUuid.test(String(req.params.id))) return res.status(404).json({ error: 'Enquiry not found' })
    const [rows] = await pool.query<any[]>(`
      SELECT e.id, e.ref_code refCode, e.name, e.email, e.phone, e.category, e.subject, e.message, e.status, e.priority,
             e.assigned_to assignedTo, a.full_name assignedToName, e.follow_up_at followUpAt, e.resolved_at resolvedAt,
             e.created_at createdAt, e.updated_at updatedAt
      FROM contact_enquiries e LEFT JOIN users a ON a.id=e.assigned_to WHERE e.id=?`, [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Enquiry not found' })
    const [messages] = await pool.query<any[]>(
      `SELECT m.id, m.direction, m.body, m.email_status emailStatus, m.created_at createdAt, u.full_name authorName
       FROM enquiry_messages m LEFT JOIN users u ON u.id=m.author_user_id WHERE m.enquiry_id=? ORDER BY m.created_at, m.id`, [req.params.id])
    const [notes] = await pool.query<any[]>(
      `SELECT n.id, n.body, n.created_at createdAt, u.full_name authorName
       FROM enquiry_notes n JOIN users u ON u.id=n.author_user_id WHERE n.enquiry_id=? ORDER BY n.created_at, n.id`, [req.params.id])
    const [attachments] = await pool.query<any[]>(
      'SELECT id, file_name fileName, mime_type mimeType, byte_size byteSize, created_at createdAt FROM enquiry_attachments WHERE enquiry_id=? ORDER BY created_at', [req.params.id])
    res.json({ enquiry: rows[0], messages, notes, attachments })
  } catch (error) { next(error) }
})

enquiriesRouter.patch('/:id', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    if (!isUuid.test(String(req.params.id))) return res.status(404).json({ error: 'Enquiry not found' })
    const input = z.object({
      status: z.enum(statuses).optional(),
      priority: z.enum(priorities).optional(),
      assignedTo: z.string().trim().regex(/^[0-9a-f-]{36}$/).nullable().optional(),
      followUpAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).nullable().optional(),
      resolutionNote: z.string().trim().max(2000).optional(),
    }).superRefine((value, ctx) => {
      if (Object.keys(value).length === 0) ctx.addIssue({ code: 'custom', message: 'Nothing to update' })
    }).parse(req.body)

    const [existing] = await pool.query<any[]>('SELECT id, status, assigned_to assignedTo, ref_code refCode FROM contact_enquiries WHERE id=?', [req.params.id])
    if (!existing.length) return res.status(404).json({ error: 'Enquiry not found' })
    const current = existing[0]

    if (input.assignedTo !== undefined && input.assignedTo !== null) {
      const [staff] = await pool.query<any[]>(`
        SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
        WHERE u.id=? AND u.status='ACTIVE' AND r.name IN ('SUPER_ADMIN','ADMIN','SUPPORT_AGENT','REGISTRATION_MANAGER')`, [input.assignedTo])
      if (!staff.length) return res.status(400).json({ error: 'Only active staff members can be assigned' })
    }
    if (input.status === 'ASSIGNED' && !(input.assignedTo ?? current.assignedTo)) {
      return res.status(400).json({ error: 'Assign a staff member before moving an enquiry to ASSIGNED' })
    }

    const sets: string[] = []
    const args: unknown[] = []
    if (input.status) { sets.push('status=?'); args.push(input.status) }
    if (input.priority) { sets.push('priority=?'); args.push(input.priority) }
    if (input.assignedTo !== undefined) { sets.push('assigned_to=?'); args.push(input.assignedTo) }
    if (input.followUpAt !== undefined) { sets.push('follow_up_at=?'); args.push(input.followUpAt ? `${input.followUpAt}:00`.slice(0, 19).replace('T', ' ') : null) }
    if (input.status === 'RESOLVED') { sets.push('resolved_at=NOW()') }
    if (input.status && input.status !== 'RESOLVED') { sets.push('resolved_at=NULL') }
    args.push(req.params.id)
    await pool.query(`UPDATE contact_enquiries SET ${sets.join(', ')} WHERE id=?`, args)

    const log: string[] = []
    if (input.status && input.status !== current.status) log.push(`Status set to ${input.status}`)
    if (input.priority) log.push(`Priority set to ${input.priority}`)
    if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) log.push(input.assignedTo ? 'Enquiry assigned to staff' : 'Assignment cleared')
    if (input.followUpAt !== undefined) log.push(input.followUpAt ? `Follow-up scheduled for ${input.followUpAt}` : 'Follow-up cleared')
    if (log.length) {
      await pool.query('INSERT INTO enquiry_messages(id,enquiry_id,direction,author_user_id,body) VALUES (?,?,\'SYSTEM\',?,?)',
        [crypto.randomUUID(), req.params.id, req.user!.id, log.join(' · ')])
    }
    if (input.resolutionNote) {
      await pool.query('INSERT INTO enquiry_notes(id,enquiry_id,author_user_id,body) VALUES (?,?,?,?)',
        [crypto.randomUUID(), req.params.id, req.user!.id, `Resolution: ${input.resolutionNote}`])
    }
    await recordAudit(req.user!.id, 'enquiries.update', 'contact_enquiry', req.params.id as string, { refCode: current.refCode, ...input })
    res.json({ ok: true })
  } catch (error) { next(error) }
})

enquiriesRouter.post('/:id/notes', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    if (!isUuid.test(String(req.params.id))) return res.status(404).json({ error: 'Enquiry not found' })
    const body = z.string().trim().min(1).max(2000).parse(req.body?.body)
    const [enquiry] = await pool.query<any[]>('SELECT id, ref_code refCode FROM contact_enquiries WHERE id=?', [req.params.id])
    if (!enquiry.length) return res.status(404).json({ error: 'Enquiry not found' })
    await pool.query('INSERT INTO enquiry_notes(id,enquiry_id,author_user_id,body) VALUES (?,?,?,?)', [crypto.randomUUID(), req.params.id, req.user!.id, body])
    await recordAudit(req.user!.id, 'enquiries.note', 'contact_enquiry', req.params.id as string, { refCode: enquiry[0].refCode })
    res.status(201).json({ ok: true })
  } catch (error) { next(error) }
})

enquiriesRouter.post('/:id/reply', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    if (!isUuid.test(String(req.params.id))) return res.status(404).json({ error: 'Enquiry not found' })
    const input = z.object({ body: z.string().trim().min(1).max(5000) }).parse(req.body)
    const [rows] = await pool.query<any[]>('SELECT id, email, name, ref_code refCode, subject FROM contact_enquiries WHERE id=?', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Enquiry not found' })
    const enquiry = rows[0]
    const messageId = crypto.randomUUID()
    let emailStatus = 'FAILED'
    let delivered = false
    try {
      const result = await queueEmail(enquiry.email, `Re: ${enquiry.subject} — ${enquiry.refCode}`,
        `Hello ${enquiry.name},\n\n${input.body}\n\n— The Haat of Art team\nReference: ${enquiry.refCode}`)
      delivered = Boolean(result.delivered)
      emailStatus = result.delivered ? 'SENT' : result.reason === 'SMTP not configured' ? 'SKIPPED' : 'FAILED'
    } catch {
      emailStatus = 'FAILED'
    }
    await pool.query('INSERT INTO enquiry_messages(id,enquiry_id,direction,author_user_id,body,email_status) VALUES (?,?,\'OUTGOING\',?,?,?)',
      [messageId, enquiry.id, req.user!.id, input.body, emailStatus])
    await recordAudit(req.user!.id, 'enquiries.reply', 'contact_enquiry', enquiry.id, { refCode: enquiry.refCode, emailStatus })
    res.status(201).json({ ok: true, emailStatus, delivered })
  } catch (error) { next(error) }
})

enquiriesRouter.get('/:id/attachments/:attachmentId', ...adminOnly, async (req: AuthRequest, res, next) => {
  try {
    const [rows] = await pool.query<any[]>(
      'SELECT file_name fileName, mime_type mimeType, data FROM enquiry_attachments WHERE id=? AND enquiry_id=?',
      [req.params.attachmentId, req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Attachment not found' })
    res.setHeader('Content-Type', rows[0].mimeType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].fileName)}`)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.send(rows[0].data)
  } catch (error) { next(error) }
})
