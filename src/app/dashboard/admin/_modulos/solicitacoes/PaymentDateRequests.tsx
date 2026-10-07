'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

interface PedidoPagamento {
  id: string
  tipo: string
  status: string
  empresa: { nome: string }
  fatura: { tipo: string; mes: string; ano: number; valor: number; status: string; gatewayPaymentId: string | null } | null
  criadoPorNome: string
  mensagem: string | null
  impacto: { vencimentoProposto?: string | null; diaVencimentoAtual?: number; diaVencimentoProposto?: number } | null
  mensalidadeVigente: number
  aprovavel: boolean
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function PaymentDateRequests() {
  const { primary } = useTheme()
  const [pedidos, setPedidos] = useState<PedidoPagamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')

  const carregar = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/assinaturas', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível consultar as negociações.')
      setPedidos((body.solicitacoes ?? []).filter((item: PedidoPagamento) => ['NEGOCIAR_PAGAMENTO', 'ALTERAR_VENCIMENTO'].includes(item.tipo) && item.status === 'PENDENTE'))
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível consultar as negociações.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void carregar()) }, [carregar])

  const decidir = async (pedido: PedidoPagamento, decisao: 'APROVAR' | 'REJEITAR') => {
    const resposta = respostas[pedido.id]?.trim()
    if (decisao === 'REJEITAR' && (!resposta || resposta.length < 3)) {
      setFeedback('Informe o motivo da recusa com pelo menos 3 caracteres.')
      return
    }
    setProcessando(pedido.id)
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/assinaturas/${pedido.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, resposta: resposta || undefined, mensalidadeEsperada: decisao === 'APROVAR' ? pedido.mensalidadeVigente : undefined }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível decidir a negociação.')
      await carregar()
      setFeedback(decisao === 'APROVAR' ? pedido.tipo === 'ALTERAR_VENCIMENTO' ? 'Novo dia fixo aprovado para os próximos ciclos.' : 'Nova data aprovada e aplicada à cobrança.' : 'Solicitação recusada.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Não foi possível decidir a negociação.')
    } finally {
      setProcessando('')
    }
  }

  return (
    <section className="border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }} aria-labelledby="negociacoes-pagamento-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: primary }}>Fila financeira</p>
          <h3 id="negociacoes-pagamento-titulo" className="font-rajdhani text-xl font-black uppercase">Negociações de pagamento</h3>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={Boolean(processando)} className="border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Atualizar</button>
      </div>
      {feedback && <p role="status" className="mt-3 text-sm" style={{ color: primary }}>{feedback}</p>}
      {carregando ? <p className="mt-4 text-sm text-foreground-muted">Carregando pedidos...</p> : pedidos.length === 0 ? <p className="mt-4 text-sm text-foreground-muted">Nenhuma negociação pendente.</p> : (
        <div className="mt-4 space-y-3">
          {pedidos.map(pedido => (
            <article key={pedido.id} className="border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap justify-between gap-2">
                <div><strong className="font-rajdhani text-lg uppercase">{pedido.empresa.nome}</strong><p className="text-xs text-foreground-muted">Solicitado por {pedido.criadoPorNome}</p></div>
                <span className="text-sm font-bold">{pedido.tipo === 'ALTERAR_VENCIMENTO' ? `Dia atual: ${pedido.impacto?.diaVencimentoAtual ?? '—'}` : pedido.fatura ? `${pedido.fatura.tipo} · ${pedido.fatura.mes}/${pedido.fatura.ano} · ${moeda.format(pedido.fatura.valor)}` : 'Fatura indisponível'}</span>
              </div>
              {pedido.impacto?.vencimentoProposto && <p className="mt-3 text-sm font-bold" style={{ color: primary }}>Nova data solicitada: {new Date(`${pedido.impacto.vencimentoProposto}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
              {pedido.tipo === 'ALTERAR_VENCIMENTO' && pedido.impacto?.diaVencimentoProposto && <p className="mt-3 text-sm font-bold" style={{ color: primary }}>Novo vencimento fixo solicitado: todo dia {pedido.impacto.diaVencimentoProposto}</p>}
              {pedido.mensagem && <p className="mt-2 text-sm text-foreground-muted">{pedido.mensagem}</p>}
              {pedido.fatura?.gatewayPaymentId && <p className="mt-2 text-xs text-foreground-muted">A aprovação também atualizará a cobrança no Asaas.</p>}
              {!pedido.aprovavel && <p className="mt-2 text-xs text-amber-500">A fatura mudou ou está em processamento. Atualize antes de decidir.</p>}
              <label className="mt-3 block text-xs font-bold uppercase" htmlFor={`resposta-${pedido.id}`}>Resposta ao gestor</label>
              <input id={`resposta-${pedido.id}`} value={respostas[pedido.id] ?? ''} onChange={event => setRespostas(atuais => ({ ...atuais, [pedido.id]: event.target.value }))} maxLength={1000} placeholder="Motivo obrigatório para recusar" className="mt-1 w-full border bg-background p-3 text-sm" style={{ borderColor: 'var(--border)' }} />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(processando) || !pedido.aprovavel} onClick={() => void decidir(pedido, 'APROVAR')} className="border px-4 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: primary, color: primary }}>{processando === pedido.id ? 'Processando...' : pedido.tipo === 'ALTERAR_VENCIMENTO' ? 'Aprovar dia fixo' : pedido.impacto?.vencimentoProposto ? 'Aprovar nova data' : 'Aprovar negociação'}</button>
                <button type="button" disabled={Boolean(processando)} onClick={() => void decidir(pedido, 'REJEITAR')} className="border border-red-500/50 px-4 py-2 text-xs font-bold uppercase text-red-500 disabled:opacity-50">Recusar</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
