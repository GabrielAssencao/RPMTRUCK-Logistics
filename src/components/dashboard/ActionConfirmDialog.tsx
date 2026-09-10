'use client'

import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { Loader2, ShieldAlert, X } from 'lucide-react'

interface ActionConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  eyebrow?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ActionConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  eyebrow = 'Confirme a ação',
  loading = false,
  onConfirm,
  onClose,
}: ActionConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [loading, onClose, open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !loading) onClose()
            }}
          >
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={descriptionId}
              className="relative w-full max-w-md overflow-hidden border border-red-500 bg-background shadow-2xl"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            >
              <span className="absolute inset-x-0 top-0 h-1 bg-red-500" aria-hidden="true" />
              <div className="flex items-start justify-between gap-4 p-5 pt-6 sm:p-6 sm:pt-7">
                <div className="flex gap-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center border border-red-500/60 text-red-500">
                    <ShieldAlert size={20} aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">{eyebrow}</p>
                    <h2 id={titleId} className="mt-1 font-rajdhani text-xl font-black uppercase">{title}</h2>
                    <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-foreground-muted">{description}</p>
                  </div>
                </div>
                <button type="button" disabled={loading} onClick={onClose} aria-label="Fechar confirmação" className="p-2 text-foreground-muted transition-colors hover:text-foreground disabled:opacity-40">
                  <X size={17} />
                </button>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end" style={{ borderColor: 'var(--border)' }}>
                <button type="button" disabled={loading} onClick={onClose} className="min-h-11 border px-5 text-xs font-black uppercase disabled:opacity-40" style={{ borderColor: 'var(--border)' }}>{cancelLabel}</button>
                <motion.button type="button" autoFocus disabled={loading} onClick={onConfirm} whileTap={loading ? undefined : { scale: 0.985 }} className="flex min-h-11 items-center justify-center gap-2 bg-red-500 px-5 text-xs font-black uppercase text-white disabled:cursor-wait disabled:opacity-70">
                  {loading && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {loading ? 'Processando...' : confirmLabel}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  )
}
