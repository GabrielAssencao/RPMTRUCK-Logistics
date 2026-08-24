'use client'

import { useEffect, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { useLandingStats } from '@/contexts/LandingStatsContext'

const FALLBACK_STATS = [
  { value: 0, suffix: '', label: 'Empresas' },
  { value: 0, suffix: '', label: 'Veículos' },
  { value: 0, suffix: '', label: 'Motoristas' },
  { value: 0, suffix: '', label: 'Manutenções' },
]

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!inView || !ref.current) return

    if (target <= 0 || prefersReducedMotion) {
      ref.current.textContent = `${Math.max(0, target)}${suffix}`
      return
    }

    const duration = 1500
    const startedAt = performance.now()
    let animationFrame = 0

    const updateCount = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      if (ref.current) {
        ref.current.textContent = `${Math.round(target * easedProgress)}${suffix}`
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(updateCount)
      }
    }

    animationFrame = requestAnimationFrame(updateCount)
    return () => cancelAnimationFrame(animationFrame)
  }, [inView, prefersReducedMotion, suffix, target])

  return <span ref={ref}>0{suffix}</span>
}

export default function Stats() {
  const { primary, isLight } = useTheme()
  const stats = useLandingStats()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const statsData = stats
    ? [
        { value: stats.empresas, suffix: '', label: 'Empresas' },
        { value: stats.veiculos, suffix: '', label: 'Veículos' },
        { value: stats.motoristas, suffix: '', label: 'Motoristas' },
        { value: stats.manutencoes, suffix: '', label: 'Manutenções' },
      ]
    : FALLBACK_STATS
  const textColor = isLight ? '#000000' : '#ffffff'
  const subtextColor = isLight ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)'

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 w-full py-16 overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: primary }}
    >
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)',
          backgroundSize: '12px 12px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.55, delay: 0.12 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="text-5xl md:text-6xl font-black mb-2 tracking-tighter"
                style={{ fontFamily: 'Rajdhani, sans-serif', color: textColor }}
              >
                <Counter target={stat.value} suffix={stat.suffix} />
              </div>
              <div
                className="text-xs uppercase tracking-[0.2em] font-bold"
                style={{ fontFamily: 'Rajdhani, sans-serif', color: subtextColor }}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}
