'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'

const ContactBoy3d = dynamic(() => import('@/components/contact-boy-3d').then((mod) => mod.ContactBoy3d), { ssr: false })

const lines = ['Namaste! Welcome to The Haat of Art.', 'Book a stall, pitch a show or just say hello.', 'Scroll down — the form is ready for you.']

export function ContactIntro() {
  const [phase, setPhase] = useState<'hidden' | 'entering' | 'talking' | 'leaving'>('hidden')
  const [line, setLine] = useState(0)
  const timers = useRef<number[]>([])

  function after(ms: number, run: () => void) { timers.current.push(window.setTimeout(run, ms)) }

  function dismiss() {
    timers.current.forEach(clearTimeout)
    document.body.classList.remove('ct-intro-lock')
    setPhase('leaving')
    after(900, () => setPhase('hidden'))
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.body.classList.add('ct-intro-lock')
    setPhase('entering')
    after(1100, () => setPhase('talking'))
    after(1900, () => setLine(1))
    after(3500, () => setLine(2))
    after(6200, dismiss)
    return () => {
      timers.current.forEach(clearTimeout)
      document.body.classList.remove('ct-intro-lock')
    }
  }, [])

  if (phase === 'hidden') return null

  return (
    <div className={`cb-intro ${phase === 'leaving' ? 'is-leaving' : ''}`} role="dialog" aria-label="Welcome to The Haat of Art">
      <div className="cb-stage">
        <div className="cb-boy"><ContactBoy3d /></div>
        <div className="cb-bubble" aria-live="polite">
          {lines[line]}
          <span className="cb-bubble-tail" aria-hidden />
        </div>
        <p className="cb-title">The Haat of Art <em>greets you</em></p>
      </div>
      <button className="cb-skip" onClick={dismiss}>Skip intro →</button>
    </div>
  )
}
