'use client'

import Link from 'next/link'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'
import type { MouseEventHandler, PointerEvent, ReactNode } from 'react'

export function MagneticLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className: string
  children: ReactNode
  onClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  const reduceMotion = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 })
  const y = useSpring(useMotionValue(0), { stiffness: 100, damping: 30 })

  function move(event: PointerEvent<HTMLSpanElement>) {
    if (reduceMotion || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    x.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 10)
    y.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 7)
  }

  function reset() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.span
      className="magnetic-link"
      onPointerMove={move}
      onPointerLeave={reset}
      style={reduceMotion ? undefined : { x, y }}
    >
      <Link href={href} className={className} onClick={onClick}>{children}</Link>
    </motion.span>
  )
}
