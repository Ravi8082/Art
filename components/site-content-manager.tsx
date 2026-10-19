'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, FileText, Image, Plus, Save, ShieldCheck, Trash2, Users } from 'lucide-react'
import { textFields, type SiteContent } from '@/lib/site-content'
import { ArtistProfileReview } from '@/components/artist/artist-profile-review'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const maxFileBytes = 50 * 1024 * 1024
const imageAccept = 'image/jpeg,image/png,image/webp,image/gif'
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

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (!response.ok) throw new Error(await readError(response))
  return response
}

const pageCopy = {
  content: { eyebrow: 'The Haat of Art · Website content', title: 'Content management', text: 'Manage the homepage copy, featured artwork and artist spotlights shown across the live website.' },
  blogs: { eyebrow: 'The Haat of Art · Community stories', title: 'Blog approvals', text: 'Review blogs submitted by visitors and artists. Only approved blogs appear on the public Blog page.' },
  artists: { eyebrow: 'The Haat of Art · Artists', title: 'Artist profile approvals', text: 'Review artist profiles. Only approved artists appear on the public Artists page.' },
} as const

export function SiteContentManager({ mode = 'content' }: { mode?: 'content' | 'blogs' | 'artists' }) {
  const copy = pageCopy[mode]
  const [signedIn, setSignedIn] = useState(false)
  const [canReviewBlogs, setCanReviewBlogs] = useState(false)
  const [content, setContent] = useState<SiteContent>({ text: {}, artists: [], artworks: [] })
  const [blogPosts, setBlogPosts] = useState<BlogReviewPost[]>([])
  const [blogReviewStatus, setBlogReviewStatus] = useState<BlogReviewStatus>('PENDING')
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const response = await api('/api/content', { cache: 'no-store' })
    setContent(await response.json() as SiteContent)
  }, [])

  const loadBlogPosts = useCallback(async (status = blogReviewStatus) => {
    const response = await api(`/api/content/blog/admin?status=${status}`, { cache: 'no-store' })
    const result = await response.json() as { posts: BlogReviewPost[] }
    setBlogPosts(result.posts)
  }, [blogReviewStatus])

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Content could not be loaded.'))
    fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' }).then(async (response) => {
      if (!response.ok) return
      const result = await response.json() as { user?: { permissions?: string[] } }
      const mayReview = result.user?.permissions?.includes('content:publish') ?? false
      setSignedIn(true)
      setCanReviewBlogs(mayReview)
      if (mayReview) await loadBlogPosts().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Blog submissions could not be loaded.'))
    }).catch(() => undefined)
  }, [load, loadBlogPosts])

  async function run(action: () => Promise<void | string>, success: string) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const actionMessage = await action()
      await load()
      if (signedIn && canReviewBlogs) await loadBlogPosts()
      setMessage(actionMessage ?? success)
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : 'Request failed.'
      setError(text)
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
    }, 'Text saved. Khali chhodne par default text wapas aa jata hai.')
  }

  function addArtist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const photo = form.get('photo')
    if (photo instanceof File && photo.size > maxFileBytes) { setError('Photo maximum 50 MB ki ho sakti hai.'); return }
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
    if (!(file instanceof File) || file.size === 0) { setError('Artwork image select karein.'); return }
    if (file.size > maxFileBytes) { setError('Image maximum 50 MB ki ho sakti hai.'); return }
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
    if (!window.confirm('Pakka delete karna hai?')) return
    void run(async () => { await api(path, { method: 'DELETE' }) }, success)
  }

  return (
    <main className="event-admin site-content-admin">
      <header className="event-admin-header site-content-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>
        </div>
        <div className="site-content-header-actions">
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

      {error && <p className="event-form-error site-content-feedback" role="alert">{error}</p>}
      {message && <p className="event-form-success site-content-feedback" role="status"><Check size={16} />{message}</p>}

      {signedIn && (
        <div className="site-content-workspace">
          {mode === 'content' && <div className="site-content-summary">
            <article><span><FileText size={18} /></span><div><small>Editable homepage fields</small><strong>{textFields.length}</strong></div></article>
            <article><span><Image size={18} /></span><div><small>Featured works</small><strong>{content.artworks.length}</strong></div></article>
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

          <form className="event-form site-content-section" onSubmit={addArtwork}>
            <div className="site-content-section-heading">
              <span className="site-content-section-icon is-blue"><Image size={19} /></span>
              <div><p className="eyebrow">Homepage gallery</p><h2>Featured artwork</h2><p>These works appear in the featured section beneath the homepage video.</p></div>
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
