'use client'

import { useState, type FormEvent } from 'react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const MAX_FILES = 6
const MAX_IMAGE = 8 * 1024 * 1024
const MAX_VIDEO = 40 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
const ACCEPT = ALLOWED.join(',')

async function responseError(response: Response) {
  const payload: unknown = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
  return `Your story could not be submitted (request ${response.status}).`
}

export function BlogSubmissionForm() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])

  function addFiles(list: FileList | null) {
    if (!list) return
    const problems: string[] = []
    const next = [...files]
    for (const file of Array.from(list)) {
      const isVideo = file.type.startsWith('video/')
      if (!ALLOWED.includes(file.type)) problems.push(`${file.name}: unsupported type`)
      else if (file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) problems.push(`${file.name}: too large (max ${isVideo ? '40' : '8'} MB)`)
      else if (next.length >= MAX_FILES) problems.push(`Only ${MAX_FILES} files allowed`)
      else next.push(file)
    }
    setFiles(next)
    setError(problems.join(' · '))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${apiBaseUrl}/api/content/blog/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: values.get('title'),
          excerpt: values.get('excerpt'),
          body: values.get('body'),
          author: values.get('author'),
          email: values.get('email'),
        }),
      })
      if (!response.ok) throw new Error(await responseError(response))
      const created = await response.json() as { id: string; uploadToken: string }
      const failed: string[] = []
      for (const file of files) {
        const upload = await fetch(`${apiBaseUrl}/api/content/blog/submissions/${created.id}/media`, {
          method: 'POST',
          headers: { 'Content-Type': file.type, 'X-Upload-Token': created.uploadToken },
          body: file,
        }).catch(() => null)
        if (!upload?.ok) failed.push(`${file.name}${upload ? ` (${await responseError(upload)})` : ''}`)
      }
      form.reset()
      setFiles([])
      setMessage(failed.length
        ? `Your story was sent for review, but these files could not be uploaded: ${failed.join(', ')}.`
        : 'Thanks for sharing your story. It has been sent to our admin team for review and will appear on the blog only after approval.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your story could not be submitted. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="bw-form" onSubmit={(event) => void submit(event)}>
      <label><span>Blog title</span><input name="title" maxLength={200} required /></label>
      <label><span>Your name</span><input name="author" maxLength={120} autoComplete="name" required /></label>
      <label><span>Email for review updates</span><input name="email" type="email" maxLength={255} autoComplete="email" required /></label>
      <label><span>Short introduction</span><textarea name="excerpt" rows={3} maxLength={400} /></label>
      <label><span>Your story</span><textarea name="body" rows={7} maxLength={20000} required /></label>
      <div className="bw-media">
        <span>Photos &amp; videos <em>(optional · up to {MAX_FILES} files)</em></span>
        <label className="bw-media-pick">
          <input type="file" multiple accept={ACCEPT} disabled={busy} onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
          Choose photos or videos
        </label>
        <small>Photos up to 8 MB · Videos (MP4, WebM, MOV) up to 40 MB</small>
        {files.length > 0 && (
          <ul className="bw-media-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.type.startsWith('video/') ? '🎬' : '🖼️'} {file.name} · {(file.size / 1048576).toFixed(1)} MB</span>
                <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} disabled={busy} aria-label={`Remove ${file.name}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="bw-form-feedback is-error" role="alert">{error}</p>}
      {message && <p className="bw-form-feedback is-success" role="status">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Sending for review…' : 'Submit for admin review'}</button>
    </form>
  )
}
