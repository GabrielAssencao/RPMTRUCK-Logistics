'use client'

import Link from 'next/link'
import { lazy, ReactNode, Suspense, useState, useSyncExternalStore } from 'react'
import { MotionConfig } from 'framer-motion'

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'

function subscribeToMobileViewport(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
  mediaQuery.addEventListener('change', onStoreChange)

  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

function getMobileViewportSnapshot() {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getDesktopServerSnapshot() {
  return false
}

function subscribeToHydration() {
  return () => undefined
}

function getHydratedSnapshot() {
  return true
}

function getServerHydratedSnapshot() {
  return false
}

// O módulo 3D só é importado depois da escolha explícita do visitante. Usar
// next/dynamic aqui faria o Next.js antecipar o chunk e o preload do modelo.
const TruckScene = lazy(() => import('@/components/landing/3d/TruckScene'))

function HeroFallback({
  children,
  onEnable3D,
}: {
  children?: ReactNode
  onEnable3D?: () => void
}) {
  return (
    <section className="relative w-full bg-background pt-28 text-foreground">
      <div className="relative mx-auto flex min-h-[calc(100vh-7rem)] max-w-7xl items-center overflow-hidden px-6 py-16 md:px-20">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 75% 40%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 35%), linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: 'auto, 56px 56px, 56px 56px',
          }}
        />
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.3em] text-primary">
            RPMTruck Plataforma
          </p>
          <h1 className="mb-6 text-5xl font-black leading-none md:text-8xl" style={{ fontFamily: 'Rajdhani, sans-serif' }}>
            POTÊNCIA &amp;<br />
            <span className="text-primary">CONTROLE</span><br />
            <span className="text-[clamp(2rem,4.5vw,3.5rem)]">NA SUA FROTA</span>
          </h1>
          <p className="mb-10 max-w-xl text-lg font-light text-foreground-muted md:text-xl">
            Gerenciamento completo da sua frota de caminhões, com operação centralizada e decisões mais rápidas.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/auth/solicitar-acesso"
              className="inline-flex min-h-12 items-center justify-center bg-primary px-8 py-4 text-sm font-bold uppercase tracking-widest"
              style={{ color: 'var(--primary-contrast)' }}
            >
              Solicitar acesso →
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex min-h-12 items-center justify-center border border-primary px-8 py-4 text-sm font-bold uppercase tracking-widest text-primary"
            >
              Fazer login
            </Link>
          </div>
          {onEnable3D && (
            <div className="mt-6 hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={onEnable3D}
                className="min-h-11 border border-border-strong px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground-muted transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Ativar experiência 3D
              </button>
              <span className="max-w-xs text-xs leading-5 text-foreground-muted">
                Opcional: baixa aproximadamente 5 MB e usa aceleração gráfica.
              </span>
            </div>
          )}
        </div>
      </div>
      {children && <div className="relative z-10">{children}</div>}
    </section>
  )
}

export default function Hero({ children }: { children?: ReactNode }) {
  const [experience3DEnabled, setExperience3DEnabled] = useState(false)
  // FIX: isMobile só avaliado no client, default false para evitar mismatch de hydration
  const isMobile = useSyncExternalStore(
    subscribeToMobileViewport,
    getMobileViewportSnapshot,
    getDesktopServerSnapshot,
  )
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  )

  // O HTML inicial já contém a proposta de valor e as ações principais. Isso
  // melhora a percepção de carregamento e evita uma primeira tela vazia.
  if (!hydrated) {
    return <HeroFallback>{children}</HeroFallback>
  }

  // Mobile: versão sem 3D
  if (isMobile) {
    return <HeroFallback>{children}</HeroFallback>
  }

  if (!experience3DEnabled) {
    return <HeroFallback onEnable3D={() => setExperience3DEnabled(true)}>{children}</HeroFallback>
  }

  // Desktop: versão com 3D (TruckScene controla o scroll inteiro)
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative w-full min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
        <Suspense fallback={<HeroFallback />}>
          <TruckScene>{children}</TruckScene>
        </Suspense>
      </section>
    </MotionConfig>
  )
}
