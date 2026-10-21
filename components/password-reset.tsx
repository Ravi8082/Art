'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function PasswordReset() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [requested, setRequested] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const result = await response.json() as { message?: string; error?: string; notRegistered?: boolean }
      if (response.status === 404 && result.notRegistered) {
        setError('No account found with this email. Redirecting you to the register page…')
        setTimeout(() => router.push('/visitor/register'), 1800)
        return
      }
      if (!response.ok) throw new Error(result.error || 'Could not request a reset code.')
      setRequested(true)
      setMessage(result.message || 'A reset code has been sent to your email.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request a reset code.')
    } finally {
      setBusy(false)
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(`${apiBase}/api/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code, password }),
      })
      const result = await response.json() as { message?: string; error?: string }
      if (!response.ok) throw new Error(result.error || 'Could not reset the password.')
      setMessage(result.message || 'Password reset. You can sign in now.')
      setCode('')
      setPassword('')
      setRequested(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reset the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="role-login-screen">
      <section className="role-login-card">
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <p className="role-eyebrow">Account recovery</p>
        <h1>Reset your password</h1>
        <p className="role-login-copy">We’ll send a secure, randomly generated code to your email address.</p>
        {!requested ? (
          <form onSubmit={requestCode}>
            <label>Email address<input type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {error && <p className="role-error" role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            <button className="role-primary-button" disabled={busy}>{busy ? 'Sending code…' : 'Send reset code'} <ArrowRight size={16} /></button>
          </form>
        ) : (
          <form onSubmit={resetPassword}>
            <label>6-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            <label>New password<input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>
            {error && <p className="role-error" role="alert">{error}</p>}
            {message && <p role="status">{message}</p>}
            <button className="role-primary-button" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'} <ArrowRight size={16} /></button>
          </form>
        )}
        <Link href="/login" className="role-back-link">Back to sign in</Link>
      </section>
    </main>
  )
}
