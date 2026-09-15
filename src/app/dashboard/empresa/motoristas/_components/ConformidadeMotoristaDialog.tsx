'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { Award, FlaskConical, Plus, ShieldCheck, Trash2, X } from 'lucide-react'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { DominoLoader } from '@/components/motion/OperationalFeedback'
import { useTheme } from '@/contexts/ThemeContext'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'

type Tipo = 'CURSO' | 'EXAME_TOXICOLOGICO'
interface Item { id: string; tipo: Tipo; nome: string; numero?: string | null; emitidoEm?: string | null; validade?: string | null; obrigatorio: boolean; cargaAplicavel?: string | null; veiculoAplicavel?: string | null; observacoes?: string | null; situacao: 'VALIDO' | 'VENCE_EM_30_DIAS' | 'VENCIDO' | 'SEM_VALIDADE' }
const vazio = { tipo: 'CURSO' as Tipo, nome: '', numero: '', emitidoEm: '', validade: '', obrigatorio: true, cargaAplicavel: '', veiculoAplicavel: '', observacoes: '' }
const cursos = ['MOPP', 'Cargas indivisíveis', 'Transporte de emergência', 'Direção defensiva', 'NR-20', 'NR-35']

export function ConformidadeMotoristaDialog({ motorista, onClose }: { motorista: { id: string; nomeAbreviado: string }; onClose: () => void }) {
  const { primary, semanticColors } = useTheme()
  const [itens, setItens] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState(vazio)
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [itemExclusao, setItemExclusao] = useState<Item | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/motoristas/${motorista.id}/conformidades`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os documentos.')
        setItens(data.conformidades)
      })
      .catch((error) => { if (error instanceof Error && error.name !== 'AbortError') setFeedback({ message: error.message, tone: 'error' }) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [motorista.id])

  const salvar = async (event: FormEvent) => {
    event.preventDefault(); if (salvando) return; setSalvando(true); setFeedback(null)
    try {
      const response = await fetch(`/api/motoristas/${motorista.id}/conformidades`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, numero: form.numero || null, emitidoEm: form.emitidoEm || null, validade: form.validade || null, cargaAplicavel: form.cargaAplicavel || null, veiculoAplicavel: form.veiculoAplicavel || null, observacoes: form.observacoes || null }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar.')
      setItens((atuais) => [...atuais, data]); setForm(vazio); setFeedback({ message: 'Documento incluído.', tone: 'success' })
    } catch (error) { setFeedback({ message: error instanceof Error ? error.message : 'Falha ao salvar.', tone: 'error' }) }
    finally { setSalvando(false) }
  }
  const excluir = async (item: Item) => {
    setExcluindo(true)
    try {
      const response = await fetch(`/api/motoristas/${motorista.id}/conformidades/${item.id}`, { method: 'DELETE' })
      const data = await response.json(); if (!response.ok) return setFeedback({ message: data.erro || 'Falha ao excluir.', tone: 'error' })
      setItens((atuais) => atuais.filter((atual) => atual.id !== item.id)); setFeedback({ message: 'Documento removido.', tone: 'success' }); setItemExclusao(null)
    } finally { setExcluindo(false) }
  }
  const corSituacao = (situacao: Item['situacao']) => situacao === 'VENCIDO' ? semanticColors.danger : situacao === 'VENCE_EM_30_DIAS' ? semanticColors.warning : situacao === 'VALIDO' ? semanticColors.success : 'var(--foreground-muted)'

  return <><ActionConfirmDialog open={Boolean(itemExclusao)} title="Excluir documento" description={`O registro “${itemExclusao?.nome ?? ''}” será removido permanentemente do histórico do motorista.`} confirmLabel="Excluir documento" cancelLabel="Manter documento" loading={excluindo} onClose={() => { if (!excluindo) setItemExclusao(null) }} onConfirm={() => { if (itemExclusao) void excluir(itemExclusao) }}/><div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 sm:items-center sm:p-5"><div role="dialog" aria-modal="true" aria-labelledby="conformidade-title" className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto border p-5" style={{ backgroundColor: 'var(--background-secondary)', borderColor: primary }}><div className="flex items-start justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}><div><p className="text-[9px] font-black uppercase tracking-widest" style={{ color: primary }}>Conformidade do condutor</p><h2 id="conformidade-title" className="font-rajdhani text-2xl font-black uppercase">{motorista.nomeAbreviado}</h2><p className="mt-1 text-[10px] text-foreground-muted">Registre os requisitos definidos para a operação. A obrigatoriedade deve ser confirmada conforme carga, veículo, rota e legislação aplicável.</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }}><X size={17}/></button></div>
    {feedback && <div className="mt-4"><ActionFeedback message={feedback.message} tone={feedback.tone}/></div>}
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.05fr_1fr]"><form onSubmit={salvar} className="grid content-start gap-3 border p-4" style={{ borderColor: 'var(--border)' }}><h3 className="flex items-center gap-2 text-xs font-black uppercase"><Plus size={15} style={{ color: primary }}/> Novo documento</h3><Campo label="Tipo"><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo, nome: e.target.value === 'EXAME_TOXICOLOGICO' ? 'Exame toxicológico' : '' })} className="input-cronograma"><option value="CURSO">Curso / certificação</option><option value="EXAME_TOXICOLOGICO">Exame toxicológico</option></select></Campo>{form.tipo === 'CURSO' && <Campo label="Atalho de curso"><select value="" onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input-cronograma"><option value="">Escolher modelo</option>{cursos.map((curso) => <option key={curso}>{curso}</option>)}</select></Campo>}<Campo label="Nome"><input required minLength={3} maxLength={140} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input-cronograma" /></Campo><div className="grid gap-3 sm:grid-cols-2"><Campo label="Emissão"><input type="date" value={form.emitidoEm} onChange={(e) => setForm({ ...form, emitidoEm: e.target.value })} className="input-cronograma" /></Campo><Campo label="Validade"><input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="input-cronograma" /></Campo></div><Campo label="Número / registro"><input maxLength={80} value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="input-cronograma" /></Campo><div className="grid gap-3 sm:grid-cols-2"><Campo label="Carga aplicável"><input placeholder="Ex.: produtos perigosos" maxLength={140} value={form.cargaAplicavel} onChange={(e) => setForm({ ...form, cargaAplicavel: e.target.value })} className="input-cronograma" /></Campo><Campo label="Veículo aplicável"><input placeholder="Ex.: bitrem / container" maxLength={140} value={form.veiculoAplicavel} onChange={(e) => setForm({ ...form, veiculoAplicavel: e.target.value })} className="input-cronograma" /></Campo></div><label className="flex items-center gap-2 text-[10px]"><input type="checkbox" checked={form.obrigatorio} onChange={(e) => setForm({ ...form, obrigatorio: e.target.checked })}/> Requisito obrigatório para esta operação</label><Campo label="Observações"><textarea rows={3} maxLength={1000} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} className="input-cronograma resize-y" /></Campo><button disabled={salvando} className="interactive-control mt-1 min-h-10 px-4 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? 'Salvando...' : 'Adicionar documento'}</button></form>
      <section className="space-y-3"><h3 className="flex items-center gap-2 text-xs font-black uppercase"><ShieldCheck size={15} style={{ color: primary }}/> Situação documental</h3>{loading ? <DominoLoader label="Carregando conformidade" className="min-h-64"/> : itens.length === 0 ? <div className="border border-dashed p-10 text-center text-xs text-foreground-muted">Nenhum curso ou exame registrado.</div> : itens.map((item) => <article key={item.id} className="border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background)' }}><div className="flex items-start justify-between gap-3"><div><span className="flex items-center gap-1 text-[9px] font-black uppercase" style={{ color: primary }}>{item.tipo === 'CURSO' ? <Award size={13}/> : <FlaskConical size={13}/>} {item.tipo.replace('_', ' ')}</span><h4 className="mt-1 text-sm font-bold">{item.nome}</h4></div><button type="button" onClick={() => setItemExclusao(item)} aria-label={`Excluir ${item.nome}`} className="interactive-control p-2" style={{ color: semanticColors.danger }}><Trash2 size={14}/></button></div><div className="mt-3 grid gap-1 text-[10px] text-foreground-muted sm:grid-cols-2"><span>Validade: <strong style={{ color: corSituacao(item.situacao) }}>{item.validade ? new Date(`${item.validade}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem validade'}</strong></span><span>Situação: <strong style={{ color: corSituacao(item.situacao) }}>{item.situacao.replaceAll('_', ' ')}</strong></span>{item.cargaAplicavel && <span>Carga: <strong>{item.cargaAplicavel}</strong></span>}{item.veiculoAplicavel && <span>Veículo: <strong>{item.veiculoAplicavel}</strong></span>}<span>{item.obrigatorio ? 'Obrigatório na operação' : 'Complementar'}</span></div></article>)}</section></div></div></div></>
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{label}{children}</label> }
