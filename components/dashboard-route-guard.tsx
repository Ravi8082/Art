'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : '')
).replace(/\/$/, '')

type AccessState = 'checking' | 'authorized' | 'unauthenticated' | 'error'

type AccessResult = {
  pathname: string
  state: AccessState
  message?: string
}

export function DashboardRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [attempt, setAttempt] = useState(0)
  const [access, setAccess] = useState<AccessResult>({ pathname: '', state: 'checking' })

  useEffect(() => {
    if (pathname === '/dashboard') return

    const controller = new AbortController()
    let active = true
    setAccess({ pathname, state: 'checking' })

    void fetch(`${apiBaseUrl}/api/auth/me`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (active) setAccess({ pathname, state: 'unauthenticated' })
          return
        }

        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : `Request failed (${response.status})`
          throw new Error(message)
        }
        if (!data || typeof data !== 'object' || !('user' in data) || !data.user) {
          throw new Error('The authentication service returned an invalid response.')
        }
        if (active) setAccess({ pathname, state: 'authorized' })
      })
      .catch((cause: unknown) => {
        if (!active || controller.signal.aborted) return
        setAccess({
          pathname,
          state: 'error',
          message: cause instanceof Error ? cause.message : 'Could not verify dashboard access.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, pathname])

  if (pathname === '/dashboard') return children

  if (access.pathname !== pathname || access.state === 'checking') {
    return <main className="role-dashboard-loading"><span className="role-spinner" /> Verifying secure dashboard access…</main>
  }

  if (access.state === 'unauthenticated') {
    return (
      <main className="role-dashboard-error">
        <h1>Sign in to continue</h1>
        <p role="status">Sign in to your dashboard account to access this workspace.</p>
        <Link className="role-primary-button" href="/dashboard">Sign in to your dashboard</Link>
        <Link className="role-back-link" href="/">Back to website</Link>
      </main>
    )
  }

  if (access.state === 'error') {
    return (
      <main className="role-dashboard-error">
        <h1>Dashboard unavailable</h1>
        <p role="alert">{access.message}</p>
        <button className="role-primary-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        <Link className="role-back-link" href="/">Back to website</Link>
      </main>
    )
  }

  return children
}
