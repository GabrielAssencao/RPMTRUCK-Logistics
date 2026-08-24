'use client'

import { useMemo, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'
import { useLandingStats } from '@/contexts/LandingStatsContext'

const STATIC_FEATURES = [
  '⚡ GESTÃO DE FROTA',
  '◆ CONTROLE DE MOTORISTAS',
  '◆ RELATÓRIOS AVANÇADOS',
  '◆ CUSTOS SEMANAIS',
  '◆ DASHBOARD EM TEMPO REAL',
]

export default function Ticker() {
  const { primary, isLight } = useTheme()
  const stats = useLandingStats()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const tickerItems = useMemo(() => stats
    ? [
        ...STATIC_FEATURES,
        `◆ ${stats.empresas}+ EMPRESAS PARCEIRAS`,
        `◆ ${stats.veiculos}+ ATIVOS EM OPERAÇÃO`,
        `◆ ${stats.motoristas}+ CONDUTORES CONECTADOS`,
      ]
    : STATIC_FEATURES,
  [stats])
  const repeated = [...tickerItems, ...tickerItems]
  const textColor = isLight ? '#000000' : '#ffffff'

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 w-full overflow-hidden py-3 border-y transition-colors duration-300"
      style={{
        backgroundColor: primary,
        borderColor: `color-mix(in srgb, ${textColor} 20%, ${primary})`,
      }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'ticker 35s linear infinite' }}
      >
        {repeated.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center px-6 font-black uppercase tracking-widest shrink-0 text-sm md:text-base"
            style={{ fontFamily: 'Rajdhani, sans-serif', color: textColor }}
          >
            {item}
          </span>
        ))}
      </div>

      <div
        className="absolute inset-y-0 left-0 w-16 pointer-events-none"
        style={{ background: `linear-gradient(to right, ${primary}, transparent)` }}
      />
      <div
        className="absolute inset-y-0 right-0 w-16 pointer-events-none"
        style={{ background: `linear-gradient(to left, ${primary}, transparent)` }}
      />

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </motion.div>
  )
}
