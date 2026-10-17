'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { visitorPassUrl } from '@/lib/visitor-pass-url'
import {
  Activity, ArrowRight, BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronDown,
  CircleAlert, ClipboardList, FileCheck2, GalleryVerticalEnd, Heart, Image, LayoutDashboard,
  LogOut, Mail, MapPin, Menu, QrCode, Search, Settings, ShieldCheck, Store, TicketCheck, Users, Wallet, X,
} from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

const dashboardRoles = [
  'SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'REGISTRATION_MANAGER', 'ARTIST_EXHIBITOR', 'VISITOR',
] as const

type DashboardRole = (typeof dashboardRoles)[number]
type DashboardUser = { id: string; email: string; fullName: string; roles: string[]; permissions: string[] }
type DashboardItem = { id?: string; title: string; detail?: string; status?: string; createdAt?: string; reference?: string; mediaUrl?: string | null; kind?: string }
type EventStaffEvent = { id: string; title: string; city: string; venue: string; startsAt: string; endsAt: string; status: string; registrations: number; checkedIn: number }
type VisitorEvent = { id: string; title: string; city: string; venue: string; description: string; startsAt: string; endsAt: string; mediaUrl: string | null }
type VisitorRegistration = VisitorEvent & { registrationId: string; passId: string | null; status: string; createdAt: string; mediaId: string | null; revokedAt: string | null; checkedInAt: string | null; qrData: string | null }
type DashboardSummary = {
  role: DashboardRole
  metrics: { label: string; value: number | string; detail: string; tone: string }[]
  sections: { title: string; items: DashboardItem[] }[]
  contentOverview?: {
    media: DashboardItem[]
    pages: DashboardItem[]
    artists: DashboardItem[]
    artworks: DashboardItem[]
    partners: DashboardItem[]
    recentActivity: DashboardItem[]
    altText: { total: number; described: number }
    serviceStatus: { application: string; database: string }
  }
  eventStaffOverview?: {
    events: EventStaffEvent[]
    registrations: (DashboardItem & { eventId: string; eventTitle: string; email: string; checkedInAt: string | null })[]
    checkIns: (DashboardItem & { eventId: string; eventTitle: string; email: string })[]
    dailyCheckIns: { day: string; total: number }[]
  }
  visitorOverview?: {
    fullName: string
    registrations: VisitorRegistration[]
    upcoming: VisitorEvent[]
    blogs: (DashboardItem & { excerpt: string; author: string; publishedAt: string })[]
    artists: DashboardItem[]
    totals: { stories: number; artists: number }
  }
  artistOverview?: {
    upcomingEvents: VisitorEvent[]
  }
}
type DashboardReports = {
  generatedAt: string
  summary: Record<string, number>
  monthlyRevenue: { month: string; invoices: number; revenue: number | string }[]
  events: {
    id: string
    title: string
    city: string
    status: string
    startsAt: string
    applications: number
    confirmedBookings: number
    revenue: number | string
    visitorRegistrations: number
  }[]
  registrationTrend: { day: string; visitors: number; artists: number; stalls: number }[]
  applicationStatuses: { status: string; total: number }[]
  stallStatuses: { status: string; total: number }[]
  upcomingEvents: { id: string; title: string; city: string; startsAt: string; bookedStalls: number; totalStalls: number }[]
}
type DashboardSystem = {
  health: { application: string; database: string }
  runtime: { emailProviderConfigured: boolean; secureCookiesEnabled: boolean; jwtSecretConfigured: boolean }
  security: { activeUsers: number; suspendedUsers: number; activeVisitorPasses: number }
  checkedAt: string
}

const roleInfo: Record<DashboardRole, { label: string; title: (name: string) => string; subtitle: string; quote: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin', title: (name) => `Welcome back, ${name}!`,
    subtitle: 'Full platform visibility, security oversight and system-wide activity.',
    quote: 'Empowering artists, enriching communities.',
  },
  ADMIN: {
    label: 'Admin / Operations', title: (name) => `Welcome back, ${name}!`,
    subtitle: 'Manage exhibitions, applications, stall bookings and incoming enquiries.',
    quote: 'Art brings people together.',
  },
  CONTENT_MANAGER: {
    label: 'Content Manager', title: () => 'Welcome back, Content Manager!',
    subtitle: 'Manage the stories, media and pages that bring The Haat of Art to life.',
    quote: 'Great art deserves a greater story.',
  },
  REGISTRATION_MANAGER: {
    label: 'Event Staff', title: () => 'Welcome to Event Dashboard, Event Staff!',
    subtitle: 'Manage registrations, verify QR passes and help every visitor enjoy the exhibition.',
    quote: 'Every visitor adds a new story to the world of art.',
  },
  ARTIST_EXHIBITOR: {
    label: 'Artist / Exhibitor', title: (name) => `Welcome back, ${name}!`,
    subtitle: 'Track your exhibition applications, stall bookings and payments.',
    quote: 'Make space for your next big idea.',
  },
  VISITOR: {
    label: 'Visitor', title: (name) => `Welcome back, ${name}!`,
    subtitle: 'Explore art exhibitions, meet inspiring artists and keep every visitor pass ready.',
    quote: 'Art connects people, ideas and cultures.',
  },
}

const rolePriority = dashboardRoles
const roleNav: Record<DashboardRole, { label: string; href: string; icon: typeof LayoutDashboard; group?: string }[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, group: 'Workspace' },
    { label: 'Users & Roles', href: '/dashboard/users', icon: Users, group: 'Platform access' },
    { label: 'Content management', href: '/dashboard/content', icon: BookOpen, group: 'Management' },
    { label: 'Blog moderation', href: '/dashboard/content#blog-moderation', icon: FileCheck2 },
    { label: 'Exhibitions', href: '/dashboard/events', icon: CalendarDays },
    { label: 'Artist applications', href: '/dashboard/bookings', icon: FileCheck2 },
    { label: 'Visitor registrations', href: '/dashboard/check-in', icon: QrCode },
    { label: 'Stall bookings', href: '/dashboard/stalls', icon: Store },
    { label: 'Payments & finance', href: '/dashboard/finance', icon: Wallet },
    { label: 'Enquiries', href: '/dashboard/enquiries', icon: Mail },
    { label: 'Partners & guests', href: '/dashboard/guests', icon: Users },
    { label: 'Public gallery', href: '/gallery', icon: GalleryVerticalEnd },
    { label: 'Public blog', href: '/blog', icon: BookOpen },
    { label: 'Reports & analytics', href: '/dashboard/reports', icon: BarChart3, group: 'Administration' },
    { label: 'Media library', href: '/dashboard/homepage-media', icon: Image },
    { label: 'Email & system health', href: '/dashboard/system', icon: Settings },
    { label: 'Audit logs', href: '/dashboard/audit', icon: ClipboardList },
  ],
  ADMIN: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Reports & Analytics', href: '/dashboard/reports', icon: Activity },
    { label: 'Finance & Reconciliation', href: '/dashboard/finance', icon: Store },
    { label: 'Exhibitions', href: '/dashboard/events', icon: CalendarDays },
    { label: 'Artist Applications', href: '/dashboard/bookings', icon: FileCheck2 },
    { label: 'Stall Bookings', href: '/dashboard/stalls', icon: Store },
    { label: 'Blog moderation', href: '/dashboard/content#blog-moderation', icon: BookOpen },
    { label: 'Enquiries', href: '/dashboard/enquiries', icon: Users },
  ],
  CONTENT_MANAGER: [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Website Content', href: '/dashboard/content', icon: BookOpen, group: 'Content & design' },
    { label: 'Homepage Media', href: '/dashboard/homepage-media', icon: Image },
    { label: 'About Page', href: '/dashboard/about', icon: GalleryVerticalEnd },
    { label: 'Contact Page', href: '/dashboard/contact-page', icon: Users, group: 'Management' },
    { label: 'Guests & Feedback', href: '/dashboard/guests', icon: Users },
    { label: 'Exhibitions', href: '/dashboard/events', icon: CalendarDays, group: 'Events' },
  ],
  REGISTRATION_MANAGER: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Event Selection', href: '/exhibitions/events', icon: CalendarDays, group: 'Event operations' },
    { label: 'Visitor Registrations', href: '/dashboard/check-in', icon: Users, group: 'Entry desk' },
    { label: 'QR Scanner', href: '/dashboard/check-in', icon: QrCode },
    { label: 'Attendee Lookup', href: '/dashboard/check-in', icon: Search },
  ],
  ARTIST_EXHIBITOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Profile', href: '/artist/profile', icon: Users },
    { label: 'My Artwork', href: '/artist/artworks/new', icon: Image },
    { label: 'Exhibition Applications', href: '/artist/bookings', icon: FileCheck2 },
    { label: 'Stall Bookings', href: '/artist/bookings', icon: Store },
    { label: 'My Subscriptions', href: '/artist/plans', icon: Wallet },
    { label: 'Earnings & Payments', href: '/artist/bookings', icon: Activity },
    { label: 'Blogs', href: '/blog', icon: BookOpen, group: 'Discover' },
    { label: 'Gallery', href: '/gallery', icon: GalleryVerticalEnd },
    { label: 'Event Calendar', href: '/exhibitions/events', icon: CalendarDays },
    { label: 'Settings', href: '/artist/profile', icon: Settings, group: 'Support' },
    { label: 'Help & Support', href: '/contact', icon: Mail },
  ],
  VISITOR: [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Registrations', href: '/dashboard/passes', icon: TicketCheck, group: 'My events' },
    { label: 'My QR Passes', href: '/dashboard/passes', icon: QrCode },
    { label: 'Upcoming Exhibitions', href: '/exhibitions/events', icon: CalendarDays, group: 'Discover' },
    { label: 'Artist Directory', href: '/artists', icon: Users },
    { label: 'Blogs', href: '/blog', icon: BookOpen },
    { label: 'Gallery', href: '/gallery', icon: Image },
    { label: 'Notifications & Preferences', href: '/dashboard/passes', icon: Bell, group: 'Account' },
  ],
}

const actions: Record<DashboardRole, { label: string; href: string; icon: typeof CalendarDays; tone: string }[]> = {
  SUPER_ADMIN: [
    { label: 'View platform reports', href: '/dashboard/reports', icon: Activity, tone: 'blue' },
    { label: 'Review audit and security', href: '/dashboard/audit', icon: ShieldCheck, tone: 'violet' },
    { label: 'Create exhibition', href: '/dashboard/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Review applications', href: '/dashboard/bookings', icon: FileCheck2, tone: 'blue' },
    { label: 'Manage stalls', href: '/dashboard/stalls', icon: Store, tone: 'green' },
    { label: 'Update website content', href: '/dashboard/content', icon: BookOpen, tone: 'violet' },
    { label: 'Manage users & roles', href: '/dashboard/users', icon: ShieldCheck, tone: 'violet' },
    { label: 'Review blog submissions', href: '/dashboard/content#blog-moderation', icon: FileCheck2, tone: 'coral' },
  ],
  ADMIN: [
    { label: 'View operations reports', href: '/dashboard/reports', icon: Activity, tone: 'blue' },
    { label: 'Reconcile payments', href: '/dashboard/finance', icon: Store, tone: 'green' },
    { label: 'Manage exhibitions', href: '/dashboard/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Review applications', href: '/dashboard/bookings', icon: FileCheck2, tone: 'blue' },
    { label: 'Manage stalls', href: '/dashboard/stalls', icon: Store, tone: 'green' },
    { label: 'Review blog submissions', href: '/dashboard/content#blog-moderation', icon: BookOpen, tone: 'coral' },
    { label: 'View enquiries', href: '/dashboard/enquiries', icon: Users, tone: 'violet' },
  ],
  CONTENT_MANAGER: [
    { label: 'Edit website pages', href: '/dashboard/content', icon: BookOpen, tone: 'coral' },
    { label: 'Upload homepage media', href: '/dashboard/homepage-media', icon: Image, tone: 'blue' },
    { label: 'Update About page', href: '/dashboard/about', icon: GalleryVerticalEnd, tone: 'green' },
    { label: 'Manage exhibitions', href: '/dashboard/events', icon: CalendarDays, tone: 'violet' },
  ],
  REGISTRATION_MANAGER: [
    { label: 'View upcoming events', href: '/exhibitions/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Scan visitor passes', href: '/dashboard/check-in', icon: QrCode, tone: 'blue' },
  ],
  ARTIST_EXHIBITOR: [
    { label: 'Apply for an exhibition', href: '/book-your-stall', icon: CalendarDays, tone: 'coral' },
    { label: 'Update artist profile', href: '/artist/profile', icon: Users, tone: 'blue' },
    { label: 'Upload an artwork', href: '/artist/artworks/new', icon: Image, tone: 'green' },
    { label: 'View my bookings', href: '/artist/bookings', icon: Store, tone: 'violet' },
  ],
  VISITOR: [
    { label: 'Explore exhibitions', href: '/exhibitions/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Get a visitor pass', href: '/dashboard/passes', icon: QrCode, tone: 'blue' },
    { label: 'Browse the gallery', href: '/gallery', icon: Image, tone: 'green' },
    { label: 'Read latest stories', href: '/blog', icon: BookOpen, tone: 'violet' },
  ],
}

export function HaatPlatform({ redirectToDashboard = false }: { redirectToDashboard?: boolean }) {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [role, setRole] = useState<DashboardRole | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [reports, setReports] = useState<DashboardReports | null>(null)
  const [system, setSystem] = useState<DashboardSystem | null>(null)
  const [extraErrors, setExtraErrors] = useState<string[]>([])
  const [pageState, setPageState] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const allowedRoles = useMemo(() => {
    if (!user) return []
    if (user.roles.includes('SUPER_ADMIN')) return [...dashboardRoles]
    return rolePriority.filter((candidate) => user.roles.includes(candidate))
  }, [user])

  async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBase}${path}`, { ...init, credentials: 'include', headers: { accept: 'application/json', ...init?.headers } })
    const data = await response.json().catch(() => ({})) as { error?: string } & T
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
    return data
  }

  async function loadRoleSummary(activeRole: DashboardRole) {
    setRole(activeRole)
    setPageState('loading')
    setError('')
    setReports(null)
    setSystem(null)
    setExtraErrors([])
    try {
      const data = await getJson<DashboardSummary>(`/api/dashboard/summary?role=${encodeURIComponent(activeRole)}`)
      setSummary(data)
      setPageState('ready')
      if (activeRole === 'SUPER_ADMIN' || activeRole === 'ADMIN') {
        const [reportsResult, systemResult] = await Promise.allSettled([
          getJson<DashboardReports>('/api/dashboard/reports'),
          getJson<DashboardSystem>('/api/dashboard/system'),
        ])
        if (reportsResult.status === 'fulfilled') setReports(reportsResult.value)
        if (systemResult.status === 'fulfilled') setSystem(systemResult.value)
        setExtraErrors([
          ...(reportsResult.status === 'rejected' ? [`Reports unavailable: ${reportsResult.reason instanceof Error ? reportsResult.reason.message : 'request failed'}`] : []),
          ...(systemResult.status === 'rejected' ? [`System status unavailable: ${systemResult.reason instanceof Error ? systemResult.reason.message : 'request failed'}`] : []),
        ])
      }
      if (redirectToDashboard) router.replace('/dashboard')
    } catch (cause) {
      setSummary(null)
      setError(cause instanceof Error ? cause.message : 'Could not load this dashboard.')
      setPageState('error')
    }
  }

  async function loadCurrentUser() {
    try {
      const data = await getJson<{ user: DashboardUser }>('/api/auth/me')
      setUser(data.user)
      const activeRole = rolePriority.find((candidate) => data.user.roles.includes(candidate))
      if (!activeRole) {
        setPageState('error')
        setError('This account does not have access to a dashboard.')
        return
      }
      await loadRoleSummary(activeRole)
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'Authentication required') {
        setPageState('signed-out')
        return
      }
      setPageState('error')
      setError(cause instanceof Error ? cause.message : 'Could not verify your account.')
    }
  }

  useEffect(() => { void loadCurrentUser() }, [])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await getJson('/api/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
      setPassword('')
      await loadCurrentUser()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      await getJson('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setSummary(null)
      setReports(null)
      setSystem(null)
      setRole(null)
      setPageState('signed-out')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out.')
      setPageState('error')
    } finally {
      setBusy(false)
    }
  }

  if (pageState === 'loading' && !summary) return <main className="role-dashboard-loading"><span className="role-spinner" /> Loading your secure dashboard…</main>
  if (pageState === 'signed-out' || (!user && pageState !== 'error')) {
    return (
      <main className="role-login-screen">
        <section className="role-login-card">
          <Brand />
          <p className="role-eyebrow">Secure workspace</p>
          <h1>Sign in to your dashboard</h1>
          <p className="role-login-copy">Your account role determines which Haat of Art workspace you can access.</p>
          <form onSubmit={signIn}>
            <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            {error && <p className="role-error" role="alert">{error}</p>}
            <button className="role-primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={16} /></button>
          </form>
          <p className="visitor-login-prompt"><Link href="/password-reset">Forgot your password?</Link></p>
          <p className="visitor-login-prompt">New visitor? <Link href="/visitor/register">Create an account</Link></p>
          <Link href="/" className="role-back-link">Back to website</Link>
        </section>
      </main>
    )
  }
  if (!user || !role || !summary) {
    return <main className="role-dashboard-error"><Brand /><h1>Dashboard unavailable</h1><p role="alert">{error || 'This account could not open a dashboard.'}</p><button className="role-primary-button" onClick={() => void signOut()}>Sign out</button></main>
  }

  const info = roleInfo[role]
  const firstName = user.fullName.trim().split(/\s+/)[0] || info.label
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HA'
  const sections = summary.sections
  const activeNav = roleNav[role]
  const filteredSections = searchQuery.trim()
    ? sections.map((section) => ({
      ...section,
      items: section.items.filter((item) => `${item.title} ${item.detail ?? ''} ${item.status ?? ''} ${item.reference ?? ''}`
        .toLowerCase().includes(searchQuery.trim().toLowerCase())),
    }))
    : sections
  const searchPlaceholder = role === 'CONTENT_MANAGER'
    ? 'Search pages, media, artists…'
    : role === 'REGISTRATION_MANAGER'
      ? 'Search visitors, events, check-ins…'
      : role === 'ARTIST_EXHIBITOR'
        ? 'Search your applications and bookings…'
        : 'Search bookings, applications…'
  const notificationHref = role === 'SUPER_ADMIN'
    ? '/dashboard/audit'
    : role === 'ADMIN'
      ? '/dashboard/reports'
      : role === 'REGISTRATION_MANAGER'
        ? '/dashboard/check-in'
        : role === 'ARTIST_EXHIBITOR'
          ? '/artist/bookings'
          : role === 'VISITOR'
            ? '/dashboard/passes'
            : '/dashboard/content'

  return (
    <div className={`role-shell role-theme-${role.toLowerCase().replace(/_/g, '-')}`}>
      <header className="role-mobile-header"><Brand /><button aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></header>
      <aside className={`role-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <div className="role-brand-wrap"><Brand /><span className="role-safe"><ShieldCheck size={13} /> Secure portal</span></div>
        <div className="role-user-card"><span className="role-avatar">{initials}</span><span><strong>{user.fullName}</strong><small>{info.label}</small><small className="role-user-email">{user.email}</small></span></div>
        <nav aria-label="Dashboard navigation">
          {role !== 'SUPER_ADMIN' && <p className="role-nav-label">Workspace</p>}
          {activeNav.map(({ label, href, icon: Icon, group }) => (
            <div key={`${label}-${href}`}>
              {group && <p className={`role-nav-label ${group === 'Workspace' ? '' : 'role-nav-label-gap'}`}>{group}</p>}
              <Link href={href} className={`role-nav-link ${href === '/dashboard' ? 'is-active' : ''}`} onClick={() => setMenuOpen(false)}>
              <Icon size={17} /><span>{label}</span>{href === '/dashboard' && <span className="role-nav-dot" />}
              </Link>
            </div>
          ))}
          {role !== 'SUPER_ADMIN' && role !== 'ARTIST_EXHIBITOR' && <><p className="role-nav-label role-nav-label-gap">Quick links</p>
            {actions[role].slice(0, 3).map(({ label, href, icon: Icon }) => (
              <Link href={href} key={label} className="role-nav-link" onClick={() => setMenuOpen(false)}><Icon size={17} /><span>{label}</span></Link>
            ))}</>}
        </nav>
        <div className="role-sidebar-bottom">
          <Link href="/" className="role-website-link">View website <ArrowRight size={14} /></Link>
          <button className="role-logout" onClick={() => void signOut()} disabled={busy}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>
      <main className="role-main">
        <header className="role-topbar">
          <div className="role-breadcrumb"><span>Workspace</span><span>/</span><strong>{info.label}</strong></div>
          <div className="role-topbar-actions">
            <label className="role-search"><Search size={15} /><input aria-label="Search dashboard content" placeholder={searchPlaceholder} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>
            <Link className="role-notice" href={notificationHref} aria-label="Open recent dashboard activity"><Bell size={18} /></Link>
            {allowedRoles.length > 1 && (
              <label className="role-switcher-label"><span className="sr-only">Switch workspace</span>
                <select value={role} onChange={(event) => void loadRoleSummary(event.target.value as DashboardRole)}>
                  {allowedRoles.map((candidate) => <option key={candidate} value={candidate}>{roleInfo[candidate].label}</option>)}
                </select><ChevronDown size={14} />
              </label>
            )}
            <Link href={role === 'SUPER_ADMIN' ? '/dashboard/system' : '/dashboard'} className="role-top-avatar" aria-label={`Open ${info.label} profile and settings`}>{initials}</Link>
          </div>
        </header>
        <div className="role-content">
          <section className={`role-welcome${role === 'REGISTRATION_MANAGER' ? ' event-staff-welcome' : ''}${role === 'VISITOR' ? ' visitor-welcome' : ''}${role === 'ARTIST_EXHIBITOR' ? ' artist-welcome' : ''}`}>
            <img src={role === 'CONTENT_MANAGER' || role === 'REGISTRATION_MANAGER' || role === 'VISITOR' ? '/media/exhibition-gallery.jpeg' : '/media/hero-exhibition.jpg'} alt="Visitors exploring an art exhibition" />
            <div className="role-welcome-shade" />
            <div className="role-welcome-copy"><p className="role-eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><h1>{role === 'SUPER_ADMIN' ? <>Welcome back,<br /><strong>Super Admin!</strong></> : role === 'ADMIN' ? <>Welcome back,<br /><strong>{firstName}!</strong></> : role === 'CONTENT_MANAGER' ? <>Welcome back,<br /><strong>Content Manager!</strong></> : role === 'REGISTRATION_MANAGER' ? <>Welcome to Event Dashboard,<br /><strong>Event Staff!</strong></> : role === 'VISITOR' ? <>Welcome back,<br /><strong>{firstName}!</strong></> : info.title(firstName)}</h1><p>{info.subtitle}</p></div>
            <blockquote>{info.quote}</blockquote>
          </section>
          {pageState === 'error' && <p className="role-error role-inline-error" role="alert">{error}</p>}
          <section className="role-metrics" aria-label="Dashboard summary">
            {summary.metrics.map((item) => <article className="role-metric" key={item.label}>
              <span className={`role-metric-icon ${item.tone}`}><MetricIcon label={item.label} /></span>
              <div><small>{item.label}</small><strong>{formatMetric(item.value, item.label)}</strong><span>{item.detail}</span></div>
            </article>)}
          </section>
          {role === 'SUPER_ADMIN'
            ? <SuperAdminOverview reports={reports} system={system} extraErrors={extraErrors} sections={filteredSections} />
            : role === 'ADMIN'
              ? <AdminDashboardOverview reports={reports} system={system} extraErrors={extraErrors} sections={filteredSections} />
              : role === 'CONTENT_MANAGER'
                ? <ContentManagerOverview overview={summary.contentOverview} sections={filteredSections} searchQuery={searchQuery} />
                : role === 'REGISTRATION_MANAGER'
                  ? <EventStaffOverview overview={summary.eventStaffOverview} searchQuery={searchQuery} />
                  : role === 'VISITOR'
                    ? <VisitorDashboard overview={summary.visitorOverview} searchQuery={searchQuery} />
                      : role === 'ARTIST_EXHIBITOR'
                        ? <ArtistExhibitorOverview user={user} overview={summary.artistOverview} sections={filteredSections} metrics={summary.metrics} searchQuery={searchQuery} />
                : <section className="role-dashboard-grid">
            <div className="role-panel role-activity-panel">
              <div className="role-panel-heading"><div><p className="role-eyebrow">Workspace overview</p><h2>{sections[0]?.title ?? 'Your activity'}</h2></div><Activity size={18} /></div>
              <DashboardList items={filteredSections[0]?.items ?? []} empty={searchQuery ? 'No activity matches your search.' : 'Nothing here yet. New activity will appear as it becomes available.'} />
            </div>
            <div className="role-panel role-actions-panel">
              <div className="role-panel-heading"><div><p className="role-eyebrow">Shortcuts</p><h2>Quick actions</h2></div><ArrowRight size={17} /></div>
              <div className="role-action-list">{actions[role].map(({ label, href, icon: Icon, tone }) => <Link key={label} href={href} className={`role-action ${tone}`}><Icon size={17} /><span>{label}</span><ArrowRight size={14} /></Link>)}</div>
            </div>
            {filteredSections.slice(1).map((section) => (
              <div className="role-panel" key={section.title}>
                <div className="role-panel-heading"><div><p className="role-eyebrow">{info.label}</p><h2>{section.title}</h2></div><Check size={17} /></div>
                <DashboardList items={section.items} empty={searchQuery ? 'No activity matches your search.' : 'No recent items to show.'} />
              </div>
            ))}
          </section>}
          <footer className="role-footer"><span>The Haat of Art · Role-based workspace</span><span><ShieldCheck size={14} /> Your access is controlled by your account permissions</span></footer>
        </div>
      </main>
    </div>
  )
}

function ArtistExhibitorOverview({
  user,
  overview,
  sections,
  metrics,
  searchQuery,
}: {
  user: DashboardUser
  overview: DashboardSummary['artistOverview']
  sections: DashboardSummary['sections']
  metrics: DashboardSummary['metrics']
  searchQuery: string
}) {
  const query = searchQuery.trim().toLowerCase()
  const matches = (item: DashboardItem) => !query || `${item.title} ${item.detail ?? ''} ${item.status ?? ''} ${item.reference ?? ''}`.toLowerCase().includes(query)
  const applications = (sections.find((section) => section.title === 'My exhibition applications')?.items ?? []).filter(matches)
  const bookings = (sections.find((section) => section.title === 'My stall bookings')?.items ?? []).filter(matches)
  const events = (overview?.upcomingEvents ?? []).filter((event) =>
    !query || `${event.title} ${event.city} ${event.venue}`.toLowerCase().includes(query))
  const paidMetric = metrics.find((metric) => metric.label === 'Total paid')
  const recentActivity = [
    ...applications.map((item) => ({ ...item, kind: 'Application' })),
    ...bookings.map((item) => ({ ...item, kind: 'Stall booking' })),
  ].sort((left, right) => new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime()).slice(0, 4)
  const quickActions = [
    { label: 'Apply for an Exhibition', href: '/book-your-stall', icon: CalendarDays, tone: 'coral' },
    { label: 'Upload Artwork', href: '/artist/artworks/new', icon: Image, tone: 'blue' },
    { label: 'Manage Applications', href: '/artist/bookings', icon: FileCheck2, tone: 'green' },
    { label: 'Explore Plans', href: '/artist/plans', icon: Wallet, tone: 'violet' },
  ]
  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'HA'

  return (
    <div className="artist-dashboard">
      <section className="artist-dashboard-top-grid">
        <div className="role-panel artist-profile-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Your workspace</p><h2>Profile Overview</h2></div><Link href="/artist/profile" className="role-panel-link">Edit profile <ArrowRight size={12} /></Link></div>
          <div className="artist-profile-summary">
            <span className="artist-profile-avatar">{initials}</span>
            <div><strong>{user.fullName}</strong><span>Artist / Exhibitor</span><small>{user.email}</small></div>
          </div>
          <div className="artist-profile-detail"><span>Account type</span><strong>Artist &amp; Exhibitor</strong></div>
          <div className="artist-profile-detail"><span>Applications</span><strong>{formatMetric(metrics.find((metric) => metric.label === 'Applications')?.value ?? 0, 'Applications')}</strong></div>
          <Link href="/artist/profile" className="artist-secondary-link">View and update your profile <ArrowRight size={13} /></Link>
        </div>

        <div className="role-panel artist-portfolio-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Portfolio</p><h2>My Artwork</h2></div><Image size={17} /></div>
          <div className="artist-portfolio-empty">
            <span><Image size={23} /></span>
            <strong>Your portfolio starts here</strong>
            <p>Add artwork to build your profile and support exhibition applications.</p>
            <Link href="/artist/artworks/new" className="artist-primary-link"><Image size={13} /> Add Artwork</Link>
          </div>
        </div>

        <div className="role-panel artist-plan-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Membership</p><h2>Subscription Plan</h2></div><Wallet size={17} /></div>
          <div className="artist-plan-callout"><span><Store size={18} /></span><strong>Artist plans</strong><p>Explore available options for your artist profile and exhibition journey.</p></div>
          <Link href="/artist/plans" className="artist-primary-link">View Plans <ArrowRight size={13} /></Link>
        </div>
      </section>

      <section className="artist-dashboard-middle-grid">
        <div className="role-panel artist-upcoming-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Find your next opportunity</p><h2>Upcoming Exhibitions</h2></div><Link href="/exhibitions/events" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {events.length
            ? <div className="artist-upcoming-list">{events.slice(0, 3).map((event) => (
              <article className="artist-upcoming-event" key={event.id}>
                {event.mediaUrl ? <img src={`${apiBase}${event.mediaUrl}`} alt="" /> : <span className="artist-event-placeholder"><CalendarDays size={17} /></span>}
                <div><strong>{event.title}</strong><small><CalendarDays size={11} /> {formatEventDate(event.startsAt)}</small><small><MapPin size={11} /> {[event.city, event.venue].filter(Boolean).join(', ') || 'Venue to be announced'}</small></div>
                <Link href="/book-your-stall">Apply</Link>
              </article>
            ))}</div>
            : <p className="artist-empty">{query ? 'No upcoming exhibitions match your search.' : 'No upcoming exhibitions are listed right now.'}</p>}
        </div>

        <div className="role-panel artist-applications-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Your submissions</p><h2>Exhibition Applications</h2></div><Link href="/artist/bookings" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <ArtistDashboardList items={applications.slice(0, 4)} empty={query ? 'No applications match your search.' : 'Your submitted applications will appear here.'} />
        </div>

        <div className="role-panel artist-bookings-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Reserved spaces</p><h2>Stall Bookings</h2></div><Link href="/artist/bookings" className="role-panel-link">Manage <ArrowRight size={12} /></Link></div>
          <ArtistDashboardList items={bookings.slice(0, 3)} empty={query ? 'No bookings match your search.' : 'Your stall bookings will appear here.'} />
        </div>
      </section>

      <section className="artist-dashboard-bottom-grid">
        <div className="role-panel artist-activity-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Latest updates</p><h2>Recent Activity</h2></div><Activity size={17} /></div>
          {recentActivity.length
            ? <ul className="artist-activity-list">{recentActivity.map((item, index) => (
              <li key={`${item.kind}-${item.reference ?? item.title}-${index}`}>
                <span className="artist-activity-icon">{item.kind === 'Application' ? <FileCheck2 size={13} /> : <Store size={13} />}</span>
                <div><strong>{item.title}</strong><small>{item.kind}{item.detail ? ` · ${item.detail}` : ''}</small></div>
                <span className={`role-status ${statusTone(item.status ?? '')}`}>{(item.status ?? 'Submitted').replaceAll('_', ' ')}</span>
              </li>
            ))}</ul>
            : <p className="artist-empty">{query ? 'No activity matches your search.' : 'Your recent applications and bookings will show here.'}</p>}
        </div>

        <div className="role-panel artist-earnings-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Confirmed stall bookings</p><h2>Earnings &amp; Payments</h2></div><Wallet size={17} /></div>
          <strong className="artist-earnings-total">{formatMetric(paidMetric?.value ?? 0, 'Total paid')}</strong>
          <p>Amount paid for confirmed bookings</p>
          <div className="artist-earnings-note"><span><Check size={12} /></span><span>Payment totals update when a stall booking is confirmed.</span></div>
          <Link href="/artist/bookings" className="artist-secondary-link">View booking payments <ArrowRight size={13} /></Link>
        </div>

        <div className="role-panel artist-quick-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Shortcuts</p><h2>Quick Actions</h2></div><ArrowRight size={16} /></div>
          <div className="artist-quick-grid">{quickActions.map(({ label, href, icon: Icon, tone }) => (
            <Link href={href} key={label} className={`role-action ${tone}`}><Icon size={15} /><span>{label}</span><ArrowRight size={12} /></Link>
          ))}</div>
        </div>
      </section>
    </div>
  )
}

function ArtistDashboardList({ items, empty }: { items: DashboardItem[]; empty: string }) {
  if (!items.length) return <p className="artist-empty">{empty}</p>
  return <div className="artist-record-list">{items.map((item, index) => (
    <article key={`${item.reference ?? item.title}-${index}`}>
      <span className="artist-record-icon">{index === 0 ? <FileCheck2 size={14} /> : <Activity size={14} />}</span>
      <div><strong>{item.title}</strong><small>{item.reference ? `${item.reference} · ` : ''}{item.detail || (item.createdAt ? formatDate(item.createdAt) : '')}</small></div>
      <span className={`role-status ${statusTone(item.status ?? '')}`}>{(item.status ?? 'Submitted').replaceAll('_', ' ')}</span>
    </article>
  ))}</div>
}

function VisitorDashboard({
  overview,
  searchQuery,
}: {
  overview: DashboardSummary['visitorOverview']
  searchQuery: string
}) {
  const query = searchQuery.trim().toLowerCase()
  const matches = (item: { title: string; detail?: string; city?: string; venue?: string; author?: string }) =>
    !query || `${item.title} ${item.detail ?? ''} ${item.city ?? ''} ${item.venue ?? ''} ${item.author ?? ''}`
      .toLowerCase().includes(query)
  const registrations = (overview?.registrations ?? []).filter(matches)
  const activePass = registrations.find((item) => item.qrData)
  const upcoming = (overview?.upcoming ?? []).filter(matches)
  const blogs = (overview?.blogs ?? []).filter(matches)
  const artists = (overview?.artists ?? []).filter(matches)
  const quickActions = [
    { label: 'Register for an Exhibition', href: '/exhibitions/events', icon: CalendarDays, tone: 'coral' },
    { label: 'View My QR Passes', href: '/dashboard/passes', icon: QrCode, tone: 'blue' },
    { label: 'Explore Artists', href: '/artists', icon: Users, tone: 'green' },
    { label: 'Read Latest Blogs', href: '/blog', icon: BookOpen, tone: 'violet' },
    { label: 'Browse Gallery', href: '/gallery', icon: Image, tone: 'amber' },
    { label: 'Edit Preferences', href: '/dashboard/passes', icon: Settings, tone: 'blue' },
  ]

  return (
    <div className="visitor-dashboard">
      <section className="visitor-dashboard-top-grid">
        <div className="role-panel visitor-upcoming-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Discover art near you</p><h2>Upcoming Exhibition</h2></div><Link href="/exhibitions/events" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {upcoming[0]
            ? <article className="visitor-featured-event">
              <img src={upcoming[0].mediaUrl ? `${apiBase}${upcoming[0].mediaUrl}` : '/media/exhibition-gallery.jpeg'} alt={`${upcoming[0].title} exhibition`} />
              <div className="visitor-featured-copy">
                <span className="visitor-event-date"><CalendarDays size={13} /> {formatEventDate(upcoming[0].startsAt)}</span>
                <h3>{upcoming[0].title}</h3>
                <p><MapPin size={13} /> {[upcoming[0].venue, upcoming[0].city].filter(Boolean).join(' · ') || 'Venue to be announced'}</p>
                <small>{upcoming[0].description}</small>
                <Link href="/dashboard/passes" className="visitor-inline-button">Register &amp; get pass <ArrowRight size={12} /></Link>
              </div>
            </article>
            : <p className="role-empty">{query ? 'No upcoming exhibitions match your search.' : 'No upcoming exhibitions are open right now.'}</p>}
        </div>

        <div className="role-panel visitor-qr-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Ready for entry</p><h2>My QR Pass</h2></div><Link href="/dashboard/passes" className="role-panel-link">All passes <ArrowRight size={12} /></Link></div>
          {activePass
            ? <VisitorPassPreview pass={activePass} fullName={overview?.fullName ?? ''} />
            : <div className="visitor-no-pass"><QrCode size={34} /><strong>No active pass yet</strong><span>Register for an exhibition to get your entry QR.</span><Link href="/dashboard/passes">Browse available passes <ArrowRight size={12} /></Link></div>}
        </div>

        <div className="role-panel visitor-registrations-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Your events</p><h2>My Registrations</h2></div><Link href="/dashboard/passes" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {registrations.length
            ? <div className="visitor-registration-list">{registrations.slice(0, 4).map((item) => <article className="visitor-registration-card" key={item.registrationId}>
              <img src={item.mediaUrl ? `${apiBase}${item.mediaUrl}` : '/media/exhibition-gallery.jpeg'} alt="" />
              <div><strong>{item.title}</strong><small>{formatEventDate(item.startsAt)} · {[item.city, item.venue].filter(Boolean).join(', ')}</small><span className={`visitor-dashboard-status ${statusTone(item.status)}`}>{item.status}</span></div>
              <Link href="/dashboard/passes" aria-label={`View ${item.title} pass`}><QrCode size={15} /></Link>
            </article>)}</div>
            : <p className="role-empty">{query ? 'No registrations match your search.' : 'Your event registrations will appear here.'}</p>}
        </div>
      </section>

      <section className="visitor-dashboard-bottom-grid">
        <div className="role-panel visitor-recommended-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Selected for you</p><h2>Recommended for You</h2></div><Link href="/exhibitions/events" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {upcoming.length
            ? <div className="visitor-recommend-grid">{upcoming.slice(0, 3).map((event) => <article className="visitor-recommend-card" key={event.id}>
              <img src={event.mediaUrl ? `${apiBase}${event.mediaUrl}` : '/media/exhibition-gallery.jpeg'} alt={`${event.title} exhibition`} />
              <strong>{event.title}</strong><small><CalendarDays size={11} /> {formatEventDate(event.startsAt)}</small><small><MapPin size={11} /> {[event.city, event.venue].filter(Boolean).join(', ')}</small>
              <Link href="/dashboard/passes">Register Now</Link>
            </article>)}</div>
            : <p className="role-empty">{query ? 'No events match your search.' : 'New exhibition recommendations will appear here.'}</p>}
        </div>

        <div className="role-panel visitor-blogs-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Ideas &amp; inspiration</p><h2>Latest Blogs</h2></div><Link href="/blog" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {blogs.length
            ? <div className="visitor-blog-list">{blogs.slice(0, 3).map((post) => <Link href={`/blog/${post.id}`} className="visitor-blog-card" key={post.id ?? post.title}>
              <img src={post.mediaUrl ? `${apiBase}${post.mediaUrl}` : '/media/visual-art.jpeg'} alt="" />
              <span><strong>{post.title}</strong><small>By {post.author} · {formatDate(post.publishedAt)}</small><small>{post.excerpt}</small></span>
            </Link>)}</div>
            : <p className="role-empty">{query ? 'No blogs match your search.' : 'No published blog posts yet.'}</p>}
        </div>

        <div className="role-panel visitor-actions-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Your art journey</p><h2>Quick Actions</h2></div><ArrowRight size={16} /></div>
          <div className="visitor-quick-grid">{quickActions.map(({ label, href, icon: Icon, tone }) => <Link href={href} key={label} className={`role-action ${tone}`}><Icon size={15} /><span>{label}</span><ArrowRight size={12} /></Link>)}</div>
          <div className="visitor-artist-preview">
            <div><p className="role-eyebrow">Meet the community</p><h3>Artist Directory</h3></div><Link href="/artists">Explore artists <ArrowRight size={12} /></Link>
            {artists.slice(0, 3).map((artist) => <Link href={artist.id ? `/artists/${artist.id}` : '/artists'} className="visitor-artist-chip" key={artist.id ?? artist.title}>
              <span>{artist.title.slice(0, 1).toUpperCase()}</span><strong>{artist.title}</strong><small>{artist.detail || 'The Haat of Art'}</small>
            </Link>)}
            {!artists.length && <p className="role-empty">Artist profiles will appear here.</p>}
          </div>
        </div>
      </section>

      <p className="visitor-favourite-note"><Heart size={13} /> Event favourites are not saved in your account yet. Browse exhibitions to discover your next favourite.</p>
    </div>
  )
}

function VisitorPassPreview({ pass, fullName }: { pass: VisitorRegistration; fullName: string }) {
  const [qrImage, setQrImage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const publicPassUrl = visitorPassUrl(pass.qrData ?? '', window.location.origin)
    setError('')
    void QRCode.toDataURL(publicPassUrl, { errorCorrectionLevel: 'M', margin: 1, width: 160 })
      .then((image) => { if (active) setQrImage(image) })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not generate your pass QR code.')
      })
    return () => { active = false }
  }, [pass.qrData])

  return (
    <div className="visitor-pass-preview">
      <div className="visitor-pass-preview-qr">
        {qrImage ? <img src={qrImage} alt={`QR entry pass for ${pass.title}`} /> : error ? <span role="alert">{error}</span> : <span>Preparing QR…</span>}
      </div>
      <div className="visitor-pass-preview-details"><span className="visitor-dashboard-status good">Valid pass</span><strong>{pass.title}</strong><small>{fullName} · Visitor</small><small><CalendarDays size={12} /> {formatEventDate(pass.startsAt)}</small><small><MapPin size={12} /> {[pass.city, pass.venue].filter(Boolean).join(', ')}</small>
        {qrImage && <a href={qrImage} download={`haat-of-art-pass-${pass.passId}.png`} className="visitor-download-pass"><TicketCheck size={13} /> Download Pass QR</a>}
        {pass.qrData && <Link href={`/visitor/pass/${encodeURIComponent(pass.qrData)}`} className="visitor-pass-info-link" target="_blank">View scan details</Link>}
      </div>
    </div>
  )
}

function EventStaffOverview({
  overview,
  searchQuery,
}: {
  overview: DashboardSummary['eventStaffOverview']
  searchQuery: string
}) {
  const events = overview?.events ?? []
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? '')
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0]
  const query = searchQuery.trim().toLowerCase()
  const checkIns = (overview?.checkIns ?? []).filter((entry) =>
    (!selectedEvent || entry.eventId === selectedEvent.id)
    && (!query || `${entry.title} ${entry.email} ${entry.eventTitle}`.toLowerCase().includes(query)))
  const registrations = (overview?.registrations ?? []).filter((entry) =>
    (!selectedEvent || entry.eventId === selectedEvent.id)
    && entry.status !== 'Checked in'
    && (!query || `${entry.title} ${entry.email} ${entry.eventTitle}`.toLowerCase().includes(query)))
  const daily = overview?.dailyCheckIns ?? []
  const maxDaily = Math.max(1, ...daily.map((item) => Number(item.total)))
  const quickActions = [
    { label: 'Scan QR Pass', href: '/dashboard/check-in', icon: QrCode, tone: 'coral' },
    { label: 'Manual Check-in', href: '/dashboard/check-in', icon: Check, tone: 'blue' },
    { label: 'Search Attendee', href: '/dashboard/check-in', icon: Search, tone: 'green' },
    { label: 'Choose Event', href: '/exhibitions/events', icon: CalendarDays, tone: 'violet' },
  ]

  return (
    <div className="event-staff-overview">
      <section className="event-staff-top-grid">
        <div className="role-panel event-staff-event-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Event selection</p><h2>Select Event</h2></div><Link href="/exhibitions/events" className="role-panel-link">All events <ArrowRight size={12} /></Link></div>
          {events.length
            ? <>
              <label className="event-staff-select-label" htmlFor="staff-event-select">Published exhibition</label>
              <select id="staff-event-select" className="event-staff-event-select" value={selectedEvent?.id ?? ''} onChange={(event) => setSelectedEventId(event.target.value)}>
                {events.map((event) => <option key={event.id} value={event.id}>{event.title}{event.city ? ` · ${event.city}` : ''}</option>)}
              </select>
              {selectedEvent && <div className="event-staff-event-card">
                <img src="/media/exhibition-gallery.jpeg" alt="Art exhibition gallery" />
                <div><strong>{selectedEvent.title}</strong><small>{selectedEvent.status} · {selectedEvent.city || selectedEvent.venue}</small><small>{formatEventDate(selectedEvent.startsAt)} · {selectedEvent.venue}</small></div>
                <Link href="/dashboard/check-in">Event desk <ArrowRight size={12} /></Link>
              </div>}
            </>
            : <p className="role-empty">No published exhibitions are open or recently completed.</p>}
        </div>

        <div className="role-panel event-staff-capacity-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Selected exhibition</p><h2>Check-in Progress</h2></div><Activity size={17} /></div>
          {selectedEvent
            ? <>
              <div className="event-staff-progress-copy"><strong>{selectedEvent.checkedIn.toLocaleString('en-IN')} / {selectedEvent.registrations.toLocaleString('en-IN')}</strong><span>{selectedEvent.registrations ? Math.round(selectedEvent.checkedIn / selectedEvent.registrations * 100) : 0}% checked in</span></div>
              <div className="event-staff-progress-track"><span style={{ width: `${selectedEvent.registrations ? Math.min(100, selectedEvent.checkedIn / selectedEvent.registrations * 100) : 0}%` }} /></div>
              <p className="event-staff-progress-note">Checked-in visitors compared with registered attendees.</p>
              <div className="event-staff-stat-row"><div><strong>{selectedEvent.registrations.toLocaleString('en-IN')}</strong><small>Registered</small></div><div><strong>{selectedEvent.checkedIn.toLocaleString('en-IN')}</strong><small>Checked in</small></div><div><strong>{Math.max(0, selectedEvent.registrations - selectedEvent.checkedIn).toLocaleString('en-IN')}</strong><small>Remaining</small></div></div>
            </>
            : <p className="role-empty">Choose a published event to view its check-in progress.</p>}
        </div>

        <div className="role-panel event-staff-actions-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Registration desk</p><h2>Quick Actions</h2></div><ArrowRight size={16} /></div>
          <div className="event-staff-quick-grid">{quickActions.map(({ label, href, icon: Icon, tone }) => <Link href={href} key={label} className={`role-action ${tone}`}><Icon size={16} /><span>{label}</span><ArrowRight size={13} /></Link>)}</div>
        </div>
      </section>

      <section className="event-staff-main-grid">
        <div className="role-panel event-staff-scanner-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Secure entry</p><h2>Live QR Scanner</h2></div><QrCode size={18} /></div>
          <div className="event-staff-scanner-visual"><QrCode size={76} /><span>Open the scanner to validate a visitor pass</span></div>
          <Link className="role-primary-button event-staff-scanner-link" href="/dashboard/check-in">Open QR Scanner <ArrowRight size={14} /></Link>
          <p className="event-staff-scanner-note">Camera scanning and manual pass entry are available at the secure check-in desk.</p>
        </div>
        <div className="role-panel event-staff-table-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Entry desk</p><h2>Recent Check-ins</h2></div><Link href="/dashboard/check-in" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {checkIns.length
            ? <div className="event-staff-table-wrap"><table className="event-staff-table"><thead><tr><th>#</th><th>Visitor</th><th>Event</th><th>Check-in time</th><th>Status</th></tr></thead><tbody>{checkIns.slice(0, 6).map((item, index) => <tr key={item.id ?? `${item.title}-${index}`}><td>{index + 1}</td><td><strong>{item.title}</strong><small>{item.email}</small></td><td>{item.eventTitle}</td><td>{item.createdAt ? formatDate(item.createdAt) : '—'}</td><td><span className="event-staff-checked-status">Checked In</span></td></tr>)}</tbody></table></div>
            : <p className="role-empty">{query ? 'No check-ins match your search.' : 'No check-ins recorded for this event yet.'}</p>}
        </div>
      </section>

      <section className="event-staff-bottom-grid">
        <div className="role-panel event-staff-chart-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Recent activity</p><h2>Check-ins · Last 7 Days</h2></div><Activity size={17} /></div>
          {daily.length
            ? <div className="event-staff-chart" aria-label="Daily check-in counts for the last seven days">{daily.map((day) => <div className="event-staff-chart-column" key={day.day}><span>{Number(day.total).toLocaleString('en-IN')}</span><i style={{ height: `${Math.max(5, Number(day.total) / maxDaily * 100)}%` }} /><small>{formatShortDay(day.day)}</small></div>)}</div>
            : <p className="role-empty">No check-ins were recorded in the last seven days.</p>}
        </div>
        <div className="role-panel event-staff-pending-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Visitor registrations</p><h2>Pending Check-ins</h2></div><Link href="/dashboard/check-in" className="role-panel-link">Find attendee <ArrowRight size={12} /></Link></div>
          {registrations.length
            ? <ul className="event-staff-pending-list">{registrations.slice(0, 6).map((item, index) => <li key={item.id ?? `${item.title}-${index}`}><span className="event-staff-pending-avatar">{item.title.slice(0, 1).toUpperCase()}</span><span><strong>{item.title}</strong><small>{item.eventTitle} · {item.email}</small></span><span className="event-staff-pending-tag">Registered</span></li>)}</ul>
            : <p className="role-empty">{query ? 'No registrations match your search.' : 'No registered visitors are waiting for check-in.'}</p>}
        </div>
      </section>
    </div>
  )
}

function formatEventDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function formatShortDay(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}

function ContentManagerOverview({
  overview,
  sections,
  searchQuery,
}: {
  overview: DashboardSummary['contentOverview']
  sections: DashboardSummary['sections']
  searchQuery: string
}) {
  const query = searchQuery.trim().toLowerCase()
  const matches = (item: DashboardItem) => !query
    || `${item.title} ${item.detail ?? ''} ${item.status ?? ''} ${item.kind ?? ''}`
      .toLowerCase().includes(query)
  const blogs = (sections.find((section) => section.title === 'Recent blog posts')?.items ?? []).filter(matches)
  const pages = (overview?.pages ?? []).filter(matches)
  const media = (overview?.media ?? []).filter(matches)
  const artists = (overview?.artists ?? []).filter(matches)
  const artworks = (overview?.artworks ?? []).filter(matches)
  const partners = (overview?.partners ?? []).filter(matches)
  const activity = (overview?.recentActivity ?? []).filter(matches)
  const quickActions = [
    { label: 'Edit Website Pages', href: '/dashboard/content', icon: BookOpen, tone: 'coral' },
    { label: 'Upload Banner', href: '/dashboard/homepage-media', icon: Image, tone: 'blue' },
    { label: 'Manage Artists', href: '/dashboard/content', icon: Users, tone: 'green' },
    { label: 'Create Blog Post', href: '/dashboard/content#blog-moderation', icon: FileCheck2, tone: 'violet' },
    { label: 'Manage Partners', href: '/dashboard/about', icon: GalleryVerticalEnd, tone: 'amber' },
    { label: 'Update Contact Info', href: '/dashboard/contact-page', icon: Mail, tone: 'blue' },
    { label: 'Manage Exhibitions', href: '/dashboard/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Open Content Workspace', href: '/dashboard/content', icon: Settings, tone: 'violet' },
  ].filter((action) => !query || action.label.toLowerCase().includes(query))
  const altCoverage = overview?.altText.total
    ? Math.round((overview.altText.described / overview.altText.total) * 100)
    : 100

  return (
    <div className="content-manager-overview">
      <section className="content-manager-top-grid">
        <div className="role-panel content-manager-pages">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Content management</p><h2>Website Page Management</h2></div><Link href="/dashboard/content" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <div className="content-page-table">
            {pages.map((page, index) => <div className="content-page-row" key={page.title}>
              <span className="content-page-number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{page.title}</strong>
              <span className="content-live-status" data-status={page.status}>{page.status}</span>
              <span className="content-page-updated">{page.createdAt ? `Updated ${formatDate(page.createdAt)}` : 'No publish record'}</span>
              <Link href={page.title === 'Home Page' ? '/dashboard/content' : page.title === 'About Us' ? '/dashboard/about' : page.title === 'Exhibitions' ? '/dashboard/events' : page.title === 'Gallery' ? '/dashboard/homepage-media' : '/dashboard/contact-page'}>Edit</Link>
            </div>)}
            {!pages.length && <p className="role-empty">{query ? 'No pages match your search.' : 'No page data is available.'}</p>}
          </div>
        </div>

        <div className="role-panel content-manager-media">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Media library</p><h2>Recent Media Uploads</h2></div><Link href="/dashboard/homepage-media" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {media.length
            ? <div className="content-media-grid">{media.slice(0, 6).map((item) => <Link href="/dashboard/homepage-media" className="content-media-card" key={`${item.kind}-${item.title}`}>
              {item.mediaUrl ? <img src={`${apiBase}${item.mediaUrl}`} alt={item.detail || item.title} /> : <span className="content-media-placeholder"><Image size={18} /></span>}
              <strong>{item.title}</strong><small>{item.kind} · {item.createdAt ? formatDate(item.createdAt) : 'Recently updated'}</small>
            </Link>)}</div>
            : <p className="role-empty">{query ? 'No media matches your search.' : 'No media uploads have been added yet.'}</p>}
        </div>

        <div className="role-panel content-manager-quick">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Workspace</p><h2>Quick Actions</h2></div><ArrowRight size={16} /></div>
          <div className="content-quick-grid">{quickActions.map(({ label, href, icon: Icon, tone }) => <Link href={href} key={label} className={`role-action ${tone}`}><Icon size={16} /><span>{label}</span><ArrowRight size={13} /></Link>)}</div>
        </div>
      </section>

      <section className="content-manager-middle-grid">
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Published stories</p><h2>Recent Blog Posts</h2></div><Link href="/blog" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <ContentDashboardList items={blogs} empty="No published blog posts yet." />
        </div>
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Public directory</p><h2>Artist Profiles</h2></div><Link href="/artists" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <ContentDashboardList items={artists} empty={query ? 'No artists match your search.' : 'No artist profiles are available.'} />
        </div>
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Public gallery</p><h2>Gallery Photos</h2></div><Link href="/gallery" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <ContentDashboardList items={artworks} empty={query ? 'No artwork matches your search.' : 'No artwork has been added to the gallery.'} />
        </div>
      </section>

      <section className="content-manager-bottom-grid">
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Accessibility check</p><h2>Content &amp; Media Health</h2></div><Link href="/dashboard/homepage-media" className="role-panel-link">Review <ArrowRight size={12} /></Link></div>
          <div className="content-health-list">
            <ContentHealthRow label="Image descriptions" value={`${overview?.altText.described ?? 0}/${overview?.altText.total ?? 0}`} detail={`${altCoverage}% have alt text`} healthy={altCoverage === 100} />
            <ContentHealthRow label="Published pages" value={`${overview?.pages.filter((page) => page.status === 'Published').length ?? 0}/5`} detail="Pages currently published" healthy={(overview?.pages.filter((page) => page.status === 'Published').length ?? 0) === 5} />
            <ContentHealthRow label="Published blogs" value="Live" detail="Approved stories appear on the site" healthy />
          </div>
        </div>
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Latest updates</p><h2>Content Activity</h2></div><Link href="/dashboard/content" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          <ContentDashboardList items={activity} empty={query ? 'No activity matches your search.' : 'Recent content changes will appear here.'} />
        </div>
        <div className="role-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Public collaborators</p><h2>Partners &amp; Mentors</h2></div><Link href="/dashboard/about" className="role-panel-link">Manage <ArrowRight size={12} /></Link></div>
          <ContentDashboardList items={partners} empty={query ? 'No partners match your search.' : 'No partners, mentors or guests are listed yet.'} />
          <div className="content-service-status">
            <span><i /> Website API</span><strong>{overview?.serviceStatus.application ?? 'Checking'}</strong>
            <span><i /> Database</span><strong>{overview?.serviceStatus.database ?? 'Checking'}</strong>
          </div>
        </div>
      </section>
    </div>
  )
}

function ContentDashboardList({ items, empty }: { items: DashboardItem[]; empty: string }) {
  if (!items.length) return <p className="role-empty">{empty}</p>
  return <ul className="content-dashboard-list">{items.slice(0, 5).map((item, index) => <li key={item.id ?? item.reference ?? `${item.title}-${index}`}>
    {item.mediaUrl
      ? <img src={`${apiBase}${item.mediaUrl}`} alt={item.title} />
      : <span className="content-list-avatar">{item.title.slice(0, 1).toUpperCase()}</span>}
    <span><strong>{item.title}</strong><small>{item.detail || item.kind || 'The Haat of Art'}</small></span>
    <span className="content-list-meta">{item.status ?? (item.createdAt ? formatDate(item.createdAt) : '')}</span>
  </li>)}</ul>
}

function ContentHealthRow({ label, value, detail, healthy }: { label: string; value: string; detail: string; healthy: boolean }) {
  return <div className="content-health-row"><span className={healthy ? 'is-healthy' : 'is-warning'}>{healthy ? <Check size={13} /> : <CircleAlert size={13} />}</span><div><strong>{label}</strong><small>{detail}</small></div><b>{value}</b></div>
}

function AdminDashboardOverview({
  reports,
  system,
  extraErrors,
  sections,
}: {
  reports: DashboardReports | null
  system: DashboardSystem | null
  extraErrors: string[]
  sections: DashboardSummary['sections']
}) {
  const section = (title: string) => sections.find((item) => item.title === title)?.items ?? []
  const recentApplications = section('Recent artist applications')
  const recentBookings = section('Recent stall bookings')
  const recentEnquiries = section('Recent enquiries')
  const series = reports?.registrationTrend ?? []
  const statusColor: Record<string, string> = {
    SUBMITTED: '#ff7a00', UNDER_REVIEW: '#1685f8', APPROVED: '#16b86a',
    CHANGES_REQUESTED: '#9b5cff', REJECTED: '#f14343',
    CONFIRMED: '#16b86a', PAYMENT_PENDING: '#ff7a00', HOLD: '#f14343',
    REFUND_PENDING: '#8993a5', CANCELLED: '#8993a5',
  }
  const quickActions = [
    { label: 'Add Exhibition', href: '/dashboard/events', icon: CalendarDays, tone: 'coral' },
    { label: 'Manage Stalls', href: '/dashboard/stalls', icon: Store, tone: 'green' },
    { label: 'Review Applications', href: '/dashboard/bookings', icon: Users, tone: 'amber' },
    { label: 'Visitor Registrations', href: '/dashboard/check-in', icon: QrCode, tone: 'blue' },
    { label: 'View Enquiries', href: '/dashboard/enquiries', icon: Mail, tone: 'violet' },
    { label: 'Review Blogs', href: '/dashboard/content#blog-moderation', icon: BookOpen, tone: 'red' },
    { label: 'Content Management', href: '/dashboard/content', icon: FileCheck2, tone: 'cyan' },
    { label: 'Reports & Analytics', href: '/dashboard/reports', icon: BarChart3, tone: 'green' },
  ]
  return (
    <div className="role-admin-overview">
      <section className="admin-analytics-grid">
        <div className="role-panel admin-registration-panel">
          <div className="role-panel-heading">
            <div><p className="role-eyebrow">Last 30 days</p><h2>Registrations Overview</h2></div>
            <div className="admin-chart-legend"><span><i className="visitors" />Visitors</span><span><i className="artists" />Artists</span><span><i className="stalls" />Stall bookings</span></div>
          </div>
          {reports
            ? <AdminRegistrationChart rows={series} />
            : <p className="role-empty">{extraErrors.find((item) => item.startsWith('Reports')) ?? 'Loading registration activity…'}</p>}
        </div>
        <div className="role-panel admin-status-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Artist applications</p><h2>Application Status</h2></div><Link href="/dashboard/bookings" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {reports && <AdminStatusDonut rows={reports.applicationStatuses} colors={statusColor} empty="No artist applications yet." />}
        </div>
        <div className="role-panel admin-status-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Exhibitor spaces</p><h2>Stall Booking Status</h2></div><Link href="/dashboard/stalls" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {reports && <AdminStatusDonut rows={reports.stallStatuses} colors={statusColor} empty="No stall bookings yet." />}
        </div>
      </section>

      <section className="admin-recent-grid">
        <AdminRecentList title="Recent Artist Applications" items={recentApplications} href="/dashboard/bookings" />
        <AdminRecentList title="Recent Stall Bookings" items={recentBookings} href="/dashboard/stalls" />
        <AdminRecentList title="Recent Enquiries" items={recentEnquiries} href="/dashboard/enquiries" />
      </section>

      <section className="admin-bottom-grid">
        <div className="role-panel admin-upcoming-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Plan ahead</p><h2>Upcoming Exhibitions</h2></div><Link href="/dashboard/events" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {reports
            ? reports.upcomingEvents.length
              ? <div className="admin-upcoming-list">{reports.upcomingEvents.map((event) => {
                const ratio = event.totalStalls ? Math.min(100, Math.round((event.bookedStalls / event.totalStalls) * 100)) : 0
                return <article className="admin-upcoming-event" key={event.id}>
                  <span className="admin-event-thumb"><Image size={18} /></span>
                  <div className="admin-event-info"><strong>{event.title}</strong><small>{formatDate(event.startsAt)} · {event.city || 'Venue to be confirmed'}</small><span className="admin-event-capacity"><i style={{ width: `${ratio}%` }} /></span></div>
                  <span className="admin-event-count">{event.bookedStalls}/{event.totalStalls}<small>stalls</small></span>
                  <Link href="/dashboard/events" aria-label={`Manage ${event.title}`}>Manage</Link>
                </article>
              })}</div>
              : <p className="admin-empty">No upcoming exhibitions are scheduled.</p>
            : <p className="role-empty">{extraErrors.find((item) => item.startsWith('Reports')) ?? 'Loading exhibition schedule…'}</p>}
        </div>

        <div className="role-panel admin-quick-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Workspace</p><h2>Quick Actions</h2></div><ArrowRight size={16} /></div>
          <div className="admin-quick-grid">{quickActions.map(({ label, href, icon: Icon, tone }) => <Link href={href} key={label} className={`admin-quick-action ${tone}`}><Icon size={16} /><span>{label}</span></Link>)}</div>
        </div>

        <div className="role-panel admin-system-panel">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Live checks</p><h2>System &amp; Event Status</h2></div><Link href="/dashboard/system" className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
          {system
            ? <div className="admin-system-list">
              <SystemStatus label="Website" healthy={system.health.application === 'ok'} detail={system.health.application === 'ok' ? 'Online' : 'Unavailable'} />
              <SystemStatus label="Database" healthy={system.health.database === 'ok'} detail={system.health.database === 'ok' ? 'Healthy' : 'Unavailable'} />
              <SystemStatus label="Email service" healthy={system.runtime.emailProviderConfigured} detail={system.runtime.emailProviderConfigured ? 'Running' : 'Not configured'} />
              <SystemStatus label="Secure cookies" healthy={system.runtime.secureCookiesEnabled} detail={system.runtime.secureCookiesEnabled ? 'Enabled' : 'Development only'} />
              <SystemStatus label="File storage" healthy detail="Healthy" />
              <SystemStatus label="Background jobs" healthy detail="Running" />
            </div>
            : <p className="role-empty">{extraErrors.find((item) => item.startsWith('System')) ?? 'Checking system status…'}</p>}
        </div>
      </section>
    </div>
  )
}

function AdminRegistrationChart({ rows }: { rows: DashboardReports['registrationTrend'] }) {
  if (!rows.length) return <p className="admin-empty">No registration activity has been recorded in the last 30 days.</p>
  const series = [
    { key: 'visitors' as const, color: '#ff7418' },
    { key: 'artists' as const, color: '#1685f8' },
    { key: 'stalls' as const, color: '#16b86a' },
  ]
  const maximum = Math.max(10, ...rows.flatMap((row) => series.map(({ key }) => Number(row[key]) || 0)))
  const pointsFor = (key: typeof series[number]['key']) => rows.map((row, index) => {
    const x = rows.length === 1 ? 300 : 28 + (index / (rows.length - 1)) * 544
    const y = 150 - ((Number(row[key]) || 0) / maximum) * 132
    return `${x},${y}`
  }).join(' ')
  return (
    <div className="admin-line-chart">
      <svg viewBox="0 0 600 190" role="img" aria-label="Daily visitors, artist applications and stall bookings over the last 30 days">
        {[0, 1, 2, 3, 4].map((step) => {
          const y = 18 + step * 33
          return <g key={step}><line x1="28" x2="572" y1={y} y2={y} /><text x="2" y={y + 4}>{Math.round(maximum - step * maximum / 4)}</text></g>
        })}
        {series.map(({ key, color }) => <polyline key={key} points={pointsFor(key)} stroke={color} />)}
        {rows.length > 1 && <><text x="28" y="180">{formatShortDate(rows[0].day)}</text><text x="572" y="180" textAnchor="end">{formatShortDate(rows[rows.length - 1].day)}</text></>}
      </svg>
    </div>
  )
}

function AdminStatusDonut({ rows, colors, empty }: { rows: { status: string; total: number }[]; colors: Record<string, string>; empty: string }) {
  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0)
  if (!total) return <p className="admin-empty">{empty}</p>
  let offset = 0
  const segments = rows.map((row) => {
    const start = offset
    offset += Number(row.total) / total * 100
    return `${colors[row.status] ?? '#8993a5'} ${start}% ${offset}%`
  })
  return (
    <div className="admin-donut-layout">
      <div className="admin-donut" style={{ background: `conic-gradient(${segments.join(',')})` }} role="img" aria-label={`${total} records by status`}>
        <span><strong>{total.toLocaleString('en-IN')}</strong><small>Total</small></span>
      </div>
      <ul className="admin-donut-legend">{rows.map((row) => <li key={row.status}><i style={{ background: colors[row.status] ?? '#8993a5' }} /><span>{formatStatus(row.status)}</span><small>{Number(row.total).toLocaleString('en-IN')} ({Math.round(Number(row.total) / total * 100)}%)</small></li>)}</ul>
    </div>
  )
}

function AdminRecentList({ title, items, href }: { title: string; items: DashboardItem[]; href: string }) {
  return (
    <div className="role-panel admin-recent-panel">
      <div className="role-panel-heading"><div><h2>{title}</h2></div><Link href={href} className="role-panel-link">View all <ArrowRight size={12} /></Link></div>
      {items.length
        ? <div className="admin-recent-list">{items.slice(0, 5).map((item, index) => <article key={item.reference ?? `${item.title}-${index}`}>
          <span className="admin-recent-avatar">{item.title.trim().slice(0, 1).toUpperCase()}</span>
          <span className="admin-recent-copy"><strong>{item.title}</strong><small>{item.detail || item.reference}</small></span>
          <span className={`admin-status-pill ${adminStatusTone(item.status)}`}>{formatStatus(item.status ?? '')}</span>
        </article>)}</div>
        : <p className="admin-empty">No recent records to show.</p>}
    </div>
  )
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}

function formatStatus(status: string) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'New'
}

function adminStatusTone(status = '') {
  if (/APPROVED|CONFIRMED|RESOLVED|REPLIED|PUBLISHED/.test(status)) return 'positive'
  if (/REJECTED|CANCELLED|SPAM/.test(status)) return 'negative'
  if (/PENDING|SUBMITTED|NEW|HOLD/.test(status)) return 'warning'
  return 'neutral'
}

function SuperAdminOverview({
  reports,
  system,
  extraErrors,
  sections,
}: {
  reports: DashboardReports | null
  system: DashboardSystem | null
  extraErrors: string[]
  sections: DashboardSummary['sections']
}) {
  const sectionLinks = ['/dashboard/bookings', '/dashboard/stalls', '/dashboard/audit', '/dashboard/content#blog-moderation']
  return (
    <>
      <section className="role-super-admin-top-grid">
        <div className="role-panel role-super-revenue">
          <div className="role-panel-heading">
            <div><p className="role-eyebrow">Finance overview</p><h2>Monthly revenue</h2></div>
            <Link href="/dashboard/reports" className="role-panel-link">View reports <ArrowRight size={13} /></Link>
          </div>
          {reports
            ? <RevenueChart rows={reports.monthlyRevenue} />
            : <p className="role-empty">{extraErrors.find((item) => item.startsWith('Reports')) ?? 'Loading live invoice data…'}</p>}
        </div>
        <div className="role-panel role-super-events">
          <div className="role-panel-heading">
            <div><p className="role-eyebrow">Exhibition performance</p><h2>Events &amp; registrations</h2></div>
            <Link href="/dashboard/events" className="role-panel-link" aria-label="Manage exhibitions"><ArrowRight size={14} /></Link>
          </div>
          {reports
            ? reports.events.length
              ? <div className="role-super-event-list">{reports.events.slice(0, 4).map((event) => (
                <article className="role-super-event" key={event.id}>
                  <span className="role-super-event-icon"><CalendarDays size={15} /></span>
                  <div><strong>{event.title}</strong><small>{event.city} · {formatDate(event.startsAt)}</small></div>
                  <span className="role-super-event-count">{event.visitorRegistrations.toLocaleString('en-IN')}<small>visitors</small></span>
                </article>
              ))}</div>
              : <p className="role-empty">No exhibition records are available yet.</p>
            : <p className="role-empty">{extraErrors.find((item) => item.startsWith('Reports')) ?? 'Loading exhibition data…'}</p>}
        </div>
        <div className="role-panel role-super-actions">
          <div className="role-panel-heading"><div><p className="role-eyebrow">Workspace</p><h2>Quick actions</h2></div><ArrowRight size={16} /></div>
          <div className="role-action-list">{actions.SUPER_ADMIN.map(({ label, href, icon: Icon, tone }) => (
            <Link key={label} href={href} className={`role-action ${tone}`}><Icon size={16} /><span>{label}</span><ArrowRight size={13} /></Link>
          ))}</div>
        </div>
      </section>

      <section className="role-super-admin-records">
        {sections.map((section, index) => (
          <div className="role-panel" key={section.title}>
            <div className="role-panel-heading">
              <div><p className="role-eyebrow">Latest updates</p><h2>{section.title}</h2></div>
              <Link href={sectionLinks[index] ?? '/dashboard/audit'} className="role-panel-link">View all <ArrowRight size={13} /></Link>
            </div>
            <DashboardList items={section.items} empty="No records match your search or are available yet." />
          </div>
        ))}
      </section>

      <section className="role-panel role-super-system">
        <div className="role-panel-heading">
          <div><p className="role-eyebrow">Live checks</p><h2>System status</h2></div>
          <Link href="/dashboard/system" className="role-panel-link">Security settings <ArrowRight size={13} /></Link>
        </div>
        {system
          ? <div className="role-super-status-grid">
            <SystemStatus label="Application" healthy={system.health.application === 'ok'} detail={system.health.application === 'ok' ? 'Online' : 'Unavailable'} />
            <SystemStatus label="Database" healthy={system.health.database === 'ok'} detail={system.health.database === 'ok' ? 'Connected' : 'Unavailable'} />
            <SystemStatus label="Email service" healthy={system.runtime.emailProviderConfigured} detail={system.runtime.emailProviderConfigured ? 'Configured' : 'Not configured'} />
            <SystemStatus label="Secure cookies" healthy={system.runtime.secureCookiesEnabled} detail={system.runtime.secureCookiesEnabled ? 'Enabled' : 'Production only'} />
            <SystemStatus label="JWT secret" healthy={system.runtime.jwtSecretConfigured} detail={system.runtime.jwtSecretConfigured ? 'Configured' : 'Missing'} />
            <SystemStatus label="Active accounts" healthy detail={system.security.activeUsers.toLocaleString('en-IN')} />
            <SystemStatus label="Visitor passes" healthy detail={system.security.activeVisitorPasses.toLocaleString('en-IN')} />
            <SystemStatus label="Suspended accounts" healthy={system.security.suspendedUsers === 0} detail={system.security.suspendedUsers.toLocaleString('en-IN')} />
          </div>
          : <p className="role-empty">{extraErrors.find((item) => item.startsWith('System')) ?? 'Checking live application and security status…'}</p>}
        {system && <p className="role-super-checked">Last checked {formatDate(system.checkedAt)}</p>}
        {extraErrors.length > 0 && <p className="role-super-data-warning" role="status">{extraErrors.join(' · ')}</p>}
        {reports && <p className="role-super-checked">Financial data refreshed {formatDate(reports.generatedAt)}</p>}
      </section>
    </>
  )
}

function RevenueChart({ rows }: { rows: DashboardReports['monthlyRevenue'] }) {
  if (!rows.length) return <p className="role-empty">No invoice revenue has been recorded in the reporting period.</p>
  const maximum = Math.max(1, ...rows.map((row) => Number(row.revenue) || 0))
  return (
    <div className="role-revenue-chart" role="img" aria-label="Monthly invoice revenue chart">
      <div className="role-revenue-chart-bars">
        {rows.map((row) => {
          const amount = Number(row.revenue) || 0
          const height = Math.max(3, Math.round((amount / maximum) * 100))
          const monthDate = new Date(`${row.month}-01T12:00:00`)
          const month = Number.isNaN(monthDate.getTime())
            ? row.month
            : new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(monthDate)
          const revenue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
          return (
            <div className="role-revenue-column" key={row.month} title={`${month}: ${revenue} · ${row.invoices} invoices`}>
              <strong>{amount ? revenue : '₹0'}</strong>
              <div className="role-revenue-track"><i style={{ height: `${height}%` }} /></div>
              <small>{month}</small>
            </div>
          )
        })}
      </div>
      <div className="role-revenue-legend"><span><i /> Invoice revenue</span><span>Reported months</span></div>
    </div>
  )
}

function SystemStatus({ label, detail, healthy }: { label: string; detail: string; healthy: boolean }) {
  return (
    <div className="role-super-status">
      <span className={healthy ? 'is-healthy' : 'is-warning'}>{healthy ? <Check size={13} /> : <CircleAlert size={13} />}</span>
      <div><small>{label}</small><strong>{detail}</strong></div>
    </div>
  )
}

function Brand() {
  return <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
}

function MetricIcon({ label }: { label: string }) {
  if (/favourite|favorite/i.test(label)) return <Heart size={18} />
  if (/visitor|user|artist|application/i.test(label)) return <Users size={18} />
  if (/pass|check.?in/i.test(label)) return <QrCode size={18} />
  if (/stall|booking|payment|revenue/i.test(label)) return <Store size={18} />
  if (/event|exhibition/i.test(label)) return <CalendarDays size={18} />
  if (/content|media|blog|artwork/i.test(label)) return <Image size={18} />
  return <FileCheck2 size={18} />
}

function DashboardList({ items, empty }: { items: DashboardItem[]; empty: string }) {
  if (!items.length) return <p className="role-empty">{empty}</p>
  return <div className="role-items">{items.map((item, index) => (
    <article className="role-item" key={`${item.reference ?? item.title}-${index}`}>
      <span className="role-item-icon">{index === 0 ? <FileCheck2 size={15} /> : <Activity size={15} />}</span>
      <div className="role-item-copy"><strong>{item.title || item.reference}</strong><span>{item.detail}</span></div>
      <div className="role-item-meta">{item.status && <span className={`role-status ${statusTone(item.status)}`}>{item.status.replaceAll('_', ' ')}</span>}{item.createdAt && <small>{formatDate(item.createdAt)}</small>}</div>
    </article>
  ))}</div>
}

function formatMetric(value: string | number, label: string) {
  if (typeof value === 'string' && !Number.isFinite(Number(value))) return value
  const amount = Number(value)
  if (/revenue|paid/i.test(label)) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  return new Intl.NumberFormat('en-IN').format(amount)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const delta = Date.now() - date.getTime()
  if (delta < 0) return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
  if (delta < 60 * 60 * 1000) return `${Math.max(1, Math.floor(delta / 60000))} min ago`
  if (delta < 24 * 60 * 60 * 1000) return `${Math.floor(delta / 3600000)} hr ago`
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
}

function statusTone(status: string) {
  if (/APPROVED|CONFIRMED|PUBLISHED|CHECKED IN|PASS ACTIVE|RESOLVED/i.test(status)) return 'good'
  if (/REJECTED|FAILED|CANCELLED|CLOSED/i.test(status)) return 'bad'
  if (/PENDING|SUBMITTED|REVIEW|REGISTERED|LOGGED|UPDATED/i.test(status)) return 'pending'
  return 'neutral'
}
