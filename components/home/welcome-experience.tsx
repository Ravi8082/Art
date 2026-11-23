'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { KalaaChat } from '@/components/home/kalaa-chat'

const WelcomeHost3d = dynamic(
  () => import('@/components/welcome-host-3d').then((module) => module.WelcomeHost3d),
  { ssr: false, loading: () => <span className="thoa-host-loading" aria-hidden="true" /> },
)

const introActions = [
  { label: 'Book a Stall', href: '/book-your-stall' },
  { label: 'Explore Artworks', href: '/gallery' },
  { label: 'Pitch / Contact Us', href: '/contact' },
]

const introSeenKey = 'thoa_intro_seen'

export function WelcomeExperience({ pathname }: { pathname: string }) {
  const dismissTimer = useRef<number | null>(null)
  const dismissedInSession = useRef(false)
  const dismissStarted = useRef(false)
  const [introVisible, setIntroVisible] = useState(false)
  const [introLeaving, setIntroLeaving] = useState(false)
  const [conciergeEnabled, setConciergeEnabled] = useState(false)
  const [conciergeOpen, setConciergeOpen] = useState(false)

  useEffect(() => {
    let seen = false
    try {
      seen = window.sessionStorage.getItem(introSeenKey) === 'true'
    } catch (error) {
      console.error('[welcome-intro] Could not read session storage', error)
    }

    setConciergeEnabled(pathname !== '/' || seen)
    if (pathname === '/' && !seen && !dismissedInSession.current) setIntroVisible(true)
  }, [pathname])

  useEffect(() => {
    if (!introVisible) return
    document.body.classList.add('thoa-intro-lock')
    return () => document.body.classList.remove('thoa-intro-lock')
  }, [introVisible])

  useEffect(() => () => {
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
  }, [])

  function dismissIntro() {
    if (!introVisible || dismissStarted.current) return
    dismissStarted.current = true
    try {
      window.sessionStorage.setItem(introSeenKey, 'true')
    } catch (error) {
      console.error('[welcome-intro] Could not save session storage', error)
    }
    dismissedInSession.current = true
    setConciergeEnabled(true)
    setIntroLeaving(true)
    if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700
    dismissTimer.current = window.setTimeout(() => {
      setIntroVisible(false)
      setIntroLeaving(false)
      dismissTimer.current = null
    }, delay)
  }

  function stopCardClick(event: MouseEvent<HTMLElement>) {
    event.stopPropagation()
  }

  function handleTiltPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'touch') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    event.currentTarget.style.setProperty('--thoa-tilt-x', `${-y * 9}deg`)
    event.currentTarget.style.setProperty('--thoa-tilt-y', `${x * 12}deg`)
    event.currentTarget.style.setProperty('--thoa-light-x', `${(x + 0.5) * 100}%`)
    event.currentTarget.style.setProperty('--thoa-light-y', `${(y + 0.5) * 100}%`)
  }

  function resetTilt(event: PointerEvent<HTMLElement>) {
    event.currentTarget.style.setProperty('--thoa-tilt-x', '0deg')
    event.currentTarget.style.setProperty('--thoa-tilt-y', '0deg')
    event.currentTarget.style.setProperty('--thoa-light-x', '50%')
    event.currentTarget.style.setProperty('--thoa-light-y', '50%')
  }

  function replayIntro() {
    try {
      window.sessionStorage.removeItem(introSeenKey)
    } catch (error) {
      console.error('[welcome-intro] Could not clear session storage', error)
    }
    dismissedInSession.current = false
    dismissStarted.current = false
    setConciergeOpen(false)
    setConciergeEnabled(false)
    setIntroLeaving(false)
    setIntroVisible(true)
  }

  return (
    <>
      {introVisible && (
        <div
          className={`thoa-welcome-splash${introLeaving ? ' is-leaving' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="thoa-welcome-title"
          onClick={dismissIntro}
        >
          <div className="thoa-welcome-backdrop" aria-hidden="true" />
          <div className="thoa-welcome-layout">
            <div
              className="thoa-welcome-scene"
              aria-hidden="true"
              onPointerMove={handleTiltPointerMove}
              onPointerLeave={resetTilt}
            >
              <div className="thoa-scene-wash" />
              <div className="thoa-mini-art thoa-mini-art-left"><span /></div>
              <div className="thoa-mini-art thoa-mini-art-right"><span /></div>
              <div className="thoa-stage-plant thoa-stage-plant-left"><i /><i /><i /></div>
              <div className="thoa-stage-plant thoa-stage-plant-right"><i /><i /><i /></div>
              <div className="thoa-clay-sculpture thoa-clay-sculpture-left" />
              <div className="thoa-clay-sculpture thoa-clay-sculpture-right" />
              <div className="thoa-host-canvas"><WelcomeHost3d /></div>
              <div className="thoa-podium" aria-hidden="true">
                <div className="thoa-podium-foot" />
                <div className="thoa-podium-body" />
                <div className="thoa-podium-top" />
                <span className="thoa-podium-title">The Haat of Art Greets You</span>
              </div>
              {Array.from({ length: 12 }, (_, index) => (
                <i className={`thoa-floating-light light-${index + 1}`} key={index} />
              ))}
            </div>

            <section className="thoa-welcome-card" onClick={stopCardClick}>
              <p className="thoa-welcome-eyebrow"><Sparkles size={14} /> A warm Namaste from our community</p>
              <h2 id="thoa-welcome-title">Welcome to a world of art.</h2>
              <p className="thoa-welcome-message">Book a stall, pitch a show or just say hello.</p>
              <nav className="thoa-welcome-actions" aria-label="Quick links">
                {introActions.map((action) => (
                  <Link href={action.href} key={action.href} onClick={dismissIntro}>
                    {action.label}<ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            </section>
          </div>
          <button className="thoa-skip-intro" type="button" onClick={(event) => {
            event.stopPropagation()
            dismissIntro()
          }}>
            SKIP INTRO <span aria-hidden="true">→</span>
          </button>
          <span className="thoa-welcome-mark" aria-hidden="true">N</span>
        </div>
      )}

      {conciergeEnabled && !introVisible && (
        <div className={`thoa-concierge${conciergeOpen ? ' is-open' : ''}`}>
          {conciergeOpen && (
            <KalaaChat sourcePage={pathname} onClose={() => setConciergeOpen(false)} onReplayIntro={replayIntro} />
          )}
          <span className="thoa-concierge-label">Chat with THOA <span aria-hidden="true">✨</span></span>
          <button
            type="button"
            className="thoa-concierge-trigger"
            aria-label={conciergeOpen ? 'Close THOA AI Art Concierge' : 'Chat with THOA, your friendly art guide'}
            aria-expanded={conciergeOpen}
            onClick={() => setConciergeOpen((open) => !open)}
            onPointerMove={handleTiltPointerMove}
            onPointerLeave={resetTilt}
          >
            <span className="thoa-concierge-avatar" aria-hidden="true"><WelcomeHost3d compact /></span>
            <span className="thoa-concierge-sparkle" aria-hidden="true"><Sparkles size={14} /></span>
            <span className="thoa-concierge-particles" aria-hidden="true">
              {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
            </span>
          </button>
        </div>
      )}
    </>
  )
}
