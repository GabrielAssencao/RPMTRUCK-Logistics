'use client'

import { useRef, type CSSProperties, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

type FeedbackTone = 'success' | 'error' | 'warning' | 'info'

const FEEDBACK_VARIABLE: Record<FeedbackTone, string> = {
  success: 'var(--status-success)',
  error: 'var(--status-danger)',
  warning: 'var(--status-warning)',
  info: 'var(--status-info)',
}

const FEEDBACK_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
} satisfies Record<FeedbackTone, typeof Info>

export function DashboardMotion({ children, motionKey }: { children: ReactNode; motionKey?: string }) {
  const pathname = usePathname()
  const activeMotionKey = motionKey ?? pathname
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const target = containerRef.current
      if (!target) return

      gsap.fromTo(
        target,
        { autoAlpha: 0.88, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.24,
          ease: 'power2.out',
          clearProps: 'transform,opacity,visibility',
        },
      )
    })
    return () => media.revert()
  }, { scope: containerRef, dependencies: [activeMotionKey], revertOnUpdate: true })

  return <div ref={containerRef} data-dashboard-motion>{children}</div>
}

export function ActionFeedback({
  message,
  tone = 'info',
  className = '',
}: {
  message: string
  tone?: FeedbackTone
  className?: string
}) {
  const feedbackRef = useRef<HTMLDivElement>(null)
  const Icon = FEEDBACK_ICON[tone]

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const target = feedbackRef.current
      if (!target) return
      const icon = target.querySelector('[data-feedback-icon]')
      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } })
      timeline.fromTo(target, { autoAlpha: 0, y: -6 }, { autoAlpha: 1, y: 0, duration: 0.22 })
      if (icon) {
        timeline.fromTo(icon, { scale: 0.75 }, { scale: 1, duration: 0.16 }, '<0.04')
      }
    })
    return () => media.revert()
  }, { scope: feedbackRef, dependencies: [message, tone], revertOnUpdate: true })

  return (
    <div
      ref={feedbackRef}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      data-action-feedback
      className={`flex items-start gap-2 border p-3 text-sm ${className}`}
      style={{ '--feedback-color': FEEDBACK_VARIABLE[tone] } as CSSProperties}
    >
      <Icon data-feedback-icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
