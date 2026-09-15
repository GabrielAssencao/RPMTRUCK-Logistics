'use client'

import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion'
import type { ReactNode } from 'react'

export default function LandingMotion({ children }: { children: ReactNode }) {
  // The public page uses animation/hover, without the drag/layout feature bundle.
  return <LazyMotion features={domAnimation}><MotionConfig reducedMotion="user">{children}</MotionConfig></LazyMotion>
}
