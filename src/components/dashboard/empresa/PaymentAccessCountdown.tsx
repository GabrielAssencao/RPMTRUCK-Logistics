'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export interface ResumoPagamento {
  vencimento: string | null
  valorPendente: number
  situacao: string
  bloqueado: boolean
  servidorAgora: string
}

export default function PaymentAccessCountdown({ pagamento }: { pagamento: ResumoPagamento }) {
  const [restante, setRestante] = useState<number | null>(null)
  useEffect(() => {
    if (!pagamento.vencimento) return
    const prazo = new Date(pagamento.vencimento).getTime()
    const inicioServidor = new Date(pagamento.servidorAgora).getTime()
    const inicioLocal = performance.now()
    const atualizar = () => setRestante(Math.max(0, prazo - inicioServidor - (performance.now() - inicioLocal)))
    atualizar()
    const intervalo = window.setInterval(atualizar, 1000)
    return () => window.clearInterval(intervalo)
  }, [pagamento.vencimento, pagamento.servidorAgora])

  if (pagamento.situacao === 'PREVIEW' || pagamento.valorPendente <= 0) return null
  const segundos = Math.ceil((restante ?? 0) / 1000)
  const dias = Math.floor(segundos / 86400)
  const horas = Math.floor(segundos % 86400 / 3600)
  const minutos = Math.floor(segundos % 3600 / 60)
  const bloqueado = pagamento.bloqueado || (restante === 0 && pagamento.vencimento !== null)
  return (
    <section aria-label="Prazo de pagamento do plano" className={`flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between ${bloqueado ? 'border-red-500/50' : 'border-amber-500/50'}`} style={{ backgroundColor: 'var(--background-secondary)' }}>
      <div>
        <h2 className="text-sm font-bold">{bloqueado ? 'Regularize o plano para recuperar o acesso operacional' : 'Pagamento do plano pendente'}</h2>
        <p className="mt-1 text-xs text-foreground-muted">{pagamento.valorPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em mensalidade e/ou implantação. Não são despesas da frota.</p>
        <p className="mt-2 text-sm font-bold tabular-nums" role="timer" aria-live="off">
          {bloqueado ? 'Prazo encerrado' : !pagamento.vencimento ? 'Consulte as condições de pagamento' : restante === null ? 'Calculando prazo…' : `Acesso disponível por ${dias}d ${String(horas).padStart(2, '0')}h ${String(minutos).padStart(2, '0')}min ${String(segundos % 60).padStart(2, '0')}s`}
        </p>
        {pagamento.vencimento && <p className="mt-1 text-xs text-foreground-muted">Regularize até {new Date(new Date(pagamento.vencimento).getTime() - (pagamento.situacao === 'AGUARDANDO_PAGAMENTO_INICIAL' || pagamento.situacao === 'PAGAMENTO_INICIAL_VENCIDO' ? 0 : 1)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })} (Brasília). O acesso é bloqueado após o prazo.</p>}
      </div>
      <Link href="/dashboard/plano" className="flex min-h-11 shrink-0 items-center justify-center border px-4 text-xs font-bold" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>Gerenciar plano e pendências →</Link>
    </section>
  )
}
