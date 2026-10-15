'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { AdminMfaQrCode, type AdminMfaChallenge } from '@/app/auth/login/_componentes/AdminMfaForm'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { AuthenticatorRecommendations } from '@/components/security/AuthenticatorRecommendations'

export default function CompanyMfaSettings({ primary }: { primary: string }) {
  const router = useRouter()
  const [ativo, setAtivo] = useState(false)
  const [challenge, setChallenge] = useState<AdminMfaChallenge | null>(null)
  const [codigo, setCodigo] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ mensagem: string; tom: 'success' | 'error' } | null>(null)
  const [codigos, setCodigos] = useState<string[]>([])

  useEffect(() => { void fetch('/api/empresa/mfa', { cache: 'no-store' }).then(async response => { if (response.ok) setAtivo(Boolean((await response.json()).ativo)) }) }, [])

  async function iniciar() {
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch('/api/empresa/mfa', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro)
      setChallenge(data)
    } catch (error) { setFeedback({ mensagem: error instanceof Error ? error.message : 'Não foi possível iniciar a configuração.', tom: 'error' }) }
    finally { setBusy(false) }
  }

  async function confirmar() {
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch('/api/auth/mfa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro)
      setAtivo(true); setChallenge(null); setCodigo(''); setCodigos(data.codigosRecuperacao || [])
      setFeedback({ mensagem: 'Segundo fator ativado. Guarde os códigos de recuperação abaixo.', tom: 'success' })
    } catch (error) { setFeedback({ mensagem: error instanceof Error ? error.message : 'Não foi possível confirmar o código.', tom: 'error' }) }
    finally { setBusy(false) }
  }

  async function desativar() {
    setBusy(true); setFeedback(null)
    try {
      const response = await fetch('/api/empresa/mfa', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro)
      router.replace('/auth/login')
    } catch (error) { setFeedback({ mensagem: error instanceof Error ? error.message : 'Não foi possível desativar o segundo fator.', tom: 'error' }) }
    finally { setBusy(false) }
  }

  return <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
    <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><ShieldCheck size={16} style={{ color: primary }} /> Proteção em duas etapas</h2>
    <p className="mt-2 text-xs leading-relaxed text-foreground-muted">Use um aplicativo autenticador. Dispositivos verificados permanecem confiáveis por até 7 dias ou 10 acessos e todo mundo entra novamente à meia-noite de Brasília.</p>
    {!ativo && <AuthenticatorRecommendations className="mt-4" />}
    {feedback && <ActionFeedback message={feedback.mensagem} tone={feedback.tom} className="mt-4 text-xs" />}
    {codigos.length > 0 && <div className="mt-4 border p-4" style={{ borderColor: primary }}><strong className="text-xs uppercase">Códigos de recuperação</strong><div className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">{codigos.map(item => <span key={item}>{item}</span>)}</div><p className="mt-3 text-xs text-foreground-muted">Cada código funciona uma vez. Salve-os fora do sistema.</p></div>}
    {challenge ? <div className="mt-5 space-y-4">
      <p className="text-sm">No aplicativo escolhido, adicione uma conta, leia o QR Code e informe o código gerado.</p>
      {challenge.otpauth && <AdminMfaQrCode otpauth={challenge.otpauth} />}
      <input value={challenge.segredo || ''} readOnly onFocus={event => event.currentTarget.select()} className="w-full border bg-background p-3 font-mono text-xs" aria-label="Chave manual do autenticador" />
      <div className="flex flex-col gap-3 sm:flex-row"><input value={codigo} onChange={event => setCodigo(event.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="min-h-11 flex-1 border bg-background px-3 font-mono" placeholder="000000" aria-label="Código do autenticador" /><button type="button" disabled={busy || !/^\d{6}$/.test(codigo)} onClick={() => void confirmar()} className="min-h-11 border px-4 text-xs font-bold uppercase disabled:opacity-40" style={{ borderColor: primary, color: primary }}>Confirmar ativação</button></div>
    </div> : ativo ? <div className="mt-5 space-y-3"><p className="text-sm font-bold text-green-500">MFA ativo nesta conta.</p><p className="text-xs text-foreground-muted">Para desativar, confirme um código atual. Todas as sessões e dispositivos confiáveis serão encerrados.</p><div className="flex flex-col gap-3 sm:flex-row"><input value={codigo} onChange={event => setCodigo(event.target.value)} inputMode="numeric" maxLength={6} className="min-h-11 flex-1 border bg-background px-3 font-mono" placeholder="000000" aria-label="Código para desativar MFA" /><button type="button" disabled={busy || !/^\d{6}$/.test(codigo)} onClick={() => void desativar()} className="min-h-11 border border-red-500/50 px-4 text-xs font-bold uppercase text-red-500 disabled:opacity-40">Desativar MFA</button></div></div> : <button type="button" disabled={busy} onClick={() => void iniciar()} className="mt-5 inline-flex min-h-11 items-center gap-2 border px-4 text-xs font-bold uppercase disabled:opacity-40" style={{ borderColor: primary, color: primary }}><KeyRound size={15} /> {busy ? 'Preparando…' : 'Ativar segundo fator'}</button>}
  </section>
}
