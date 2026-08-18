'use client'

import { useRef, useEffect, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'

// Estado neutro: evita publicar números fictícios quando o banco estiver indisponível.
const FALLBACK_STATS = [
  { value: 0, suffix: '', label: 'Empresas' },
  { value: 0, suffix: '', label: 'Veículos' },
  { value: 0, suffix: '', label: 'Motoristas' },
  { value: 0, suffix: '', label: 'Manutenções' },
]

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1500
    
    if (target === 0) {
      setCount(0)
      return
    }
    
    const step = Math.ceil(target / (duration / 16))
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(start)
      }
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target])

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  )
}

export default function Stats() {
  const { primary, isLight } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  const [statsData, setStatsData] = useState<typeof FALLBACK_STATS>(FALLBACK_STATS)

  // ─── CONEXÃO COM A API / BANCO DE DADOS PRISMA ───
  useEffect(() => {
    async function fetchStatsFromDB() {
      try {
        const response = await fetch('/api/stats')
        if (!response.ok) {
          throw new Error('Falha de resposta na API de estatísticas')
        }
        
        const dbData = await response.json()

        setStatsData([
          { value: Number(dbData.empresas ?? 0), suffix: '', label: 'Empresas' },
          { value: Number(dbData.veiculos ?? 0), suffix: '', label: 'Veículos' },
          { value: Number(dbData.motoristas ?? 0), suffix: '', label: 'Motoristas' },
          { value: Number(dbData.manutencoes ?? 0), suffix: '', label: 'Manutenções' },
        ])
      } catch (error) {
        console.error('Erro ao buscar dados reais para o Stats, mantendo fallback:', error)
        setStatsData(FALLBACK_STATS)
      }
    }

    fetchStatsFromDB()
  }, [])

  // Definição da cor de contraste para os números dentro do bloco com a cor primária
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
      {/* Padrão de fundo industrial estilizado */}
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
