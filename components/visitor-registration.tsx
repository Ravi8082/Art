'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, UserRoundPlus } from 'lucide-react'
import { EmailOtpForm } from '@/components/email-otp-form'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

export function VisitorRegistration() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [verificationMessage, setVerificationMessage] = useState('')

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`${apiBase}/api/auth/register-visitor`, {
        method: 'POST',
        credentials: 'include',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase(), password }),
      })
      const data = await response.json() as { error?: string; otpSent?: boolean; message?: string }
      if (!response.ok) throw new Error(data.error || `Could not create account (${response.status})`)
      setVerificationEmail(email.trim().toLowerCase())
      setVerificationMessage(data.message || (data.otpSent ? 'Enter the verification code sent to your email.' : 'The code could not be sent yet. Use Resend code to try again.'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create your visitor account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="role-login-screen">
      {verificationEmail ? (
        <EmailOtpForm email={verificationEmail} initialMessage={verificationMessage} onVerified={() => router.replace('/dashboard')} />
      ) : (
      <section className="role-login-card visitor-register-card">
        <Link href="/" className="role-brand" aria-label="The Haat of Art home"><img src="/media/logo.png" alt="The Haat of Art" /></Link>
        <span className="visitor-register-icon"><UserRoundPlus size={21} /></span>
        <p className="role-eyebrow">Join The Haat of Art</p>
        <h1>Create your visitor account</h1>
        <p className="role-login-copy">Register for exhibitions, keep your entry passes together and check your visit history.</p>
        <form onSubmit={register}>
          <label>Full name<input autoComplete="name" required minLength={2} maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
          <label>Email address<input type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>
          <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {error && <p className="role-error" role="alert">{error}</p>}
          <button className="role-primary-button" disabled={busy}>{busy ? 'Creating account…' : 'Create visitor account'} <ArrowRight size={16} /></button>
        </form>
        <p className="visitor-login-prompt">Already have an account? <Link href="/login">Sign in</Link></p>
      </section>
      )}
    </main>
  )
}
