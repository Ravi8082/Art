import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'
import { referenceQrValue } from '../services/pass-token.js'

const adminWriteLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false })

export const dashboardRouter = Router()

const dashboardRoles = new Set([
  'SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'REGISTRATION_MANAGER', 'ARTIST_EXHIBITOR', 'VISITOR',
])
const dashboardRoleList = [...dashboardRoles] as [string, ...string[]]

function metric(label: string, value: number | string, detail: string, tone = 'orange') {
  return { label, value, detail, tone }
}

function count(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

dashboardRouter.get('/users', requireAuth, requirePermission('roles:manage'), async (_req, res, next) => {
  try {
    const [users] = await pool.query<any[]>(`SELECT u.id, u.full_name fullName, u.email, u.status,
      u.created_at createdAt,
      GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ',') roles,
      GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ',') permissions,
      GROUP_CONCAT(DISTINCT direct_p.name ORDER BY direct_p.name SEPARATOR ',') directPermissions,
      (SELECT GROUP_CONCAT(s.state ORDER BY s.state SEPARATOR '|') FROM staff_state_access s WHERE s.user_id=u.id) states,
      (SELECT GROUP_CONCAT(a.event_id) FROM staff_event_access a WHERE a.user_id=u.id) eventIds
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id=u.id
      LEFT JOIN roles r ON r.id=ur.role_id
      LEFT JOIN role_permissions rp ON rp.role_id=r.id
      LEFT JOIN permissions p ON p.id=rp.permission_id
      LEFT JOIN user_permissions up ON up.user_id=u.id
      LEFT JOIN permissions direct_p ON direct_p.id=up.permission_id
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`)
    const [permissions] = await pool.query<any[]>('SELECT name FROM permissions ORDER BY name')
    res.json({
      users: users.map((user: any) => ({
        ...user,
        roles: user.roles ? String(user.roles).split(',') : [],
        permissions: user.permissions ? String(user.permissions).split(',') : [],
        directPermissions: user.directPermissions ? String(user.directPermissions).split(',') : [],
        states: user.states ? String(user.states).split('|') : [],
        eventIds: user.eventIds ? String(user.eventIds).split(',') : [],
      })),
      roles: [...dashboardRoles],
      permissions: permissions.map((permission: { name: string }) => permission.name),
    })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.put('/users/:userId/roles', requireAuth, requirePermission('roles:manage'), adminWriteLimit, async (req: AuthRequest, res, next) => {
  try {
    const input = z.object({
      roles: z.array(z.enum(dashboardRoleList as [typeof dashboardRoleList[number], ...typeof dashboardRoleList[number][]])).min(1).max(dashboardRoles.size),
      permissions: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    }).parse(req.body)
    if (input.roles.includes('SUPER_ADMIN') && !req.user!.roles.includes('SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Only a Super Admin can grant Super Admin access' })
    }
    const result = await withTransaction(async (connection) => {
      const [targetRows] = await connection.query<any[]>('SELECT id FROM users WHERE id=? FOR UPDATE', [req.params.userId])
      if (!targetRows.length) return { status: 404 as const, error: 'User not found' }

      const uniquePermissions = input.permissions === undefined ? undefined : [...new Set(input.permissions)]
      const permissionRows = uniquePermissions === undefined
        ? undefined
        : uniquePermissions.length
          ? (await connection.query<any[]>(
            `SELECT id,name FROM permissions WHERE name IN (${uniquePermissions.map(() => '?').join(',')})`,
            uniquePermissions,
          ))[0]
          : []
      if (permissionRows && permissionRows.length !== uniquePermissions?.length) {
        return { status: 400 as const, error: 'One or more permissions are not configured' }
      }

      const [existingRoles] = await connection.query<any[]>(
        'SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=?',
        [req.params.userId],
      )
      const hadSuperAdmin = existingRoles.some((entry: { name: string }) => entry.name === 'SUPER_ADMIN')
      if (hadSuperAdmin && !input.roles.includes('SUPER_ADMIN')) {
        const [activeRoots] = await connection.query<any[]>(
          `SELECT u.id FROM users u
           JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
           WHERE r.name='SUPER_ADMIN' AND u.status='ACTIVE' FOR UPDATE`,
        )
        if (activeRoots.length <= 1) return { status: 409 as const, error: 'At least one active Super Admin must remain' }
      }

      await connection.query('DELETE FROM user_roles WHERE user_id=?', [req.params.userId])
      for (const roleName of input.roles) {
        const [roleRows] = await connection.query<any[]>('SELECT id FROM roles WHERE name=?', [roleName])
        if (!roleRows.length) throw new Error(`Dashboard role is not configured: ${roleName}`)
        await connection.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [req.params.userId, roleRows[0].id])
      }
      if (input.permissions) {
        await connection.query('DELETE FROM user_permissions WHERE user_id=?', [req.params.userId])
        for (const permission of permissionRows ?? []) {
          await connection.query(
            'INSERT INTO user_permissions(user_id,permission_id,granted_by) VALUES (?,?,?)',
            [req.params.userId, permission.id, req.user!.id],
          )
        }
      }
      await connection.query(
        'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
        [req.user!.id, 'dashboard.user_access.updated', 'user', req.params.userId,
          JSON.stringify({ roles: input.roles, directPermissions: input.permissions ?? null })],
      )
      return { status: 200 as const, roles: input.roles, directPermissions: uniquePermissions }
    })
    if (result.status !== 200) return res.status(result.status).json({ error: result.error })
    res.json({ userId: req.params.userId, roles: result.roles, directPermissions: result.directPermissions })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/staff-events', requireAuth, requirePermission('roles:manage'), async (_req, res, next) => {
  try {
    const [events] = await pool.query<any[]>(`SELECT id,title,city,state,starts_at startsAt FROM events
      WHERE status IN ('APPROVED','PUBLISHED') AND ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ORDER BY starts_at LIMIT 200`)
    res.json({ events })
  } catch (error) {
    next(error)
  }
})

const staffAssignment = z.object({
  states: z.array(z.string().trim().min(2).max(80)).max(40).default([]),
  eventIds: z.array(z.string().uuid()).max(200).default([]),
})

async function saveStaffAssignment(
  connection: { query: (sql: string, values?: unknown[]) => Promise<any> },
  userId: string, actorId: string, input: z.infer<typeof staffAssignment>,
) {
  const states = [...new Map(input.states.map((state) => [state.toLowerCase(), state])).values()]
  const eventIds = [...new Set(input.eventIds)]
  await connection.query('DELETE FROM staff_state_access WHERE user_id=?', [userId])
  await connection.query('DELETE FROM staff_event_access WHERE user_id=?', [userId])
  for (const state of states) {
    await connection.query('INSERT INTO staff_state_access(user_id,state,assigned_by) VALUES (?,?,?)', [userId, state, actorId])
  }
  for (const eventId of eventIds) {
    await connection.query('INSERT INTO staff_event_access(user_id,event_id,assigned_by) VALUES (?,?,?)', [userId, eventId, actorId])
  }
  await connection.query(
    'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES (?,?,?,?,?)',
    [actorId, 'dashboard.staff_assignment.updated', 'user', userId, JSON.stringify({ states, eventIds })],
  )
  return { states, eventIds }
}

dashboardRouter.put('/users/:userId/states', requireAuth, requirePermission('roles:manage'), adminWriteLimit, async (req: AuthRequest, res, next) => {
  try {
    const input = staffAssignment.parse(req.body)
    const result = await withTransaction(async (connection) => {
      const [targetRows] = await connection.query<any[]>('SELECT id FROM users WHERE id=? FOR UPDATE', [req.params.userId])
      if (!targetRows.length) return null
      return saveStaffAssignment(connection, String(req.params.userId), req.user!.id, input)
    })
    if (!result) return res.status(404).json({ error: 'User not found' })
    res.json({ userId: req.params.userId, ...result })
  } catch (error) {
    next(error)
  }
})

// Admin creates a registration-staff account already scoped to specific states/events.
dashboardRouter.post('/staff', requireAuth, requirePermission('roles:manage'), adminWriteLimit, async (req: AuthRequest, res, next) => {
  try {
    const input = staffAssignment.extend({
      fullName: z.string().trim().min(2).max(160),
      email: z.string().trim().toLowerCase().email().max(255),
      password: z.string().min(12).max(128),
    }).parse(req.body)
    if (!input.states.length && !input.eventIds.length) {
      return res.status(400).json({ error: 'Assign at least one state or event to this staff member' })
    }
    const userId = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(input.password, 12)
    const result = await withTransaction(async (connection) => {
      const [taken] = await connection.query<any[]>('SELECT id FROM users WHERE email=?', [input.email])
      if (taken.length) return null
      const [roleRows] = await connection.query<any[]>("SELECT id FROM roles WHERE name='REGISTRATION_MANAGER'")
      if (!roleRows.length) throw new Error('Dashboard role is not configured: REGISTRATION_MANAGER')
      await connection.query(
        "INSERT INTO users(id,email,password_hash,full_name,status,email_verified_at) VALUES (?,?,?,?,'ACTIVE',NOW())",
        [userId, input.email, passwordHash, input.fullName])
      await connection.query('INSERT INTO user_roles(user_id,role_id) VALUES (?,?)', [userId, roleRows[0].id])
      return saveStaffAssignment(connection, userId, req.user!.id, input)
    })
    if (!result) return res.status(409).json({ error: 'An account already uses this email address' })
    res.status(201).json({ userId, email: input.email, ...result })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/reports', requireAuth, requirePermission('reports:read'), async (_req, res, next) => {
  try {
    const [summaryResult, monthlyResult, eventResult, paymentResult, trendResult, applicationStatusResult, stallStatusResult, upcomingResult] = await Promise.all([
      pool.query<any[]>(`SELECT
        (SELECT COUNT(*) FROM users) totalUsers,
        (SELECT COUNT(*) FROM users WHERE status='ACTIVE') activeUsers,
        (SELECT COUNT(*) FROM events) totalEvents,
        (SELECT COUNT(*) FROM events WHERE status='PUBLISHED') publishedEvents,
        (SELECT COUNT(*) FROM exhibition_applications) totalApplications,
        (SELECT COUNT(*) FROM exhibition_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')) pendingApplications,
        (SELECT COUNT(*) FROM stall_bookings) totalBookings,
        (SELECT COUNT(*) FROM stall_bookings WHERE status='CONFIRMED') confirmedBookings,
        (SELECT COALESCE(SUM(total_amount),0) FROM stall_bookings WHERE status='CONFIRMED') confirmedRevenue,
        (SELECT COUNT(*) FROM payments WHERE status='PENDING') paymentsToReview,
        (SELECT COUNT(*) FROM event_registrations WHERE status='REGISTERED') visitorRegistrations,
        (SELECT COUNT(*) FROM check_ins) visitorCheckIns`),
      pool.query<any[]>(`SELECT DATE_FORMAT(issued_at,'%Y-%m') month,
        COUNT(*) invoices, COALESCE(SUM(amount + tax_amount),0) revenue
        FROM invoices WHERE issued_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 5 MONTH)
        GROUP BY DATE_FORMAT(issued_at,'%Y-%m') ORDER BY month`),
      pool.query<any[]>(`SELECT e.id,e.title,e.city,e.status,e.starts_at startsAt,
        COUNT(DISTINCT a.id) applications,
        COUNT(DISTINCT CASE WHEN b.status='CONFIRMED' THEN b.id END) confirmedBookings,
        COALESCE((SELECT SUM(sb.total_amount) FROM stall_bookings sb
          WHERE sb.event_id=e.id AND sb.status='CONFIRMED'),0) revenue,
        (SELECT COUNT(*) FROM event_registrations er
          WHERE er.event_id=e.id AND er.status='REGISTERED') visitorRegistrations
        FROM events e
        LEFT JOIN exhibition_applications a ON a.event_id=e.id
        LEFT JOIN stall_bookings b ON b.event_id=e.id
        GROUP BY e.id ORDER BY e.starts_at DESC LIMIT 12`),
      pool.query<any[]>(`SELECT status,COUNT(*) total FROM payments GROUP BY status ORDER BY status`),
      pool.query<any[]>(`SELECT DATE_FORMAT(day,'%Y-%m-%d') day,
        SUM(visitors) visitors,SUM(artists) artists,SUM(stalls) stalls FROM (
          SELECT DATE(created_at) day,COUNT(*) visitors,0 artists,0 stalls
          FROM event_registrations
          WHERE status='REGISTERED' AND created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY)
          GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) day,0 visitors,COUNT(*) artists,0 stalls
          FROM exhibition_applications
          WHERE created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY)
          GROUP BY DATE(created_at)
          UNION ALL
          SELECT DATE(created_at) day,0 visitors,0 artists,COUNT(*) stalls
          FROM stall_bookings
          WHERE created_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 29 DAY)
          GROUP BY DATE(created_at)
        ) activity
        GROUP BY day ORDER BY day`),
      pool.query<any[]>(`SELECT status,COUNT(*) total FROM exhibition_applications GROUP BY status ORDER BY status`),
      pool.query<any[]>(`SELECT status,COUNT(*) total FROM stall_bookings GROUP BY status ORDER BY status`),
      pool.query<any[]>(`SELECT e.id,e.title,e.city,e.starts_at startsAt,
        COUNT(DISTINCT CASE WHEN b.status IN ('CONFIRMED','PAYMENT_PENDING') THEN b.id END) bookedStalls,
        (SELECT COUNT(*) FROM stalls s WHERE s.event_id=e.id) totalStalls
        FROM events e LEFT JOIN stall_bookings b ON b.event_id=e.id
        WHERE e.status IN ('APPROVED','PUBLISHED') AND e.starts_at>=CURRENT_DATE()
        GROUP BY e.id ORDER BY e.starts_at LIMIT 4`),
    ])
    const row = summaryResult[0][0] ?? {}
    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers: count(row.totalUsers),
        activeUsers: count(row.activeUsers),
        totalEvents: count(row.totalEvents),
        publishedEvents: count(row.publishedEvents),
        totalApplications: count(row.totalApplications),
        pendingApplications: count(row.pendingApplications),
        totalBookings: count(row.totalBookings),
        confirmedBookings: count(row.confirmedBookings),
        confirmedRevenue: Number(row.confirmedRevenue ?? 0),
        paymentsToReview: count(row.paymentsToReview),
        visitorRegistrations: count(row.visitorRegistrations),
        visitorCheckIns: count(row.visitorCheckIns),
      },
      monthlyRevenue: monthlyResult[0],
      events: eventResult[0],
      paymentsByStatus: paymentResult[0],
      registrationTrend: trendResult[0],
      applicationStatuses: applicationStatusResult[0],
      stallStatuses: stallStatusResult[0],
      upcomingEvents: upcomingResult[0],
    })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/audit', requireAuth, requirePermission('audit:read'), async (req, res, next) => {
  try {
    const pageInput = z.coerce.number().int().min(1).max(10000).safeParse(req.query.page ?? 1)
    const limitInput = z.coerce.number().int().min(1).max(100).safeParse(req.query.limit ?? 50)
    const searchInput = z.string().trim().max(120).safeParse(req.query.q ?? '')
    if (!pageInput.success || !limitInput.success || !searchInput.success) {
      return res.status(400).json({ error: 'Invalid audit search or pagination parameters' })
    }
    const where = searchInput.data
      ? 'WHERE (a.action LIKE ? OR a.entity_type LIKE ? OR u.email LIKE ? OR a.entity_id LIKE ?)'
      : ''
    const search = `%${searchInput.data}%`
    const params = searchInput.data ? [search, search, search, search] : []
    const [rows, totals] = await Promise.all([
      pool.query<any[]>(`SELECT a.id,a.action,a.entity_type entityType,a.entity_id entityId,
        a.metadata,a.created_at createdAt,u.full_name actorName,u.email actorEmail
        FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id
        ${where} ORDER BY a.created_at DESC,a.id DESC LIMIT ? OFFSET ?`,
      [...params, limitInput.data, (pageInput.data - 1) * limitInput.data]),
      pool.query<any[]>(`SELECT COUNT(*) total FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ${where}`, params),
    ])
    res.json({
      entries: rows[0].map((entry: any) => ({
        ...entry,
        metadata: typeof entry.metadata === 'string' ? JSON.parse(entry.metadata) : entry.metadata,
      })),
      page: pageInput.data,
      limit: limitInput.data,
      total: count(totals[0][0]?.total),
    })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/system', requireAuth, requirePermission('settings:manage'), async (_req, res, next) => {
  try {
    const [[database]] = await pool.query<any[]>('SELECT DATABASE() databaseName, VERSION() databaseVersion')
    const [countsResult, emailResult, activityResult] = await Promise.all([
      pool.query<any[]>(`SELECT
        (SELECT COUNT(*) FROM users WHERE status='ACTIVE') activeUsers,
        (SELECT COUNT(*) FROM users WHERE status='SUSPENDED') suspendedUsers,
        (SELECT COUNT(*) FROM otp_challenges WHERE consumed_at IS NULL AND expires_at>NOW()) pendingChallenges,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at>=DATE_SUB(NOW(),INTERVAL 24 HOUR)) auditEvents24h,
        (SELECT COUNT(*) FROM qr_passes WHERE revoked_at IS NULL) activePasses`),
      pool.query<any[]>(`SELECT status,COUNT(*) total FROM email_delivery_records
        WHERE created_at>=DATE_SUB(NOW(),INTERVAL 7 DAY) GROUP BY status`),
      pool.query<any[]>(`SELECT action,entity_type entityType,created_at createdAt
        FROM audit_logs ORDER BY created_at DESC,id DESC LIMIT 8`),
    ])
    const rows = countsResult[0][0] ?? {}
    res.json({
      health: { database: 'ok', application: 'ok' },
      runtime: {
        databaseName: database.databaseName,
        databaseVersion: database.databaseVersion,
        nodeVersion: process.version,
        environment: process.env.NODE_ENV ?? 'development',
        emailProviderConfigured: Boolean(process.env.SMTP_HOST),
        secureCookiesEnabled: process.env.NODE_ENV === 'production',
        jwtSecretConfigured: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
      },
      security: {
        activeUsers: count(rows.activeUsers),
        suspendedUsers: count(rows.suspendedUsers),
        pendingVerificationChallenges: count(rows.pendingChallenges),
        auditEventsLast24Hours: count(rows.auditEvents24h),
        activeVisitorPasses: count(rows.activePasses),
      },
      emailDeliveriesLast7Days: emailResult[0].map((item: any) => ({ status: item.status, count: count(item.total) })),
      recentActivity: activityResult[0],
      checkedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.get('/summary', requireAuth, requirePermission('dashboard:read'), async (req: AuthRequest, res, next) => {
  try {
    const requestedRole = String(req.query.role ?? '')
    const role = dashboardRoles.has(requestedRole)
      ? requestedRole
      : ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'REGISTRATION_MANAGER', 'ARTIST_EXHIBITOR', 'VISITOR']
        .find((candidate) => req.user!.roles.includes(candidate))

    if (!role) return res.status(403).json({ error: 'This account has no dashboard role' })
    if (!req.user!.roles.includes('SUPER_ADMIN') && !req.user!.roles.includes(role)) {
      return res.status(403).json({ error: 'You do not have access to this dashboard' })
    }

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      const [metricsResult, applicationsResult, bookingsResult, activityResult, blogResult, enquiriesResult] = await Promise.all([
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM users WHERE status='ACTIVE') activeUsers,
          (SELECT COUNT(*) FROM events WHERE status IN ('APPROVED','PUBLISHED')) activeEvents,
          (SELECT COUNT(*) FROM events WHERE status='PENDING_APPROVAL') pendingEvents,
          (SELECT COUNT(*) FROM exhibition_applications WHERE status IN ('SUBMITTED','UNDER_REVIEW')) pendingApplications,
          (SELECT COUNT(*) FROM visitor_profiles WHERE email_verified_at IS NOT NULL) verifiedVisitors,
          (SELECT COUNT(*) FROM event_registrations WHERE status='REGISTERED') visitorRegistrations,
          (SELECT COUNT(*) FROM qr_passes WHERE revoked_at IS NULL) activePasses,
          (SELECT COUNT(*) FROM stalls s LEFT JOIN stall_bookings b ON b.stall_id=s.id AND b.status IN ('CONFIRMED','PAYMENT_PENDING','REFUND_PENDING') WHERE b.id IS NOT NULL) stallsBooked,
          (SELECT COALESCE(SUM(total_amount),0) FROM stall_bookings WHERE status='CONFIRMED') revenue,
          (SELECT COUNT(*) FROM payments WHERE status='PENDING') pendingPayments,
          (SELECT COUNT(*) FROM contact_enquiries WHERE status NOT IN ('RESOLVED','CLOSED','SPAM')) openEnquiries,
          (SELECT COUNT(*) FROM blog_posts WHERE status='PENDING') pendingBlogSubmissions`),
        pool.query<any[]>(`SELECT a.application_ref reference, CONCAT(a.first_name, ' ', a.last_name) title,
          CONCAT(e.title, ' · ', a.art_form) detail, a.status, a.created_at createdAt
          FROM exhibition_applications a JOIN events e ON e.id=a.event_id
          ORDER BY a.created_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT b.booking_ref reference, CONCAT(u.full_name, ' · ', s.code) title,
          CONCAT(e.title, ' · ₹', FORMAT(b.total_amount, 2)) detail, b.status, b.created_at createdAt
          FROM stall_bookings b JOIN users u ON u.id=b.user_id JOIN events e ON e.id=b.event_id
          JOIN stalls s ON s.id=b.stall_id ORDER BY b.created_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT action, entity_type entityType, created_at createdAt
          FROM audit_logs ORDER BY created_at DESC LIMIT 6`),
        pool.query<any[]>(`SELECT id reference, title, CONCAT(author, ' · ', submitter_email) detail, status, submitted_at createdAt
          FROM blog_posts WHERE status='PENDING' ORDER BY submitted_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT ref_code reference,name title,CONCAT(category,' · ',subject) detail,status,created_at createdAt
          FROM contact_enquiries WHERE status NOT IN ('RESOLVED','CLOSED','SPAM')
          ORDER BY created_at DESC LIMIT 5`),
      ])
      const rows = metricsResult[0][0] ?? {}
      const applications = applicationsResult[0]
      const bookings = bookingsResult[0]
      const activity = activityResult[0]
      const blogSubmissions = blogResult[0]
      const enquiries = enquiriesResult[0]
      return res.json({
        role,
        metrics: [
          metric('Active users', count(rows.activeUsers), 'Verified platform accounts', 'blue'),
          metric('Pending artist applications', count(rows.pendingApplications), 'Applications awaiting review'),
          metric('Visitor registrations', count(rows.visitorRegistrations), `${count(rows.verifiedVisitors)} verified visitors`, 'green'),
          metric('Active exhibitions', count(rows.activeEvents), `${count(rows.pendingEvents)} awaiting approval`, 'blue'),
          metric('Stalls booked', count(rows.stallsBooked), 'Confirmed or awaiting payment', 'purple'),
          metric('Blogs awaiting review', count(rows.pendingBlogSubmissions), 'Pending admin approval', 'orange'),
          ...(role === 'SUPER_ADMIN' || role === 'ADMIN'
            ? [metric('Confirmed revenue', count(rows.revenue), `${count(rows.pendingPayments)} payments to review`, 'green')]
            : []),
          metric('Open enquiries', count(rows.openEnquiries), 'Needs a team response', 'orange'),
        ],
        sections: [
          { title: 'Recent artist applications', items: applications },
          { title: 'Recent stall bookings', items: bookings },
          { title: 'Recent platform activity', items: activity.map((item: any) => ({
            title: item.action, detail: item.entityType, status: 'Logged', createdAt: item.createdAt,
          })) },
          { title: 'Recent blog submissions', items: blogSubmissions },
          { title: 'Recent enquiries', items: enquiries },
        ],
      })
    }

    if (role === 'CONTENT_MANAGER') {
      const [metricsResult, postsResult, mediaResult, artistsResult, artworksResult, partnersResult, activityResult, altTextResult, pagesResult] = await Promise.all([
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM site_content) contentEntries,
          (SELECT COUNT(*) FROM homepage_media) homepageMedia,
          (SELECT COUNT(*) FROM homepage_media WHERE media_key IN ('hero','hero2','hero3')) heroSlides,
          (SELECT COUNT(*) FROM blog_posts WHERE status='APPROVED') blogPosts,
          (SELECT COUNT(*) FROM blog_posts WHERE status='PENDING') pendingBlogs,
          (SELECT COUNT(*) FROM artworks) artworks,
          (SELECT COUNT(*) FROM artists) artists,
          (SELECT COUNT(*) FROM event_partners WHERE active=1)
            + (SELECT COUNT(*) FROM team_members WHERE active=1)
            + (SELECT COUNT(*) FROM guests WHERE active=1) partnersAndMentors`),
        pool.query<any[]>(`SELECT title, author detail, 'Published' status, published_at createdAt
          FROM blog_posts WHERE status='APPROVED' ORDER BY published_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT title, detail, kind, mediaUrl, createdAt FROM (
          SELECT media_key title, alt_text detail, 'Homepage' kind,
            CONCAT('/api/homepage/media/', media_key) mediaUrl, updated_at createdAt
          FROM homepage_media WHERE mime_type LIKE 'image/%'
          UNION ALL
          SELECT title, artist_name detail, 'Artwork' kind,
            CONCAT('/api/content/artworks/', id, '/image') mediaUrl, created_at createdAt
          FROM artworks
          UNION ALL
          SELECT name title, city detail, 'Artist' kind,
            CONCAT('/api/content/artists/', id, '/photo') mediaUrl, created_at createdAt
          FROM artists WHERE photo_mime LIKE 'image/%'
        ) recent ORDER BY createdAt DESC LIMIT 6`),
        pool.query<any[]>(`SELECT id, name title, city detail, photo_mime IS NOT NULL hasPhoto,
          created_at createdAt FROM artists ORDER BY created_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT id, title, artist_name detail, created_at createdAt,
          CONCAT('/api/content/artworks/', id, '/image') mediaUrl
          FROM artworks ORDER BY created_at DESC LIMIT 5`),
        pool.query<any[]>(`SELECT id, name title, category detail, 'Partner' kind, updated_at createdAt
          FROM event_partners WHERE active=1
          UNION ALL
          SELECT id, name title, designation detail, 'Mentor' kind, updated_at createdAt
          FROM team_members WHERE active=1
          UNION ALL
          SELECT id, name title, role detail, 'Guest' kind, updated_at createdAt
          FROM guests WHERE active=1
          ORDER BY createdAt DESC LIMIT 5`),
        pool.query<any[]>(`SELECT title, detail, status, createdAt FROM (
          SELECT title, author detail, 'Blog published' status, published_at createdAt
          FROM blog_posts WHERE status='APPROVED'
          UNION ALL
          SELECT media_key title, alt_text detail, 'Homepage media updated' status, updated_at createdAt
          FROM homepage_media
          UNION ALL
          SELECT content_key title, 'Website copy' detail, 'Page content updated' status, updated_at createdAt
          FROM site_content
          UNION ALL
          SELECT title, artist_name detail, 'Artwork added' status, created_at createdAt
          FROM artworks
        ) activity ORDER BY createdAt DESC LIMIT 6`),
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM homepage_media WHERE mime_type LIKE 'image/%')
            + (SELECT COUNT(*) FROM artworks)
            + (SELECT COUNT(*) FROM artists WHERE photo_mime LIKE 'image/%') total,
          (SELECT COUNT(*) FROM homepage_media WHERE mime_type LIKE 'image/%' AND TRIM(alt_text) <> '')
            + (SELECT COUNT(*) FROM artworks WHERE TRIM(title) <> '')
            + (SELECT COUNT(*) FROM artists WHERE photo_mime LIKE 'image/%' AND TRIM(name) <> '') described`),
        pool.query<any[]>(`SELECT page.title, page.status, page.updatedAt createdAt FROM (
          SELECT 1 sortOrder, 'Home Page' title,
            IF((SELECT COUNT(*) FROM homepage_media WHERE mime_type LIKE 'image/%') > 0, 'Published', 'Draft') status,
            (SELECT MAX(updated_at) FROM homepage_media WHERE mime_type LIKE 'image/%') updatedAt
          UNION ALL
          SELECT 2, 'About Us',
            IF((SELECT COUNT(*) FROM about_publish_history) > 0, 'Published', 'Draft'),
            (SELECT MAX(created_at) FROM about_publish_history)
          UNION ALL
          SELECT 3, 'Exhibitions',
            IF((SELECT COUNT(*) FROM events WHERE status='PUBLISHED') > 0, 'Published', 'Draft'),
            (SELECT MAX(updated_at) FROM events)
          UNION ALL
          SELECT 4, 'Gallery',
            IF((SELECT COUNT(*) FROM artworks) > 0, 'Published', 'Draft'),
            (SELECT MAX(created_at) FROM artworks)
          UNION ALL
          SELECT 5, 'Contact Us',
            IF((SELECT COUNT(*) FROM site_content WHERE content_key LIKE 'contact%' AND TRIM(content_value) <> '') > 0, 'Published', 'Draft'),
            (SELECT MAX(updated_at) FROM site_content WHERE content_key LIKE 'contact%')
        ) page ORDER BY page.sortOrder`),
      ])
      const rows = metricsResult[0][0] ?? {}
      const posts = postsResult[0]
      const media = mediaResult[0]
      const artists = artistsResult[0]
      const artworks = artworksResult[0]
      const partners = partnersResult[0]
      const altText = altTextResult[0][0] ?? {}
      const pages = pagesResult[0]
      return res.json({
        role,
        metrics: [
          metric('Total Pages', pages.length, `${pages.filter((page: any) => page.status === 'Published').length} currently published`),
          metric('Banners / Sliders', count(rows.homepageMedia), `${count(rows.heroSlides)} hero slides`, 'blue'),
          metric('Gallery Photos', count(rows.artworks), 'Public artwork catalogue', 'purple'),
          metric('Approved Blogs', count(rows.blogPosts), `${count(rows.pendingBlogs)} awaiting review`, 'green'),
          metric('Artist Profiles (Public)', count(rows.artists), 'Public artist directory', 'blue'),
          metric('Partners & Mentors', count(rows.partnersAndMentors), 'Active public collaborators', 'orange'),
        ],
        sections: [
          { title: 'Recent blog posts', items: posts },
          { title: 'Recent media updates', items: media },
        ],
        contentOverview: {
          media,
          pages,
          artists: artists.map((item: any) => ({
            id: item.id, title: item.title, detail: item.detail,
            status: 'Public', createdAt: item.createdAt,
            mediaUrl: item.hasPhoto ? `/api/content/artists/${item.id}/photo` : null,
          })),
          artworks,
          partners,
          recentActivity: activityResult[0],
          altText: { total: count(altText.total), described: count(altText.described) },
          serviceStatus: { application: 'Online', database: 'Connected' },
        },
      })
    }

    if (role === 'REGISTRATION_MANAGER') {
      // Non-admin staff only see events assigned to them (directly or by state).
      const unrestricted = req.user!.roles.some((name) => name === 'ADMIN' || name === 'SUPER_ADMIN')
      const [assigned] = unrestricted ? [[]] : await pool.query<any[]>(`SELECT e.id FROM events e
        WHERE e.id IN (SELECT event_id FROM staff_event_access WHERE user_id=?)
          OR LOWER(e.state) IN (SELECT LOWER(state) FROM staff_state_access WHERE user_id=?)`, [req.user!.id, req.user!.id])
      const scopeIds = assigned.length ? assigned.map((row: any) => row.id) : ['']
      const sc = unrestricted ? '' : 'AND e.id IN (?)'
      const sp = unrestricted ? [] : [scopeIds]
      const [eventsResult, registrationsResult, checkInsResult, metricResult, dailyResult] = await Promise.all([
        pool.query<any[]>(`SELECT e.id,e.title,e.city,e.state,e.venue,e.starts_at startsAt,e.ends_at endsAt,
          IF(NOW() BETWEEN e.starts_at AND e.ends_at,'Live',IF(e.starts_at>NOW(),'Upcoming','Recently ended')) status,
          COUNT(DISTINCT CASE WHEN r.status='REGISTERED' THEN r.id END) registrations,
          COUNT(DISTINCT CASE WHEN r.status='REGISTERED' AND c.id IS NOT NULL THEN r.id END) checkedIn
          FROM events e
          LEFT JOIN event_registrations r ON r.event_id=e.id
          LEFT JOIN qr_passes q ON q.registration_id=r.id AND q.revoked_at IS NULL
          LEFT JOIN check_ins c ON c.pass_id=q.id
          WHERE e.status IN ('APPROVED','PUBLISHED') AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}
          GROUP BY e.id ORDER BY e.starts_at LIMIT 20`, sp),
        pool.query<any[]>(`SELECT r.id registrationId,v.full_name title,v.email,
          e.id eventId,e.title eventTitle,IF(c.id IS NULL,'Registered','Checked in') status,
          r.created_at createdAt,c.checked_in_at checkedInAt
          FROM event_registrations r JOIN visitor_profiles v ON v.id=r.visitor_id
          JOIN events e ON e.id=r.event_id
          LEFT JOIN qr_passes q ON q.registration_id=r.id AND q.revoked_at IS NULL
          LEFT JOIN check_ins c ON c.pass_id=q.id
          WHERE r.status='REGISTERED' AND e.status IN ('APPROVED','PUBLISHED')
            AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}
          ORDER BY r.created_at DESC LIMIT 8`, sp),
        pool.query<any[]>(`SELECT c.id,v.full_name title,v.email,e.id eventId,e.title eventTitle,
          'Checked in' status,c.checked_in_at createdAt
          FROM check_ins c JOIN qr_passes q ON q.id=c.pass_id AND q.revoked_at IS NULL
          JOIN event_registrations r ON r.id=q.registration_id AND r.status='REGISTERED'
          JOIN visitor_profiles v ON v.id=r.visitor_id JOIN events e ON e.id=r.event_id
          WHERE e.status IN ('APPROVED','PUBLISHED') AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}
          ORDER BY c.checked_in_at DESC LIMIT 8`, sp),
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM event_registrations r JOIN events e ON e.id=r.event_id
            WHERE r.status='REGISTERED' AND e.status IN ('APPROVED','PUBLISHED')
              AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}) registrations,
          (SELECT COUNT(*) FROM check_ins c JOIN qr_passes q ON q.id=c.pass_id AND q.revoked_at IS NULL
            JOIN event_registrations r ON r.id=q.registration_id AND r.status='REGISTERED'
            JOIN events e ON e.id=r.event_id WHERE e.status IN ('APPROVED','PUBLISHED')
              AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}) checkedIn,
          (SELECT COUNT(*) FROM qr_passes q JOIN event_registrations r ON r.id=q.registration_id AND r.status='REGISTERED'
            JOIN events e ON e.id=r.event_id WHERE q.revoked_at IS NULL
              AND e.status IN ('APPROVED','PUBLISHED') AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}) activePasses,
          (SELECT COUNT(*) FROM events e WHERE e.status IN ('APPROVED','PUBLISHED')
            AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) ${sc}) activeEvents,
          (SELECT COUNT(*) FROM check_ins c JOIN qr_passes q ON q.id=c.pass_id AND q.revoked_at IS NULL
            JOIN event_registrations r ON r.id=q.registration_id AND r.status='REGISTERED'
            JOIN events e ON e.id=r.event_id WHERE e.status IN ('APPROVED','PUBLISHED')
              AND e.ends_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) AND c.checked_in_at>=CURRENT_DATE() ${sc}) todayEntries`,
        [...sp, ...sp, ...sp, ...sp, ...sp]),
        pool.query<any[]>(`SELECT DATE_FORMAT(c.checked_in_at,'%Y-%m-%d') day,COUNT(*) total
          FROM check_ins c JOIN qr_passes q ON q.id=c.pass_id AND q.revoked_at IS NULL
          JOIN event_registrations r ON r.id=q.registration_id AND r.status='REGISTERED'
          JOIN events e ON e.id=r.event_id
          WHERE e.status IN ('APPROVED','PUBLISHED') AND c.checked_in_at>=DATE_SUB(CURRENT_DATE(),INTERVAL 6 DAY) ${sc}
          GROUP BY DATE_FORMAT(c.checked_in_at,'%Y-%m-%d') ORDER BY day`, sp),
      ])
      const rows = metricResult[0][0] ?? {}
      const events = eventsResult[0]
      const registrations = registrationsResult[0]
      const checkIns = checkInsResult[0]
      const dailyCheckIns = dailyResult[0]
      return res.json({
        role,
        metrics: [
          metric('Total Registrations', count(rows.registrations), 'Recent published exhibitions', 'orange'),
          metric('Checked In', count(rows.checkedIn), 'Valid event entries', 'green'),
          metric('Yet to Check In', Math.max(0, count(rows.registrations) - count(rows.checkedIn)), 'Registered attendees', 'blue'),
          metric('Active QR Passes', count(rows.activePasses), 'Not revoked', 'purple'),
          metric('Active Exhibitions', count(rows.activeEvents), 'Open or within the last 30 days', 'orange'),
          metric('Today’s Entries', count(rows.todayEntries), 'Successful scans today', 'green'),
        ],
        sections: [
          { title: 'Recent registrations', items: registrations.map((item: any) => ({
            id: item.registrationId, title: item.title, detail: `${item.eventTitle} · ${item.email}`,
            status: item.status, createdAt: item.createdAt,
          })) },
          { title: 'Recent check-ins', items: checkIns.map((item: any) => ({
            id: item.id, title: item.title, detail: `${item.eventTitle} · ${item.email}`,
            status: item.status, createdAt: item.createdAt,
          })) },
        ],
        eventStaffOverview: { events, registrations, checkIns, dailyCheckIns },
      })
    }

    if (role === 'ARTIST_EXHIBITOR') {
      const [metricsResult, applicationsResult, bookingsResult, upcomingEventsResult] = await Promise.all([
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM exhibition_applications WHERE user_id=?) applications,
          (SELECT COUNT(*) FROM exhibition_applications WHERE user_id=? AND status IN ('SUBMITTED','UNDER_REVIEW')) underReview,
          (SELECT COUNT(*) FROM stall_bookings WHERE user_id=? AND status='CONFIRMED') confirmedBookings,
          (SELECT COUNT(*) FROM stall_bookings WHERE user_id=?) stallBookings,
          (SELECT COALESCE(SUM(total_amount),0) FROM stall_bookings WHERE user_id=? AND status='CONFIRMED') paid`,
        [req.user!.id, req.user!.id, req.user!.id, req.user!.id, req.user!.id]),
        pool.query<any[]>(`SELECT a.application_ref reference, e.title, CONCAT(a.art_form, ' · ', DATE_FORMAT(a.created_at,'%e %b %Y')) detail,
          a.status, a.created_at createdAt FROM exhibition_applications a JOIN events e ON e.id=a.event_id
          WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 5`, [req.user!.id]),
        pool.query<any[]>(`SELECT b.booking_ref reference, e.title, CONCAT(s.code, ' · ₹', FORMAT(b.total_amount,2)) detail,
          b.status, b.created_at createdAt FROM stall_bookings b JOIN events e ON e.id=b.event_id
          JOIN stalls s ON s.id=b.stall_id WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 5`, [req.user!.id]),
        pool.query<any[]>(`SELECT e.id,e.title,e.city,e.venue,e.description,e.starts_at startsAt,e.ends_at endsAt,
            (SELECT em.id FROM event_media em WHERE em.event_id=e.id AND em.media_type='IMAGE' AND em.data IS NOT NULL ORDER BY em.sort_order,em.id LIMIT 1) mediaId
          FROM events e WHERE e.status IN ('APPROVED','PUBLISHED') AND e.starts_at >= CURRENT_DATE()
          ORDER BY e.starts_at LIMIT 4`),
      ])
      const rows = metricsResult[0][0] ?? {}
      const applications = applicationsResult[0]
      const bookings = bookingsResult[0]
      return res.json({
        role,
        metrics: [
          metric('Applications', count(rows.applications), `${count(rows.underReview)} under review`, 'orange'),
          metric('Under review', count(rows.underReview), 'Applications awaiting a decision', 'purple'),
          metric('Stall bookings', count(rows.stallBookings), 'Your exhibition spaces', 'blue'),
          metric('Confirmed bookings', count(rows.confirmedBookings), 'Successfully paid', 'green'),
          metric('Total paid', Number(rows.paid ?? 0), 'Confirmed stall bookings · INR', 'purple'),
        ],
        sections: [
          { title: 'My exhibition applications', items: applications },
          { title: 'My stall bookings', items: bookings },
        ],
        artistOverview: {
          upcomingEvents: upcomingEventsResult[0].map((event: any) => ({
            ...event,
            mediaUrl: event.mediaId ? `/api/events/${event.id}/media/${event.mediaId}` : null,
          })),
        },
      })
    }

    const [userResult] = await pool.query<any[]>('SELECT email,full_name fullName FROM users WHERE id=?', [req.user!.id])
    const account = userResult[0]
    const email = String(account?.email ?? '')
    const [profileResult] = await pool.query<any[]>('SELECT id FROM visitor_profiles WHERE email=?', [email])
    const profileId = profileResult[0]?.id as string | undefined
    const [registrations, upcoming, postsResult, artistsResult, storyCountResult, artistCountResult] = await Promise.all([
      profileId
        ? pool.query<any[]>(`SELECT r.id registrationId,e.id eventId,e.title,e.city,e.venue,
            e.starts_at startsAt,e.ends_at endsAt,e.description,r.created_at createdAt,
            q.id passId,q.reference_code referenceCode,q.revoked_at revokedAt,c.checked_in_at checkedInAt,
            (SELECT em.id FROM event_media em WHERE em.event_id=e.id AND em.media_type='IMAGE' AND em.data IS NOT NULL ORDER BY em.sort_order,em.id LIMIT 1) mediaId
            FROM event_registrations r JOIN events e ON e.id=r.event_id
            LEFT JOIN qr_passes q ON q.registration_id=r.id
            LEFT JOIN check_ins c ON c.pass_id=q.id
            WHERE r.visitor_id=? AND r.status='REGISTERED'
            ORDER BY e.starts_at DESC LIMIT 10`, [profileId])
        : Promise.resolve([[]]),
      pool.query<any[]>(`SELECT e.id,e.title,e.city,e.venue,e.description,e.starts_at startsAt,e.ends_at endsAt,
          (SELECT em.id FROM event_media em WHERE em.event_id=e.id AND em.media_type='IMAGE' AND em.data IS NOT NULL ORDER BY em.sort_order,em.id LIMIT 1) mediaId
          FROM events e
          WHERE status IN ('APPROVED','PUBLISHED') AND ends_at >= CURRENT_DATE()
          ORDER BY starts_at LIMIT 5`),
      pool.query<any[]>(`SELECT id,title,excerpt,author,published_at publishedAt,
          cover_mime IS NOT NULL hasCover FROM blog_posts WHERE status='APPROVED'
          ORDER BY published_at DESC,id DESC LIMIT 3`),
      pool.query<any[]>(`SELECT id,name,city,photo_mime IS NOT NULL hasPhoto
          FROM artists ORDER BY created_at DESC,id DESC LIMIT 4`),
      pool.query<any[]>(`SELECT COUNT(*) total FROM blog_posts WHERE status='APPROVED'`),
      pool.query<any[]>(`SELECT COUNT(*) total FROM artists`),
    ])
    const visitorRegistrations = registrations[0].map((item: any) => ({
      ...item,
      status: item.revokedAt ? 'Revoked' : item.checkedInAt ? 'Used' : item.passId ? 'Pass active' : 'Registered',
      mediaUrl: item.mediaId ? `/api/events/${item.eventId}/media/${item.mediaId}` : null,
      qrData: item.passId && item.referenceCode && !item.revokedAt && !item.checkedInAt
        ? referenceQrValue(item.referenceCode)
        : null,
    }))
    const visitorEvents = upcoming[0].map((item: any) => ({
      ...item,
      mediaUrl: item.mediaId ? `/api/events/${item.id}/media/${item.mediaId}` : null,
    }))
    const activePasses = visitorRegistrations.filter((item: any) => item.status === 'Pass active')
    return res.json({
      role,
      metrics: [
        metric('Total Registrations', visitorRegistrations.length, 'Your exhibition history', 'orange'),
        metric('Active QR Passes', activePasses.length, 'Ready for event entry', 'green'),
        metric('Upcoming Exhibitions', visitorEvents.length, 'Explore what is coming', 'blue'),
        metric('Favourite Events', '—', 'Event favourites are not saved yet', 'purple'),
        metric('Days to Next Event', visitorEvents.length
          ? Math.max(0, Math.ceil((new Date(visitorEvents[0].startsAt).getTime() - Date.now()) / 86400000))
          : '—', visitorEvents.length ? visitorEvents[0].title : 'No upcoming exhibition', 'orange'),
      ],
      sections: [
        { title: 'My event registrations', items: visitorRegistrations.map((item: any) => ({
          id: item.registrationId, title: item.title,
          detail: `${item.city || item.venue} · ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(item.startsAt))}`,
          status: item.status, createdAt: item.createdAt, mediaUrl: item.mediaUrl,
        })) },
        { title: 'Upcoming exhibitions', items: visitorEvents.map((item: any) => ({
          id: item.id, title: item.title, detail: `${item.city || item.venue} · ${item.startsAt}`,
          status: 'Upcoming', createdAt: item.startsAt, mediaUrl: item.mediaUrl,
        })) },
      ],
      visitorOverview: {
        fullName: account?.fullName ?? '',
        registrations: visitorRegistrations,
        upcoming: visitorEvents,
        blogs: postsResult[0].map((post: any) => ({
          ...post,
          mediaUrl: post.hasCover ? `/api/content/blog/${post.id}/cover` : null,
        })),
        artists: artistsResult[0].map((artist: any) => ({
          id: artist.id, title: artist.name, detail: artist.city,
          mediaUrl: artist.hasPhoto ? `/api/content/artists/${artist.id}/photo` : null,
        })),
        totals: {
          stories: count(storyCountResult[0][0]?.total),
          artists: count(artistCountResult[0][0]?.total),
        },
      },
    })
  } catch (error) {
    next(error)
  }
})
