'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BellRing, Check, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, RotateCcw, StickyNote, Trash2, X } from 'lucide-react'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { DominoLoader } from '@/components/motion/OperationalFeedback'
import { useTheme } from '@/contexts/ThemeContext'
import { NOTIFICACOES_ATUALIZADAS_EVENT } from '@/hooks/useNotificacoes'
import { BrazilianDateTimePicker } from '@/components/cronograma/BrazilianDateTimePicker'
import { anteriorAoMinutoDaReferencia, formatarDataHoraBrasil } from '@/lib/dataHoraOperacional'

export type UrgenciaLembrete = 'LEVE' | 'MEDIA' | 'ALTA'
type ModoNotificacao = 'AUTOMATICA' | 'PERSONALIZADA'

export interface LembretePessoal {
  id: string
  titulo: string
  descricao?: string | null
  dataHora: string
  urgencia: UrgenciaLembrete
  modoNotificacao: ModoNotificacao
  notificarEm: string
  notificacaoEm?: string | null
  concluido: boolean
  ordem: number
  criado_em: string
}

interface FormLembrete {
  titulo: string
  descricao: string
  data: string
  hora: string
  urgencia: UrgenciaLembrete
  modoNotificacao: ModoNotificacao
  dataNotificacao: string
  horaNotificacao: string
}

const ANTECEDENCIA: Record<UrgenciaLembrete, string> = {
  LEVE: '3 dias antes',
  MEDIA: '3 dias antes',
  ALTA: '5 dias antes',
}

const ITENS_POR_PAGINA = 24

function formVazio(): FormLembrete {
  const [data = '', hora = ''] = formatarDataHoraBrasil().split(' ')
  return {
    titulo: '',
    descricao: '',
    data,
    hora,
    urgencia: 'MEDIA',
    modoNotificacao: 'AUTOMATICA',
    dataNotificacao: '',
    horaNotificacao: hora,
  }
}

function paraDataBrasil(valor: string) {
  return new Date(valor).toLocaleDateString('pt-BR')
}

function paraHoraBrasil(valor: string) {
  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function paraCamposBrasil(valor: string) {
  const data = new Date(valor)
  return {
    data: data.toLocaleDateString('pt-BR'),
    hora: data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function paraIsoBrasil(dataTexto: string, horaTexto: string) {
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataTexto)
  if (!correspondencia || !/^\d{2}:\d{2}$/.test(horaTexto)) throw new Error('Informe data e hora no formato brasileiro.')
  const [, dia, mes, ano] = correspondencia
  const [hora, minuto] = horaTexto.split(':').map(Number)
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia), hora, minuto)
  if (
    data.getFullYear() !== Number(ano)
    || data.getMonth() !== Number(mes) - 1
    || data.getDate() !== Number(dia)
    || hora > 23
    || minuto > 59
  ) throw new Error('Informe uma data e hora válidas.')
  return data.toISOString()
}

export function LembretesPessoaisBoard({
  active,
  onChange,
  createRequest = 0,
  showCreateAction = true,
}: {
  active: boolean
  onChange: (lembretes: LembretePessoal[]) => void
  createRequest?: number
  showCreateAction?: boolean
}) {
  const { primary, semanticColors } = useTheme()
  const reduzirMovimento = useReducedMotion()
  const [lembretes, setLembretes] = useState<LembretePessoal[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [editorAberto, setEditorAberto] = useState(false)
  const [editando, setEditando] = useState<LembretePessoal | null>(null)
  const [exclusao, setExclusao] = useState<LembretePessoal | null>(null)
  const [form, setForm] = useState<FormLembrete>(() => formVazio())
  const [pagina, setPagina] = useState(1)
  const ultimoPedidoCriacao = useRef(createRequest)

  const atualizarLista = useCallback((novaLista: LembretePessoal[]) => {
    setLembretes(novaLista)
    onChange(novaLista)
  }, [onChange])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/lembretes-pessoais', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar seus lembretes.')
      atualizarLista(Array.isArray(data) ? data : [])
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao carregar lembretes.')
    } finally {
      setLoading(false)
    }
  }, [atualizarLista])

  useEffect(() => { queueMicrotask(() => void carregar()) }, [carregar])

  const abrirCriacao = useCallback(() => {
    setEditando(null)
    setForm(formVazio())
    setEditorAberto(true)
  }, [])

  useEffect(() => {
    if (createRequest === ultimoPedidoCriacao.current) return
    ultimoPedidoCriacao.current = createRequest
    queueMicrotask(abrirCriacao)
  }, [abrirCriacao, createRequest])

  const abrirEdicao = (lembrete: LembretePessoal) => {
    const evento = paraCamposBrasil(lembrete.dataHora)
    const notificacao = paraCamposBrasil(lembrete.notificarEm)
    setEditando(lembrete)
    setForm({
      titulo: lembrete.titulo,
      descricao: lembrete.descricao ?? '',
      data: evento.data,
      hora: evento.hora,
      urgencia: lembrete.urgencia,
      modoNotificacao: lembrete.modoNotificacao,
      dataNotificacao: notificacao.data,
      horaNotificacao: notificacao.hora,
    })
    setEditorAberto(true)
  }

  const salvar = async (event: FormEvent) => {
    event.preventDefault()
    if (salvando) return
    setSalvando(true)
    setErro('')
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        dataHora: paraIsoBrasil(form.data, form.hora),
        urgencia: form.urgencia,
        modoNotificacao: form.modoNotificacao,
        notificarEm: form.modoNotificacao === 'PERSONALIZADA'
          ? paraIsoBrasil(form.dataNotificacao, form.horaNotificacao)
          : null,
      }
      if (!editando && anteriorAoMinutoDaReferencia(new Date(payload.dataHora))) {
        throw new Error('O lembrete não pode ser agendado antes do momento do cadastro.')
      }
      const response = await fetch(editando ? `/api/lembretes-pessoais/${editando.id}` : '/api/lembretes-pessoais', {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar o lembrete.')
      atualizarLista(editando
        ? lembretes.map((item) => item.id === data.id ? data : item)
        : [...lembretes, data])
      if (!editando) {
        const totalAtivos = lembretes.filter((item) => !item.concluido).length + 1
        setPagina(Math.max(1, Math.ceil(totalAtivos / ITENS_POR_PAGINA)))
      }
      setEditorAberto(false)
      setSucesso(editando ? 'Lembrete atualizado.' : 'Post-it criado no seu quadro pessoal.')
      window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao salvar o lembrete.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarConcluido = async (lembrete: LembretePessoal) => {
    if (salvando) return
    setSalvando(true)
    setErro('')
    try {
      const response = await fetch(`/api/lembretes-pessoais/${lembrete.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concluido: !lembrete.concluido }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível atualizar o lembrete.')
      atualizarLista(lembretes.map((item) => item.id === data.id ? data : item))
      setSucesso(data.concluido ? 'Lembrete concluído.' : 'Lembrete reaberto.')
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao atualizar o lembrete.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    if (!exclusao || salvando) return
    setSalvando(true)
    try {
      const response = await fetch(`/api/lembretes-pessoais/${exclusao.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível excluir o lembrete.')
      atualizarLista(lembretes.filter((item) => item.id !== exclusao.id))
      setExclusao(null)
      setSucesso('Lembrete e suas notificações foram excluídos.')
      window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao excluir o lembrete.')
    } finally {
      setSalvando(false)
    }
  }

  const todosVisiveis = lembretes.filter((lembrete) => lembrete.concluido === mostrarConcluidos)
  const totalPaginas = Math.max(1, Math.ceil(todosVisiveis.length / ITENS_POR_PAGINA))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const visiveis = todosVisiveis.slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA)

  useEffect(() => {
    if (pagina > totalPaginas) queueMicrotask(() => setPagina(totalPaginas))
  }, [pagina, totalPaginas])

  return (
    <>
      <section hidden={!active} aria-label="Quadro de lembretes pessoais">
      <div className="mb-4 flex flex-col gap-3 border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: primary }}>Organização pessoal</p>
          <h2 className="mt-1 font-rajdhani text-xl font-black uppercase">Meu quadro de lembretes</h2>
          <p className="mt-1 text-[10px] text-foreground-muted">Somente você pode visualizar, editar e excluir estes post-its. {todosVisiveis.length} nesta visualização.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setMostrarConcluidos((valor) => !valor); setPagina(1) }} className="interactive-control flex min-h-10 items-center gap-2 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}>
            {mostrarConcluidos ? <RotateCcw size={14} /> : <Check size={14} />} {mostrarConcluidos ? 'Ver ativos' : 'Ver concluídos'}
          </button>
          {showCreateAction && (
            <button type="button" onClick={abrirCriacao} className="interactive-control flex min-h-10 items-center gap-2 px-4 text-[10px] font-black uppercase text-black" style={{ backgroundColor: primary }}>
              <Plus size={15} /> Novo lembrete
            </button>
          )}
        </div>
      </div>

      {(erro || sucesso) && <div className="mb-4"><ActionFeedback message={erro || sucesso} tone={erro ? 'error' : 'success'} /></div>}

      {loading ? <DominoLoader label="Organizando seus post-its" className="min-h-[420px]" /> : (
        <div className="min-h-[520px] border p-5 sm:p-7" style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--background-secondary) 88%, var(--primary) 12%)' }}>
          <div className="grid auto-rows-fr gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <AnimatePresence initial={false}>
              {visiveis.map((lembrete, indice) => {
                const cor = lembrete.urgencia === 'ALTA' ? semanticColors.danger : lembrete.urgencia === 'MEDIA' ? semanticColors.warning : primary
                return (
                  <motion.article
                    layout
                    key={lembrete.id}
                    initial={reduzirMovimento ? false : { opacity: 0, y: 12, rotate: indice % 2 ? 0.8 : -0.8 }}
                    animate={{ opacity: 1, y: 0, rotate: indice % 2 ? 0.4 : -0.4 }}
                    exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: reduzirMovimento ? 0 : 0.26, delay: reduzirMovimento ? 0 : Math.min(indice * 0.03, 0.18), ease: [0.2, 0, 0, 1] }}
                    className="group relative flex min-h-52 flex-col border p-5 shadow-xl"
                    style={{ borderColor: `${cor}88`, background: `linear-gradient(145deg, color-mix(in srgb, ${cor} 26%, #17150f), color-mix(in srgb, ${cor} 11%, #0f0f0d))` }}
                  >
                    <span className="absolute left-1/2 top-0 h-2.5 w-20 -translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: `${cor}99`, boxShadow: `0 3px 12px ${cor}44` }} aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: cor }}><StickyNote size={13} /> {lembrete.urgencia}</span>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button type="button" onClick={() => abrirEdicao(lembrete)} className="interactive-control p-1.5" aria-label={`Editar ${lembrete.titulo}`}><Pencil size={13} /></button>
                        <button type="button" onClick={() => setExclusao(lembrete)} className="interactive-control p-1.5" style={{ color: semanticColors.danger }} aria-label={`Excluir ${lembrete.titulo}`}><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <h3 className="mt-4 break-words font-rajdhani text-lg font-black leading-5">{lembrete.titulo}</h3>
                    {lembrete.descricao && <p className="mt-2 line-clamp-4 text-[10px] leading-4 text-foreground-muted">{lembrete.descricao}</p>}
                    <div className="mt-auto space-y-2 border-t pt-4 text-[9px]" style={{ borderColor: `${cor}55` }}>
                      <span className="flex items-center gap-2"><Clock3 size={12} /> {paraDataBrasil(lembrete.dataHora)} às {paraHoraBrasil(lembrete.dataHora)}</span>
                      <span className="flex items-center gap-2 text-foreground-muted"><BellRing size={12} /> {lembrete.modoNotificacao === 'AUTOMATICA' ? ANTECEDENCIA[lembrete.urgencia] : `${paraDataBrasil(lembrete.notificarEm)} às ${paraHoraBrasil(lembrete.notificarEm)}`}</span>
                    </div>
                    <button type="button" disabled={salvando} onClick={() => void alternarConcluido(lembrete)} className="interactive-control mt-4 min-h-9 border px-3 text-[9px] font-black uppercase disabled:opacity-50" style={{ borderColor: `${cor}77` }}>
                      {lembrete.concluido ? 'Reabrir lembrete' : 'Marcar como concluído'}
                    </button>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
          {visiveis.length === 0 && <div className="flex min-h-[400px] flex-col items-center justify-center text-center text-foreground-muted"><StickyNote size={32} /><strong className="mt-3 text-xs uppercase">Nenhum lembrete {mostrarConcluidos ? 'concluído' : 'ativo'}</strong><span className="mt-1 text-[10px]">Crie um post-it para organizar seus compromissos.</span></div>}
          {totalPaginas > 1 && (
            <nav className="mt-6 flex items-center justify-center gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }} aria-label="Paginação dos lembretes">
              <button type="button" disabled={paginaAtual === 1} onClick={() => setPagina((atual) => Math.max(1, atual - 1))} className="interactive-control grid min-h-10 min-w-10 place-items-center border disabled:opacity-35" style={{ borderColor: 'var(--border)' }} aria-label="Página anterior"><ChevronLeft size={16} /></button>
              <span className="text-[10px] font-bold uppercase text-foreground-muted">Página {paginaAtual} de {totalPaginas}</span>
              <button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina((atual) => Math.min(totalPaginas, atual + 1))} className="interactive-control grid min-h-10 min-w-10 place-items-center border disabled:opacity-35" style={{ borderColor: 'var(--border)' }} aria-label="Próxima página"><ChevronRight size={16} /></button>
            </nav>
          )}
        </div>
      )}

      </section>

      <AnimatePresence>
        {editorAberto && (
          <motion.div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="titulo-editor-lembrete" initial={reduzirMovimento ? false : { opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} transition={{ duration: reduzirMovimento ? 0 : 0.3, ease: [0.2, 0, 0, 1] }} className="modal-cronograma max-h-[88dvh] w-full max-w-xl overflow-y-auto border p-4 sm:p-5" style={{ borderColor: primary, backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex items-start justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}><div><p className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: primary }}>Post-it pessoal</p><h2 id="titulo-editor-lembrete" className="mt-1 font-rajdhani text-xl font-black uppercase">{editando ? 'Editar lembrete' : 'Novo lembrete'}</h2></div><button type="button" onClick={() => setEditorAberto(false)} className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }} aria-label="Fechar"><X size={16} /></button></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Campo label="Título" className="sm:col-span-2"><input autoFocus required minLength={3} maxLength={120} value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} className="input-cronograma" /></Campo>
                <Campo label="Data e horário" className="sm:col-span-2"><BrazilianDateTimePicker required horarioPadrao="09:00" value={form.data ? `${form.data} ${form.hora}` : ''} onChange={(valor) => { const [data = '', hora = ''] = valor.split(' '); setForm({ ...form, data, hora }) }} /></Campo>
                <Campo label="Urgência"><select value={form.urgencia} onChange={(event) => setForm({ ...form, urgencia: event.target.value as UrgenciaLembrete })} className="input-cronograma"><option value="LEVE">Leve — aviso 3 dias antes</option><option value="MEDIA">Médio — aviso 3 dias antes</option><option value="ALTA">Alto — aviso 5 dias antes</option></select></Campo>
                <Campo label="Regra da notificação"><select value={form.modoNotificacao} onChange={(event) => setForm({ ...form, modoNotificacao: event.target.value as ModoNotificacao })} className="input-cronograma"><option value="AUTOMATICA">Automática pela urgência</option><option value="PERSONALIZADA">Escolher data e hora</option></select></Campo>
                {form.modoNotificacao === 'PERSONALIZADA' && <Campo label="Data e horário da notificação" className="sm:col-span-2"><BrazilianDateTimePicker required horarioPadrao="09:00" value={form.dataNotificacao ? `${form.dataNotificacao} ${form.horaNotificacao}` : ''} onChange={(valor) => { const [dataNotificacao = '', horaNotificacao = ''] = valor.split(' '); setForm({ ...form, dataNotificacao, horaNotificacao }) }} /></Campo>}
                <Campo label="Anotação" className="sm:col-span-2"><textarea rows={3} maxLength={1000} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className="input-cronograma resize-y" /></Campo>
              </div>
              <div className="mt-4 flex flex-col-reverse justify-end gap-2 border-t pt-3 sm:flex-row" style={{ borderColor: 'var(--border)' }}><button type="button" disabled={salvando} onClick={() => setEditorAberto(false)} className="interactive-control min-h-10 border px-4 text-xs font-bold" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={salvando} className="interactive-control min-h-10 px-4 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? 'Salvando...' : 'Fixar no quadro'}</button></div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <ActionConfirmDialog open={Boolean(exclusao)} title="Excluir lembrete" description={`O lembrete “${exclusao?.titulo ?? ''}” e suas notificações vinculadas serão excluídos permanentemente.`} confirmLabel="Excluir lembrete" cancelLabel="Manter lembrete" loading={salvando} onClose={() => { if (!salvando) setExclusao(null) }} onConfirm={() => void excluir()} />
    </>
  )
}

function Campo({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid gap-1.5 text-[9px] font-bold uppercase tracking-wider text-foreground-muted ${className}`}>{label}{children}</label>
}
