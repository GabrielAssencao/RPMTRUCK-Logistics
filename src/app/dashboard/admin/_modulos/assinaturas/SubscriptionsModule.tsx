'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, CreditCard, Loader2, RefreshCw, Save, XCircle } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type PlanoId = 'PREVIEW' | 'ESSENCIAL' | 'AVANCADO' | 'ENTERPRISE'

interface PlanoAdmin {
  id: PlanoId
  nome: string
  precoBase: number
  taxaImplantacao: number
  precoUsuarioAdicional: number
  precoVeiculoAdicional: number
  usuariosBase: number
  veiculosBase: number
  ticketsSuporteMes: number
  prazoRespostaSuporteHoras: number
  versao: number
}

interface ImpactoAdmin {
  perdas?: string[]
  bloqueios?: string[]
  mudanca?: string
}

interface SolicitacaoAdmin {
  id: string
  tipo: 'ALTERAR_PLANO' | 'ALTERAR_COTAS' | 'NEGOCIAR_PAGAMENTO'
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
  empresa: { id: string; nome: string }
  planoAtual: PlanoId
  planoSolicitado: PlanoId | null
  usuariosAdicionaisSolicitados: number
  veiculosAdicionaisSolicitados: number
  mensalidadeAtual: number
  mensalidadeProposta: number
  mensalidadeVigente: number
  impacto: ImpactoAdmin | null
  aprovavel: boolean
  estadoAlterado: boolean
  mensagem: string | null
  respostaAdmin: string | null
  criadoPorNome: string
  decididoPorNome: string | null
  criado_em: string
  fatura: { id: string; mes: string; ano: number; tipo: string; valor: number; status: string } | null
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SubscriptionsModule() {
  const { primary } = useTheme()
  const [planos, setPlanos] = useState<PlanoAdmin[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAdmin[]>([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState('')
  const [feedback, setFeedback] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState<'PENDENTE' | 'TODAS'>('PENDENTE')

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    try {
      const [planosResponse, solicitacoesResponse] = await Promise.all([
        fetch('/api/admin/planos', { cache: 'no-store', signal }),
        fetch('/api/admin/assinaturas', { cache: 'no-store', signal }),
      ])
      const [planosBody, solicitacoesBody] = await Promise.all([planosResponse.json(), solicitacoesResponse.json()])
      if (!planosResponse.ok) throw new Error(planosBody.erro || 'Falha ao carregar os planos.')
      if (!solicitacoesResponse.ok) throw new Error(solicitacoesBody.erro || 'Falha ao carregar as solicitações.')
      setPlanos(Array.isArray(planosBody.planos) ? planosBody.planos : [])
      setSolicitacoes(Array.isArray(solicitacoesBody.solicitacoes) ? solicitacoesBody.solicitacoes : [])
      setFeedback('')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setFeedback(cause instanceof Error ? cause.message : 'Falha ao carregar a gestão comercial.')
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void carregar(controller.signal)
    })
    return () => controller.abort()
  }, [carregar])

  const atualizarCampo = (planoId: PlanoId, campo: keyof Pick<PlanoAdmin, 'precoBase' | 'taxaImplantacao' | 'precoUsuarioAdicional' | 'precoVeiculoAdicional'>, valor: string) => {
    const numero = Number(valor)
    setPlanos((atuais) => atuais.map((plano) => plano.id === planoId ? { ...plano, [campo]: Number.isFinite(numero) ? Math.max(0, numero) : 0 } : plano))
  }

  const salvarPlano = async (plano: PlanoAdmin) => {
    setProcessando(`plano:${plano.id}`)
    setFeedback('')
    try {
      const response = await fetch('/api/admin/planos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano: plano.id,
          versao: plano.versao,
          precoBase: plano.precoBase,
          taxaImplantacao: plano.taxaImplantacao,
          precoUsuarioAdicional: plano.precoUsuarioAdicional,
          precoVeiculoAdicional: plano.precoVeiculoAdicional,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível atualizar o plano.')
      await carregar()
      setFeedback(`Valores do plano ${plano.nome} atualizados. Landing e novos cálculos já usarão a nova versão.`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível atualizar o plano.')
    } finally {
      setProcessando('')
    }
  }

  const decidir = async (solicitacao: SolicitacaoAdmin, decisao: 'APROVAR' | 'REJEITAR') => {
    const resposta = respostas[solicitacao.id]?.trim()
    if (decisao === 'REJEITAR' && !resposta) {
      setFeedback('Informe o motivo antes de rejeitar a solicitação.')
      return
    }
    setProcessando(`solicitacao:${solicitacao.id}`)
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/assinaturas/${solicitacao.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisao,
          resposta: resposta || undefined,
          mensalidadeEsperada: decisao === 'APROVAR' ? solicitacao.mensalidadeVigente : undefined,
        }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível processar a solicitação.')
      setRespostas((atuais) => ({ ...atuais, [solicitacao.id]: '' }))
      await carregar()
      setFeedback(
        decisao === 'REJEITAR'
          ? 'Solicitação rejeitada.'
          : solicitacao.tipo === 'NEGOCIAR_PAGAMENTO'
            ? 'Negociação aprovada e resposta registrada.'
            : 'Solicitação aprovada e aplicada.',
      )
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível processar a solicitação.')
    } finally {
      setProcessando('')
    }
  }

  const exibidas = filtro === 'TODAS' ? solicitacoes : solicitacoes.filter((item) => item.status === 'PENDENTE')

  return (
    <div className="space-y-10">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: primary }}>Governança comercial</p>
          <h2 className="text-3xl font-black uppercase font-rajdhani">Planos e assinaturas</h2>
          <p className="mt-1 text-sm text-foreground-muted">Preços centralizados, pedidos auditáveis e aplicação somente após aprovação.</p>
        </div>
        <button type="button" onClick={() => void carregar()} disabled={carregando} className="flex items-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-widest disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={14} /> Atualizar</button>
      </header>

      {feedback && <div role="status" className="border p-4 text-sm" style={{ borderColor: primary, color: primary }}>{feedback}</div>}

      <section>
        <div className="mb-5 flex items-center gap-2"><CreditCard size={18} style={{ color: primary }} /><h3 className="text-xl font-black uppercase font-rajdhani">Catálogo comercial</h3></div>
        {carregando && planos.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin" style={{ color: primary }} /></div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {planos.map((plano) => (
              <div key={plano.id} className="border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                <div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-widest text-foreground-muted">Versão comercial {plano.versao}</div><h4 className="text-2xl font-black uppercase font-rajdhani">{plano.nome}</h4></div><div className="text-right text-[10px] uppercase tracking-widest text-foreground-muted">Base<br />{plano.usuariosBase} usuários · {plano.veiculosBase} veículos<br />{plano.ticketsSuporteMes} tickets · resposta {plano.prazoRespostaSuporteHoras}h úteis</div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MoneyField label="Mensalidade base" value={plano.precoBase} onChange={(valor) => atualizarCampo(plano.id, 'precoBase', valor)} />
                  <MoneyField label="Taxa de implantação" value={plano.taxaImplantacao} onChange={(valor) => atualizarCampo(plano.id, 'taxaImplantacao', valor)} />
                  <MoneyField label="Usuário adicional / mês" value={plano.precoUsuarioAdicional} onChange={(valor) => atualizarCampo(plano.id, 'precoUsuarioAdicional', valor)} />
                  <MoneyField label="Veículo adicional / mês" value={plano.precoVeiculoAdicional} onChange={(valor) => atualizarCampo(plano.id, 'precoVeiculoAdicional', valor)} />
                </div>
                <button type="button" disabled={Boolean(processando)} onClick={() => void salvarPlano(plano)} className="mt-5 flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest disabled:opacity-50" style={{ backgroundColor: primary, color: '#000' }}><Save size={14} />{processando === `plano:${plano.id}` ? 'Salvando...' : 'Salvar valores'}</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="text-xl font-black uppercase font-rajdhani">Solicitações das empresas</h3><p className="text-sm text-foreground-muted">A mensalidade é recalculada no servidor imediatamente antes da aplicação.</p></div><div className="flex gap-1">{(['PENDENTE', 'TODAS'] as const).map((item) => <button key={item} type="button" onClick={() => setFiltro(item)} className="border px-3 py-2 text-[10px] font-black uppercase tracking-widest" style={{ borderColor: filtro === item ? primary : 'var(--border)', color: filtro === item ? primary : 'var(--foreground-muted)' }}>{item}</button>)}</div></div>
        {exibidas.length === 0 ? (
          <div className="border border-dashed p-10 text-center text-sm text-foreground-muted">Nenhuma solicitação nesta categoria.</div>
        ) : (
          <div className="space-y-4">
            {exibidas.map((solicitacao) => {
              const perdas = Array.isArray(solicitacao.impacto?.perdas) ? solicitacao.impacto.perdas : []
              const bloqueios = Array.isArray(solicitacao.impacto?.bloqueios) ? solicitacao.impacto.bloqueios : []
              const pendente = solicitacao.status === 'PENDENTE'
              return (
                <article key={solicitacao.id} className="border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
                  <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                    <div><div className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: primary }}>{solicitacao.tipo.replaceAll('_', ' ')}</div><h4 className="mt-1 text-2xl font-black uppercase font-rajdhani">{solicitacao.empresa.nome}</h4><p className="text-xs text-foreground-muted">Solicitado por {solicitacao.criadoPorNome} em {new Date(solicitacao.criado_em).toLocaleString('pt-BR')}</p></div>
                    <span className={`w-fit border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${solicitacao.status === 'APROVADA' ? 'border-green-500/30 text-green-500' : solicitacao.status === 'REJEITADA' ? 'border-red-500/30 text-red-500' : 'border-amber-500/30 text-amber-500'}`}>{solicitacao.status}</span>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3"><Summary label="Plano" value={solicitacao.planoSolicitado ? `${solicitacao.planoAtual} → ${solicitacao.planoSolicitado}` : solicitacao.planoAtual} /><Summary label="Mensalidade atual" value={moeda.format(solicitacao.mensalidadeAtual)} /><Summary label="Mensalidade calculada agora" value={moeda.format(solicitacao.mensalidadeVigente)} /></div>
                  {solicitacao.fatura && <p className="mt-3 text-sm"><strong>Fatura:</strong> {solicitacao.fatura.mes}/{solicitacao.fatura.ano} · {solicitacao.fatura.tipo} · {moeda.format(solicitacao.fatura.valor)}</p>}
                  {solicitacao.mensagem && <p className="mt-3 border-l-2 pl-3 text-sm text-foreground-muted" style={{ borderColor: primary }}>{solicitacao.mensagem}</p>}
                  {perdas.map((perda) => <p key={perda} className="mt-2 text-xs text-amber-500">• {perda}</p>)}
                  {bloqueios.map((bloqueio) => <p key={bloqueio} className="mt-2 text-xs text-red-500">• {bloqueio}</p>)}
                  {solicitacao.estadoAlterado && <div className="mt-3 flex items-center gap-2 text-xs text-red-500"><AlertTriangle size={14} />A assinatura mudou depois do pedido; peça uma nova solicitação.</div>}
                  {pendente && (
                    <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                      <textarea value={respostas[solicitacao.id] ?? ''} onChange={(event) => setRespostas((atuais) => ({ ...atuais, [solicitacao.id]: event.target.value }))} maxLength={1000} rows={3} placeholder="Resposta ou condição para a empresa. Obrigatória em caso de rejeição." className="w-full resize-none border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} />
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button type="button" disabled={Boolean(processando) || !solicitacao.aprovavel} onClick={() => void decidir(solicitacao, 'APROVAR')} className="flex items-center justify-center gap-2 border border-green-500/30 bg-green-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-green-500 disabled:opacity-40"><CheckCircle size={14} />{solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' ? 'Aprovar negociação' : 'Aprovar e aplicar'}</button>
                        <button type="button" disabled={Boolean(processando)} onClick={() => void decidir(solicitacao, 'REJEITAR')} className="flex items-center justify-center gap-2 border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-500 disabled:opacity-40"><XCircle size={14} />Rejeitar</button>
                      </div>
                    </div>
                  )}
                  {!pendente && solicitacao.respostaAdmin && <p className="mt-4 border-t pt-4 text-sm text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Resposta: {solicitacao.respostaAdmin}</p>}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}<div className="mt-2 flex items-center border bg-background px-3" style={{ borderColor: 'var(--border)' }}><span className="text-xs">R$</span><input type="number" min={0} step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-transparent p-3 text-sm font-bold outline-none" /></div></label>
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border p-3" style={{ borderColor: 'var(--border)' }}><div className="text-[9px] uppercase tracking-widest text-foreground-muted">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>
}
