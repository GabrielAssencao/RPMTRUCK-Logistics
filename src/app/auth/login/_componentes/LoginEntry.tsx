'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { LoginProfileCard } from './LoginVisual'
import FractalBackdrop from '@/components/brand/FractalBackdrop'

export default function LoginEntry({ onEntered, role }: { onEntered: () => void; role?: string }) {
  const reduced = useReducedMotion()
  return <div className="fixed inset-0 z-50 grid place-items-center bg-background text-foreground" role="status" aria-live="polite">
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true"><FractalBackdrop /></div>
    <motion.div className="relative flex flex-col items-center px-6 text-center" initial={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduced ? 0 : .38, ease: [.4, 0, .2, 1] }} onAnimationComplete={onEntered}>
      <div className="mb-8 flex w-64 justify-center"><LoginProfileCard role={role} /></div>
      <h1 className="font-display text-3xl font-bold">Acesso confirmado</h1>
      <p className="mt-2 text-sm text-foreground-muted">Abrindo seu painel…</p>
    </motion.div>
  </div>
}
