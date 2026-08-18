'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'

// SSR=false obrigatório — Three.js usa APIs do browser
const TruckScene = dynamic(() => import('@/components/landing/3d/TruckScene'), {
  ssr: false,
  loading: () => (
    // FIX: Loading state que NÃO pisca — mesmo fundo, só spinner
    <div
      className="fixed inset-0 z-0 flex items-center justify-center"
      style={{ backgroundColor: '#080808' }}
    >
      <div style={{ textAlign: 'center' }}>
        <span
          className="inline-block w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#22c55e', borderTopColor: 'transparent' }}
        />
        <p
          className="mt-4 text-xs uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}
        >
          Carregando...
        </p>
      </div>
    </div>
  ),
})

export default function Hero({ children }: { children?: ReactNode }) {
  const { primary, isLight } = useTheme()
  const router = useRouter()

  // FIX: isMobile só avaliado no client, default false para evitar mismatch de hydration
  const [isMobile, setIsMobile] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Antes de hidratar: renderiza o container vazio com o fundo certo (sem flash)
  if (!hydrated) {
    return (
      <section
        className="relative w-full min-h-screen"
        style={{ backgroundColor: '#080808' }}
      />
    )
  }

  // Mobile: versão sem 3D
  if (isMobile) {
    return (
      <section
        className="relative w-full pt-32 text-foreground transition-colors duration-300"
        style={{ backgroundColor: 'var(--background)' }}
      >
        <div className="px-6 py-12 text-center max-w-lg mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-6"
            style={{
              borderColor: `color-mix(in srgb, ${primary} 30%, transparent)`,
              backgroundColor: `color-mix(in srgb, ${primary} 10%, transparent)`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: primary }}
            />
            <span
              className="text-xs uppercase tracking-widest font-bold"
              style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}
            >
              RPMTruck Plataforma
            </span>
          </div>

          {/* Título */}
          <h1
            className="text-5xl font-black mb-4 leading-tight"
            style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}
          >
            POTÊNCIA &amp;<br />
            <span style={{ color: primary }}>CONTROLE</span><br />
            <span style={{ fontSize: '2.2rem' }}>NA SUA FROTA</span>
          </h1>

          <p
            className="mb-10 text-lg font-light"
            style={{ color: 'var(--foreground-muted)', fontFamily: 'Outfit, sans-serif' }}
          >
            Gerenciamento completo da sua frota de caminhões, na palma da mão.
          </p>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              type="button"
              onClick={() => router.push('/auth/solicitar-acesso')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-sm font-bold uppercase tracking-widest transition-all"
              style={{
                backgroundColor: primary,
                color: isLight ? '#000' : '#fff',
                fontFamily: 'Rajdhani, sans-serif',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
              }}
            >
              Solicitar Acesso →
            </button>

            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 text-sm font-bold uppercase tracking-widest border transition-all"
              style={{
                borderColor: primary,
                color: primary,
                backgroundColor: 'transparent',
                fontFamily: 'Rajdhani, sans-serif',
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
              }}
            >
              Fazer Login
            </button>
          </div>
        </div>

        {/* Conteúdo estático (Ticker, Features, etc.) */}
        <div className="relative z-10">{children}</div>
      </section>
    )
  }

  // Desktop: versão com 3D (TruckScene controla o scroll inteiro)
  return (
    <section className="relative w-full min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <TruckScene>{children}</TruckScene>
    </section>
  )
}
