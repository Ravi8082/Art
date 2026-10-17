'use client'

import { useState, type FormEvent } from 'react'

const apiBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

async function responseError(response: Response) {
  const payload: unknown = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') return payload.error
  return `Your story could not be submitted (request ${response.status}).`
}

export function BlogSubmissionForm() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

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
      form.reset()
      setMessage('Thanks for sharing your story. It has been sent to our admin team for review and will appear on the blog only after approval.')
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
      {error && <p className="bw-form-feedback is-error" role="alert">{error}</p>}
      {message && <p className="bw-form-feedback is-success" role="status">{message}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Sending for review…' : 'Submit for admin review'}</button>
    </form>
  )
}
