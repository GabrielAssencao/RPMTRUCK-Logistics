'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Truck, Shield, BarChart3, Zap, Route, Fuel } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

const FEATURES = [
  { icon: Truck,     title: 'Gestão de Frota',         desc: 'Cadastro completo de veículos com modelo, tipo e placa. Controle total da sua frota com histórico detalhado.',          tag: 'Plano Essencial'    },
  { icon: Shield,    title: 'Controle de Motoristas',   desc: 'Vincule motoristas aos veículos e acompanhe o histórico completo de cada um em qualquer período.',                       tag: 'Plano Avançado'     },
  { icon: BarChart3, title: 'Relatórios Avançados',     desc: 'Gráficos de custos mensais e anuais por motorista e veículo. 3 anos de dados para decisões estratégicas.',              tag: 'Plano Enterprise'   },
  { icon: Fuel,      title: 'Custos de Combustível',    desc: 'Lance autonomia e abastecimento semana a semana. Saiba exatamente o que cada caminhão consome.',                          tag: 'Plano Avançado'     },
  { icon: Route,     title: 'Pedágios & Rotas',         desc: 'Registre gastos com pedágios por semana e por motorista. Identifique rotas mais custosas.',                              tag: 'Plano Avançado'     },
  { icon: Zap,       title: 'Manutenção',               desc: 'Acompanhe todos os custos de manutenção por veículo. Histórico completo para negociações com seguradoras.',              tag: 'Plano Enterprise'   },
]

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const Icon   = feature.icon
  const { primary } = useTheme()

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="feature-card group relative border border-border bg-card p-6 transition-all duration-300 cursor-default"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
      }}
    >
      {/* CSS injetado inline para o hover com cor dinâmica */}
      <style>{`
        .feature-card:hover {
          border-color: ${primary} !important;
        }
        .feature-card:hover .feature-glow {
          opacity: 1;
        }
        .feature-card:hover .feature-corner {
          border-color: ${primary} !important;
        }
      `}</style>

      {/* Glow no hover */}
      <div
        className="feature-glow absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${primary} 12%, transparent) 0%, transparent 60%)` }}
      />

      {/* Ícone */}
      <div
        className="w-12 h-12 border flex items-center justify-center mb-5 transition-colors duration-300"
        style={{
          borderColor: `color-mix(in srgb, ${primary} 30%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${primary} 10%, transparent)`,
        }}
      >
        <Icon className="w-6 h-6" style={{ color: primary }} />
      </div>

      {/* Tag */}
      <div className="text-xs uppercase tracking-widest mb-3 font-bold"
        style={{ fontFamily: 'JetBrains Mono, monospace', color: primary, opacity: 0.8 }}>
        {feature.tag}
      </div>

      <h3 className="text-foreground font-bold text-xl mb-3" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
        {feature.title}
      </h3>
      <p className="text-foreground-muted text-sm leading-relaxed" style={{ fontFamily: 'Outfit, sans-serif' }}>
        {feature.desc}
      </p>

      {/* Canto decorativo */}
      <div
        className="feature-corner absolute bottom-0 right-0 w-3 h-3 border-b border-r transition-colors duration-300"
        style={{ borderColor: `color-mix(in srgb, ${primary} 30%, transparent)` }}
      />
    </motion.div>
  )
}

export default function Features() {
  const headerRef    = useRef<HTMLDivElement>(null)
  const headerInView = useInView(headerRef, { once: true, margin: '-60px' })
  const { primary }  = useTheme()

  return (
    <section id="funcionalidades" className="relative z-10 py-20 w-full bg-background transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 24 }}
          animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-xs tracking-[0.3em] uppercase font-bold mb-4"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: primary }}
          >
            Funcionalidades
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold leading-tight text-foreground"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            TUDO QUE SUA<br />
            <span style={{ color: primary }}>FROTA PRECISA</span>
          </motion.h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
