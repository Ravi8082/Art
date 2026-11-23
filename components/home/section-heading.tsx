'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'

export function SectionHeading({ before, accent, subtitle, cta }: { before: string; accent: string; subtitle?: string; cta?: { label: string; href: string } }) {
  const headingRef = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: headingRef, offset: ['start end', 'center center'] })
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
  const y = useTransform(progress, [0, 1], [24, 0])
  const opacity = useTransform(progress, [0, 0.25, 1], [0, 1, 1])
  const letterSpacing = useTransform(progress, [0, 1], ['0.035em', '0em'])

  return (
    <motion.div ref={headingRef} className="th-heading" style={reduceMotion ? undefined : { y, opacity }}>
      <div>
        <motion.h2 style={reduceMotion ? undefined : { letterSpacing }}>{before} <em>{accent}</em></motion.h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {cta && <Link className="th-btn-outline" href={cta.href}>{cta.label} <ArrowRight size={14} /></Link>}
    </motion.div>
  )
}
