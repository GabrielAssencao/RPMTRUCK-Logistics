// src/components/dashboard/GenericDrawer.tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, Loader2, Save } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

// Estrutura de cada campo do formulário
export interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select'
  placeholder?: string
  required?: boolean
  min?: number | string
  max?: number | string
  maxLength?: number
  minLength?: number
  pattern?: string
  step?: number | string
  title?: string
  options?: { label: string; value: string }[]
}

interface GenericDrawerProps {
  isOpen: boolean
  onClose: () => void
  titulo: string
  subtitulo?: string
  errorMessage?: string
  campos: FieldConfig[]
  initialValues?: Record<string, unknown>
  onSubmit: (formData: Record<string, unknown>) => Promise<boolean | void>
}

export default function GenericDrawer({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  errorMessage,
  campos,
  initialValues,
  onSubmit
}: GenericDrawerProps) {
  const { primary, isLight } = useTheme()
  const titleId = useId()
  const descriptionId = useId()
  const reduzirMovimento = useReducedMotion()
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (isOpen) queueMicrotask(() => setFormData(initialValues ?? {}))
  }, [isOpen, initialValues])

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    try {
      const sucesso = await onSubmit(formData)
      if (sucesso === false) return
      setFormData({}) // Limpa após envio
      onClose()
    } catch (err) {
      console.error('Erro ao salvar formulário:', err)
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="adaptive-form-overlay fixed inset-0 z-50 flex bg-black/70 backdrop-blur-xs"
          initial={reduzirMovimento ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduzirMovimento ? 0 : 0.18 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitulo ? descriptionId : undefined}
            initial={reduzirMovimento ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: reduzirMovimento ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
            className="adaptive-form-panel flex w-full flex-col overflow-hidden border shadow-2xl sm:max-w-xl"
            style={{
              backgroundColor: isLight ? '#ffffff' : '#0a0a0a',
              borderColor: 'var(--border)'
            }}
          >
            <div className="contents">
              {/* TOPBAR / CABEÇALHO */}
              <div className="flex shrink-0 items-start justify-between gap-4 border-b p-4 sm:p-5" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2
                    id={titleId}
                    className="text-lg font-black uppercase tracking-tight font-rajdhani sm:text-xl"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {titulo}
                  </h2>
                  {subtitulo && (
                    <p id={descriptionId} className="mt-1 text-xs font-mono" style={{ color: 'var(--foreground-muted)' }}>
                      {subtitulo}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  disabled={loading}
                  aria-label="Fechar formulário"
                  className="grid min-h-10 min-w-10 shrink-0 place-items-center border transition-colors hover:bg-white/10 disabled:opacity-40"
                  style={{ color: 'var(--foreground-muted)', borderColor: 'var(--border)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* FORMULÁRIO DINÂMICO */}
              <form id="drawer-form" onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 font-mono sm:p-5">
                {errorMessage && (
                  <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
                    {errorMessage}
                  </p>
                )}
                {campos.map((campo) => (
                  <div key={campo.name}>
                    <label
                      className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {campo.label} {campo.required && <span className="text-red-500">*</span>}
                    </label>

                    {/* RENDERIZAÇÃO POR TIPO DE CAMPO */}
                    {campo.type === 'select' ? (
                      <select
                        required={campo.required}
                        value={inputValue(formData[campo.name])}
                        onChange={(e) => handleChange(campo.name, e.target.value)}
                        className="min-h-11 w-full border px-3 py-2.5 text-xs outline-none transition-colors"
                        style={{
                          backgroundColor: 'var(--background-secondary)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)'
                        }}
                      >
                        <option value="">Selecione uma opção...</option>
                        {campo.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={campo.type}
                        required={campo.required}
                        min={campo.min}
                        max={campo.max}
                        maxLength={campo.maxLength}
                        minLength={campo.minLength}
                        pattern={campo.pattern}
                        step={campo.step}
                        title={campo.title}
                        placeholder={campo.placeholder}
                        value={inputValue(formData[campo.name])}
                        onChange={(e) => handleChange(campo.name, e.target.value)}
                        className="min-h-11 w-full border px-3 py-2.5 text-xs outline-none transition-colors"
                        style={{
                          backgroundColor: 'var(--background-secondary)',
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)'
                        }}
                        onFocus={(e) => (e.target.style.borderColor = primary)}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                      />
                    )}
                  </div>
                ))}
              </form>
            </div>

            {/* RODAPÉ DE AÇÕES */}
            <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-4 sm:flex sm:items-center sm:justify-end sm:p-5" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="min-h-11 border px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-colors hover:bg-white/5 disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
              >
                CANCELAR
              </button>

              <button
                type="submit"
                form="drawer-form"
                disabled={loading}
                className="flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-xs font-mono font-bold uppercase tracking-widest transition-all disabled:cursor-wait disabled:opacity-70"
                style={{
                  backgroundColor: primary,
                  color: '#000',
                  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {loading ? 'A SALVAR...' : 'CONFIRMAR'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function inputValue(value: unknown): string | number {
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}
