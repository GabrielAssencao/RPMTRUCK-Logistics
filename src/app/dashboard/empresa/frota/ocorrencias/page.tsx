'use client'

import { type FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Plus, ReceiptText, X } from 'lucide-react'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { DominoLoader } from '@/components/motion/OperationalFeedback'
import { useTheme } from '@/contexts/ThemeContext'

type Status = 'ABERTA' | 'EM_ANALISE' | 'RESOLVIDA'
type Tipo = 'MULTA' | 'COLISAO' | 'AVARIA' | 'OUTRA'
interface Opcao { id: string; nome?: string; modelo?: string; placa?: string; descricao?: string; valor?: number; status?: string; veiculoId?: string | null }
interface Ocorrencia {
  id: string; tipo: Tipo; titulo: string; descricao?: string | null; data: string; local?: string | null
  valorEfetivo: number; pontosCnh?: number | null; status: Status
  veiculo: { id: string; modelo: string; placa: string }; motorista?: { id: string; nome: string } | null
  contaPagar?: { id: string; descricao: string; valor: number; status: string } | null
}

const vazio = { tipo: 'MULTA' as Tipo, titulo: '', descricao: '', data: new Date().toISOString().slice(0, 10), local: '', valor: '', pontosCnh: '', veiculoId: '', motoristaId: '', contaPagarId: '' }

export default function OcorrenciasVeiculosPage() {
  const { primary, semanticColors } = useTheme()
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([])
  const [veiculos, setVeiculos] = useState<Opcao[]>([])
  const [motoristas, setMotoristas] = useState<Opcao[]>([])
  const [contas, setContas] = useState<Opcao[]>([])
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [filtro, setFiltro] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [editor, setEditor] = useState(false)
  const [form, setForm] = useState(vazio)
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ pagina: String(pagina) })
      if (filtro !== 'TODOS') params.set('status', filtro)
      const response = await fetch(`/api/ocorrencias-veiculos?${params}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar as ocorrências.')
      setOcorrencias(data.ocorrencias); setTotal(data.total); setVeiculos(data.veiculos); setMotoristas(data.motoristas); setContas(data.contas)
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Falha ao carregar ocorrências.', tone: 'error' })
    } finally { setLoading(false) }
  }, [filtro, pagina])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ pagina: String(pagina) })
    if (filtro !== 'TODOS') params.set('status', filtro)
    fetch(`/api/ocorrencias-veiculos?${params}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar as ocorrências.')
        setOcorrencias(data.ocorrencias); setTotal(data.total); setVeiculos(data.veiculos); setMotoristas(data.motoristas); setContas(data.contas)
      })
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') setFeedback({ message: error.message, tone: 'error' }) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filtro, pagina])

  const salvar = async (event: FormEvent) => {
    event.preventDefault(); if (salvando) return
    setSalvando(true); setFeedback(null)
    try {
      const response = await fetch('/api/ocorrencias-veiculos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        tipo: form.tipo, titulo: form.titulo, descricao: form.descricao || null, data: form.data, local: form.local || null,
        valor: form.valor ? Number(form.valor) : null, pontosCnh: form.tipo === 'MULTA' && form.pontosCnh ? Number(form.pontosCnh) : null,
        veiculoId: form.veiculoId, motoristaId: form.motoristaId || null, contaPagarId: form.contaPagarId || null,
      }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar a ocorrência.')
      setEditor(false); setForm(vazio); setFeedback({ message: 'Ocorrência registrada e custo operacional sincronizado.', tone: 'success' }); setPagina(1); await carregar()
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Falha ao salvar.', tone: 'error' }) }
    finally { setSalvando(false) }
  }

  const alterarStatus = async (item: Ocorrencia, status: Status) => {
    const response = await fetch(`/api/ocorrencias-veiculos/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    const data = await response.json()
    if (!response.ok) return setFeedback({ message: data.erro || 'Falha ao atualizar.', tone: 'error' })
    setOcorrencias((atuais) => atuais.map((atual) => atual.id === item.id ? { ...atual, status } : atual))
    setFeedback({ message: 'Situação da ocorrência atualizada.', tone: 'success' })
  }

  const totalPaginas = Math.max(1, Math.ceil(total / 20))
  return <div className="mx-auto max-w-[1600px] space-y-5 font-mono">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><Link href="/dashboard/empresa/frota" className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase text-foreground-muted"><ArrowLeft size={14} /> Voltar à frota</Link><h1 className="font-rajdhani text-3xl font-black uppercase">Ocorrências <span style={{ color: primary }}>da frota</span></h1><p className="mt-1 text-xs text-foreground-muted">Multas, colisões e avarias vinculadas ao veículo, motorista e financeiro.</p></div><button type="button" onClick={() => setEditor(true)} className="interactive-control flex min-h-11 items-center justify-center gap-2 px-5 text-xs font-black uppercase text-black" style={{ backgroundColor: primary }}><Plus size={16} /> Nova ocorrência</button></div>
    {feedback && <ActionFeedback message={feedback.message} tone={feedback.tone} />}
    <div className="flex flex-wrap gap-2 border p-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>{['TODOS', 'ABERTA', 'EM_ANALISE', 'RESOLVIDA'].map((status) => <button type="button" key={status} onClick={() => { setFiltro(status); setPagina(1) }} className="interactive-control min-h-9 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: filtro === status ? primary : 'var(--border)', color: filtro === status ? primary : undefined }}>{status.replace('_', ' ')}</button>)}</div>
    {loading ? <DominoLoader label="Carregando ocorrências" /> : <div className="overflow-x-auto border" style={{ borderColor: 'var(--border)' }}><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[var(--background-secondary)] text-[9px] uppercase text-foreground-muted"><tr><th className="p-3">Ocorrência</th><th className="p-3">Veículo</th><th className="p-3">Motorista</th><th className="p-3">Data</th><th className="p-3">Custo</th><th className="p-3">Situação</th></tr></thead><tbody>{ocorrencias.map((item) => <tr key={item.id} className="border-t" style={{ borderColor: 'var(--border)' }}><td className="p-3"><span className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase" style={{ color: item.tipo === 'MULTA' ? semanticColors.warning : semanticColors.danger }}><AlertTriangle size={12} /> {item.tipo}</span><strong>{item.titulo}</strong>{item.descricao && <p className="mt-1 max-w-md text-[10px] text-foreground-muted">{item.descricao}</p>}</td><td className="p-3"><strong>{item.veiculo.placa}</strong><br/><span className="text-[10px] text-foreground-muted">{item.veiculo.modelo}</span></td><td className="p-3">{item.motorista?.nome ?? 'Não informado'}</td><td className="p-3">{new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="p-3"><strong>{item.valorEfetivo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>{item.contaPagar && <span className="mt-1 flex items-center gap-1 text-[9px] text-foreground-muted"><ReceiptText size={11}/>{item.contaPagar.status}</span>}</td><td className="p-3"><select aria-label={`Situação de ${item.titulo}`} value={item.status} onChange={(event) => void alterarStatus(item, event.target.value as Status)} className="input-cronograma min-h-9"><option value="ABERTA">Aberta</option><option value="EM_ANALISE">Em análise</option><option value="RESOLVIDA">Resolvida</option></select></td></tr>)}{ocorrencias.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-foreground-muted">Nenhuma ocorrência neste filtro.</td></tr>}</tbody></table></div>}
    {totalPaginas > 1 && <nav aria-label="Paginação das ocorrências" className="flex items-center justify-center gap-3"><button type="button" disabled={pagina === 1} onClick={() => setPagina((valor) => valor - 1)} className="interactive-control grid min-h-10 min-w-10 place-items-center border disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronLeft size={16}/></button><span className="text-[10px] font-bold uppercase">Página {pagina} de {totalPaginas}</span><button type="button" disabled={pagina === totalPaginas} onClick={() => setPagina((valor) => valor + 1)} className="interactive-control grid min-h-10 min-w-10 place-items-center border disabled:opacity-30" style={{ borderColor: 'var(--border)' }}><ChevronRight size={16}/></button></nav>}
    {editor && <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/75 p-3 sm:p-5"><form onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="nova-ocorrencia" className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl min-w-0 overflow-y-auto overscroll-contain border p-4 sm:max-h-[calc(100dvh-2.5rem)] sm:p-5" style={{ backgroundColor: 'var(--background-secondary)', borderColor: primary }}><div className="sticky top-0 z-10 flex items-start justify-between border-b pb-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><div><p className="text-[9px] font-black uppercase tracking-widest" style={{ color: primary }}>Registro operacional</p><h2 id="nova-ocorrencia" className="font-rajdhani text-xl font-black uppercase">Nova ocorrência</h2></div><button type="button" onClick={() => setEditor(false)} aria-label="Fechar" className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }}><X size={16}/></button></div><div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4">
      <Campo label="Tipo"><select required value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })} className="input-cronograma"><option value="MULTA">Multa</option><option value="COLISAO">Colisão</option><option value="AVARIA">Avaria</option><option value="OUTRA">Outra</option></select></Campo>
      <Campo label="Data"><input required type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="input-cronograma" /></Campo>
      <Campo label="Título" wide><input required minLength={3} maxLength={140} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="input-cronograma" /></Campo>
      <Campo label="Veículo"><select required value={form.veiculoId} onChange={(e) => setForm({ ...form, veiculoId: e.target.value })} className="input-cronograma"><option value="">Selecione</option>{veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}</select></Campo>
      <Campo label="Motorista envolvido"><select value={form.motoristaId} onChange={(e) => setForm({ ...form, motoristaId: e.target.value })} className="input-cronograma"><option value="">Não informado</option>{motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select></Campo>
      <Campo label="Local"><input maxLength={180} value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} className="input-cronograma" /></Campo>
      <Campo label="Valor estimado"><input type="number" min="0" step="0.01" disabled={Boolean(form.contaPagarId)} value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="input-cronograma disabled:opacity-50" /></Campo>
      {form.tipo === 'MULTA' && <Campo label="Pontos na CNH"><input type="number" min="0" max="20" value={form.pontosCnh} onChange={(e) => setForm({ ...form, pontosCnh: e.target.value })} className="input-cronograma" /></Campo>}
      <Campo label="Conta/boletos já cadastrados" wide><select value={form.contaPagarId} onChange={(e) => setForm({ ...form, contaPagarId: e.target.value })} className="input-cronograma"><option value="">Sem vínculo financeiro</option>{contas.filter((c) => !c.veiculoId || c.veiculoId === form.veiculoId).map((c) => <option key={c.id} value={c.id}>{c.descricao} · {Number(c.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>)}</select><span className="text-[9px] normal-case text-foreground-muted">Ao vincular, o valor do boleto prevalece e alimenta o custo automaticamente.</span></Campo>
      <Campo label="Descrição" wide><textarea rows={3} maxLength={2000} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="input-cronograma resize-y" /></Campo>
    </div><div className="sticky bottom-0 mt-5 flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><button type="button" onClick={() => setEditor(false)} className="interactive-control min-h-10 border px-4 text-xs" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={salvando} className="interactive-control min-h-10 px-5 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? 'Salvando...' : 'Registrar ocorrência'}</button></div></form></div>}
  </div>
}

function Campo({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`grid min-w-0 gap-1.5 text-[9px] font-bold uppercase tracking-wider text-foreground-muted ${wide ? 'sm:col-span-2' : ''}`}>{label}{children}</label> }
