// src/app/auth/reset/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, CheckCircle, AlertTriangle, Send, ShieldAlert } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import dynamic from 'next/dynamic'

// ─── Importa o Canvas 3D apenas no cliente ─────────────────────────────────────
const TruckPanel = dynamic(() => import('@/app/auth/login/TruckPanel'), { ssr: false })

export default function ResetPage() {
  const { primary, isLight } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  // Detecta visualização responsiva para desligar o 3D
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    setError('')

    try {
      // Conecta diretamente à rota real de backend que criamos por segurança
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.erro || 'Erro ao processar solicitação.')
      }

      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Falha de comunicação com o servidor de segurança.')
    } finally {
      setLoading(false)
    }
  }

  // ─── CONTEÚDO DO FORMULÁRIO DINÂMICO ──────────────────────────────────────────
  const formContent = (
    <AnimatePresence mode="wait">
      {!sent ? (
        <motion.div
          key="request-form"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          <div>
            <div className="text-xs uppercase tracking-[0.25em] font-bold mb-2" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>
              SEGURANÇA CORPORATIVA
            </div>
            <h2 className="text-4xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>
              RECUPERAR<br />ACESSO
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
              Informe o seu e-mail funcional para acionar a esteira de redefinição de chaves.
            </p>
          </div>

          {/* Alerta de erro da API */}
          {error && (
            <div 
              className="p-3 border text-xs flex items-center gap-2 font-mono" 
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}
            >
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ color: primary }}><Mail size={14} /></span> E-mail Cadastrado
              </label>
              <input 
                type="email" 
                placeholder="seu@empresa.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                disabled={loading}
                className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border" 
                style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)', fontFamily: 'Outfit, sans-serif' }} 
                onFocus={e => e.target.style.borderColor = primary} 
                onBlur={e => e.target.style.borderColor = 'var(--border)'} 
              />
            </div>

            <div className="p-4 border text-xs" style={{ borderColor: `${primary}30`, backgroundColor: `${primary}05`, color: 'var(--foreground-muted)', fontFamily: 'Outfit, sans-serif' }}>
              <span className="font-bold uppercase tracking-widest block mb-1 flex items-center gap-1" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}>
                <ShieldAlert size={12} /> Log de Auditoria
              </span>
              O chamado será enviado ao administrador geral. Após a aprovação, será disponibilizado um código de uso único, válido por 30 minutos e nunca armazenado em texto legível.
            </div>

            <motion.button 
              type="submit"
              disabled={loading || !email}
              whileHover={{ scale: !email ? 1 : 1.01 }} 
              whileTap={{ scale: !email ? 1 : 0.99 }} 
              className="w-full py-4 font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed" 
              style={{ fontFamily: 'Rajdhani, sans-serif', backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <> <Send size={14} /> ENVIAR PARA ANALISE </>
              )}
            </motion.button>
          </form>

          <div className="text-center">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase opacity-60 hover:opacity-100 transition-opacity font-mono" style={{ color: 'var(--foreground)' }}>
              <ArrowLeft size={12} /> Retornar ao Login
            </Link>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="success-message"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-4 space-y-5"
        >
          <div className="w-16 h-16 flex items-center justify-center mx-auto border-2" style={{ borderColor: primary, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
            <CheckCircle size={26} style={{ color: primary }} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.25em] font-bold mb-1" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>SOLICITAÇÃO ENVIADA!</div>
            <h2 className="text-3xl font-black font-rajdhani uppercase tracking-tight" style={{ color: 'var(--foreground)' }}>Fila de Triagem</h2>
            <p className="text-sm mt-3 text-foreground-muted">
              Uma requisição de reconfiguração foi anexada com êxito para a conta:
            </p>
            <p className="font-mono text-sm font-bold bg-black/10 px-3 py-1.5 border border-border mt-2 inline-block text-primary" style={{ color: primary }}>
              {email.toLowerCase()}
            </p>
          </div>
          <p className="text-xs max-w-xs mx-auto text-foreground-muted leading-relaxed">
            Aguarde a aprovação. Quando receber o código, acesse “Recuperar senha” para cadastrar uma nova senha forte. O código só poderá ser utilizado uma vez.
          </p>
          <div className="pt-4">
            <Link 
              href="/login" 
              className="px-6 py-3 font-black text-xs uppercase tracking-widest inline-block transition-transform hover:scale-105" 
              style={{ backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))', fontFamily: 'Rajdhani, sans-serif' }}
            >
              Ir para o Login
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ─── RENDERIZADOR RESPONSIVO MOBILE ──────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="relative h-36 flex flex-col items-center justify-center overflow-hidden" style={{ backgroundColor: primary }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
          <div className="absolute top-4 left-6 w-8 h-8 border-2 border-black/20 rounded-sm" />
          <div className="absolute bottom-4 right-8 w-5 h-5 border border-black/20 rounded-full" />
          <div className="relative z-10 text-center">
            <div className="font-black text-2xl text-black font-rajdhani">RPM<span className="opacity-70">TRUCK</span></div>
            <div className="text-xs text-black/60 uppercase tracking-[0.3em] mt-1 font-mono">LOGISTICS</div>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-10">
          <div className="w-full max-w-sm">{formContent}</div>
        </div>
      </div>
    )
  }

  // ─── RENDERIZADOR COMPLETO DESKTOP (SPLIT SCREEN) ───────────────────────────
  return (
    <div className="min-h-screen flex transition-colors duration-300 overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      
      {/* PAINEL ESQUERDO: CANVAS 3D DO CAMINHÃO VOLVO */}
      <motion.div 
        initial={{ x: -60, opacity: 0 }} 
        animate={{ x: 0, opacity: 1 }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="relative hidden md:flex flex-col w-[52%] overflow-hidden" 
        style={{ backgroundColor: isLight ? '#f0f0f0' : '#080808' }}
      >
        <div className="absolute inset-0">
          <TruckPanel primary={primary} isLight={isLight} />
        </div>
        <div className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, transparent, ${isLight ? '#ffffff' : '#0f0f0f'})` }} />
        
        <div className="relative z-20 flex flex-col justify-between h-full p-10">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link href="/" className="inline-flex items-center gap-2 group">
              <div className="font-black text-2xl font-rajdhani" style={{ color: 'var(--foreground)' }}>RPM<span style={{ color: primary }}>TRUCK</span></div>
              <span className="text-xs uppercase tracking-widest opacity-50 font-mono" style={{ color: 'var(--foreground)' }}>LOGISTICS</span>
            </Link>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }} className="mb-16">
            <div className="text-xs uppercase tracking-[0.3em] font-bold mb-3 style-mono" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>Sistema de Recuperação</div>
            <h1 className="text-5xl font-black leading-none mb-4 font-rajdhani" style={{ color: 'var(--foreground)' }}>CRIPTOGRAFIA<br />&amp; <span style={{ color: primary }}>BLINDAGEM</span><br />DE IDENTIDADE</h1>
            <p className="text-sm max-w-xs font-sans text-foreground-muted">Insira seu e-mail corporativo autenticado para restabelecer os protocolos de segurança do seu terminal.</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-8 h-0.5" style={{ backgroundColor: primary }} />
              <div className="w-2 h-0.5" style={{ backgroundColor: primary, opacity: 0.5 }} />
              <div className="w-1 h-0.5" style={{ backgroundColor: primary, opacity: 0.25 }} />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* PAINEL DIREITO: GRID GEOMÉTRICO E FORMULÁRIO */}
      <motion.div 
        initial={{ x: 60, opacity: 0 }} 
        animate={{ x: 0, opacity: 1 }} 
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
        className="flex-1 flex items-center justify-center px-8 py-12 relative" 
        style={{ backgroundColor: isLight ? '#ffffff' : '#0f0f0f' }}
      >
        {/* Malha geométrica com opacidade reduzida */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: `linear-gradient(${primary} 1px, transparent 1px), linear-gradient(90deg, ${primary} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${primary}10 0%, transparent 60%)` }} />
        
        <div className="relative z-10 w-full max-w-sm">
          {formContent}
        </div>
      </motion.div>

    </div>
  )
}
