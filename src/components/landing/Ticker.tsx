'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { useTheme } from '@/contexts/ThemeContext'

const STATIC_FEATURES = [
  '⚡ GESTÃO DE FROTA',
  '◆ CONTROLE DE MOTORISTAS',
  '◆ RELATÓRIOS AVANÇADOS',
  '◆ CUSTOS SEMANAIS',
  '◆ DASHBOARD EM TEMPO REAL',
]

export default function Ticker() {
  const { primary, isLight } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  // Inicialização padrão com o fallback para evitar re-layout e layout shift durante o scroll
  const [tickerItems, setTickerItems] = useState<string[]>(STATIC_FEATURES)

  useEffect(() => {
    async function fetchStatsFromDB() {
      try {
        const response = await fetch('/api/stats')
        
        if (!response.ok) {
          throw new Error('Falha na resposta do servidor')
        }
        
        const dbData = await response.json()

        const combinedItems = [
          ...STATIC_FEATURES,
          `◆ ${dbData.empresas || 10}+ EMPRESAS PARCEIRAS`,
          `◆ ${dbData.veiculos || 120}+ ATIVOS EM OPERAÇÃO`,
          `◆ ${dbData.motoristas || 240}+ CONDUTORES CONECTADOS`,
        ]

        setTickerItems(combinedItems)
      } catch (error) {
        console.error('Erro ao buscar dados dinâmicos do Ticker, mantendo estático:', error)
        setTickerItems(STATIC_FEATURES)
      }
    }

    fetchStatsFromDB()
  }, [])

  // Duplicação para efeito infindo sem descontinuidade visual
  const repeated = [...tickerItems, ...tickerItems]

  // Definição da cor do texto garantindo alto contraste com o tema
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
        borderColor: `color-mix(in srgb, ${textColor} 20%, ${primary})` 
      }}
    >
      <div
        className="flex whitespace-nowrap"
        style={{ animation: 'ticker 35s linear infinite' }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center px-6 font-black uppercase tracking-widest shrink-0 text-sm md:text-base"
            style={{ fontFamily: 'Rajdhani, sans-serif', color: textColor }}
          >
            {item}
          </span>
        ))}
      </div>

      {/* Gradientes laterais de fusão usando a cor dinâmica ativa */}
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