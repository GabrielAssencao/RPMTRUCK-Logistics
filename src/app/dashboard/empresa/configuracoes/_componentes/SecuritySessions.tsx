'use client'

import { useCallback, useEffect, useState } from 'react'
import { Laptop, LogOut, MonitorSmartphone, Smartphone } from 'lucide-react'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { DominoLoader } from '@/components/motion/OperationalFeedback'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'

interface UserSession {
  id: string
  userAgent: string | null
  criadoEm: string
  ultimaAtividade: string
  expiraEm: string
  atual: boolean
}

function describeDevice(userAgent: string | null) {
  const agent = userAgent || ''
  const mobile = /Android|iPhone|iPad/i.test(agent)
  const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : 'Navegador'
  const system = /Windows/i.test(agent) ? 'Windows' : /Android/i.test(agent) ? 'Android' : /iPhone|iPad/i.test(agent) ? 'iOS' : /Mac OS/i.test(agent) ? 'macOS' : /Linux/i.test(agent) ? 'Linux' : 'Sistema não identificado'
  return { label: `${browser} em ${system}`, mobile }
}

export default function SecuritySessions({ primary }: { primary: string }) {
  const [sessions, setSessions] = useState<UserSession[]>([])
  const [loading, setLoading] = useState(true)
  const [revokingId, setRevokingId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error'>('success')
  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/sessions', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar as sessões.')
      setSessions(Array.isArray(data.sessions) ? data.sessions : [])
    } catch (error) {
      setFeedbackTone('error')
      setFeedback(error instanceof Error ? error.message : 'Não foi possível carregar as sessões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void loadSessions())
  }, [loadSessions])

  const revokeSession = async (session: UserSession) => {
    if (session.atual || revokingId) return

    setRevokingId(session.id)
    setFeedback('')
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível encerrar a sessão.')
      setSessions((current) => current.filter((item) => item.id !== session.id))
      setSessionToRevoke(null)
      setFeedbackTone('success')
      setFeedback('Sessão encerrada com sucesso.')
    } catch (error) {
      setFeedbackTone('error')
      setFeedback(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
    } finally {
      setRevokingId('')
    }
  }

  return (
    <section className="border p-5 sm:p-6" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <div className="mb-5 flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-start" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><MonitorSmartphone size={16} style={{ color: primary }} /> Sessões ativas</h2>
          <p className="mt-1 text-[10px] text-foreground-muted">Revise os dispositivos conectados à sua conta e encerre acessos desconhecidos.</p>
        </div>
        <button type="button" onClick={() => void loadSessions()} disabled={loading} className="min-h-10 border px-3 text-[9px] font-bold uppercase tracking-wider disabled:opacity-50" style={{ borderColor: 'var(--border)', color: primary }}>Atualizar</button>
      </div>

      {feedback && <ActionFeedback message={feedback} tone={feedbackTone} className="mb-4 text-xs" />}

      {loading ? <DominoLoader label="Carregando sessões ativas" /> : sessions.length === 0 ? (
        <p className="border p-4 text-xs text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Nenhuma sessão ativa foi encontrada.</p>
      ) : (
        <div className="divide-y border" style={{ borderColor: 'var(--border)' }}>
          {sessions.map((session) => {
            const device = describeDevice(session.userAgent)
            const DeviceIcon = device.mobile ? Smartphone : Laptop
            return (
              <article key={session.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border)' }}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border" style={{ borderColor: session.atual ? primary : 'var(--border)', color: session.atual ? primary : 'var(--foreground-muted)' }}><DeviceIcon size={16} /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-xs">{device.label}</strong>
                      {session.atual && <span className="border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider" style={{ borderColor: `${primary}66`, color: primary }}>Sessão atual</span>}
                    </div>
                    <p className="mt-1 text-[9px] text-foreground-muted">Última atividade: {new Date(session.ultimaAtividade).toLocaleString('pt-BR')}</p>
                    <p className="text-[9px] text-foreground-muted">Expira em: {new Date(session.expiraEm).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                {!session.atual && (
                  <button type="button" onClick={() => setSessionToRevoke(session)} disabled={Boolean(revokingId)} className="interactive-control flex min-h-10 items-center justify-center gap-2 border border-red-500/40 px-3 text-[9px] font-bold uppercase tracking-wider text-red-500 disabled:opacity-50">
                    <LogOut size={13} /> {revokingId === session.id ? 'Encerrando…' : 'Encerrar sessão'}
                  </button>
                )}
              </article>
            )
          })}
        </div>
      )}
      <ActionConfirmDialog
        open={Boolean(sessionToRevoke)}
        title="Encerrar sessão em outro dispositivo"
        description={`${sessionToRevoke ? describeDevice(sessionToRevoke.userAgent).label : 'Este dispositivo'} perderá o acesso imediatamente e precisará entrar novamente.`}
        confirmLabel="Encerrar sessão"
        cancelLabel="Manter conectada"
        eyebrow="Segurança da conta"
        loading={Boolean(revokingId)}
        onClose={() => { if (!revokingId) setSessionToRevoke(null) }}
        onConfirm={() => { if (sessionToRevoke) void revokeSession(sessionToRevoke) }}
      />
    </section>
  )
}
