'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Key, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import dynamic from 'next/dynamic'
import TurnstileWidget from '@/components/security/TurnstileWidget'

const TruckPanel = dynamic(() => import('@/app/auth/login/_componentes/TruckPanel'), { ssr: false })

export default function RecuperarSenhaPage() {
  const { primary, isLight } = useTheme()
  
  // 0 = Digitar E-mail, 1 = Digitar Token e Nova Senha, 2 = Processando, 3 = Sucesso
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileVersion, setTurnstileVersion] = useState(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Solicita a redefinição de senha (Cria o registro no banco)
  const handleSolicitarReset = async () => {
    if (!email) return
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Conclua a verificação de segurança.')
      return
    }
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: turnstileToken || undefined })
      })

      setTurnstileToken('')
      setTurnstileVersion((value) => value + 1)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.erro || 'Não foi possível abrir a solicitação.')
      }

      // Avança para a etapa onde o usuário aguarda o token enviado pelo administrador
      setStep(1)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Erro de conexão com o servidor.')
    } finally {
      setLoading(false)
    }
  }

  // Valida o token recebido e atualiza a credencial no banco
  const handleValidarEAtualizar = async () => {
    if (!token || !novaSenha) return
    setStep(2) // Tela de carregamento
    setError('')

    try {
      const res = await fetch('/api/auth/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, novaSenha })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.erro || 'Token inválido ou expirado.')
        setStep(1) // Devolve para a tela de digitação em caso de erro
        return
      }

      setStep(3) // Sucesso total
    } catch {
      setError('Erro crítico ao processar redefinição.')
      setStep(1)
    }
  }

  const content = (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] font-bold mb-2" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>RECOVERY SYSTEM</div>
            <h2 className="text-4xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>RECUPERAR ACESSO</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>Informe o seu e-mail cadastrado para solicitar o código de validação corporativa.</p>
          </div>

          {error && <ErrorAlert message={error} />}

          <StyledInput icon={<Mail size={14} />} label="E-mail Corporativo" type="email" placeholder="seu@empresa.com" value={email} onChange={setEmail} primary={primary} onEnter={handleSolicitarReset} autoFocus />
          
          <TurnstileWidget key={turnstileVersion} action="password_reset" onTokenChange={setTurnstileToken} />
          <SubmitBtn onClick={handleSolicitarReset} disabled={!email || loading} loading={loading} primary={primary} label="SOLICITAR CÓDIGO →" />
        </motion.div>
      )}

      {step === 1 && (
        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] font-bold mb-2" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>SOLICITAÇÃO REGISTRADA</div>
            <h2 className="text-4xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>VALIDAR TOKENS</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>Use o código de uso único liberado pelo administrador. Por segurança, ele expira em 30 minutos.</p>
          </div>

          {error && <ErrorAlert message={error} />}

          <div className="px-4 py-3 text-sm flex items-center gap-3 border cursor-default" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)', color: 'var(--foreground-muted)' }}>
            <Mail size={14} style={{ color: primary }} />
            <span style={{ fontFamily: 'Outfit, sans-serif' }}>{email}</span>
            <button onClick={() => setStep(0)} className="ml-auto text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>alterar</button>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: primary }}><Key size={14} /></span> Código de uso único
            </label>
            <input type="text" maxLength={64} placeholder="RPM-..." value={token} onChange={e => setToken(e.target.value.trim())} autoComplete="one-time-code" autoFocus className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border text-center font-mono tracking-wider font-bold" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: primary }}><Lock size={14} /></span> Nova Senha Definitiva
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border pr-12 font-mono" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} onKeyDown={e => e.key === 'Enter' && handleValidarEAtualizar()} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60" style={{ color: 'var(--foreground-muted)' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--foreground-muted)' }}>Use ao menos 10 caracteres, com letra maiúscula, minúscula e número.</p>
          </div>

          <SubmitBtn onClick={handleValidarEAtualizar} disabled={token.length < 20 || novaSenha.length < 10} loading={false} primary={primary} label="ATUALIZAR CREDENCIAIS →" />
        </motion.div>
      )}

      {step === 2 && (
        <motion.div key="step2" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="py-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center border-2" style={{ borderColor: primary, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 8px))' }}>
            <span className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${primary}30`, borderTopColor: primary }} />
          </div>
          <div className="text-center">
            <div className="font-bold text-sm uppercase tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif' }}>Sincronizando Segurança</div>
            <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Validando códigos criptográficos...</div>
          </div>
        </motion.div>
      )}

      {step === 3 && (
        <motion.div key="step3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4 space-y-6">
          <div className="w-16 h-16 flex items-center justify-center mx-auto border-2" style={{ borderColor: primary, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
            <CheckCircle size={26} style={{ color: primary }} />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase" style={{ fontFamily: 'Rajdhani, sans-serif' }}>SENHA REDEFINIDA!</h3>
            <p className="text-xs max-w-xs mx-auto mt-2" style={{ color: 'var(--foreground-muted)' }}>Sua credencial de segurança corporativa foi atualizada com sucesso no banco de dados.</p>
          </div>
          <Link href="/auth/login" className="w-full py-4 font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-200" style={{ fontFamily: 'Rajdhani, sans-serif', backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
            RETORNAR AO LOGIN →
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="relative h-36 flex flex-col items-center justify-center overflow-hidden" style={{ backgroundColor: primary }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '12px 12px' }} />
          <div className="relative z-10 text-center">
            <div className="font-black text-2xl text-black" style={{ fontFamily: 'Rajdhani, sans-serif' }}>RPM<span className="opacity-70">TRUCK</span></div>
            <div className="text-xs text-black/60 uppercase tracking-[0.3em] mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>SECURITY SYSTEM</div>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center px-6 pt-10 pb-10">
          <div className="w-full max-w-sm">{content}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex transition-colors duration-300 overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      {/* LADO ESQUERDO: CANVAS 3D MODELO */}
      <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative hidden md:flex flex-col w-[52%] overflow-hidden" style={{ backgroundColor: isLight ? '#f0f0f0' : '#080808' }}>
        <div className="absolute inset-0">
          <TruckPanel primary={primary} isLight={isLight} />
        </div>
        <div className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, transparent, ${isLight ? '#ffffff' : '#0f0f0f'})` }} />
        <div className="relative z-20 flex flex-col justify-between h-full p-10">
          <Link href="/login" className="inline-flex items-center gap-2 group">
            <div className="font-black text-2xl" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>RPM<span style={{ color: primary }}>TRUCK</span></div>
            <span className="text-xs uppercase tracking-widest opacity-50" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--foreground)' }}>LOGISTICS</span>
          </Link>
          <div className="mb-16">
            <div className="text-xs uppercase tracking-[0.3em] font-bold mb-3" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>Módulo de Segurança</div>
            <h1 className="text-5xl font-black leading-none mb-4" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>PROTEÇÃO<br />&amp; <span style={{ color: primary }}>SEGURANÇA</span><br />DE DADOS</h1>
            <p className="text-sm max-w-xs" style={{ color: 'var(--foreground-muted)', fontFamily: 'Outfit, sans-serif' }}>Redefina sua credencial corporativa através de validação manual direta por token descartável.</p>
          </div>
        </div>
      </motion.div>

      {/* LADO DIREITO: FORMULÁRIO DINÂMICO */}
      <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="flex-1 flex items-center justify-center px-8 py-12 relative" style={{ backgroundColor: isLight ? '#ffffff' : '#0f0f0f' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: `linear-gradient(${primary} 1px, transparent 1px), linear-gradient(90deg, ${primary} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <div className="relative z-10 w-full max-w-sm">
          <div className="absolute -top-8 left-0">
            <Link href="/login" className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold transition-opacity hover:opacity-60" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}><ArrowLeft size={12} /> Voltar ao Login</Link>
          </div>
          {content}
        </div>
      </motion.div>
    </div>
  )
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="p-3 border text-xs flex items-center gap-2 font-mono" style={{ borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
      <AlertTriangle size={14} />
      {message}
    </div>
  )
}

function StyledInput({ icon, label, type = 'text', placeholder, value, onChange, primary, onEnter, autoFocus }: { icon: React.ReactNode; label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void; primary: string; onEnter?: () => void; autoFocus?: boolean }) { 
  return (
    <div> 
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}> <span style={{ color: primary }}>{icon}</span> {label} </label> 
      <input type={type} placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onEnter?.()} className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)', fontFamily: 'Outfit, sans-serif' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} /> 
    </div> 
  ) 
}

function SubmitBtn({ onClick, disabled, loading, primary, label }: { onClick: () => void; disabled: boolean; loading: boolean; primary: string; label: string }) { 
  return (
    <motion.button onClick={onClick} disabled={disabled || loading} whileHover={{ scale: disabled ? 1 : 1.01 }} whileTap={{ scale: disabled ? 1 : 0.99 }} className="w-full py-4 font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontFamily: 'Rajdhani, sans-serif', backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}> 
      {loading ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : label} 
    </motion.button> 
  ) 
}
