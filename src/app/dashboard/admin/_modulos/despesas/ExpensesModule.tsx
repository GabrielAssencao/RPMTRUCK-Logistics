'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ReceiptText } from 'lucide-react'
import { useAnoFinanceiro } from '@/hooks/useAnoFinanceiro'

type Despesa = {
  id: string
  descricao: string
  categoria: string
  valor: number
  dataPagamento: string
  observacao: string | null
}

const categorias = [
  ['INFRAESTRUTURA', 'Infraestrutura e hospedagem'],
  ['DOMINIO_EMAIL', 'Domínio e e-mail'],
  ['SOFTWARE_IA', 'Software e IA'],
  ['MARKETING', 'Marketing'],
  ['LEGAL_CONTABIL', 'Jurídico e contábil'],
  ['GATEWAY_OUTROS', 'Outras taxas de gateway'],
  ['OUTROS', 'Outros'],
] as const

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const formVazio = { descricao: '', categoria: 'INFRAESTRUTURA', valor: '', dataPagamento: '', observacao: '' }
const campo = 'min-h-11 w-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'
export default function ExpensesModule() {
  const { anoAtual, anoSelecionado: ano, selecionarAno: setAno } = useAnoFinanceiro()
  const [pagina, setPagina] = useState(1)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [total, setTotal] = useState(0)
  const [form, setForm] = useState(formVazio)
  const [editando, setEditando] = useState<string | null>(null)
  const [confirmarId, setConfirmarId] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  const carregar = useCallback(async (paginaAlvo: number) => {
    setCarregando(true)
    try {
      const resposta = await fetch(`/api/admin/despesas?ano=${ano}&pagina=${paginaAlvo}`, { cache: 'no-store' })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível carregar as despesas.')
      setDespesas(dados.despesas)
      setTotal(dados.total)
      setErro('')
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar as despesas.')
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => { queueMicrotask(() => void carregar(pagina)) }, [carregar, pagina])

  const mudarAno = (novoAno: number) => {
    if (novoAno < 2020 || novoAno > anoAtual) return
    setPagina(1)
    setAno(novoAno)
    setConfirmarId(null)
  }

  const salvar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (processando) return
    setProcessando(true)
    setErro('')
    setMensagem('')
    try {
      const resposta = await fetch(editando ? `/api/admin/despesas/${editando}` : '/api/admin/despesas', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, valor: Number(form.valor), observacao: form.observacao.trim() || undefined }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível salvar a despesa.')
      setForm(formVazio)
      setEditando(null)
      setPagina(1)
      await carregar(1)
      setMensagem('Despesa salva. O painel refletirá o lançamento ao ser aberto.')
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível salvar a despesa.')
    } finally {
      setProcessando(false)
    }
  }

  const excluir = async (id: string) => {
    if (processando) return
    setProcessando(true)
    setErro('')
    setMensagem('')
    try {
      const resposta = await fetch(`/api/admin/despesas/${id}`, { method: 'DELETE' })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível excluir a despesa.')
      setConfirmarId(null)
      if (despesas.length === 1 && pagina > 1) setPagina(pagina - 1)
      else await carregar(pagina)
      setMensagem('Despesa removida do saldo; o registro de auditoria foi preservado.')
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível excluir a despesa.')
    } finally {
      setProcessando(false)
    }
  }

  const iniciarEdicao = (despesa: Despesa) => {
    setEditando(despesa.id)
    setForm({
      descricao: despesa.descricao,
      categoria: despesa.categoria,
      valor: String(despesa.valor),
      dataPagamento: despesa.dataPagamento.slice(0, 10),
      observacao: despesa.observacao || '',
    })
    formRef.current?.scrollIntoView({ block: 'start' })
  }

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-primary text-[10px] font-bold uppercase tracking-[0.3em]">Controle operacional</p>
        <h1 className="font-rajdhani text-3xl font-black uppercase">Despesas do sistema</h1>
        <p className="mt-1 text-sm text-foreground-muted">Registre custos pagos do aplicativo e do site. O painel administrativo usa estes lançamentos no saldo mensal.</p>
      </div>
      <div className="flex items-center gap-3 border border-border bg-background-secondary px-3 py-2" aria-label="Ano das despesas">
        <button type="button" aria-label="Ano anterior" disabled={ano <= 2020} onClick={() => mudarAno(ano - 1)} className="p-2 disabled:opacity-30"><ChevronLeft size={16} /></button>
        <span className="min-w-12 text-center text-sm font-black">{ano}</span>
        <button type="button" aria-label="Ano seguinte" disabled={ano >= anoAtual} onClick={() => mudarAno(ano + 1)} className="p-2 disabled:opacity-30"><ChevronRight size={16} /></button>
      </div>
    </header>

    {erro && <p role="alert" className="border border-red-500/50 p-3 text-sm text-red-500">{erro}</p>}
    {mensagem && <p role="status" className="border border-primary/50 p-3 text-sm text-primary">{mensagem}</p>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <form ref={formRef} onSubmit={salvar} className="border border-border bg-background-secondary p-4 sm:p-5">
        <div className="flex items-center gap-2"><ReceiptText size={17} className="text-primary" aria-hidden="true" /><h2 className="text-sm font-black uppercase tracking-widest">{editando ? 'Editar despesa' : 'Novo lançamento'}</h2></div>
        <p className="mt-2 text-xs text-foreground-muted">Informe a data em que o pagamento realmente aconteceu.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <label className="grid gap-1.5 text-xs font-bold">Descrição<input required minLength={3} maxLength={160} className={campo} value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} placeholder="Ex.: domínio anual" /></label>
          <label className="grid gap-1.5 text-xs font-bold">Categoria<select className={campo} value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })}>{categorias.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-bold">Valor pago (R$)<input required type="number" min="0.01" max="10000000" step="0.01" className={campo} value={form.valor} onChange={event => setForm({ ...form, valor: event.target.value })} /></label>
          <label className="grid gap-1.5 text-xs font-bold">Data do pagamento<input required type="date" max={hoje} className={campo} value={form.dataPagamento} onChange={event => setForm({ ...form, dataPagamento: event.target.value })} /></label>
        </div>
        <label className="mt-4 grid gap-1.5 text-xs font-bold">Observação opcional<input maxLength={500} className={campo} value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} /></label>
        <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={processando} className="min-h-11 bg-primary px-4 text-xs font-black uppercase text-black disabled:opacity-50">{processando ? 'Salvando...' : editando ? 'Salvar alteração' : 'Adicionar despesa'}</button>{editando && <button type="button" onClick={() => { setEditando(null); setForm(formVazio) }} className="min-h-11 border border-border px-4 text-xs font-bold">Cancelar</button>}</div>
      </form>

      <section aria-labelledby="despesas-lista-titulo" className="min-w-0 border border-border bg-background-secondary p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="despesas-lista-titulo" className="text-sm font-black uppercase tracking-widest">Lançamentos de {ano}</h2><span className="text-xs text-foreground-muted">{total} registro(s)</span></div>
        {carregando ? <p className="mt-5 text-sm" role="status">Carregando despesas...</p> : despesas.length === 0 ? <p className="mt-5 border border-dashed border-border p-5 text-sm text-foreground-muted">Nenhuma despesa lançada neste ano.</p> : <div className="mt-4 divide-y divide-border">{despesas.map(despesa => <article key={despesa.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><h3 className="break-words text-sm font-bold">{despesa.descricao}</h3><p className="text-xs text-foreground-muted">{despesa.dataPagamento.slice(0, 10).split('-').reverse().join('/')} · {categorias.find(item => item[0] === despesa.categoria)?.[1] || despesa.categoria}</p></div>
          <div className="flex flex-wrap items-center gap-2"><strong className="mr-2 text-sm">{moeda.format(despesa.valor)}</strong><button type="button" disabled={processando} onClick={() => iniciarEdicao(despesa)} className="border border-border px-2 py-1.5 text-xs disabled:opacity-50">Editar</button>{confirmarId === despesa.id ? <><button type="button" disabled={processando} onClick={() => void excluir(despesa.id)} className="border border-red-500 px-2 py-1.5 text-xs text-red-500 disabled:opacity-50">Confirmar</button><button type="button" onClick={() => setConfirmarId(null)} className="px-2 py-1.5 text-xs">Cancelar</button></> : <button type="button" disabled={processando} onClick={() => setConfirmarId(despesa.id)} className="border border-border px-2 py-1.5 text-xs text-red-500 disabled:opacity-50">Excluir</button>}</div>
        </article>)}</div>}
        {total > 20 && <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3"><button type="button" disabled={pagina === 1 || carregando} onClick={() => setPagina(pagina - 1)} className="text-xs disabled:opacity-40">Anterior</button><span className="text-xs">{pagina} / {Math.ceil(total / 20)}</span><button type="button" disabled={pagina >= Math.ceil(total / 20) || carregando} onClick={() => setPagina(pagina + 1)} className="text-xs disabled:opacity-40">Próxima</button></div>}
      </section>
    </div>
  </div>
}
