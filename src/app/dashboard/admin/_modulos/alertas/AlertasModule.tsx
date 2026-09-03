'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type Usuario = { id: string; nome: string; email: string; role: string; empresa: { nome: string } | null }
type Alerta = { id: string; titulo: string; mensagem: string; severidade: 'INFORMACAO' | 'AVISO' | 'CRITICO'; ativo: boolean; inicio_em: string; fim_em: string | null; criado_em: string; destinatario: Usuario | null; criadoPor: { nome: string }; _count: { leituras: number } }
type FormState = { titulo: string; mensagem: string; severidade: Alerta['severidade']; ativo: boolean; inicioEm: string; fimEm: string; destinatarioId: string }

function paraInput(valor: string | Date) {
  const data = new Date(valor)
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const novoFormulario = (): FormState => ({ titulo: '', mensagem: '', severidade: 'INFORMACAO', ativo: true, inicioEm: paraInput(new Date()), fimEm: '', destinatarioId: '' })

export default function AlertasModule() {
  const { primary } = useTheme()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [form, setForm] = useState<FormState>(novoFormulario)
  const [editando, setEditando] = useState<string | null>(null)
  const [formAberto, setFormAberto] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/alertas', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível carregar os alertas.')
      setAlertas(body.alertas); setUsuarios(body.usuarios); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os alertas.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(initial)
  }, [carregar])

  const abrirNovo = () => { setEditando(null); setForm(novoFormulario()); setFormAberto(true); setError('') }
  const abrirEdicao = (alerta: Alerta) => {
    setEditando(alerta.id)
    setForm({ titulo: alerta.titulo, mensagem: alerta.mensagem, severidade: alerta.severidade, ativo: alerta.ativo, inicioEm: paraInput(alerta.inicio_em), fimEm: alerta.fim_em ? paraInput(alerta.fim_em) : '', destinatarioId: alerta.destinatario?.id || '' })
    setFormAberto(true); setError('')
  }

  const salvar = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('')
    try {
      const response = await fetch(editando ? `/api/admin/alertas/${editando}` : '/api/admin/alertas', {
        method: editando ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, inicioEm: new Date(form.inicioEm).toISOString(), fimEm: form.fimEm ? new Date(form.fimEm).toISOString() : null, destinatarioId: form.destinatarioId || null }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível salvar o alerta.')
      setFormAberto(false); setEditando(null); setForm(novoFormulario()); await carregar()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o alerta.') }
    finally { setSaving(false) }
  }

  const remover = async (alerta: Alerta) => {
    if (!window.confirm(`Excluir permanentemente o alerta “${alerta.titulo}”?`)) return
    const response = await fetch(`/api/admin/alertas/${alerta.id}`, { method: 'DELETE' })
    if (response.ok) { if (editando === alerta.id) setFormAberto(false); await carregar() }
    else { const body = await response.json(); setError(body.erro || 'Não foi possível excluir o alerta.') }
  }

  const agora = new Date()
  const estado = (alerta: Alerta) => !alerta.ativo ? 'Inativo' : new Date(alerta.inicio_em) > agora ? 'Agendado' : alerta.fim_em && new Date(alerta.fim_em) <= agora ? 'Encerrado' : 'Em exibição'

  return <div className="space-y-6">
    <div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div><p className="text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Comunicação da plataforma</p><h1 className="mt-1 text-2xl font-black font-rajdhani sm:text-3xl">ALERTAS DO SISTEMA</h1><p className="mt-1 text-sm text-foreground-muted">Publique avisos globais ou direcionados, com início e término programados.</p></div><div className="flex gap-2"><button type="button" onClick={() => void carregar()} disabled={loading} aria-label="Atualizar alertas" className="min-h-11 min-w-11 border p-3 disabled:opacity-50" style={{ borderColor: 'var(--border)' }}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button><button type="button" onClick={abrirNovo} className="flex min-h-11 items-center gap-2 px-4 text-xs font-black uppercase text-black" style={{ backgroundColor: primary }}><Plus size={16}/> Novo alerta</button></div></div>
    {error && <p role="alert" className="border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">{error}</p>}

    {formAberto && <form onSubmit={salvar} className="space-y-4 border p-4 sm:p-5" style={{ borderColor: primary, backgroundColor: 'var(--background-secondary)' }}><div className="flex items-center justify-between"><h2 className="text-sm font-black uppercase">{editando ? 'Editar alerta' : 'Novo alerta'}</h2><button type="button" onClick={() => setFormAberto(false)} aria-label="Fechar formulário" className="min-h-10 min-w-10 p-2"><X size={17}/></button></div><div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-xs font-bold">Título<input required minLength={3} maxLength={120} value={form.titulo} onChange={(e) => setForm({...form, titulo:e.target.value})} className="w-full border bg-transparent px-3 py-2.5 font-normal outline-none" style={{borderColor:'var(--border)'}}/></label>
      <label className="space-y-1 text-xs font-bold">Severidade<select value={form.severidade} onChange={(e) => setForm({...form, severidade:e.target.value as FormState['severidade']})} className="w-full border bg-[var(--background)] px-3 py-2.5 font-normal" style={{borderColor:'var(--border)'}}><option value="INFORMACAO">Informação</option><option value="AVISO">Aviso</option><option value="CRITICO">Crítico</option></select></label>
      <label className="space-y-1 text-xs font-bold md:col-span-2">Mensagem<textarea required minLength={3} maxLength={2000} rows={4} value={form.mensagem} onChange={(e) => setForm({...form, mensagem:e.target.value})} className="w-full resize-y border bg-transparent px-3 py-2.5 font-normal outline-none" style={{borderColor:'var(--border)'}}/></label>
      <label className="space-y-1 text-xs font-bold">Público<select value={form.destinatarioId} onChange={(e) => setForm({...form, destinatarioId:e.target.value})} className="w-full border bg-[var(--background)] px-3 py-2.5 font-normal" style={{borderColor:'var(--border)'}}><option value="">Todos os usuários</option>{usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.empresa?.nome || 'Sem empresa'} — {usuario.nome} ({usuario.email})</option>)}</select></label>
      <label className="space-y-1 text-xs font-bold">Início<input required type="datetime-local" value={form.inicioEm} onChange={(e) => setForm({...form, inicioEm:e.target.value})} className="w-full border bg-transparent px-3 py-2.5 font-normal" style={{borderColor:'var(--border)'}}/></label>
      <label className="space-y-1 text-xs font-bold">Término opcional<input type="datetime-local" min={form.inicioEm} value={form.fimEm} onChange={(e) => setForm({...form, fimEm:e.target.value})} className="w-full border bg-transparent px-3 py-2.5 font-normal" style={{borderColor:'var(--border)'}}/></label>
      <label className="flex items-center gap-2 self-end py-2 text-xs font-bold"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({...form, ativo:e.target.checked})} style={{accentColor:primary}}/> Alerta ativo</label>
    </div><div className="flex justify-end gap-2"><button type="button" onClick={() => setFormAberto(false)} className="min-h-11 border px-4 text-xs font-bold uppercase" style={{borderColor:'var(--border)'}}>Cancelar</button><button disabled={saving} className="min-h-11 px-5 text-xs font-black uppercase text-black disabled:opacity-50" style={{backgroundColor:primary}}>{saving ? 'Salvando...' : 'Salvar alerta'}</button></div></form>}

    <div className="space-y-3">{loading && alertas.length === 0 ? <p className="border p-8 text-center text-xs text-foreground-muted" style={{borderColor:'var(--border)'}}>Carregando alertas...</p> : alertas.length === 0 ? <div className="border p-10 text-center" style={{borderColor:'var(--border)'}}><AlertTriangle className="mx-auto mb-3 opacity-30"/><p className="text-sm font-bold">Nenhum alerta configurado</p><p className="mt-1 text-xs text-foreground-muted">Crie um aviso de manutenção, alteração de valores ou comunicado geral.</p></div> : alertas.map((alerta) => <article key={alerta.id} className="border p-4" style={{borderColor:'var(--border)', backgroundColor:'var(--background-secondary)'}}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-words text-sm font-black uppercase">{alerta.titulo}</h2><span className="border px-2 py-0.5 text-[9px] font-bold uppercase" style={{borderColor: alerta.severidade === 'CRITICO' ? 'var(--status-danger)' : alerta.severidade === 'AVISO' ? 'var(--status-warning)' : primary}}>{alerta.severidade}</span><span className="text-[9px] font-bold uppercase text-foreground-muted">{estado(alerta)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground-muted">{alerta.mensagem}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9px] uppercase tracking-wider text-foreground-muted"><span>Público: {alerta.destinatario ? `${alerta.destinatario.nome} · ${alerta.destinatario.empresa?.nome || alerta.destinatario.email}` : 'Todos os usuários'}</span><span>Início: {new Date(alerta.inicio_em).toLocaleString('pt-BR')}</span>{alerta.fim_em && <span>Fim: {new Date(alerta.fim_em).toLocaleString('pt-BR')}</span>}<span>Leituras: {alerta._count.leituras}</span></div></div><div className="flex shrink-0 gap-2"><button type="button" onClick={() => abrirEdicao(alerta)} aria-label={`Editar ${alerta.titulo}`} className="min-h-10 min-w-10 border p-2" style={{borderColor:'var(--border)'}}><Pencil size={15}/></button><button type="button" onClick={() => void remover(alerta)} aria-label={`Excluir ${alerta.titulo}`} className="min-h-10 min-w-10 border border-red-500/40 p-2 text-red-500"><Trash2 size={15}/></button></div></div></article>)}</div>
  </div>
}
