'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export interface ResumoPagamento {
  vencimento: string | null
  bloqueioEm: string | null
  valorPendente: number
  primeiraMensalidadePaga: boolean
  situacao: string
  bloqueado: boolean
  emCarencia: boolean
  recorrenciaAtiva: boolean
  servidorAgora: string
}

const JANELA_AVISO_VENCIMENTO_MS = 2 * 24 * 60 * 60 * 1000

export default function PaymentAccessCountdown({ pagamento, mostrarLinkGestao = true }: { pagamento: ResumoPagamento; mostrarLinkGestao?: boolean }) {
  const [restante, setRestante] = useState<number | null>(null)
  useEffect(() => {
    const alvo = pagamento.emCarencia ? pagamento.bloqueioEm : pagamento.vencimento
    if (!alvo) return
    const prazo = new Date(alvo).getTime()
    const inicioServidor = new Date(pagamento.servidorAgora).getTime()
    const inicioLocal = performance.now()
    const atualizar = () => setRestante(Math.max(0, prazo - inicioServidor - (performance.now() - inicioLocal)))
    atualizar()
    const intervalo = window.setInterval(atualizar, 1000)
    return () => window.clearInterval(intervalo)
  }, [pagamento.bloqueioEm, pagamento.emCarencia, pagamento.servidorAgora, pagamento.vencimento])

  if (pagamento.situacao === 'PREVIEW' || pagamento.valorPendente <= 0) return null
  const segundos = Math.ceil((restante ?? 0) / 1000)
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor(segundos % 86400 / 3600)
  const minutos = Math.floor(segundos % 3600 / 60)
  const bloqueado = pagamento.bloqueado
  const vencimento = pagamento.vencimento ? new Date(pagamento.vencimento) : null
  const agoraServidor = new Date(pagamento.servidorAgora).getTime()
  const tempoAteVencimento = vencimento ? vencimento.getTime() - agoraServidor : null
  const exigeRegularizacao = bloqueado || pagamento.emCarencia || (tempoAteVencimento !== null && tempoAteVencimento <= 0)
  const mostrarAvisoProximo = tempoAteVencimento !== null
    && tempoAteVencimento > 0
    && tempoAteVencimento <= JANELA_AVISO_VENCIMENTO_MS
  if (pagamento.primeiraMensalidadePaga && !exigeRegularizacao) {
    if (pagamento.recorrenciaAtiva || !mostrarAvisoProximo) return null
  }
  return (
    <section aria-label="Prazo de pagamento do plano" className={`flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between ${bloqueado ? 'border-red-500/50' : 'border-amber-500/50'}`} style={{ backgroundColor: 'var(--background-secondary)' }}>
      <div>
        <h2 className="text-sm font-bold">{bloqueado ? 'Regularize o plano para recuperar o acesso operacional' : pagamento.emCarencia ? 'Pagamento vencido: período de regularização' : pagamento.recorrenciaAtiva ? 'Próximo pagamento automático' : 'Fatura próxima do vencimento'}</h2>
        <p className="mt-1 text-xs text-foreground-muted">{pagamento.valorPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em mensalidade e/ou implantação. Não são despesas da frota.</p>
        <p className="mt-2 text-sm font-bold tabular-nums" role="timer" aria-live="off">
          {bloqueado ? 'Prazo encerrado — regularização obrigatória' : !pagamento.vencimento ? 'Consulte as condições de pagamento' : restante === null ? 'Calculando prazo…' : pagamento.emCarencia ? `Regularize em até ${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min ${String(segundos % 60).padStart(2, '0')}s` : `Vencimento em ${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min`}
        </p>
        {pagamento.vencimento && <p className="mt-1 text-xs text-foreground-muted">Vencimento em {new Date(pagamento.vencimento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}. Se não houver pagamento, o acesso operacional será bloqueado após 3 dias de carência.</p>}
      </div>
      {mostrarLinkGestao && <Link href="/dashboard/plano" className="flex min-h-11 shrink-0 items-center justify-center border px-4 text-xs font-bold" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>Gerenciar plano e pendências →</Link>}
    </section>
  )
}
