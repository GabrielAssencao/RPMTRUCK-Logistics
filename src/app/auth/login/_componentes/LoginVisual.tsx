'use client'

import { Component, lazy, Suspense, useId, type ReactNode } from 'react'
import FractalBackdrop from '@/components/brand/FractalBackdrop'
import { motion, useReducedMotion } from 'framer-motion'
import styles from './LoginVisual.module.css'

const TruckPanel = lazy(() => import('./TruckPanel'))

export function LoginProfileCard({ role }: { role?: string }) {
  const reduced = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const admin = role === 'ADMIN_RPM' || role === 'ADMIN'
  const equipe = role === 'OPERADOR' || role === 'VISUALIZADOR'
  const label = admin ? 'Perfil de administrador' : equipe ? 'Perfil da equipe' : 'Perfil de usuário'
  return <motion.div role="img" aria-label={label} className={styles.figure} data-login-profile={admin ? 'admin' : equipe ? 'equipe' : 'usuario'} initial={false} animate={{ rotate: 0 }} whileHover={reduced ? undefined : { scale: 1.03, y: -6 }} transition={{ duration: reduced ? 0 : .45, ease: [.4, 0, .2, 1] }} onPointerMove={(event) => {
    if (reduced || event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--tilt-y', `${((event.clientX - bounds.left) / bounds.width - .5) * 16}deg`)
    event.currentTarget.style.setProperty('--tilt-x', `${(.5 - (event.clientY - bounds.top) / bounds.height) * 12}deg`)
  }} onPointerLeave={(event) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg')
    event.currentTarget.style.setProperty('--tilt-y', '0deg')
  }}>
    <svg className={styles.profileIcon} viewBox="0 0 320 340" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="color-mix(in srgb, var(--primary) 65%, #10151c)" /><stop offset=".16" stopColor="color-mix(in srgb, var(--primary) 45%, white)" /><stop offset=".27" stopColor="var(--primary)" /><stop offset=".4" stopColor="color-mix(in srgb, var(--primary) 35%, #10151c)" /><stop offset=".56" stopColor="color-mix(in srgb, var(--primary) 65%, white)" /><stop offset=".68" stopColor="color-mix(in srgb, var(--primary) 35%, white)" /><stop offset=".8" stopColor="color-mix(in srgb, var(--primary) 55%, #10151c)" /><stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
        <radialGradient id={`${id}-body`} cx=".22" cy=".12" r=".9">
          <stop stopColor="#27333d" /><stop offset=".48" stopColor="#0d131b" /><stop offset="1" stopColor="#030508" />
        </radialGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="color-mix(in srgb, var(--primary) 40%, white)" /><stop offset=".32" stopColor="color-mix(in srgb, var(--primary) 45%, #10151c)" /><stop offset=".63" stopColor="var(--primary)" /><stop offset="1" stopColor="color-mix(in srgb, var(--primary) 30%, #10151c)" />
        </linearGradient>
        <g id={`${id}-person`}>
          <circle cx="160" cy="103" r="65" />
          <path d="M58 282c0-54 18-92 54-102 13-4 20 9 48 9s35-13 48-9c36 10 54 48 54 102 0 20-11 29-31 29H89c-20 0-31-9-31-29Z" />
        </g>
      </defs>
      {equipe && <g fill={`url(#${id}-body)`} stroke={`url(#${id}-chrome)`} strokeWidth="7" opacity=".82">
        <use href={`#${id}-person`} transform="translate(-25 68) scale(.64)" />
        <use href={`#${id}-person`} transform="translate(143 68) scale(.64)" />
      </g>}
      <use href={`#${id}-person`} transform="translate(4 5)" fill="#030507" stroke={`url(#${id}-rim)`} strokeWidth="12" />
      <use href={`#${id}-person`} fill={`url(#${id}-body)`} stroke={`url(#${id}-chrome)`} strokeWidth="8" />
      <use href={`#${id}-person`} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="2" />
      <path d="M112 63c12-14 29-21 47-22M66 279c0-39 12-73 38-88M82 300h85" fill="none" stroke="color-mix(in srgb, var(--primary) 40%, white)" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
      {admin && <g>
        <path d="m255 211 43 16v34c0 32-26 52-43 61-17-9-43-29-43-61v-34Z" fill={`url(#${id}-body)`} stroke={`url(#${id}-chrome)`} strokeWidth="7" />
        <path d="m237 264 12 12 26-28" fill="none" stroke="var(--primary)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>}
    </svg>
  </motion.div>
}

function BrandVisual() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pb-52" style={{ background: 'linear-gradient(135deg, transparent 45%, color-mix(in srgb, var(--primary) 8%, transparent) 45%, transparent 85%)' }}>
      <div className="absolute inset-0 bottom-52"><FractalBackdrop /></div>
      <LoginProfileCard />
    </div>
  )
}

class VisualBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <BrandVisual /> : this.props.children }
}

export default function LoginVisual({ enabled, primary, isLight }: { enabled: boolean; primary: string; isLight: boolean }) {
  if (!enabled) return <BrandVisual />
  return <VisualBoundary><Suspense fallback={<BrandVisual />}><TruckPanel primary={primary} isLight={isLight} /></Suspense></VisualBoundary>
}
