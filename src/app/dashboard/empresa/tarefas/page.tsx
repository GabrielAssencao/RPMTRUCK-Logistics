'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Clock3, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'
type PrioridadeTarefa = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
type PerfilUsuario = 'GESTOR_EMPRESA' | 'GESTOR' | 'OPERADOR' | 'VISUALIZADOR'

interface UsuarioOption { id: string; nome: string; email: string; role: string }
interface Tarefa {
  id: string
  titulo: string
  descricao?: string | null
  prazo?: string | null
  prioridade: PrioridadeTarefa
  status: StatusTarefa
  modulo?: string | null
  responsavel: UsuarioOption
  criador: { id: string; nome: string }
  criado_em: string
}

const STATUS: StatusTarefa[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']

export default function TarefasPage() {
  const { primary } = useTheme()
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [filtro, setFiltro] = useState<'TODAS' | StatusTarefa>('TODAS')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [form, setForm] = useState({ titulo: '', descricao: '', prazo: '', prioridade: 'MEDIA' as PrioridadeTarefa, responsavelId: '' })

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const [tarefasResponse, perfilResponse] = await Promise.all([
        fetch('/api/tarefas', { cache: 'no-store' }),
        fetch('/api/empresa/perfil', { cache: 'no-store' }),
      ])
      const tarefasData = await tarefasResponse.json()
      if (!tarefasResponse.ok) throw new Error(tarefasData.erro || 'Não foi possível carregar tarefas.')
      setTarefas(Array.isArray(tarefasData) ? tarefasData : [])

      const perfilData = await perfilResponse.json()
      if (!perfilResponse.ok) throw new Error(perfilData.erro || 'Não foi possível identificar seu perfil.')
      const role = perfilData.usuario.role as PerfilUsuario
      setPerfil(role)

      if (role === 'GESTOR_EMPRESA' || role === 'GESTOR') {
        const usuariosResponse = await fetch('/api/empresa/usuarios', { cache: 'no-store' })
        if (!usuariosResponse.ok) throw new Error('Não foi possível carregar os responsáveis.')
        const usuariosData = await usuariosResponse.json()
        const lista = Array.isArray(usuariosData) ? usuariosData : []
        setUsuarios(lista)
        setForm(atual => ({ ...atual, responsavelId: atual.responsavelId || lista[0]?.id || '' }))
      } else {
        setUsuarios([])
      }
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao carregar tarefas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void carregar()) }, [carregar])

  const eGestor = perfil === 'GESTOR_EMPRESA' || perfil === 'GESTOR'
  const podeAtualizarStatus = eGestor || perfil === 'OPERADOR'

  const tarefasFiltradas = useMemo(
    () => tarefas.filter(tarefa => filtro === 'TODAS' || tarefa.status === filtro),
    [filtro, tarefas],
  )

  const criarTarefa = async (event: FormEvent) => {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      const response = await fetch('/api/tarefas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          prazo: form.prazo ? new Date(form.prazo).toISOString() : null,
          modulo: 'TAREFAS',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível delegar a tarefa.')
      setTarefas(atual => [data, ...atual])
      setForm(atual => ({ titulo: '', descricao: '', prazo: '', prioridade: 'MEDIA', responsavelId: atual.responsavelId }))
      setMostrarFormulario(false)
      setSucesso('Tarefa delegada e responsável notificado.')
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao delegar tarefa.')
    } finally {
      setSalvando(false)
    }
  }

  const atualizarStatus = async (tarefa: Tarefa, status: StatusTarefa) => {
    const response = await fetch(`/api/tarefas/${tarefa.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    const data = await response.json()
    if (!response.ok) return setErro(data.erro || 'Não foi possível atualizar a tarefa.')
    setTarefas(atual => atual.map(item => item.id === tarefa.id ? data : item))
    setSucesso('Status da tarefa atualizado.')
  }

  const excluir = async (tarefa: Tarefa) => {
    if (!window.confirm(`Excluir a tarefa "${tarefa.titulo}"?`)) return
    const response = await fetch(`/api/tarefas/${tarefa.id}`, { method: 'DELETE' })
    const data = await response.json()
    if (!response.ok) return setErro(data.erro || 'Não foi possível excluir a tarefa.')
    setTarefas(atual => atual.filter(item => item.id !== tarefa.id))
    setSucesso('Tarefa excluída.')
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 font-mono">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: primary }}>Operação</p>
          <h1 className="font-rajdhani text-3xl font-black uppercase">{eGestor ? 'Delegação de tarefas' : 'Minhas tarefas'}</h1>
          <p className="mt-1 text-sm text-foreground-muted">{eGestor ? 'Acompanhe responsáveis, prazos e andamento em um único lugar.' : 'Acompanhe somente as tarefas atribuídas a você.'}</p>
        </div>
        {eGestor && usuarios.length > 0 && (
          <button onClick={() => setMostrarFormulario(valor => !valor)} className="flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase text-black" style={{ backgroundColor: primary }}>
            <Plus size={15} /> Delegar tarefa
          </button>
        )}
      </div>

      {(erro || sucesso) && (
        <div role="status" className={`border p-3 text-sm ${erro ? 'border-red-500/30 text-red-500' : 'border-green-500/30 text-green-500'}`}>{erro || sucesso}</div>
      )}

      {eGestor && mostrarFormulario && (
        <form onSubmit={criarTarefa} className="grid gap-4 border p-5 md:grid-cols-2" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <Campo label="Título"><input required minLength={3} maxLength={160} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className="w-full border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></Campo>
          <Campo label="Responsável"><select required value={form.responsavelId} onChange={e => setForm({ ...form, responsavelId: e.target.value })} className="w-full border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }}>{usuarios.map(usuario => <option key={usuario.id} value={usuario.id}>{usuario.nome} — {usuario.role.replace('_', ' ')}</option>)}</select></Campo>
          <Campo label="Prazo"><input type="datetime-local" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} className="w-full border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></Campo>
          <Campo label="Prioridade"><select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value as PrioridadeTarefa })} className="w-full border bg-background p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }}>{(['BAIXA', 'MEDIA', 'ALTA', 'URGENTE'] as const).map(item => <option key={item}>{item}</option>)}</select></Campo>
          <div className="md:col-span-2"><Campo label="Descrição"><textarea rows={3} maxLength={2000} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="w-full resize-y border bg-transparent p-3 text-sm outline-none" style={{ borderColor: 'var(--border)' }} /></Campo></div>
          <div className="flex justify-end gap-3 md:col-span-2"><button type="button" onClick={() => setMostrarFormulario(false)} className="border px-5 py-2 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={salvando} className="px-5 py-2 text-xs font-black text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? 'Salvando...' : 'Delegar e notificar'}</button></div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(['TODAS', ...STATUS] as const).map(item => <button key={item} onClick={() => setFiltro(item)} className="border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: filtro === item ? primary : 'var(--border)', color: filtro === item ? primary : 'var(--foreground-muted)' }}>{item.replace('_', ' ')}</button>)}
        <button onClick={() => void carregar()} className="ml-auto border p-2" style={{ borderColor: 'var(--border)' }} aria-label="Atualizar tarefas"><RefreshCw size={15} /></button>
      </div>

      {loading ? <div className="py-16 text-center text-sm text-foreground-muted">Carregando tarefas...</div> : tarefasFiltradas.length === 0 ? (
        <div className="border border-dashed py-16 text-center" style={{ borderColor: 'var(--border)' }}><ClipboardList className="mx-auto mb-3 opacity-40" /><p className="text-sm font-bold">Nenhuma tarefa neste filtro</p><p className="mt-1 text-xs text-foreground-muted">Novas delegações aparecerão aqui e no sino de notificações.</p></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tarefasFiltradas.map(tarefa => (
            <article key={tarefa.id} className="border p-5" style={{ borderColor: tarefa.status === 'CONCLUIDA' ? '#22c55e55' : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex items-start justify-between gap-4"><div><span className="text-[9px] font-black uppercase tracking-widest" style={{ color: tarefa.prioridade === 'URGENTE' ? '#ef4444' : primary }}>{tarefa.prioridade}</span><h2 className="mt-1 font-bold">{tarefa.titulo}</h2></div>{eGestor && <button onClick={() => void excluir(tarefa)} className="p-1 text-red-500" aria-label="Excluir tarefa"><Trash2 size={15} /></button>}</div>
              {tarefa.descricao && <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{tarefa.descricao}</p>}
              <div className="mt-4 grid gap-2 text-xs text-foreground-muted sm:grid-cols-2">{eGestor && <span className="flex items-center gap-2"><UserRound size={13} /> {tarefa.responsavel.nome}</span>}<span className="flex items-center gap-2"><Clock3 size={13} /> {tarefa.prazo ? new Date(tarefa.prazo).toLocaleString('pt-BR') : 'Sem prazo'}</span></div>
              <div className="mt-4 flex items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}><CheckCircle2 size={15} style={{ color: primary }} />{podeAtualizarStatus ? <select value={tarefa.status} onChange={e => void atualizarStatus(tarefa, e.target.value as StatusTarefa)} className="flex-1 bg-background p-2 text-xs font-bold uppercase outline-none">{STATUS.map(item => <option key={item}>{item}</option>)}</select> : <span className="flex-1 p-2 text-xs font-bold uppercase">{tarefa.status.replace('_', ' ')}</span>}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}</span>{children}</label>
}
