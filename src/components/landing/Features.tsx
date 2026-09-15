'use client'

import { useRef } from 'react'
import { m as motion, useInView } from 'framer-motion'
import { Truck, Shield, BarChart3, Zap, Route, Fuel } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

const FEATURES = [
  { icon: Truck,     title: 'Gestão de Frota',         desc: 'Conheça cada caminhão além da placa. Reúna cadastro e histórico para acompanhar sua frota com mais clareza.', tag: 'Plano Essencial' },
  { icon: Shield,    title: 'Controle de Motoristas',   desc: 'Equipe no mesmo ritmo da operação. Vincule motoristas aos veículos e consulte o histórico de cada condutor.', tag: 'Plano Avançado' },
  { icon: BarChart3, title: 'Relatórios Avançados',     desc: 'Transforme o histórico em direção. Compare custos por veículo, motorista e período para orientar suas próximas decisões.', tag: 'Plano Enterprise' },
  { icon: Fuel,      title: 'Custos de Combustível',    desc: 'O motor gira. Você acompanha o consumo. Registre abastecimentos e autonomia para entender o gasto de cada caminhão.', tag: 'Plano Avançado' },
  { icon: Route,     title: 'Pedágios & Rotas',         desc: 'Cada trajeto tem um custo. Organize os gastos com pedágios por semana e motorista para enxergar onde sua operação pesa.', tag: 'Plano Avançado' },
  { icon: Zap,       title: 'Manutenção',               desc: 'Leia os sinais da sua frota. Acompanhe serviços, peças e custos por veículo, com um histórico que ajuda a planejar os próximos cuidados.', tag: 'Plano Enterprise' },
]

function FeatureCard({ feature, index, isVisible }: { feature: typeof FEATURES[0]; index: number; isVisible: boolean }) {
  const Icon   = feature.icon
  const { primary } = useTheme()

  return (
    <motion.div
      initial={{ opacity: 0, y: 48, scale: 0.96, rotateX: 6 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : {}}
      whileHover={{ y: -8, transition: { duration: 0.22, ease: 'easeOut' } }}
      transition={{ duration: 0.62, delay: 0.12 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="feature-card group relative min-h-[19rem] overflow-hidden border border-border bg-card p-7 cursor-default"
      style={{
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
        transformPerspective: 900,
      }}
    >
      {/* Glow no hover */}
      <div
        className="feature-glow absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${primary} 12%, transparent) 0%, transparent 60%)` }}
      />

      <div
        className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
        style={{ backgroundColor: primary }}
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
  const cardsRef     = useRef<HTMLDivElement>(null)
  const headerInView = useInView(headerRef, { once: true, margin: '-60px' })
  const cardsInView  = useInView(cardsRef, { once: true, margin: '-60px' })
  const { primary }  = useTheme()

  return (
    <section id="funcionalidades" className="relative z-10 py-20 w-full bg-background transition-colors duration-300">
      <style>{`
        .feature-card {
          transition: border-color 240ms ease, box-shadow 240ms ease;
        }
        .feature-card:hover {
          border-color: ${primary} !important;
          box-shadow: 0 24px 64px color-mix(in srgb, ${primary} 10%, transparent);
        }
        .feature-card:hover .feature-glow {
          opacity: 1;
        }
        .feature-card:hover .feature-corner {
          border-color: ${primary} !important;
        }
      `}</style>
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
            Os sinais da sua operação, conectados
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-5xl md:text-7xl font-bold leading-tight text-foreground"
            style={{ fontFamily: 'Rajdhani, sans-serif' }}
          >
            LEIA OS SINAIS.<br />
            <span style={{ color: primary }}>ASSUMA O CONTROLE.</span>
          </motion.h2>
        </motion.div>

        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} isVisible={cardsInView} />
          ))}
        </div>
      </div>
    </section>
  )
}
