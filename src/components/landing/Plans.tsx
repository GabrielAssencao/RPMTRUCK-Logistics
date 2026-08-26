'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Check, Star, Lock } from 'lucide-react'
import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { usePlanosPublicos } from '@/hooks/usePlanosPublicos'

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function Plans() {
  const { primary, isLight } = useTheme()
  const ref    = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  const { planos, carregando, erro, recarregar } = usePlanosPublicos()

  const btnVars = `
    .plan-btn {
      --btn-color: ${primary};
      --btn-hover-bg: ${primary};
      --btn-hover-text: ${isLight ? '#000000' : '#ffffff'};
    }
    .plan-btn:not(:disabled):hover {
      background-color: var(--btn-hover-bg) !important;
      color: var(--btn-hover-text) !important;
    }
    .plan-card {
      border-color: var(--border);
      transition: border-color 240ms ease, box-shadow 240ms ease;
    }
    .plan-card:hover {
      border-color: color-mix(in srgb, ${primary} 58%, var(--border));
      box-shadow: 0 28px 72px color-mix(in srgb, ${primary} 9%, transparent);
    }
    .plan-card-featured {
      border-color: ${primary};
    }
  `

  return (
    <section id="planos" className="relative py-32 bg-background transition-colors duration-500 border-t border-border">
      <style>{btnVars}</style>

      <div className="max-w-7xl mx-auto px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-20"
        >
          <div className="text-xs tracking-[0.3em] uppercase mb-4 font-bold" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>
            PLANOS & NÍVEIS
          </div>
          <h2 className="text-5xl md:text-7xl font-bold text-foreground font-rajdhani">
            ESCOLHA SEU<br />
            <span style={{ color: primary }}>NÍVEL DE PERFORMANCE</span>
          </h2>
        </motion.div>

        {erro && (
          <div role="alert" className="mb-8 border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-500">
            {erro}{' '}
            <button type="button" onClick={() => void recarregar()} className="font-bold underline">Tentar novamente</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {carregando && Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-h-[42rem] animate-pulse border border-border bg-card" />
          ))}
          {planos.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 48, scale: 0.96, rotateX: 5 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1, rotateX: 0 } : {}}
              whileHover={plan.restricted ? undefined : { y: -8, transition: { duration: 0.22, delay: 0 } }}
              transition={{ duration: 0.62, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={`plan-card group relative flex min-h-[42rem] flex-col justify-between overflow-hidden border bg-card p-8 ${plan.featured ? 'plan-card-featured xl:-mt-3 xl:mb-3' : ''}`}
              style={{
                clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                transformPerspective: 900,
              }}
            >
              <div
                className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                style={{ backgroundColor: primary }}
              />
              <span
                className="absolute right-5 top-5 text-5xl font-black leading-none opacity-[0.06]"
                style={{ color: primary, fontFamily: 'Rajdhani, sans-serif' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                {/* Badge */}
                {plan.featured && (
                  <div className="absolute left-1/2 top-0 -translate-x-1/2">
                    <span
                      className="inline-flex items-center px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap border font-mono"
                      style={{ backgroundColor: 'var(--card)', borderColor: primary, color: primary }}
                    >
                      MAIS POPULAR
                    </span>
                  </div>
                )}

                <div
                  className="mb-6 text-[9px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}
                >
                  Nível operacional {String(i + 1).padStart(2, '0')}
                </div>

                <Star className="w-6 h-6 mb-4" style={{ color: plan.featured ? primary : 'var(--muted)' }} fill="none" />

                <h3 className="text-2xl font-bold mb-1 font-rajdhani" style={{ color: plan.featured ? primary : 'var(--foreground)' }}>
                  {plan.name}
                </h3>
                <p className="text-foreground-muted text-sm mb-6">{plan.desc}</p>
                <div className="text-3xl font-bold mb-2 text-foreground font-rajdhani">{moeda.format(plan.price)}</div>
                <div className="mb-8 text-[10px] uppercase tracking-widest text-foreground-muted">por mês</div>

                <ul className="space-y-3 mb-8 font-mono">
                  {plan.modules.map((m) => (
                    <li key={m} className="flex gap-3 text-xs text-foreground-muted leading-snug">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: primary }} />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.restricted ? (
                <button
                  disabled
                  className="plan-btn w-full py-3 font-bold uppercase tracking-widest text-sm border flex items-center justify-center gap-2 opacity-50 cursor-not-allowed font-rajdhani"
                  style={{ backgroundColor: 'transparent', borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
                >
                  <Lock size={14} /> RESTRITO (ADMIN)
                </button>
              ) : (
                <Link
                  href={`/auth/solicitar-acesso?plano=${plan.id}`}
                  className="plan-btn w-full py-3 font-bold uppercase tracking-widest text-sm border flex items-center justify-center gap-2 transition-all duration-200 font-rajdhani cursor-pointer"
                  style={{ backgroundColor: 'transparent', borderColor: primary, color: primary }}
                >
                  Solicitar Acesso →
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
