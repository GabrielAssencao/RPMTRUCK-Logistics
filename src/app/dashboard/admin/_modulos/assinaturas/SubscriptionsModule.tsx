'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
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
  vencimentoProposto?: string | null
  diaVencimentoAtual?: number
  diaVencimentoProposto?: number
}

interface PromocaoAdmin {
  id: string
  nome: string
  plano: PlanoId
  escopo: string
  precoBaseInicial: number
  precoBaseRenovacao: number
  taxaImplantacao: number
  mesesPrecoInicial: number
  limiteAdesoes: number | null
  adesoesConfirmadas: number
  ativa: boolean
  visivelSolicitacao: boolean
  criado_em: string
  _count: { empresas: number; solicitacoes: number; configuracoesPix: number }
}

interface SolicitacaoAdmin {
  id: string
  tipo: 'ALTERAR_PLANO' | 'ALTERAR_COTAS' | 'ALTERAR_VENCIMENTO' | 'NEGOCIAR_PAGAMENTO'
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
  fatura: { id: string; mes: string; ano: number; tipo: string; valor: number; status: string; gatewayPaymentId: string | null } | null
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SubscriptionsModule() {
  const { primary } = useTheme()
  const [planos, setPlanos] = useState<PlanoAdmin[]>([])
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAdmin[]>([])
  const [promocoes, setPromocoes] = useState<PromocaoAdmin[]>([])
  const [filtroPromocoes, setFiltroPromocoes] = useState<'ATIVAS' | 'ARQUIVADAS'>('ATIVAS')
  const [confirmarExclusaoId, setConfirmarExclusaoId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState('')
  const [feedback, setFeedback] = useState('')
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [filtro, setFiltro] = useState<'PENDENTE' | 'TODAS'>('PENDENTE')
  const [novaPromocao, setNovaPromocao] = useState({ nome: '', plano: 'ESSENCIAL' as 'ESSENCIAL' | 'AVANCADO', escopo: 'NOVAS_EMPRESAS', precoBaseInicial: '297', mesesPrecoInicial: '12', precoBaseRenovacao: '397', taxaImplantacao: '0', limiteAdesoes: '5', visivelSolicitacao: true })

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    try {
      const [planosResponse, solicitacoesResponse, promocoesResponse] = await Promise.all([
        fetch('/api/admin/planos', { cache: 'no-store', signal }),
        fetch('/api/admin/assinaturas', { cache: 'no-store', signal }),
        fetch('/api/admin/promocoes', { cache: 'no-store', signal }),
      ])
      const [planosBody, solicitacoesBody, promocoesBody] = await Promise.all([planosResponse.json(), solicitacoesResponse.json(), promocoesResponse.json()])
      if (!planosResponse.ok) throw new Error(planosBody.erro || 'Falha ao carregar os planos.')
      if (!solicitacoesResponse.ok) throw new Error(solicitacoesBody.erro || 'Falha ao carregar as solicitações.')
      if (!promocoesResponse.ok) throw new Error(promocoesBody.erro || 'Falha ao carregar as promoções.')
      setPlanos(Array.isArray(planosBody.planos) ? planosBody.planos : [])
      setSolicitacoes(Array.isArray(solicitacoesBody.solicitacoes) ? solicitacoesBody.solicitacoes : [])
      setPromocoes(Array.isArray(promocoesBody.promocoes) ? promocoesBody.promocoes : [])
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

  const criarPromocao = async () => {
    setProcessando('promocao'); setFeedback('')
    try {
      const response = await fetch('/api/admin/promocoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...novaPromocao,
          precoBaseInicial: Number(novaPromocao.precoBaseInicial),
          mesesPrecoInicial: Number(novaPromocao.mesesPrecoInicial),
          precoBaseRenovacao: Number(novaPromocao.precoBaseRenovacao),
          taxaImplantacao: Number(novaPromocao.taxaImplantacao),
          limiteAdesoes: novaPromocao.limiteAdesoes.trim() ? Number(novaPromocao.limiteAdesoes) : null,
        }),
      })
      const body = await response.json(); if (!response.ok) throw new Error(body.erro || 'Não foi possível criar a promoção.')
      await carregar()
      setFeedback('Promoção criada. O Asaas emitirá a cobrança com o valor vigente quando a empresa solicitar o pagamento.')
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Não foi possível criar a promoção.') }
    finally { setProcessando('') }
  }

  const alterarPromocao = async (promocao: PromocaoAdmin, acao: 'ARQUIVAR' | 'REATIVAR' | 'EXCLUIR') => {
    setProcessando(`promocao:${promocao.id}`)
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/promocoes/${promocao.id}`, {
        method: acao === 'EXCLUIR' ? 'DELETE' : 'PATCH',
        ...(acao !== 'EXCLUIR' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativa: acao === 'REATIVAR' }) } : {}),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível alterar a promoção.')
      setConfirmarExclusaoId('')
      await carregar()
      setFeedback(acao === 'EXCLUIR' ? 'Promoção sem histórico excluída.' : acao === 'ARQUIVAR' ? 'Promoção arquivada; condições já contratadas foram preservadas.' : 'Promoção reativada.')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Não foi possível alterar a promoção.')
    } finally {
      setProcessando('')
    }
  }

  const exibidas = filtro === 'TODAS' ? solicitacoes : solicitacoes.filter((item) => item.status === 'PENDENTE')
  const promocoesExibidas = promocoes.filter(item => filtroPromocoes === 'ATIVAS' ? item.ativa : !item.ativa)

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


      <section className="border p-5" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <h3 className="text-xl font-black uppercase font-rajdhani">Nova promoção</h3>
        <p className="mt-1 max-w-4xl text-sm text-foreground-muted">Defina quem recebe a oferta, por quanto tempo o preço promocional será válido e qual valor passará a valer depois desse período.</p>

        <div className="mt-5 grid gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
          <PromotionInput label="Nome da promoção" hint="Nome interno e texto exibido no ticket." value={novaPromocao.nome} onChange={nome => setNovaPromocao(x => ({ ...x, nome }))} placeholder="Ex.: Fundadoras 2026" />
          <PromotionField label="Plano contemplado" hint="Plano ao qual os valores abaixo serão aplicados.">
            <select value={novaPromocao.plano} onChange={e => setNovaPromocao(x => ({ ...x, plano: e.target.value as 'ESSENCIAL' | 'AVANCADO' }))} className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary">
              <option value="ESSENCIAL">Essencial</option>
              <option value="AVANCADO">Avançado</option>
            </select>
          </PromotionField>
          <PromotionField label="Público da promoção" hint="Define quais empresas podem receber a condição.">
            <select value={novaPromocao.escopo} onChange={e => setNovaPromocao(x => ({ ...x, escopo: e.target.value, visivelSolicitacao: e.target.value === 'NOVAS_EMPRESAS' }))} className="w-full border border-border bg-background p-3 text-sm outline-none focus:border-primary">
              <option value="NOVAS_EMPRESAS">Novas empresas</option>
              <option value="TODAS_EMPRESAS">Todas as empresas</option>
              <option value="EMPRESAS_ATIVAS">Somente empresas ativas</option>
            </select>
          </PromotionField>
          <PromotionInput label="Limite de adesões" hint="Deixe vazio para não limitar a quantidade." value={novaPromocao.limiteAdesoes} onChange={limiteAdesoes => setNovaPromocao(x => ({ ...x, limiteAdesoes }))} type="number" min="1" step="1" placeholder="Sem limite" suffix="empresas" />

          <PromotionInput label="Mensalidade promocional" hint="Valor cobrado durante o período da oferta." value={novaPromocao.precoBaseInicial} onChange={precoBaseInicial => setNovaPromocao(x => ({ ...x, precoBaseInicial }))} type="number" min="0" step="0.01" prefix="R$" />
          <PromotionInput label="Duração da promoção" hint="Quantidade de meses usando o preço promocional." value={novaPromocao.mesesPrecoInicial} onChange={mesesPrecoInicial => setNovaPromocao(x => ({ ...x, mesesPrecoInicial }))} type="number" min="1" max="60" step="1" suffix="meses" />
          <PromotionInput label="Mensalidade após a promoção" hint="Valor recorrente depois do período promocional." value={novaPromocao.precoBaseRenovacao} onChange={precoBaseRenovacao => setNovaPromocao(x => ({ ...x, precoBaseRenovacao }))} type="number" min="0" step="0.01" prefix="R$" />
          <PromotionInput label="Taxa de implantação" hint="Valor único cobrado na ativação da empresa." value={novaPromocao.taxaImplantacao} onChange={taxaImplantacao => setNovaPromocao(x => ({ ...x, taxaImplantacao }))} type="number" min="0" step="0.01" prefix="R$" />
        </div>

        <div className="mt-5 flex flex-col justify-between gap-4 border p-4 sm:flex-row sm:items-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={novaPromocao.visivelSolicitacao} disabled={novaPromocao.escopo !== 'NOVAS_EMPRESAS'} onChange={e => setNovaPromocao(x => ({ ...x, visivelSolicitacao: e.target.checked }))} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
            <span><strong className="block text-xs uppercase tracking-widest">Exibir na solicitação de acesso</strong><small className="mt-1 block text-xs text-foreground-muted">Disponível para promoções destinadas a novas empresas. Exibe o preço e o ticket promocional no formulário público.</small></span>
          </label>
          <button type="button" disabled={processando === 'promocao' || novaPromocao.nome.trim().length < 3} onClick={() => void criarPromocao()} className="min-h-11 shrink-0 px-5 py-3 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: primary, color: '#000' }}>{processando === 'promocao' ? 'Criando...' : 'Criar promoção'}</button>
        </div>
      </section>

      <section aria-labelledby="promocoes-cadastradas-titulo">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h3 id="promocoes-cadastradas-titulo" className="font-rajdhani text-xl font-black uppercase">Promoções cadastradas</h3><p className="text-sm text-foreground-muted">Arquivar retira a oferta de novas adesões sem apagar condições já contratadas.</p></div>
          <div className="flex gap-1" role="group" aria-label="Filtrar promoções">
            {(['ATIVAS', 'ARQUIVADAS'] as const).map(item => <button key={item} type="button" aria-pressed={filtroPromocoes === item} onClick={() => setFiltroPromocoes(item)} className="border px-3 py-2 text-[10px] font-black uppercase tracking-widest" style={{ borderColor: filtroPromocoes === item ? primary : 'var(--border)', color: filtroPromocoes === item ? primary : 'var(--foreground-muted)' }}>{item} ({promocoes.filter(p => item === 'ATIVAS' ? p.ativa : !p.ativa).length})</button>)}
          </div>
        </div>
        {promocoesExibidas.length === 0 ? <p className="border border-dashed p-6 text-sm text-foreground-muted" style={{ borderColor: 'var(--border)' }}>Nenhuma promoção nesta lista.</p> : <div className="grid gap-3 lg:grid-cols-2">{promocoesExibidas.map(promocao => {
          const usada = promocao._count.empresas + promocao._count.solicitacoes + promocao._count.configuracoesPix > 0
          return <article key={promocao.id} className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-rajdhani text-lg font-black uppercase">{promocao.nome}</h4><p className="text-xs text-foreground-muted">{promocao.plano} · {promocao.escopo.replaceAll('_', ' ')} · criada em {new Date(promocao.criado_em).toLocaleDateString('pt-BR')}</p></div><span className="border px-2 py-1 text-[10px] font-bold uppercase" style={{ borderColor: promocao.ativa ? primary : 'var(--border)', color: promocao.ativa ? primary : 'var(--foreground-muted)' }}>{promocao.ativa ? 'Ativa' : 'Arquivada'}</span></div>
            <p className="mt-3 text-sm"><strong>{moeda.format(promocao.precoBaseInicial)}/mês</strong> por {promocao.mesesPrecoInicial} {promocao.mesesPrecoInicial === 1 ? 'mês' : 'meses'} · depois {moeda.format(promocao.precoBaseRenovacao)}/mês · implantação {moeda.format(promocao.taxaImplantacao)}</p>
            <p className="mt-1 text-xs text-foreground-muted">{promocao.adesoesConfirmadas}{promocao.limiteAdesoes ? ` de ${promocao.limiteAdesoes}` : ''} adesões · {promocao.ativa && promocao.visivelSolicitacao ? 'visível na solicitação de acesso' : !promocao.ativa ? 'fora da solicitação de acesso' : 'uso administrativo'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <button type="button" disabled={Boolean(processando)} onClick={() => void alterarPromocao(promocao, promocao.ativa ? 'ARQUIVAR' : 'REATIVAR')} className="border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>{promocao.ativa ? 'Arquivar' : 'Reativar'}</button>
              {!usada && (confirmarExclusaoId === promocao.id ? <><span className="text-xs text-red-500">Excluir definitivamente?</span><button type="button" disabled={Boolean(processando)} onClick={() => void alterarPromocao(promocao, 'EXCLUIR')} className="border border-red-500 px-3 py-2 text-xs font-bold uppercase text-red-500 disabled:opacity-50">Confirmar exclusão</button><button type="button" onClick={() => setConfirmarExclusaoId('')} className="px-2 py-2 text-xs">Cancelar</button></> : <button type="button" disabled={Boolean(processando)} onClick={() => setConfirmarExclusaoId(promocao.id)} className="px-3 py-2 text-xs font-bold uppercase text-red-500 disabled:opacity-50">Excluir</button>)}
              {usada && <span className="text-xs text-foreground-muted">Possui histórico: mantenha arquivada.</span>}
            </div>
          </article>
        })}</div>}
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
                  {solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' && solicitacao.impacto?.vencimentoProposto && <p className="mt-2 border-l-2 pl-3 text-sm" style={{ borderColor: primary }}><strong>Nova data solicitada:</strong> {new Date(`${solicitacao.impacto.vencimentoProposto}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
                  {solicitacao.tipo === 'ALTERAR_VENCIMENTO' && solicitacao.impacto?.diaVencimentoProposto && <p className="mt-2 border-l-2 pl-3 text-sm" style={{ borderColor: primary }}><strong>Novo vencimento fixo:</strong> dia {solicitacao.impacto.diaVencimentoProposto} de cada mês</p>}
                  {solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' && !solicitacao.aprovavel && solicitacao.impacto?.vencimentoProposto && <p className="mt-2 text-xs text-amber-500">A fatura foi quitada ou está em processamento. Atualize a tela antes de decidir.</p>}
                  {solicitacao.tipo === 'NEGOCIAR_PAGAMENTO' && solicitacao.aprovavel && solicitacao.fatura?.gatewayPaymentId && solicitacao.impacto?.vencimentoProposto && <p className="mt-2 text-xs text-foreground-muted">Ao aprovar, o vencimento da cobrança no Asaas também será atualizado.</p>}
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

function PromotionField({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return <label className="grid content-start gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">{label}</span>{children}<small className="text-[10px] leading-relaxed text-foreground-muted">{hint}</small></label>
}

function PromotionInput({ label, hint, value, onChange, type = 'text', min, max, step, prefix, suffix, placeholder }: { label: string; hint: string; value: string; onChange: (value: string) => void; type?: 'text' | 'number'; min?: string; max?: string; step?: string; prefix?: string; suffix?: string; placeholder?: string }) {
  return (
    <PromotionField label={label} hint={hint}>
      <span className="flex min-h-11 items-center border border-border bg-background focus-within:border-primary">
        {prefix && <span className="shrink-0 border-r px-3 text-xs font-black text-foreground-muted" style={{ borderColor: 'var(--border)' }}>{prefix}</span>}
        <input type={type} min={min} max={max} step={step} inputMode={type === 'number' ? 'decimal' : undefined} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none placeholder:font-normal placeholder:text-foreground-muted" />
        {suffix && <span className="shrink-0 border-l px-3 text-[9px] font-black uppercase tracking-wider text-foreground-muted" style={{ borderColor: 'var(--border)' }}>{suffix}</span>}
      </span>
    </PromotionField>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border p-3" style={{ borderColor: 'var(--border)' }}><div className="text-[9px] uppercase tracking-widest text-foreground-muted">{label}</div><div className="mt-1 text-sm font-black">{value}</div></div>
}
