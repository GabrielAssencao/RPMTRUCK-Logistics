// src/components/dashboard/GenericDrawer.tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Save } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

// Estrutura de cada campo do formulário
export interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  placeholder?: string
  required?: boolean
  min?: number | string
  max?: number | string
  maxLength?: number
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
  campos: FieldConfig[]
  initialValues?: Record<string, unknown>
  onSubmit: (formData: Record<string, unknown>) => Promise<void>
}

export default function GenericDrawer({
  isOpen,
  onClose,
  titulo,
  subtitulo,
  campos,
  initialValues = {},
  onSubmit
}: GenericDrawerProps) {
  const { primary, isLight } = useTheme()
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) queueMicrotask(() => setFormData(initialValues))
  }, [isOpen, initialValues])

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
      setFormData({}) // Limpa após envio
      onClose()
    } catch (err) {
      console.error('Erro ao salvar formulário:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* OVERLAY ESCURO COM BACKDROP BLUR */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50"
          />

          {/* PAINEL LATERAL (DRAWER) */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[480px] z-50 p-6 md:p-8 flex flex-col justify-between border-l shadow-2xl"
            style={{
              backgroundColor: isLight ? '#ffffff' : '#0a0a0a',
              borderColor: 'var(--border)'
            }}
          >
            <div>
              {/* TOPBAR / CABEÇALHO */}
              <div className="flex justify-between items-start pb-6 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <h2
                    className="text-xl font-black uppercase tracking-tight font-rajdhani"
                    style={{ color: 'var(--foreground)' }}
                  >
                    {titulo}
                  </h2>
                  {subtitulo && (
                    <p className="text-xs font-mono mt-1" style={{ color: 'var(--foreground-muted)' }}>
                      {subtitulo}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-sm hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* FORMULÁRIO DINÂMICO */}
              <form id="drawer-form" onSubmit={handleSubmit} className="space-y-5 font-mono">
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
                        className="w-full px-4 py-3 text-xs border outline-none transition-colors"
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
                        pattern={campo.pattern}
                        step={campo.step}
                        title={campo.title}
                        placeholder={campo.placeholder}
                        value={inputValue(formData[campo.name])}
                        onChange={(e) => handleChange(campo.name, e.target.value)}
                        className="w-full px-4 py-3 text-xs border outline-none transition-colors"
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
            <div className="pt-6 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-xs font-mono font-bold uppercase tracking-widest border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}
              >
                CANCELAR
              </button>

              <button
                type="submit"
                form="drawer-form"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 text-xs font-mono font-bold uppercase tracking-widest transition-all"
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
        </>
      )}
    </AnimatePresence>
  )
}

function inputValue(value: unknown): string | number {
  return typeof value === 'string' || typeof value === 'number' ? value : ''
}
