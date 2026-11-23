'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, FileText, Image, MapPin, Plus, Save, ShieldCheck, Trash2, Users } from 'lucide-react'
import { textFields, type SiteContent } from '@/lib/site-content'
import { ArtistProfileReview } from '@/components/artist/artist-profile-review'
import { defaultHomepageContent, defaultHomepageHeroMedia, type HomepageContent, type HomepageHeroMedia, type HomepageIcon } from '@/lib/homepage-content'
import { HomepageExhibitionsManager } from '@/components/homepage-exhibitions-manager'
import { HomepageHeroMediaManager } from '@/components/homepage-hero-media-manager'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 50 * 1024 * 1024
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif'
const homepageIcons = ['calendar', 'users', 'accessibility', 'palette', 'image', 'landmark', 'brush', 'archive'] as const satisfies readonly HomepageIcon[]
const homepageIconLabels: Record<HomepageIcon, string> = {
  calendar: 'Calendar',
  users: 'People',
  accessibility: 'Accessibility',
  palette: 'Palette',
  image: 'Image',
  landmark: 'Landmark',
  brush: 'Brush',
  archive: 'Archive',
}
const heroTextFields = textFields.filter(({ key }) => ['heroKicker', 'heroLine1', 'heroAccent', 'heroIntro'].includes(key))
const aboutTextFields = textFields.filter(({ key }) => ['statementLine1', 'statementAccent', 'statementText'].includes(key))
const footerTextFields = textFields.filter(({ key }) => key === 'footerLocations')
const homepageVisibilityOptions: {
  key: keyof HomepageContent['visibility']
  title: string
  description: string
}[] = [
  { key: 'hero', title: 'Top hero area', description: 'Main image, video and welcome message' },
  { key: 'upcomingExhibitions', title: 'Upcoming exhibitions', description: 'Upcoming dates and city announcements' },
  { key: 'exploreArtSpaces', title: 'Explore Art Spaces', description: 'Links to art categories and spaces' },
  { key: 'featuredArtists', title: 'Artists in focus', description: 'Artist profiles and their work' },
  { key: 'aboutStory', title: 'Our story', description: 'About the Haat of Art' },
  { key: 'leadership', title: 'Leadership profiles', description: 'Founder, mentor and team profiles' },
  { key: 'impact', title: 'Our impact', description: 'Exhibition figures and highlights' },
  { key: 'invitedGuests', title: 'Invited guests', description: 'Featured guests and public figures' },
  { key: 'valueProposition', title: 'Why The Haat of Art', description: 'What artists, partners and collectors gain' },
  { key: 'eventHighlights', title: 'Event highlights', description: 'Experiences from our exhibitions' },
  { key: 'gallery', title: 'Photo gallery', description: 'Images from events and exhibitions' },
  { key: 'communityTestimonials', title: 'Community reviews', description: 'Visitor and artist feedback' },
  { key: 'venuePartners', title: 'Venue partners', description: 'Exhibition venue names' },
  { key: 'mediaAlliances', title: 'Media, press and outdoor alliances', description: 'Our media and outdoor partners' },
]
type BlogReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
type BlogReviewPost = {
  id: string
  title: string
  excerpt: string
  body: string
  author: string
  email: string
  status: Exclude<BlogReviewStatus, 'ALL'>
  reviewNote: string | null
  media?: { id: string; mediaType: 'IMAGE' | 'VIDEO'; url: string }[]
  submittedAt: string
}

async function readError(response: Response) {
  const result: unknown = await response.json().catch(() => null)
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error
  return `Request failed (${response.status})`
}

function isNetworkFailure(cause: unknown) {
  return cause instanceof Error && /failed to fetch|fetch failed|network error|network request failed|load failed/i.test(cause.message)
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

const pageCopy = {
  content: { eyebrow: 'The Haat of Art · Website content', title: 'Content management', text: 'Manage homepage copy, artwork records and artist spotlights.' },
  homepage: { eyebrow: 'The Haat of Art · Homepage', title: 'Homepage management', text: 'Use Save all changes for photos, video, text and sections. City announcements save with their own Add or Update button.' },
  blogs: { eyebrow: 'The Haat of Art · Community stories', title: 'Blog approvals', text: 'Review blogs submitted by visitors and artists. Only approved blogs appear on the public Blog page.' },
  artists: { eyebrow: 'The Haat of Art · Artists', title: 'Artist profile approvals', text: 'Review artist profiles. Only approved artists appear on the public Artists page.' },
} as const

export function SiteContentManager({ mode = 'content' }: { mode?: 'content' | 'homepage' | 'blogs' | 'artists' }) {
  const copy = pageCopy[mode]
  const [signedIn, setSignedIn] = useState(false)
  const [canReviewBlogs, setCanReviewBlogs] = useState(false)
  const [content, setContent] = useState<SiteContent>({ text: {}, artists: [], artworks: [] })
  const [homepageContent, setHomepageContent] = useState<HomepageContent>(defaultHomepageContent)
  const [homepageContentLoaded, setHomepageContentLoaded] = useState(false)
  const [homepageHeroMedia, setHomepageHeroMedia] = useState<HomepageHeroMedia>(defaultHomepageHeroMedia)
  const [homepageHeroMediaLoading, setHomepageHeroMediaLoading] = useState(mode === 'homepage')
  const [homepageHeroMediaLoaded, setHomepageHeroMediaLoaded] = useState(false)
  const [homepageHeroMediaUploading, setHomepageHeroMediaUploading] = useState(false)
  const [blogPosts, setBlogPosts] = useState<BlogReviewPost[]>([])
  const [blogReviewStatus, setBlogReviewStatus] = useState<BlogReviewStatus>('PENDING')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [homepageText, setHomepageText] = useState<Record<string, string>>({})
  const retryAction = useRef<(() => void) | null>(null)

  const load = useCallback(async () => {
    const [response, homepageResponse] = await Promise.all([
      api('/api/content', { cache: 'no-store' }),
      api('/api/site-settings/homepage', { cache: 'no-store' }),
    ])
    const [nextContent, nextHomepage] = await Promise.all([
      response.json() as Promise<SiteContent>,
      homepageResponse.json() as Promise<{ homepage: HomepageContent | null }>,
    ])
    setContent(nextContent)
    setHomepageText(nextContent.text)
    setHomepageContent(nextHomepage.homepage ?? defaultHomepageContent)
    setHomepageContentLoaded(true)
  }, [])

  const loadBlogPosts = useCallback(async (status = blogReviewStatus) => {
    const response = await api(`/api/content/blog/admin?status=${status}`, { cache: 'no-store' })
    const result = await response.json() as { posts: BlogReviewPost[] }
    setBlogPosts(result.posts)
  }, [blogReviewStatus])

  const loadHomepageHeroMedia = useCallback(async () => {
    setHomepageHeroMediaLoading(true)
    try {
      const response = await api('/api/dashboard/homepage', { cache: 'no-store' })
      setHomepageHeroMedia(await response.json() as HomepageHeroMedia)
      setHomepageHeroMediaLoaded(true)
    } finally {
      setHomepageHeroMediaLoading(false)
    }
  }, [])

  const reportRequestError = useCallback((cause: unknown, fallback: string, retry?: () => void) => {
    const networkFailure = isNetworkFailure(cause)
    setError(networkFailure
      ? 'Network/server se data load ya save nahi ho paya — kripya dobara koshish karein. / Could not load or save data right now — please try again.'
      : cause instanceof Error ? cause.message : fallback)
    retryAction.current = networkFailure ? retry ?? null : null
  }, [])

  const attemptLoad = useCallback(function attempt(action: () => Promise<unknown>, fallback: string) {
    void action().catch((cause: unknown) => {
      reportRequestError(cause, fallback, () => attempt(action, fallback))
    })
  }, [reportRequestError])

  const loadAdminAccess = useCallback(async function checkAccess() {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' })
      if (response.status === 401) return
      if (!response.ok) throw new Error(await readError(response))
      const result = await response.json() as { user?: { permissions?: string[] } }
      const mayReview = result.user?.permissions?.includes('content:publish') ?? false
      setSignedIn(true)
      setCanReviewBlogs(mayReview)
      if (mayReview) attemptLoad(loadBlogPosts, 'Blog submissions could not be loaded.')
    } catch (cause) {
      reportRequestError(cause, 'Admin access could not be checked.', () => { void checkAccess() })
    }
  }, [attemptLoad, loadBlogPosts, reportRequestError])

  function retryFailedRequest() {
    const retry = retryAction.current
    if (!retry) return
    retryAction.current = null
    setError('')
    retry()
  }

  useEffect(() => {
    attemptLoad(load, 'Content could not be loaded.')
    void loadAdminAccess()
  }, [attemptLoad, load, loadAdminAccess])

  useEffect(() => {
    if (mode !== 'homepage' || !signedIn) return
    attemptLoad(loadHomepageHeroMedia, 'Hero media could not be loaded.')
  }, [attemptLoad, loadHomepageHeroMedia, mode, signedIn])

  async function run(action: () => Promise<void | string>, success: string) {
    setBusy(true)
    setMessage('')
    setError('')
    retryAction.current = null
    try {
      const actionMessage = await action()
      await load()
      if (signedIn && canReviewBlogs) await loadBlogPosts()
      setMessage(actionMessage ?? success)
    } catch (cause) {
      reportRequestError(cause, 'Request failed.', () => { void run(action, success) })
      const text = cause instanceof Error ? cause.message : 'Request failed.'
      if (/auth|login|forbidden|session/i.test(text)) setSignedIn(false)
    } finally {
      setBusy(false)
    }
  }

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(async () => {
      await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      })
      const accessResponse = await api('/api/auth/me', { cache: 'no-store' })
      const access = await accessResponse.json() as { user?: { permissions?: string[] } }
      const mayReview = access.user?.permissions?.includes('content:publish') ?? false
      setSignedIn(true)
      setCanReviewBlogs(mayReview)
      if (mayReview) await loadBlogPosts()
    }, 'Signed in.')
  }

  function reviewBlog(id: string, decision: 'APPROVED' | 'REJECTED') {
    const reviewNote = reviewNotes[id] ?? ''
    void run(async () => {
      const response = await api(`/api/content/blog/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNote }),
      })
      const result = await response.json() as { emailStatus: 'SENT' | 'NOT_CONFIGURED' | 'FAILED' }
      const resultLabel = decision === 'APPROVED' ? 'approved and published' : 'rejected'
      const emailLabel = result.emailStatus === 'SENT'
        ? 'The submitter was emailed.'
        : result.emailStatus === 'NOT_CONFIGURED'
          ? 'SMTP is not configured, so no email was sent.'
          : 'The decision was saved, but the email could not be delivered.'
      return `Blog ${resultLabel}. ${emailLabel}`
    }, 'Blog review saved.')
  }

  function saveText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(textFields.map((field) => [field.key, String(form.get(field.key) ?? '')]))
    void run(async () => {
      await api('/api/content/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }, 'Text saved. If you leave a field empty, the default text is restored.')
  }

  function saveTextGroup(event: FormEvent<HTMLFormElement>, fields: readonly { key: string }[], success: string) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(fields.map((field) => [field.key, String(form.get(field.key) ?? '')]))
    void run(async () => {
      await api('/api/content/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }, success)
  }

  function saveHero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = Object.fromEntries(heroTextFields.map((field) => [field.key, homepageText[field.key] ?? content.text[field.key] ?? '']))
    void run(async () => {
      await api('/api/content/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      await api('/api/site-settings/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homepageContent),
      })
      const response = await api('/api/dashboard/homepage/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: homepageHeroMedia.slides, video: homepageHeroMedia.video }),
      })
      setHomepageHeroMedia(await response.json() as HomepageHeroMedia)
    }, 'Hero media and content saved.')
  }

  function saveAllHomepage() {
    const allHomepageTextFields = [...heroTextFields, ...aboutTextFields, ...footerTextFields]
    const text = Object.fromEntries(allHomepageTextFields.map(({ key }) => [key, homepageText[key] ?? content.text[key] ?? '']))
    void run(async () => {
      await api('/api/content/text', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(text),
      })
      await api('/api/site-settings/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homepageContent),
      })
      const response = await api('/api/dashboard/homepage/media', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: homepageHeroMedia.slides, video: homepageHeroMedia.video }),
      })
      setHomepageHeroMedia(await response.json() as HomepageHeroMedia)
    }, 'All homepage changes saved. City announcements save with their own Add or Update button.')
  }

  function saveHomepageSection(event: FormEvent<HTMLFormElement>, success: string) {
    event.preventDefault()
    void run(async () => {
      await api('/api/site-settings/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homepageContent),
      })
    }, success)
  }

  function updateHomepageSection<K extends keyof HomepageContent>(key: K, value: HomepageContent[K]) {
    setHomepageContent((current) => ({ ...current, [key]: value }))
  }

  function saveHomepage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void run(async () => {
      await api('/api/site-settings/homepage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(homepageContent),
      })
    }, 'Homepage sections saved.')
  }

  function addArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const photo = form.get('photo')
    if (photo instanceof File && photo.size > maxFileBytes) { setError('Photo must be 50 MB or smaller.'); return }
    void run(async () => {
      const created = await api('/api/content/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), city: form.get('city'), bio: form.get('bio') }),
      })
      const { id } = await created.json() as { id: string }
      if (photo instanceof File && photo.size > 0) {
        await api(`/api/content/artists/${id}/photo`, { method: 'PUT', headers: { 'Content-Type': photo.type }, body: photo })
      }
      formElement.reset()
    }, 'Artist added.')
  }

  function addArtwork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get('image')
    if (!(file instanceof File) || file.size === 0) { setError('Please select an artwork image.'); return }
    if (file.size > maxFileBytes) { setError('Image must be 50 MB or smaller.'); return }
    void run(async () => {
      await api('/api/content/artworks', {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          'X-Title': encodeURIComponent(String(form.get('title') ?? '')),
          'X-Artist': encodeURIComponent(String(form.get('artist') ?? '')),
        },
        body: file,
      })
      formElement.reset()
    }, 'Artwork added.')
  }

  function remove(path: string, success: string) {
    if (!window.confirm('Delete this item permanently?')) return
    void run(async () => { await api(path, { method: 'DELETE' }) }, success)
  }

  return (
    <main className={`event-admin site-content-admin${mode === 'homepage' ? ' homepage-admin' : ''}`}>
      <header className="event-admin-header site-content-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
        </div>
        <div className="site-content-header-actions">
          {mode === 'homepage' && signedIn && <button
            className="site-content-save-all"
            type="button"
            title="Save hero media, homepage text, and section settings. City announcements save with their own Add or Update button."
            disabled={busy || !homepageContentLoaded || homepageHeroMediaLoading || homepageHeroMediaUploading || !homepageHeroMediaLoaded}
            onClick={saveAllHomepage}
          ><Save size={15} />{busy ? 'Saving…' : 'Save all changes'}</button>}
          <Link className="site-content-public-link" href="/" target="_blank" rel="noopener noreferrer"><span>View live website</span><ExternalLink size={14} /></Link>
          <Link className="site-content-back" href="/dashboard"><ArrowLeft size={15} /> Dashboard</Link>
        </div>
      </header>

      {!signedIn && (
        <form className="event-form site-content-login" onSubmit={signIn}>
          <span className="site-content-section-icon"><ShieldCheck size={20} /></span>
          <div><h2>Sign in to continue</h2><p>Use your dashboard account to review and manage the website.</p></div>
          <label>Admin email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Admin password<input name="password" type="password" autoComplete="current-password" required /></label>
          <button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in securely'}</button>
        </form>
      )}

      {error && <div className="event-form-error site-content-feedback" role="alert">
        <span>{error}</span>
        {retryAction.current && <button type="button" className="site-content-retry" onClick={retryFailedRequest}>Retry</button>}
      </div>}
      {message && <p className="event-form-success site-content-feedback" role="status"><Check size={16} />{message}</p>}

      {signedIn && (
        <div className="site-content-workspace">
          {mode === 'content' && <div className="site-content-summary">
            <article><span><FileText size={18} /></span><div><small>Editable homepage fields</small><strong>{textFields.length}</strong></div></article>
            <article><span><Image size={18} /></span><div><small>Artwork library</small><strong>{content.artworks.length}</strong></div></article>
            <article><span><Users size={18} /></span><div><small>Artists in focus</small><strong>{content.artists.length}</strong></div></article>
          </div>}

          {mode === 'blogs' && canReviewBlogs && <section className="blog-moderation" id="blog-moderation" aria-labelledby="blog-moderation-title">
            <header className="blog-moderation-header">
              <div>
                <p className="eyebrow">Community stories</p>
                <h2 id="blog-moderation-title">Blog moderation</h2>
                <p>Only approved submissions are visible in the public blog. Submitters receive an email after each decision.</p>
              </div>
              <div className="blog-moderation-tabs" aria-label="Filter blog submissions">
                {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
                  <button
                    type="button"
                    key={status}
                    className={blogReviewStatus === status ? 'is-active' : ''}
                    aria-pressed={blogReviewStatus === status}
                    disabled={busy}
                    onClick={() => setBlogReviewStatus(status)}
                  >
                    {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </header>

            {blogPosts.length === 0
              ? <p className="blog-moderation-empty">{blogReviewStatus === 'PENDING' ? 'No blog submissions are waiting for review.' : 'No blog submissions found for this filter.'}</p>
              : <div className="blog-moderation-list">
                {blogPosts.map((post) => (
                  <article className="blog-moderation-card" key={post.id}>
                    <div className="blog-moderation-card-heading">
                      <h3>{post.title}</h3>
                      <span className="blog-moderation-status">{post.status}</span>
                    </div>
                    <div className="blog-moderation-card-meta">
                      <span>By {post.author}</span>
                      <span>{post.email}</span>
                      <span>Submitted {new Date(post.submittedAt).toLocaleString()}</span>
                    </div>
                    {post.excerpt && <p>{post.excerpt}</p>}
                    <details>
                      <summary>Read full submission</summary>
                      <div className="blog-moderation-card-body">{post.body}</div>
                    </details>
                    {post.media && post.media.length > 0 && (
                      <div className="blog-media">
                        {post.media.map((item) => item.mediaType === 'VIDEO'
                          ? <video key={item.id} src={`${apiBaseUrl}${item.url}`} controls preload="metadata" playsInline />
                          : <img key={item.id} src={`${apiBaseUrl}${item.url}`} alt="" loading="lazy" />)}
                      </div>
                    )}
                    {post.status === 'PENDING' && (
                      <>
                        <label className="blog-moderation-note">Optional note for the submitter
                          <textarea
                            maxLength={1000}
                            value={reviewNotes[post.id] ?? ''}
                            onChange={(event) => setReviewNotes((notes) => ({ ...notes, [post.id]: event.target.value }))}
                            placeholder="Add a helpful reason if you reject this story."
                          />
                        </label>
                        <div className="blog-moderation-card-actions">
                          <button className="blog-approve" type="button" disabled={busy} onClick={() => reviewBlog(post.id, 'APPROVED')}><Check size={14} /> Approve &amp; publish</button>
                          <button className="blog-reject" type="button" disabled={busy} onClick={() => reviewBlog(post.id, 'REJECTED')}>Reject submission</button>
                        </div>
                      </>
                    )}
                    {post.reviewNote && post.status === 'REJECTED' && <p><strong>Review note:</strong> {post.reviewNote}</p>}
                  </article>
                ))}
              </div>}
          </section>}

          {mode === 'artists' && canReviewBlogs && <ArtistProfileReview />}

          {mode === 'content' && <>
          <form className="event-form site-content-section site-content-text-form" onSubmit={saveText} key={JSON.stringify(content.text)}>
            <div className="site-content-section-heading">
              <span className="site-content-section-icon"><FileText size={19} /></span>
              <div><p className="eyebrow">Homepage</p><h2>Text &amp; page copy</h2><p>Update the headlines and paragraphs visitors see on the homepage.</p></div>
            </div>
            <div className="site-content-fields">
            {textFields.map((field) => (
              <label className={field.multiline ? 'is-wide' : ''} key={field.key}>{field.label}
                {field.multiline
                  ? <textarea name={field.key} rows={3} maxLength={1000} defaultValue={content.text[field.key] ?? ''} placeholder={field.fallback} />
                  : <input name={field.key} maxLength={1000} defaultValue={content.text[field.key] ?? ''} placeholder={field.fallback} />}
              </label>
            ))}
            </div>
            <div className="site-content-form-actions"><span>Changes will appear on the live homepage after saving.</span><button disabled={busy} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save homepage text'}</button></div>
          </form>

          <form className="event-form site-content-section" onSubmit={saveHomepage}>
            <div className="site-content-section-heading">
              <span className="site-content-section-icon"><FileText size={19} /></span>
              <div>
                <p className="eyebrow">Homepage layout</p>
                <h2>Reference sections</h2>
                <p>Edit the categories, impact figures, event highlights, mentor, testimonials and venue partners shown on the homepage.</p>
              </div>
              <Link className="site-content-public-link" href="/dashboard/homepage-media">Manage homepage images</Link>
            </div>

            <h3>Hero feature labels</h3>
            <div className="site-content-add-grid">
              {homepageContent.heroFeatures.map((feature, index) => (
                <div className="sd-col" key={`hero-feature-${index}`}>
                  <label>First line<input maxLength={80} value={feature.title} onChange={(event) => setHomepageContent((current) => ({ ...current, heroFeatures: current.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} /></label>
                  <label>Second line<input maxLength={80} value={feature.subtitle} onChange={(event) => setHomepageContent((current) => ({ ...current, heroFeatures: current.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, subtitle: event.target.value } : item) }))} /></label>
                  <label>Icon<select value={feature.icon} onChange={(event) => {
                    const icon = homepageIcons.find((option) => option === event.target.value)
                    if (icon) setHomepageContent((current) => ({ ...current, heroFeatures: current.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, icon } : item) }))
                  }}>
                    {homepageIcons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                  </select></label>
                </div>
              ))}
            </div>

            <h3>Explore Art Spaces</h3>
            <div className="site-content-add-grid">
              {homepageContent.categories.map((category, index) => (
                <div className="sd-col" key={`category-${index}`}>
                  <label>Category name<input maxLength={60} value={category.title} onChange={(event) => setHomepageContent((current) => ({ ...current, categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} /></label>
                  <label>Destination<input maxLength={300} value={category.href} onChange={(event) => setHomepageContent((current) => ({ ...current, categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item) }))} /></label>
                  <label>Icon<select value={category.icon} onChange={(event) => {
                    const icon = homepageIcons.find((option) => option === event.target.value)
                    if (icon) setHomepageContent((current) => ({ ...current, categories: current.categories.map((item, itemIndex) => itemIndex === index ? { ...item, icon } : item) }))
                  }}>
                    {homepageIcons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
                  </select></label>
                </div>
              ))}
            </div>

            <h3>Home leadership profiles</h3>
            <p>Founder, co-founder, mentor, and other active team profiles are fetched from the About database, including their uploaded portraits.</p>
            <Link className="site-content-link" href="/dashboard/about">Manage leadership profiles <ExternalLink size={14} /></Link>

            <h3>Our impact</h3>
            <div className="site-content-add-grid">
              {homepageContent.impact.map((metric, index) => (
                <div className="sd-col" key={`metric-${index}`}>
                  <label>Value<input maxLength={40} value={metric.value} onChange={(event) => setHomepageContent((current) => ({ ...current, impact: current.impact.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} /></label>
                  <label>Label<input maxLength={80} value={metric.label} onChange={(event) => setHomepageContent((current) => ({ ...current, impact: current.impact.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) }))} /></label>
                </div>
              ))}
            </div>

            <h3>Event highlights</h3>
            <div className="site-content-add-grid">
              {homepageContent.highlights.map((highlight, index) => (
                <div className="sd-col" key={`highlight-${index}`}>
                  <label>Title<input maxLength={80} value={highlight.title} onChange={(event) => setHomepageContent((current) => ({ ...current, highlights: current.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} /></label>
                  <label>Description<textarea rows={3} maxLength={240} value={highlight.description} onChange={(event) => setHomepageContent((current) => ({ ...current, highlights: current.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} /></label>
                </div>
              ))}
            </div>

            <h3>Community testimonials</h3>
            <div className="site-content-add-grid">
              {homepageContent.testimonials.map((testimonial, index) => (
                <div className="sd-col" key={`testimonial-${index}`}>
                  <label>Name<input maxLength={120} value={testimonial.authorName} onChange={(event) => setHomepageContent((current) => ({ ...current, testimonials: current.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, authorName: event.target.value } : item) }))} /></label>
                  <label>Role<input maxLength={160} value={testimonial.authorRole} onChange={(event) => setHomepageContent((current) => ({ ...current, testimonials: current.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, authorRole: event.target.value } : item) }))} /></label>
                  <label>Quote<textarea rows={4} maxLength={900} value={testimonial.message} onChange={(event) => setHomepageContent((current) => ({ ...current, testimonials: current.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, message: event.target.value } : item) }))} /></label>
                  <button type="button" className="site-content-remove" onClick={() => setHomepageContent((current) => ({ ...current, testimonials: current.testimonials.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} />Remove testimonial</button>
                </div>
              ))}
            </div>
            <button type="button" className="site-content-add" disabled={homepageContent.testimonials.length >= 5} onClick={() => setHomepageContent((current) => ({ ...current, testimonials: [...current.testimonials, { authorName: '', authorRole: '', message: '' }] }))}><Plus size={14} /> Add testimonial</button>

            <h3>Venue partners</h3>
            <div className="site-content-add-grid">
              {homepageContent.venuePartners.map((partner, index) => (
                <div className="sd-col" key={`venue-partner-${index}`}>
                  <label>Partner name<input maxLength={160} value={partner.name} onChange={(event) => setHomepageContent((current) => ({ ...current, venuePartners: current.venuePartners.map((item, itemIndex) => itemIndex === index ? { name: event.target.value } : item) }))} /></label>
                  <button type="button" className="site-content-remove" onClick={() => setHomepageContent((current) => ({ ...current, venuePartners: current.venuePartners.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={14} />Remove partner</button>
                </div>
              ))}
            </div>
            <button type="button" className="site-content-add" disabled={homepageContent.venuePartners.length >= 5} onClick={() => setHomepageContent((current) => ({ ...current, venuePartners: [...current.venuePartners, { name: '' }] }))}><Plus size={14} /> Add venue partner</button>

            <div className="site-content-form-actions">
              <span>Figures, endorsements and images should be verified before publishing. Image files upload to the database through the media library.</span>
              <button disabled={busy} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save reference sections'}</button>
            </div>
          </form>

          {mode === 'content' && <HomepageExhibitionsManager />}
          </>}

          {mode === 'homepage' && <>
            <form className="event-form site-content-section homepage-admin-hero" onSubmit={saveHero}>
              <div className="site-content-section-heading">
                <span className="site-content-section-icon"><Image size={19} /></span>
                <div><p className="eyebrow">Section 1</p><h2>Hero</h2><p>Update the top homepage pictures or video, headline, introduction and short feature points.</p></div>
              </div>
              <HomepageHeroMediaManager
                media={homepageHeroMedia}
                onChange={setHomepageHeroMedia}
                onUploadingChange={setHomepageHeroMediaUploading}
                disabled={busy || homepageHeroMediaLoading || !homepageHeroMediaLoaded}
              />
              {homepageHeroMediaLoading && <p className="homepage-admin-loading" role="status">Loading saved hero media…</p>}
              <h3 className="homepage-admin-step">2. Likhai (Text) check karein</h3>
              <div className="site-content-fields">
                {heroTextFields.map((field) => (
                  <label className={field.multiline ? 'is-wide' : ''} key={field.key}>{field.label}
                    {field.multiline
                      ? <textarea name={field.key} rows={3} maxLength={1000} value={homepageText[field.key] ?? content.text[field.key] ?? ''} onChange={(event) => setHomepageText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.fallback} />
                      : <input name={field.key} maxLength={1000} value={homepageText[field.key] ?? content.text[field.key] ?? ''} onChange={(event) => setHomepageText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.fallback} />}
                  </label>
                ))}
              </div>
              <h3>Hero feature labels</h3>
              <div className="site-content-add-grid homepage-admin-features">
                {homepageContent.heroFeatures.map((feature, index) => (
                  <div className="sd-col" key={`homepage-hero-feature-${index}`}>
                    <label>First line<input maxLength={80} value={feature.title} onChange={(event) => updateHomepageSection('heroFeatures', homepageContent.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                    <label>Second line<input maxLength={80} value={feature.subtitle} onChange={(event) => updateHomepageSection('heroFeatures', homepageContent.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, subtitle: event.target.value } : item))} /></label>
                    <label>Icon<select value={feature.icon} onChange={(event) => {
                      const icon = homepageIcons.find((option) => option === event.target.value)
                      if (icon) updateHomepageSection('heroFeatures', homepageContent.heroFeatures.map((item, itemIndex) => itemIndex === index ? { ...item, icon } : item))
                    }}>
                      {homepageIcons.map((icon) => <option key={icon} value={icon}>{homepageIconLabels[icon]}</option>)}
                    </select></label>
                  </div>
                ))}
              </div>
              <div className="site-content-form-actions homepage-admin-submit-row">
                <span>3. Submit dabayein — photos, video, text and labels save together.</span>
                <button className="homepage-admin-submit" disabled={busy || !homepageContentLoaded || homepageHeroMediaLoading || homepageHeroMediaUploading || !homepageHeroMediaLoaded} type="submit"><Save size={16} />{busy ? 'Saving…' : 'Submit & Save'}</button>
              </div>
            </form>

            <form className="event-form site-content-section homepage-admin-visibility" onSubmit={(event) => saveHomepageSection(event, 'Homepage section visibility saved.')}>
              <div className="site-content-section-heading">
                <span className="site-content-section-icon"><Check size={19} /></span>
                <div><p className="eyebrow">Easy homepage controls</p><h2>Show or hide sections</h2><p>Turn each section on or off. Switch it on to show it on the live homepage.</p></div>
              </div>
              <div className="homepage-admin-visibility-grid">
                {homepageVisibilityOptions.map(({ key, title, description }) => {
                  const isVisible = homepageContent.visibility[key]
                  return (
                    <label className="homepage-admin-visibility-item" key={key}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(event) => updateHomepageSection('visibility', {
                          ...homepageContent.visibility,
                          [key]: event.target.checked,
                        })}
                      />
                      <span className="homepage-admin-visibility-copy"><strong>{title}</strong><small>{description}</small></span>
                      <span className={`homepage-admin-visibility-status${isVisible ? ' is-visible' : ' is-hidden'}`}>{isVisible ? 'Shown' : 'Hidden'}</span>
                    </label>
                  )
                })}
              </div>
              <div className="site-content-form-actions">
                <span>These switches affect only the live homepage. Your content stays saved when hidden.</span>
                <button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save visibility'}</button>
              </div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveTextGroup(event, aboutTextFields, 'About copy saved.')} key={`about-copy-${JSON.stringify(content.text)}`}>
              <div className="site-content-section-heading">
                <span className="site-content-section-icon"><FileText size={19} /></span>
                <div><p className="eyebrow">Section 2</p><h2>About copy</h2><p>Update the title and story visitors see on the homepage.</p></div>
              </div>
              <div className="site-content-fields">
                {aboutTextFields.map((field) => (
                  <label className={field.multiline ? 'is-wide' : ''} key={field.key}>{field.label}
                    {field.multiline
                      ? <textarea name={field.key} rows={3} maxLength={1000} value={homepageText[field.key] ?? content.text[field.key] ?? ''} onChange={(event) => setHomepageText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.fallback} />
                      : <input name={field.key} maxLength={1000} value={homepageText[field.key] ?? content.text[field.key] ?? ''} onChange={(event) => setHomepageText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.fallback} />}
                  </label>
                ))}
              </div>
              <div className="site-content-form-actions"><span>Copy updates apply only to the homepage.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save copy'}</button></div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveHomepageSection(event, 'Explore Art Spaces saved.')}>
              <div className="site-content-section-heading">
                <span className="site-content-section-icon"><Image size={19} /></span>
                <div><p className="eyebrow">Section 3</p><h2>Explore Art Spaces</h2><p>Manage the six homepage category cards and their destinations.</p></div>
              </div>
              <div className="site-content-add-grid homepage-admin-categories">
                {homepageContent.categories.map((category, index) => (
                  <div className="sd-col" key={`homepage-category-${index}`}>
                    <label>Category name<input maxLength={60} value={category.title} onChange={(event) => updateHomepageSection('categories', homepageContent.categories.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                    <label>Destination<input maxLength={300} value={category.href} onChange={(event) => updateHomepageSection('categories', homepageContent.categories.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))} /></label>
                    <label>Icon<select value={category.icon} onChange={(event) => {
                      const icon = homepageIcons.find((option) => option === event.target.value)
                      if (icon) updateHomepageSection('categories', homepageContent.categories.map((item, itemIndex) => itemIndex === index ? { ...item, icon } : item))
                    }}>
                      {homepageIcons.map((icon) => <option key={icon} value={icon}>{homepageIconLabels[icon]}</option>)}
                    </select></label>
                  </div>
                ))}
              </div>
              <div className="site-content-form-actions"><span>Choose an on-site path or a full web address.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save art spaces'}</button></div>
            </form>

            <section className="event-form site-content-section">
              <div className="site-content-section-heading">
                <span className="site-content-section-icon is-purple"><Users size={19} /></span>
                <div><p className="eyebrow">Section 4</p><h2>Leadership profiles</h2><p>Founder, co-founder, mentor and active team profiles are shown from the About database.</p></div>
              </div>
              <Link className="site-content-link" href="/dashboard/about">Manage leadership profiles <ExternalLink size={14} /></Link>
            </section>

            <form className="event-form site-content-section" onSubmit={(event) => saveHomepageSection(event, 'Homepage impact saved.')}>
              <div className="site-content-section-heading"><span className="site-content-section-icon"><FileText size={19} /></span><div><p className="eyebrow">Section 5</p><h2>Our impact</h2><p>Update the figures and labels shown in the homepage impact strip.</p></div></div>
              <div className="site-content-add-grid homepage-admin-two-column">
                {homepageContent.impact.map((metric, index) => (
                  <div className="sd-col" key={`homepage-impact-${index}`}>
                    <label>Value<input maxLength={40} value={metric.value} onChange={(event) => updateHomepageSection('impact', homepageContent.impact.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /></label>
                    <label>Label<input maxLength={80} value={metric.label} onChange={(event) => updateHomepageSection('impact', homepageContent.impact.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /></label>
                  </div>
                ))}
              </div>
              <div className="site-content-form-actions"><span>Confirm impact figures before publishing.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save impact'}</button></div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveHomepageSection(event, 'Event highlights saved.')}>
              <div className="site-content-section-heading"><span className="site-content-section-icon"><FileText size={19} /></span><div><p className="eyebrow">Section 6</p><h2>Event highlights</h2><p>Manage the featured experiences shown on the homepage.</p></div></div>
              <div className="site-content-add-grid homepage-admin-two-column">
                {homepageContent.highlights.map((highlight, index) => (
                  <div className="sd-col" key={`homepage-highlight-${index}`}>
                    <label>Title<input maxLength={80} value={highlight.title} onChange={(event) => updateHomepageSection('highlights', homepageContent.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label>
                    <label>Description<textarea rows={3} maxLength={240} value={highlight.description} onChange={(event) => updateHomepageSection('highlights', homepageContent.highlights.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label>
                  </div>
                ))}
              </div>
              <div className="site-content-form-actions"><span>Use concise, visitor-friendly descriptions.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save highlights'}</button></div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveHomepageSection(event, 'Community testimonials saved.')}>
              <div className="site-content-section-heading"><span className="site-content-section-icon is-purple"><Users size={19} /></span><div><p className="eyebrow">Section 7</p><h2>Community testimonials</h2><p>Manage the visitor and artist stories shown on the homepage.</p></div></div>
              <div className="site-content-add-grid homepage-admin-two-column">
                {homepageContent.testimonials.map((testimonial, index) => (
                  <div className="sd-col" key={`homepage-testimonial-${index}`}>
                    <label>Name<input maxLength={120} value={testimonial.authorName} onChange={(event) => updateHomepageSection('testimonials', homepageContent.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, authorName: event.target.value } : item))} /></label>
                    <label>Role<input maxLength={160} value={testimonial.authorRole} onChange={(event) => updateHomepageSection('testimonials', homepageContent.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, authorRole: event.target.value } : item))} /></label>
                    <label>Quote<textarea rows={4} maxLength={900} value={testimonial.message} onChange={(event) => updateHomepageSection('testimonials', homepageContent.testimonials.map((item, itemIndex) => itemIndex === index ? { ...item, message: event.target.value } : item))} /></label>
                    <button type="button" className="site-content-remove" disabled={busy || !homepageContentLoaded} onClick={() => updateHomepageSection('testimonials', homepageContent.testimonials.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} />Remove testimonial</button>
                  </div>
                ))}
              </div>
              <button type="button" className="site-content-add" disabled={busy || !homepageContentLoaded || homepageContent.testimonials.length >= 5} onClick={() => updateHomepageSection('testimonials', [...homepageContent.testimonials, { authorName: '', authorRole: '', message: '' }])}><Plus size={14} /> Add testimonial</button>
              <div className="site-content-form-actions"><span>Each testimonial needs a name and a quote.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save testimonials'}</button></div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveHomepageSection(event, 'Venue partners saved.')}>
              <div className="site-content-section-heading"><span className="site-content-section-icon"><Users size={19} /></span><div><p className="eyebrow">Section 8</p><h2>Venue partners</h2><p>Manage the venue names displayed in the homepage partner strip.</p></div></div>
              <div className="site-content-add-grid homepage-admin-two-column">
                {homepageContent.venuePartners.map((partner, index) => (
                  <div className="sd-col" key={`homepage-partner-${index}`}>
                    <label>Partner name<input maxLength={160} value={partner.name} onChange={(event) => updateHomepageSection('venuePartners', homepageContent.venuePartners.map((item, itemIndex) => itemIndex === index ? { name: event.target.value } : item))} /></label>
                    <button type="button" className="site-content-remove" disabled={busy || !homepageContentLoaded} onClick={() => updateHomepageSection('venuePartners', homepageContent.venuePartners.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} />Remove partner</button>
                  </div>
                ))}
              </div>
              <button type="button" className="site-content-add" disabled={busy || !homepageContentLoaded || homepageContent.venuePartners.length >= 5} onClick={() => updateHomepageSection('venuePartners', [...homepageContent.venuePartners, { name: '' }])}><Plus size={14} /> Add venue partner</button>
              <div className="site-content-form-actions"><span>Only list confirmed venue partners.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save partners'}</button></div>
            </form>

            <form className="event-form site-content-section" onSubmit={(event) => saveTextGroup(event, footerTextFields, 'Footer locations saved.')} key={`footer-locations-${JSON.stringify(content.text.footerLocations)}`}>
              <div className="site-content-section-heading"><span className="site-content-section-icon"><MapPin size={19} /></span><div><p className="eyebrow">Section 9</p><h2>Footer locations</h2><p>Set the location line shown in the homepage footer.</p></div></div>
              <div className="site-content-fields">
                {footerTextFields.map((field) => <label key={field.key}>{field.label}<input name={field.key} maxLength={1000} value={homepageText[field.key] ?? content.text[field.key] ?? ''} onChange={(event) => setHomepageText((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.fallback} /></label>)}
              </div>
              <div className="site-content-form-actions"><span>This footer copy is rendered on the homepage only.</span><button disabled={busy || !homepageContentLoaded} type="submit"><Save size={15} />{busy ? 'Saving…' : 'Save footer locations'}</button></div>
            </form>

            <HomepageExhibitionsManager />

            <div className="homepage-manager-links">
              <Link href="/dashboard/artist-approvals"><Users size={16} /> Review artist profiles shown in the carousel</Link>
              <Link href="/dashboard/guests"><Users size={16} /> Manage visitor reviews and feedback</Link>
            </div>
          </>}

          {mode === 'content' && <>
          <form className="event-form site-content-section" onSubmit={addArtwork}>
            <div className="site-content-section-heading">
              <span className="site-content-section-icon is-blue"><Image size={19} /></span>
              <div><p className="eyebrow">Artwork library</p><h2>Artwork records</h2><p>Manage artwork images and artist names stored in the website content library.</p></div>
              <span className="site-content-count">{content.artworks.length} works</span>
            </div>
            <div className="site-content-add-grid">
              <label className="site-content-file-field">Artwork image<input name="image" type="file" accept={imageAccept} required /></label>
              <label>Artwork title<input name="title" maxLength={160} required placeholder="Enter artwork title" /></label>
              <label>Artist name<input name="artist" maxLength={120} placeholder="Optional" /></label>
              <button disabled={busy} type="submit"><Plus size={15} />{busy ? 'Adding…' : 'Add artwork'}</button>
            </div>
            <ul className="content-list site-content-list">
              {content.artworks.map((work) => (
                <li key={work.id}>
                  <img src={`${apiBaseUrl}${work.url}`} alt={work.title} />
                  <span><strong>{work.title}</strong><small>{work.artistName || 'Artist not listed'}</small></span>
                  <button type="button" aria-label={`Delete ${work.title}`} disabled={busy} onClick={() => remove(`/api/content/artworks/${work.id}`, 'Artwork deleted.')}><Trash2 size={15} /><span>Delete</span></button>
                </li>
              ))}
            </ul>
          </form>

          <form className="event-form site-content-section" onSubmit={addArtist}>
            <div className="site-content-section-heading">
              <span className="site-content-section-icon is-purple"><Users size={19} /></span>
              <div><p className="eyebrow">Artist directory</p><h2>Artists in focus</h2><p>Choose the artists and short biographies highlighted on the public artist page.</p></div>
              <span className="site-content-count">{content.artists.length} artists</span>
            </div>
            <div className="site-content-add-grid site-content-artist-fields">
              <label>Name<input name="name" maxLength={120} required placeholder="Artist name" /></label>
              <label>City / practice<input name="city" maxLength={120} placeholder="City or art practice" /></label>
              <label>Short bio<input name="bio" maxLength={500} placeholder="A short introduction" /></label>
              <label className="site-content-file-field">Photo (optional)<input name="photo" type="file" accept={imageAccept} /></label>
              <button disabled={busy} type="submit"><Plus size={15} />{busy ? 'Adding…' : 'Add artist'}</button>
            </div>
            <ul className="content-list site-content-list">
              {content.artists.map((artist) => (
                <li key={artist.id}>
                  {artist.photoUrl ? <img src={`${apiBaseUrl}${artist.photoUrl}`} alt={artist.name} /> : <i />}
                  <span><strong>{artist.name}</strong><small>{artist.city || 'Location not listed'}</small></span>
                  <button type="button" aria-label={`Delete ${artist.name}`} disabled={busy} onClick={() => remove(`/api/content/artists/${artist.id}`, 'Artist deleted.')}><Trash2 size={15} /><span>Delete</span></button>
                </li>
              ))}
            </ul>
          </form>
          </>}
        </div>
      )}
    </main>
  )
}
