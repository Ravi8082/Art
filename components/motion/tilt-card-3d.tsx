'use client'

import { useMotionValue, useReducedMotion, useSpring, useTransform, motion } from 'framer-motion'
import type { PointerEvent, ReactNode } from 'react'

export function TiltCard3D({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion()
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [5, -5]), { stiffness: 180, damping: 22 })
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-6, 6]), { stiffness: 180, damping: 22 })

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width
    const y = (event.clientY - bounds.top) / bounds.height
    pointerX.set(x - 0.5)
    pointerY.set(y - 0.5)
    event.currentTarget.style.setProperty('--sheen-x', `${x * 100}%`)
    event.currentTarget.style.setProperty('--sheen-y', `${y * 100}%`)
  }

  function resetTilt() {
    pointerX.set(0)
    pointerY.set(0)
  }

  return (
    <motion.div
      className={className ? `tilt-card-3d ${className}` : 'tilt-card-3d'}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      style={reduceMotion ? undefined : { rotateX, rotateY, transformPerspective: 1000, transformStyle: 'preserve-3d' }}
    >
      {children}
    </motion.div>
  )
}
