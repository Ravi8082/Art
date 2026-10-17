import { Router } from 'express'
import { z } from 'zod'
import { pool, withTransaction } from '../db/pool.js'
import { requireAuth, requirePermission, type AuthRequest } from '../middleware/auth.js'

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
      GROUP_CONCAT(DISTINCT direct_p.name ORDER BY direct_p.name SEPARATOR ',') directPermissions
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
      })),
      roles: [...dashboardRoles],
      permissions: permissions.map((permission: { name: string }) => permission.name),
    })
  } catch (error) {
    next(error)
  }
})

dashboardRouter.put('/users/:userId/roles', requireAuth, requirePermission('roles:manage'), async (req: AuthRequest, res, next) => {
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
      const [metricsResult, postsResult, mediaResult, artistsResult, artworksResult, partnersResult, activityResult, altTextResult] = await Promise.all([
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
          SELECT COALESCE(NULLIF(alt_text,''), kind) title, kind detail, 'Library' kind,
            CONCAT('/api/about/media/', id) mediaUrl, created_at createdAt
          FROM media_assets WHERE media_type='IMAGE' AND kind NOT LIKE 'application-%'
          UNION ALL
          SELECT title, artist_name detail, 'Artwork' kind,
            CONCAT('/api/content/artworks/', id, '/image') mediaUrl, created_at createdAt
          FROM artworks
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
            + (SELECT COUNT(*) FROM media_assets WHERE media_type='IMAGE' AND kind NOT LIKE 'application-%') total,
          (SELECT COUNT(*) FROM homepage_media WHERE mime_type LIKE 'image/%' AND TRIM(alt_text) <> '')
            + (SELECT COUNT(*) FROM media_assets WHERE media_type='IMAGE' AND kind NOT LIKE 'application-%' AND TRIM(alt_text) <> '') described`),
      ])
      const rows = metricsResult[0][0] ?? {}
      const posts = postsResult[0]
      const media = mediaResult[0]
      const artists = artistsResult[0]
      const artworks = artworksResult[0]
      const partners = partnersResult[0]
      const altText = altTextResult[0][0] ?? {}
      return res.json({
        role,
        metrics: [
          metric('Managed pages', 5, 'Home, About, Exhibitions, Gallery and Contact'),
          metric('Banners / sliders', count(rows.heroSlides), `${count(rows.homepageMedia)} homepage media slots`, 'blue'),
          metric('Gallery photos', count(rows.artworks), 'Public artwork catalogue', 'purple'),
          metric('Published blogs', count(rows.blogPosts), 'Stories on the website', 'green'),
          metric('Artist profiles', count(rows.artists), 'Public artist directory', 'blue'),
          metric('Partners & mentors', count(rows.partnersAndMentors), `${count(rows.pendingBlogs)} blogs awaiting review`, 'orange'),
        ],
        sections: [
          { title: 'Recent blog posts', items: posts },
          { title: 'Recent media updates', items: media },
        ],
        contentOverview: {
          media,
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
      const [metricsResult, eventsResult, registrationsResult] = await Promise.all([
        pool.query<any[]>(`SELECT
          (SELECT COUNT(*) FROM event_registrations WHERE status='REGISTERED') registrations,
          (SELECT COUNT(*) FROM check_ins) checkedIn,
          (SELECT COUNT(*) FROM qr_passes WHERE revoked_at IS NULL) activePasses,
          (SELECT COUNT(*) FROM event_registrations r LEFT JOIN check_ins c ON c.pass_id=(SELECT q.id FROM qr_passes q WHERE q.registration_id=r.id) WHERE r.status='REGISTERED' AND c.id IS NULL) waiting`,
        ),
        pool.query<any[]>(`SELECT e.title, CONCAT(e.city, ' · ', DATE_FORMAT(e.starts_at,'%e %b %Y')) detail,
          e.status, e.starts_at createdAt,
          (SELECT COUNT(*) FROM event_registrations r WHERE r.event_id=e.id AND r.status='REGISTERED') registrations
          FROM events e WHERE e.status IN ('APPROVED','PUBLISHED') AND e.ends_at >= CURRENT_DATE()
          ORDER BY e.starts_at LIMIT 5`),
        pool.query<any[]>(`SELECT v.full_name title, CONCAT(e.title, ' · ', DATE_FORMAT(r.created_at,'%e %b %Y')) detail,
          IF(c.id IS NULL, 'Registered', 'Checked in') status, r.created_at createdAt
          FROM event_registrations r JOIN visitor_profiles v ON v.id=r.visitor_id
          JOIN events e ON e.id=r.event_id LEFT JOIN qr_passes q ON q.registration_id=r.id
          LEFT JOIN check_ins c ON c.pass_id=q.id WHERE r.status='REGISTERED'
          ORDER BY r.created_at DESC LIMIT 6`),
      ])
      const rows = metricsResult[0][0] ?? {}
      const events = eventsResult[0]
      const registrations = registrationsResult[0]
      return res.json({
        role,
        metrics: [
          metric('Visitor registrations', count(rows.registrations), 'Across published exhibitions', 'orange'),
          metric('Checked in', count(rows.checkedIn), 'Successful event entries', 'green'),
          metric('Yet to check in', count(rows.waiting), 'Registered attendees', 'blue'),
          metric('Active QR passes', count(rows.activePasses), 'Not revoked', 'purple'),
        ],
        sections: [
          { title: 'Upcoming event desk', items: events },
          { title: 'Recent registrations', items: registrations },
        ],
      })
    }

    if (role === 'ARTIST_EXHIBITOR') {
      const [metricsResult, applicationsResult, bookingsResult] = await Promise.all([
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
      ])
      const rows = metricsResult[0][0] ?? {}
      const applications = applicationsResult[0]
      const bookings = bookingsResult[0]
      return res.json({
        role,
        metrics: [
          metric('Applications', count(rows.applications), `${count(rows.underReview)} under review`, 'orange'),
          metric('Stall bookings', count(rows.stallBookings), 'Your exhibition spaces', 'blue'),
          metric('Confirmed bookings', count(rows.confirmedBookings), 'Successfully paid', 'green'),
          metric('Total paid', Number(rows.paid ?? 0), 'Confirmed stall bookings · INR', 'purple'),
        ],
        sections: [
          { title: 'My exhibition applications', items: applications },
          { title: 'My stall bookings', items: bookings },
        ],
      })
    }

    const [userResult] = await pool.query<any[]>('SELECT email FROM users WHERE id=?', [req.user!.id])
    const userRows = userResult
    const email = String(userRows[0]?.email ?? '')
    const [profileResult] = await pool.query<any[]>('SELECT id FROM visitor_profiles WHERE email=?', [email])
    const profiles = profileResult
    const profileId = profiles[0]?.id as string | undefined
    const [registrations, upcoming] = await Promise.all([
      profileId
        ? pool.query<any[]>(`SELECT e.title, CONCAT(e.city, ' · ', DATE_FORMAT(e.starts_at,'%e %b %Y')) detail,
            IF(q.revoked_at IS NULL AND q.id IS NOT NULL, 'Pass active', 'Registered') status,
            r.created_at createdAt, q.id passId
            FROM event_registrations r JOIN events e ON e.id=r.event_id
            LEFT JOIN qr_passes q ON q.registration_id=r.id
            WHERE r.visitor_id=? AND r.status='REGISTERED' ORDER BY e.starts_at DESC LIMIT 10`, [profileId])
        : Promise.resolve([[]]),
      pool.query<any[]>(`SELECT title, CONCAT(city, ' · ', DATE_FORMAT(starts_at,'%e %b %Y')) detail,
          status, starts_at createdAt FROM events
          WHERE status IN ('APPROVED','PUBLISHED') AND ends_at >= CURRENT_DATE()
          ORDER BY starts_at LIMIT 5`),
    ])
    const passes = (registrations[0] as any[]).filter((item) => item.passId && item.status === 'Pass active').length
    return res.json({
      role,
      metrics: [
        metric('My registrations', registrations[0].length, 'Your exhibition history', 'orange'),
        metric('Active QR passes', passes, 'Ready for event entry', 'green'),
        metric('Upcoming exhibitions', upcoming[0].length, 'Explore what is coming', 'blue'),
      ],
      sections: [
        { title: 'My event registrations', items: (registrations[0] as any[]).map(({ passId: _passId, ...item }) => item) },
        { title: 'Upcoming exhibitions', items: upcoming[0] },
      ],
    })
  } catch (error) {
    next(error)
  }
})
