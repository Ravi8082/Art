'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react'
import { Steps } from '@/components/artist/artist-pages'

const apiBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

async function postAuth<T>(path: string, payload: Record<string, string>): Promise<T> {
  const response = await fetch(`${apiBase}/api/auth/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

function ArtistAuthCard({ step, children }: { step: 1 | 2; children: React.ReactNode }) {
  return (
    <main className="ar-auth">
      <section className="ar-card">
        <Link href="/" className="ar-logo" aria-label="The Haat of Art home">
          <img src="/media/logo.png" alt="The Haat of Art" />
        </Link>
        <Steps active={step} />
        {children}
      </section>
    </main>
  )
}

export function ExhibitorRegistrationForm() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await postAuth<{ email: string }>('register-exhibitor', {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      setPassword('')
      router.push(`/artist/verify?email=${encodeURIComponent(result.email)}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create your artist account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ArtistAuthCard step={1}>
      <h2>Create Your Artist Account</h2>
      <p className="ar-sub">Join our community and start your journey.</p>
      <form className="ar-form" onSubmit={submit}>
        <label className="ar-field"><span>Full Name<em> *</em></span><input autoComplete="name" required minLength={2} maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
        <label className="ar-field"><span>Email Address<em> *</em></span><input type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="ar-field"><span>Password<em> *</em></span><input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use at least 12 characters.</small></label>
        <label className="ar-check"><input type="checkbox" required /> I agree to the <Link href="/contact">Terms &amp; Conditions</Link> and <Link href="/contact">Privacy Policy</Link></label>
        {error && <p className="role-error" role="alert">{error}</p>}
        <button className="th-btn ar-wide" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Send verification code →'}</button>
      </form>
      <p className="ar-foot">Already have an account? <Link href="/login">Sign in</Link></p>
    </ArtistAuthCard>
  )
}

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')?.trim().toLowerCase() ?? ''
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await postAuth('verify-email', { email, code })
      router.replace('/dashboard')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify your email.')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await postAuth<{ message?: string }>('resend-verification', { email })
      setNotice(result.message || 'A new verification code was sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend the verification code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ArtistAuthCard step={2}>
      <div className="ar-mail" aria-hidden="true"><Mail size={32} /></div>
      <h2>Verify Your Email</h2>
      <p className="ar-sub">Enter the 6-digit verification code sent to<br /><b>{email || 'your email address'}</b></p>
      {!email && <p className="role-error" role="alert">Email address is missing. Please start again from registration.</p>}
      <form className="ar-form" onSubmit={verify}>
        <label className="ar-field"><span>Verification code<em> *</em></span><input aria-label="6-digit verification code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
        {error && <p className="role-error" role="alert">{error}</p>}
        {notice && <p className="role-success" role="status"><CheckCircle2 size={14} /> {notice}</p>}
        <button className="th-btn ar-wide" type="submit" disabled={busy || !email}>{busy ? 'Verifying…' : 'Verify & continue'} <ArrowRight size={15} /></button>
      </form>
      <p className="ar-links"><button type="button" onClick={() => void resend()} disabled={busy || !email}>Resend code</button><Link href="/artist/register">Change email</Link></p>
    </ArtistAuthCard>
  )
}

export function ExhibitorEmailVerification() {
  return <Suspense fallback={<main className="role-dashboard-loading"><span className="role-spinner" /> Loading email verification…</main>}><VerifyEmailForm /></Suspense>
}
