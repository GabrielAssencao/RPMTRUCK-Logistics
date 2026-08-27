'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'

export default function CTA() {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const { primary } = useTheme()

  return (
    <section
      id="solicitar-acesso"
      ref={ref}
      className="relative z-10 py-24 w-full bg-background transition-colors duration-300 overflow-hidden"
    >
      {/* Background Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse 60% 40% at 50% 50%, color-mix(in srgb, ${primary} 15%, transparent) 0%, transparent 70%)` }}
      />

      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* Linha de acento topo */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }} 
      />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-xs tracking-[0.3em] uppercase mb-6 font-bold"
          style={{ fontFamily: 'JetBrains Mono, monospace', color: primary }}
        >
          Pronto para começar?
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl md:text-7xl font-bold leading-none mb-6 text-foreground"
          style={{ fontFamily: 'Rajdhani, sans-serif' }}
        >
          PRONTO PARA<br />
          <span style={{ color: primary }}>ACELERAR SUA GESTÃO?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-foreground-muted text-base md:text-lg mb-10 max-w-xl mx-auto"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Solicite agora o acesso e transforme como você gerencia sua frota.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <Link
            href="/auth/solicitar-acesso"
            className="inline-flex items-center gap-3 font-bold px-10 py-5 text-sm uppercase tracking-widest transition-all duration-300 hover:gap-4 hover:scale-105"
            style={{
              fontFamily: 'Rajdhani, sans-serif',
              backgroundColor: primary,
              color: 'var(--primary-contrast)',
              clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
              boxShadow: `0 0 40px color-mix(in srgb, ${primary} 40%, transparent)`,
            }}
          >
            SOLICITAR ACESSO AGORA →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
