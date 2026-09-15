'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Key, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { BrandLogo } from '@/components/brand/BrandLogo'
import LoginVisual from './_componentes/LoginVisual'
import LoginEntry from './_componentes/LoginEntry'
import { getExperience3DReady, getServerExperience3DReady, subscribeExperience3D } from '@/lib/experience3d'
import TurnstileWidget from '@/components/security/TurnstileWidget'

export default function LoginPage() {
  return <MotionConfig reducedMotion="user"><LoginContent /></MotionConfig>
}

function LoginContent() {
  const router = useRouter()
  const experience3DReady = useSyncExternalStore(subscribeExperience3D, getExperience3DReady, getServerExperience3DReady)
  const { primary, isLight } = useTheme()
  const [step, setStep] = useState(0) 
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [newPassword, setNewPassword] = useState('') 
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('') 
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileVersion, setTurnstileVersion] = useState(0)
  const [destination, setDestination] = useState<string | null>(null)
  const [authenticatedRole, setAuthenticatedRole] = useState<string>()
  const authenticating = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleNextStep = async () => {
    if (authenticating.current || destination) return
    setError('')

    if (step === 0) {
      if (!email) return
      setStep(1)
    } else if (step === 1 || step === 3) {
      if (!senha) return
      if (step === 3) {
        if (!newPassword || newPassword !== confirmPassword) {
          setError('A confirmação deve ser igual à nova senha.')
          return
        }
        if (newPassword.length < 12) {
          setError('Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.')
          return
        }
      }
      if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !turnstileToken) {
        setError('Conclua a verificação de segurança.')
        return
      }
      const etapaOrigem = step
      authenticating.current = true
      if (etapaOrigem === 1) setStep(2)
      else setLoading(true)

      try {
        // ROTA CORRIGIDA PARA O CAMINHO DO BACKEND
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            senha,
            novaSenha: etapaOrigem === 3 ? newPassword : undefined,
            turnstileToken: turnstileToken || undefined,
          })
        })

        const data = await res.json()
        setTurnstileToken('')
        setTurnstileVersion((value) => value + 1)

        if (data.trocaSenhaObrigatoria) {
          setStep(3)
          return
        }

        if (!res.ok) {
          setError(data.erro || 'Falha na autenticação.')
          setStep(etapaOrigem)
          return
        }

        setAuthenticatedRole(data.usuario.role)
        // Lógica de redirecionamento pós-login
        try {
          localStorage.setItem('@rpmtruck:user', JSON.stringify(data.usuario))
        } catch {
          // Authentication uses the session cookie; local storage only supplies display data.
        }
        
        if (data.usuario.role === 'ADMIN_RPM' || data.usuario.role === 'ADMIN') {
          setDestination('/dashboard/admin')
        } else if (data.acessoSomentePlano) {
          setDestination('/dashboard/plano')
        } else {
          setDestination('/dashboard/empresa')
        }
      } catch {
        setError('Erro de conexão com o servidor.')
        setStep(step === 3 ? 3 : 1)
      } finally {
        authenticating.current = false
        setLoading(false)
      }
    }
  }

  const resetLogin = () => {
    setStep(0)
    setEmail('')
    setSenha('')
    setNewPassword('')
    setConfirmPassword('')
    setLoading(false)
    setError('')
  }

  if (destination) return <LoginEntry role={authenticatedRole} onEntered={() => router.replace(destination)} />

  // ─── Conteúdo do painel direito ───────────────────────────────────────────────
  const panelContent = (
    <LoginForm
      step={step}
      email={email} setEmail={setEmail}
      senha={senha} setSenha={setSenha}
      newPassword={newPassword} setNewPassword={setNewPassword}
      confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
      showPass={showPass} setShowPass={setShowPass}
      loading={loading}
      error={error} // Passando o erro para o form
      onNext={handleNextStep}
      onBack={() => { 
        setError('')
        if (step > 0) setStep(s => s === 3 ? 1 : s - 1) 
      }}
      onForgot={() => router.push('/auth/recuperar-senha')}
      onReset={resetLogin}
      primary={primary}
      turnstileVersion={turnstileVersion}
      onTurnstileToken={setTurnstileToken}
    />
  )

  // ─── LAYOUT MOBILE ─────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col transition-colors duration-300" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
        <header className="relative flex items-center justify-between px-6 py-6 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <Link href="/" aria-label="RPMTruck — início" className="flex items-center gap-3">
            <BrandLogo variant="wordmark" className="h-14 w-32" primary={primary} />

          </Link>
          <Link href="/" className="text-xs flex items-center gap-2" style={{ color: 'var(--foreground-muted)' }}><ArrowLeft size={14} />Início</Link>
        </header>
        <div className="flex-1 flex items-start justify-center px-6 pt-10 pb-10">
          <div className="w-full max-w-sm">{panelContent}</div>
        </div>
      </div>
    )
  }

  // ─── LAYOUT DESKTOP: split screen ──────────────────────────────────────────────
  return (
    <div className="min-h-screen flex transition-colors duration-300 overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
      <motion.div initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative hidden md:flex flex-col w-[52%] overflow-hidden" style={{ backgroundColor: isLight ? '#f0f0f0' : '#080808' }}>
        <div className="absolute inset-0">
          <LoginVisual enabled={experience3DReady} primary={primary} isLight={isLight} />
        </div>
        <div className="absolute inset-y-0 right-0 w-32 z-10 pointer-events-none" style={{ background: `linear-gradient(to right, transparent, ${isLight ? '#ffffff' : '#0f0f0f'})` }} />
        <div className="relative z-20 flex flex-col justify-between min-h-screen w-full p-10 pointer-events-none">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link href="/" aria-label="RPMTruck — início" className="inline-flex items-center gap-3 group pointer-events-auto">
              <BrandLogo variant="wordmark" className="h-16 w-36" primary={primary} />

            </Link>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }} className="mb-16">
            <div className="text-xs uppercase tracking-[0.3em] font-bold mb-3" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>Bem-vindo de volta</div>
            <h1 className="text-5xl font-black leading-none mb-4" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>O PULSO<br /><span style={{ color: primary }}>DA SUA FROTA.</span><br />NAS SUAS MÃOS.</h1>
            <p className="text-sm max-w-xs" style={{ color: 'var(--foreground-muted)', fontFamily: 'Outfit, sans-serif' }}>Acompanhe os sinais de cada caminhão, confira os custos e dê ritmo ao próximo passo da operação.</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="w-8 h-0.5" style={{ backgroundColor: primary }} />
              <div className="w-2 h-0.5" style={{ backgroundColor: primary, opacity: 0.5 }} />
              <div className="w-1 h-0.5" style={{ backgroundColor: primary, opacity: 0.25 }} />
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className="flex-1 flex items-center justify-center px-8 py-12 relative" style={{ backgroundColor: isLight ? '#ffffff' : '#0f0f0f' }}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{ backgroundImage: `linear-gradient(${primary} 1px, transparent 1px), linear-gradient(90deg, ${primary} 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${primary}10 0%, transparent 60%)` }} />
        <div className="relative z-10 w-full max-w-sm">
          <div className="absolute -top-8 left-0 md:hidden">
            <Link href="/" className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold transition-opacity hover:opacity-60" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}><ArrowLeft size={12} /> Início</Link>
          </div>
          {panelContent}
          {step !== 3 && (
            <p className="text-center text-xs mt-8" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              Ainda não tem acesso? <Link href="/auth/solicitar-acesso" className="font-bold transition-opacity hover:opacity-70" style={{ color: primary }}>Solicite aqui →</Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMULÁRIO DE LOGIN (multi-step)
// ═══════════════════════════════════════════════════════════════════════════════
function LoginForm({
  step, email, setEmail, senha, setSenha, newPassword, setNewPassword, confirmPassword, setConfirmPassword, showPass, setShowPass,
  loading, error, onNext, onBack, onForgot, onReset, primary,
  turnstileVersion, onTurnstileToken,
}: {
  step: number
  email: string; setEmail: (v: string) => void
  senha: string; setSenha: (v: string) => void
  newPassword: string; setNewPassword: (v: string) => void
  confirmPassword: string; setConfirmPassword: (v: string) => void
  showPass: boolean; setShowPass: (v: boolean) => void
  loading: boolean
  error: string
  onNext: () => void
  onBack: () => void
  onForgot: () => void
  onReset: () => void
  primary: string
  turnstileVersion: number
  onTurnstileToken: (token: string) => void
}) {
  const VISUAL_STEPS = step === 3 ? ['Identificação', 'Segurança', 'Acesso'] : ['E-mail', 'Senha', 'Acesso']
  const visualStepIndex = step === 3 ? 1 : step === 2 ? 2 : step

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.25em] font-bold mb-2" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>
          {step === 3 ? 'AÇÃO NECESSÁRIA' : 'ACESSAR PAINEL'}
        </div>
        <h2 className="text-4xl font-black" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>
          {step === 0 && 'BEM-VINDO'}
          {step === 1 && 'SUA SENHA'}
          {step === 2 && 'VERIFICANDO...'}
          {step === 3 && 'NOVA SENHA'}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
          {step === 0 && 'Informe seu e-mail corporativo para continuar.'}
          {step === 1 && `Olá! Digite sua senha para acessar.`}
          {step === 2 && 'Autenticando suas credenciais...'}
          {step === 3 && 'Sua conta exige a definição de uma senha definitiva.'}
        </p>
      </div>

      {step !== 2 && (
        <div className="flex items-center gap-2 mb-8">
          {VISUAL_STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 text-[10px] font-black transition-all duration-300"
                style={{ backgroundColor: i <= visualStepIndex ? primary : 'var(--border)', color: i <= visualStepIndex ? '#000' : 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
                {i < visualStepIndex ? '✓' : i + 1}
              </div>
              <span className="text-[10px] uppercase tracking-widest transition-colors" style={{ color: i === visualStepIndex ? primary : 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{s}</span>
              {i < VISUAL_STEPS.length - 1 && <div className="w-6 h-px mx-1 transition-colors" style={{ backgroundColor: i < visualStepIndex ? primary : 'var(--border)' }} />}
            </div>
          ))}
        </div>
      )}

      {/* NOVO: Exibição de Erro */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} 
            className="mb-4 p-3 border text-xs flex items-center gap-2" 
            style={{ borderColor: 'rgba(239, 68, 68, 0.5)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
            <AlertTriangle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="email-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
            <StyledInput icon={<Mail size={14} />} label="E-mail" type="email" placeholder="seu@empresa.com" value={email} onChange={setEmail} primary={primary} onEnter={onNext} autoFocus />
            <SubmitBtn onClick={onNext} disabled={!email} loading={false} primary={primary} label="CONTINUAR →" />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="senha-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="px-4 py-3 text-sm flex items-center gap-3 border cursor-default" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)', color: 'var(--foreground-muted)' }}>
              <Mail size={14} style={{ color: primary }} />
              <span style={{ fontFamily: 'Outfit, sans-serif' }}>{email}</span>
              <button onClick={onBack} className="ml-auto text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>alterar</button>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ color: primary }}><Lock size={14} /></span> Senha
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={senha} onChange={e => setSenha(e.target.value)} autoFocus className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border pr-12" style={{ backgroundColor: 'var(--background-secondary)', borderColor: error ? '#ef4444' : 'var(--border)', color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = error ? '#ef4444' : 'var(--border)'} onKeyDown={e => e.key === 'Enter' && onNext()} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60" style={{ color: 'var(--foreground-muted)' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={onForgot} className="text-[11px] transition-opacity hover:opacity-70" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace' }}>Esqueci minha senha →</button>
            </div>
            <TurnstileWidget key={turnstileVersion} action="login" onTokenChange={onTurnstileToken} />
            <SubmitBtn onClick={onNext} disabled={!senha} loading={false} primary={primary} label="ENTRAR →" />
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="loading-step" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="py-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 flex items-center justify-center border-2" style={{ borderColor: primary, clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
              <span className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: `${primary}30`, borderTopColor: primary }} />
            </div>
            <div className="text-center">
              <div className="font-bold text-sm uppercase tracking-widest" style={{ fontFamily: 'Rajdhani, sans-serif', color: 'var(--foreground)' }}>Verificando credenciais</div>
              <div className="text-xs mt-1" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{email}</div>
            </div>
            <button onClick={onReset} className="text-[10px] uppercase tracking-widest transition-opacity hover:opacity-60" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>cancelar</button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="new-password-step" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-4">
            <div className="p-4 border text-xs" style={{ borderColor: `${primary}40`, backgroundColor: `${primary}10`, color: 'var(--foreground-muted)', fontFamily: 'Outfit, sans-serif' }}>
              <span className="font-bold uppercase tracking-widest block mb-1 flex items-center gap-1.5" style={{ color: primary, fontFamily: 'JetBrains Mono, monospace', fontSize: '10px' }}><ShieldCheck size={14} /> Atualização Obrigatória</span>
              Este é o seu primeiro acesso ou um reset foi liberado. Substitua a credencial provisória por uma senha forte e definitiva.
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                <span style={{ color: primary }}><Key size={14} /></span> Nova Senha Definitiva
              </label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border pr-12" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} onKeyDown={e => e.key === 'Enter' && onNext()} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60" style={{ color: 'var(--foreground-muted)' }}>{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>
              Use 12 ou mais caracteres, incluindo maiúscula, minúscula, número e símbolo.
            </p>
            <StyledInput icon={<ShieldCheck size={14} />} label="Confirmar nova senha" type={showPass ? 'text' : 'password'} placeholder="••••••••••••" value={confirmPassword} onChange={setConfirmPassword} primary={primary} onEnter={onNext} />
            <TurnstileWidget key={turnstileVersion} action="login" onTokenChange={onTurnstileToken} />
            <SubmitBtn onClick={onNext} disabled={!newPassword || !confirmPassword} loading={loading} primary={primary} label="SALVAR E ACESSAR →" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StyledInput({ icon, label, type = 'text', placeholder, value, onChange, primary, onEnter, autoFocus }: { icon: React.ReactNode; label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void; primary: string; onEnter?: () => void; autoFocus?: boolean }) { return ( <label className="block"> <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--foreground-muted)', fontFamily: 'JetBrains Mono, monospace' }}> <span style={{ color: primary }}>{icon}</span> {label} </span> <input type={type} placeholder={placeholder} value={value} autoFocus={autoFocus} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onEnter?.()} className="w-full px-4 py-3 text-sm outline-none transition-all duration-200 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border)', color: 'var(--foreground)', fontFamily: 'Outfit, sans-serif' }} onFocus={e => e.target.style.borderColor = primary} onBlur={e => e.target.style.borderColor = 'var(--border)'} /> </label> ) }

function SubmitBtn({ onClick, disabled, loading, primary, label }: { onClick: () => void; disabled: boolean; loading: boolean; primary: string; label: string }) { return ( <motion.button onClick={onClick} disabled={disabled || loading} whileHover={{ scale: disabled ? 1 : 1.01 }} whileTap={{ scale: disabled ? 1 : 0.99 }} className="w-full py-4 font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed" style={{ fontFamily: 'Rajdhani, sans-serif', backgroundColor: primary, color: '#000', clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}> {loading ? <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : label} </motion.button> ) }
