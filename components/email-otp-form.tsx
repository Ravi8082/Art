'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function EmailOtpForm({ email, onVerified, className = 'role-login-card', initialMessage = '' }: {
  email: string
  onVerified: () => void | Promise<void>
  className?: string
  initialMessage?: string
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState(initialMessage)
  const [busy, setBusy] = useState(false)

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${apiBase}/api/auth/verify-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not verify this email.')
      await onVerified()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this email.')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(`${apiBase}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json() as { error?: string; message?: string }
      if (!response.ok) throw new Error(result.error || 'Could not resend the code.')
      setMessage(result.message || 'A new verification code has been sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={className}>
      <p className="role-eyebrow">Email verification</p>
      <h1>Check your inbox</h1>
      <p className="role-login-copy">Enter the 6-digit code sent to {email}.</p>
      <form onSubmit={verify}>
        <label>Verification code
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        {error && <p className="role-error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
        <button className="role-primary-button" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'} <ArrowRight size={16} /></button>
      </form>
      <button className="role-back-link" type="button" disabled={busy} onClick={() => void resend()}>Resend code</button>
    </section>
  )
}
