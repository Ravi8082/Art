'use client'

import { useState } from 'react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function NewsletterUnsubscribe({ token }: { token: string }) {
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function unsubscribe() {
    setSubmitting(true)
    setStatus('')
    try {
      const response = await fetch(`${apiBase}/api/newsletter/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const message = await response.text()
      if (!response.ok) throw new Error(message || 'Could not unsubscribe. Please try again.')
      setStatus(message)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not unsubscribe. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="newsletter-unsubscribe">
      <section>
        <h1>Newsletter preferences</h1>
        <p>Confirm if you no longer want to receive updates from The Haat of Art.</p>
        <button type="button" onClick={unsubscribe} disabled={submitting || !token}>
          {submitting ? 'Updating…' : 'Unsubscribe'}
        </button>
        {status && <p role="status" aria-live="polite">{status}</p>}
        {!token && <p role="alert">This unsubscribe link is invalid.</p>}
      </section>
    </main>
  )
}
