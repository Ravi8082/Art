'use client'

import { useCallback, useEffect, useState } from 'react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
type Status = 'PENDING' | 'APPROVED' | 'REJECTED'
type Row = {
  userId: string; displayName: string; headline: string; city: string; state: string; artStyle: string; bio: string | null
  status: Status; reviewNote: string | null; photoUrl: string | null; email: string; artworkCount: number; updatedAt: string
}

export function ArtistProfileReview() {
  const [filter, setFilter] = useState<Status | 'ALL'>('PENDING')
  const [rows, setRows] = useState<Row[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const response = await fetch(`${apiBaseUrl}/api/artist-profile/admin?status=${filter}`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) throw new Error(`Artist profiles could not be loaded (${response.status}).`)
    setRows((await response.json() as { artists: Row[] }).artists)
  }, [filter])

  useEffect(() => { load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load.')) }, [load])

  async function review(userId: string, decision: 'APPROVED' | 'REJECTED') {
    setBusy(true); setMessage(''); setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/artist-profile/admin/${userId}/review`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reviewNote: notes[userId] ?? '' }),
      })
      if (!response.ok) throw new Error(`Review failed (${response.status}).`)
      setMessage(decision === 'APPROVED' ? 'Artist approved and now visible on the Artists page.' : 'Artist profile rejected.')
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review failed.')
    } finally { setBusy(false) }
  }

  return (
    <section className="blog-moderation" id="artist-moderation" aria-labelledby="artist-moderation-title">
      <header className="blog-moderation-header">
        <div>
          <p className="eyebrow">Artists</p>
          <h2 id="artist-moderation-title">Artist profile approvals</h2>
          <p>Only approved artists appear on the public Artists page.</p>
        </div>
        <div className="blog-moderation-tabs" aria-label="Filter artist profiles">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
            <button type="button" key={status} className={filter === status ? 'is-active' : ''} aria-pressed={filter === status} disabled={busy} onClick={() => setFilter(status)}>
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </header>
      {error && <p className="blog-moderation-empty" role="alert">{error}</p>}
      {message && <p className="blog-moderation-empty" role="status">{message}</p>}
      {rows.length === 0
        ? <p className="blog-moderation-empty">No artist profiles found for this filter.</p>
        : <div className="blog-moderation-list">
          {rows.map((a) => (
            <article className="blog-moderation-card" key={a.userId}>
              <div className="blog-moderation-card-heading"><h3>{a.displayName}</h3><span className="blog-moderation-status">{a.status}</span></div>
              <div className="blog-moderation-card-meta">
                <span>{a.email}</span>
                <span>{[a.city, a.state].filter(Boolean).join(', ') || 'No location'}</span>
                <span>{a.artworkCount} artwork{a.artworkCount === 1 ? '' : 's'}</span>
              </div>
              {a.photoUrl && <div className="blog-media"><img src={`${apiBaseUrl}${a.photoUrl}`} alt={a.displayName} loading="lazy" /></div>}
              {(a.headline || a.artStyle) && <p><strong>{a.headline}</strong>{a.artStyle && ` · ${a.artStyle}`}</p>}
              {a.bio && <details><summary>Read bio</summary><div className="blog-moderation-card-body">{a.bio}</div></details>}
              {a.status !== 'APPROVED' && (
                <label className="blog-moderation-note">Note for the artist (shown if rejected)
                  <textarea maxLength={1000} value={notes[a.userId] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [a.userId]: event.target.value }))} />
                </label>
              )}
              <div className="blog-moderation-card-actions">
                {a.status !== 'APPROVED' && <button className="blog-approve" type="button" disabled={busy} onClick={() => void review(a.userId, 'APPROVED')}>Approve &amp; publish</button>}
                {a.status !== 'REJECTED' && <button className="blog-reject" type="button" disabled={busy} onClick={() => void review(a.userId, 'REJECTED')}>{a.status === 'APPROVED' ? 'Unpublish' : 'Reject'}</button>}
              </div>
              {a.reviewNote && a.status === 'REJECTED' && <p><strong>Note:</strong> {a.reviewNote}</p>}
            </article>
          ))}
        </div>}
    </section>
  )
}
