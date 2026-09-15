'use client'

import Link from 'next/link'
import { Component, lazy, ReactNode, Suspense, useState, useSyncExternalStore } from 'react'
import { MotionConfig } from 'framer-motion'
import { ArrowRight, Box } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import SystemPreviewDeck from './SystemPreviewDeck'
import styles from './HeroShowcase.module.css'
import { requestExperience3DDownload } from '@/lib/experience3d'

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
  notice,
}: {
  children?: ReactNode
  onEnable3D?: () => void
  notice?: string
}) {
  const [confirmDownload, setConfirmDownload] = useState(false)
  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          {notice && <p role="status" className="mb-4 text-xs text-foreground-muted">{notice}</p>}
          <p className={styles.eyebrow}>Agilidade na gestão. Cuidado com a frota.</p>
          <BrandLogo variant="wordmark" className={styles.wordmark} />
          <h1 className={styles.title}>O pulso da frota.<br /><span>O ritmo da gestão.</span></h1>
          <p className={styles.description}>Com a RPMTruck, você acompanha os sinais de cada caminhão e dá ritmo à operação. Frota, custos e equipe conectados para decidir com clareza.</p>
          <div className={styles.actions}>
            <Link href="/auth/solicitar-acesso" className={styles.primaryAction}>Solicitar acesso <ArrowRight size={16} /></Link>
            <Link href="/auth/login" className={styles.secondaryAction}>Fazer login</Link>
          </div>
          {onEnable3D && <div className={styles.experience}>
            {confirmDownload ? <>
              <p>Baixar aproximadamente 5 MB para iniciar a experiência 3D?</p>
              <div className="flex gap-5"><button type="button" onClick={() => { requestExperience3DDownload(); onEnable3D() }}><Box size={15} />Baixar e ativar</button><button type="button" onClick={() => setConfirmDownload(false)}>Agora não</button></div>
            </> : <><button type="button" onClick={() => setConfirmDownload(true)}><Box size={15} />Ativar experiência 3D <ArrowRight size={14} /></button><p>Opcional: baixa aproximadamente 5 MB e usa aceleração gráfica.</p></>}
          </div>}
        </div>
        <SystemPreviewDeck />
      </div>
      {children && <div className="relative z-10">{children}</div>}
    </section>
  )
}

class ExperienceBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
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
        <ExperienceBoundary fallback={<HeroFallback notice="A experiência 3D está indisponível. Conheça o sistema pelas telas abaixo.">{children}</HeroFallback>}>
          <Suspense fallback={<HeroFallback />}>
            <TruckScene>{children}</TruckScene>
          </Suspense>
        </ExperienceBoundary>
      </section>
    </MotionConfig>
  )
}
