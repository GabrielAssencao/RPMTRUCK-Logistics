'use client'

import {
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BellRing,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GripVertical,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { ActionFeedback } from '@/components/motion/DashboardMotion'
import { DominoLoader } from '@/components/motion/OperationalFeedback'
import { ActionConfirmDialog } from '@/components/dashboard/ActionConfirmDialog'
import { sinalizarAtualizacaoDashboardEmpresa } from '@/lib/dashboardEvents'
import { NOTIFICACOES_ATUALIZADAS_EVENT } from '@/hooks/useNotificacoes'
import { LembretesPessoaisBoard, type LembretePessoal } from '@/components/cronograma/LembretesPessoaisBoard'
import { BrazilianDateTimePicker } from '@/components/cronograma/BrazilianDateTimePicker'
import { anteriorAoMinutoDaReferencia, formatarDataHoraBrasil } from '@/lib/dataHoraOperacional'
import { calcularNotificacaoTarefa, DIAS_ANTECEDENCIA_TAREFA, type ModoNotificacaoTarefa } from '@/lib/tarefaNotificacao'

import CronogramaPessoal from '@/components/cronograma/CronogramaPessoal'

type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA'
type PrioridadeTarefa = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE'
type PerfilUsuario = 'GESTOR_EMPRESA' | 'GESTOR' | 'OPERADOR' | 'VISUALIZADOR'
type Visualizacao = 'QUADRO' | 'LEMBRETES' | 'CALENDARIO'
type FiltroPeriodo = 'TODAS' | 'ATRASADAS' | 'HOJE' | '7_DIAS' | 'SEM_DATA'

interface UsuarioOption {
  id: string
  nome: string
  email: string
  role: string
}

interface Tarefa {
  id: string
  titulo: string
  descricao?: string | null
  prazo?: string | null
  inicio?: string | null
  duracaoMinutos?: number | null
  exibirCalendario: boolean
  diaInteiro: boolean
  lembreteEm?: string | null
  modoNotificacao: ModoNotificacaoTarefa
  prioridade: PrioridadeTarefa
  status: StatusTarefa
  ordem: number
  modulo?: string | null
  responsavel: UsuarioOption
  criador: { id: string; nome: string }
  criado_em: string
}

interface FormTarefa {
  titulo: string
  descricao: string
  inicio: string
  prazo: string
  modoNotificacao: ModoNotificacaoTarefa
  notificarEm: string
  prioridade: PrioridadeTarefa
  responsavelId: string
  exibirCalendario: boolean
  diaInteiro: boolean
}

const STATUS: StatusTarefa[] = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA']
const PRIORIDADES: PrioridadeTarefa[] = ['BAIXA', 'MEDIA', 'ALTA', 'URGENTE']
const PRIORIDADES_NOVAS: PrioridadeTarefa[] = ['BAIXA', 'MEDIA', 'ALTA']
const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const STATUS_INFO: Record<StatusTarefa, { titulo: string; descricao: string }> = {
  PENDENTE: { titulo: 'Pendente', descricao: 'Aguardando início' },
  EM_ANDAMENTO: { titulo: 'Em andamento', descricao: 'Execução ativa' },
  CONCLUIDA: { titulo: 'Concluída', descricao: 'Entregas finalizadas' },
  CANCELADA: { titulo: 'Cancelada', descricao: 'Itens interrompidos' },
}

function formVazio(responsavelId = ''): FormTarefa {
  return {
    titulo: '',
    descricao: '',
    inicio: formatarDataHoraBrasil(),
    prazo: '',
    modoNotificacao: 'AUTOMATICA',
    notificarEm: '',
    prioridade: 'MEDIA',
    responsavelId,
    exibirCalendario: true,
    diaInteiro: false,
  }
}

function paraInputData(valor?: string | null, somenteData = false) {
  if (!valor) return ''
  const data = new Date(valor)
  return `${data.toLocaleDateString('pt-BR')}${somenteData ? '' : ` ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}`
}

function paraIsoOuNull(valor: string, somenteData = false) {
  if (!valor) return null
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/.exec(valor)
  if (!correspondencia) throw new Error('Informe as datas no formato DD/MM/AAAA e preencha o horário.')
  const [, dia, mes, ano, horaInformada, minutoInformado] = correspondencia
  const hora = somenteData ? '12' : horaInformada
  const minuto = somenteData ? '00' : minutoInformado
  if (!hora || !minuto) throw new Error('Preencha o horário ou marque a opção de dia inteiro.')
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto))
  if (
    data.getFullYear() !== Number(ano)
    || data.getMonth() !== Number(mes) - 1
    || data.getDate() !== Number(dia)
    || Number(hora) > 23
    || Number(minuto) > 59
  ) throw new Error('Informe uma data e hora válidas.')
  return data.toISOString()
}

function nomePrioridade(prioridade: PrioridadeTarefa) {
  if (prioridade === 'BAIXA') return 'Leve'
  if (prioridade === 'MEDIA') return 'Média'
  if (prioridade === 'ALTA') return 'Alta'
  return 'Urgente (legado)'
}

function resumoNotificacao(form: FormTarefa) {
  if (form.modoNotificacao === 'PERSONALIZADA') {
    return form.notificarEm ? `Aviso escolhido para ${form.notificarEm}.` : 'Escolha a data e o horário do aviso.'
  }
  const referencia = form.prazo || form.inicio
  if (!referencia) return 'Informe o prazo ou o início para programar o aviso automático.'
  try {
    const data = calcularNotificacaoTarefa({
      inicio: form.inicio ? new Date(paraIsoOuNull(form.inicio, form.diaInteiro)!) : null,
      prazo: form.prazo ? new Date(paraIsoOuNull(form.prazo, form.diaInteiro)!) : null,
      prioridade: form.prioridade,
      modo: 'AUTOMATICA',
    })
    const antecedencia = DIAS_ANTECEDENCIA_TAREFA[form.prioridade]
    if (!data) return 'Informe o prazo ou o início para programar o aviso automático.'
    const quando = form.diaInteiro ? data.toLocaleDateString('pt-BR') : data.toLocaleString('pt-BR')
    return `Aviso ${antecedencia} dias antes, em ${quando}. O prazo é usado primeiro; sem ele, vale o início.`
  } catch {
    return 'Complete a data para visualizar quando a notificação será enviada.'
  }
}

function chaveDia(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function dataPrincipal(tarefa: Tarefa) {
  const valor = tarefa.inicio ?? tarefa.prazo
  return valor ? new Date(valor) : null
}

function tarefaAtrasada(tarefa: Tarefa, agora = new Date()) {
  if (!tarefa.prazo || ['CONCLUIDA', 'CANCELADA'].includes(tarefa.status)) return false
  const prazo = new Date(tarefa.prazo)
  return tarefa.diaInteiro ? chaveDia(prazo) < chaveDia(agora) : prazo < agora
}

function ordemEntre(anterior: number | undefined, proxima: number | undefined) {
  if (anterior === undefined && proxima === undefined) return 1000
  if (anterior === undefined) return Math.max(0, Math.floor((proxima ?? 1000) / 2))
  if (proxima === undefined) return Math.min(anterior + 1000, 1_000_000_000)
  return Math.max(0, Math.floor((anterior + proxima) / 2))
}

export default function TarefasPage() {
  const { primary, semanticColors } = useTheme()
  const reduzirMovimento = useReducedMotion()
  const [somenteLembretes, setSomenteLembretes] = useState(false)
  const [tarefas, setTarefas] = useState<Tarefa[]>([])
  const [lembretesPessoais, setLembretesPessoais] = useState<LembretePessoal[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [visualizacao, setVisualizacao] = useState<Visualizacao>('QUADRO')
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'TODAS' | StatusTarefa>('TODAS')
  const [filtroPrioridade, setFiltroPrioridade] = useState<'TODAS' | PrioridadeTarefa>('TODAS')
  const [filtroResponsavel, setFiltroResponsavel] = useState('TODOS')
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>('TODAS')
  const [editorAberto, setEditorAberto] = useState(false)
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null)
  const [form, setForm] = useState<FormTarefa>(() => formVazio())
  const [exclusao, setExclusao] = useState<Tarefa | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [mesAtual, setMesAtual] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [pedidoNovoLembrete, setPedidoNovoLembrete] = useState(0)
  const aoAtualizarLembretes = useCallback((lembretes: LembretePessoal[]) => setLembretesPessoais(lembretes), [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const perfilResponse = await fetch('/api/empresa/perfil', { cache: 'no-store' })
      const perfilData = await perfilResponse.json()
      if (!perfilResponse.ok) throw new Error(perfilData.erro || 'Não foi possível identificar seu perfil.')
      const role = perfilData.usuario.role as PerfilUsuario
      setPerfil(role)
      const pessoal = perfilData.empresa.permissoes.telaTarefas === false
      setSomenteLembretes(pessoal)
      if (pessoal) {
        setTarefas([])
        setUsuarios([])
        return
      }
      const tarefasResponse = await fetch('/api/tarefas', { cache: 'no-store' })
      const tarefasData = await tarefasResponse.json()
      if (!tarefasResponse.ok) throw new Error(tarefasData.erro || 'Não foi possível carregar o cronograma.')
      setTarefas(Array.isArray(tarefasData) ? tarefasData : [])

      if (role === 'GESTOR_EMPRESA' || role === 'GESTOR') {
        const usuariosResponse = await fetch('/api/empresa/usuarios', { cache: 'no-store' })
        if (!usuariosResponse.ok) throw new Error('Não foi possível carregar os responsáveis.')
        const usuariosData = await usuariosResponse.json()
        const lista = Array.isArray(usuariosData) ? usuariosData : []
        setUsuarios(lista)
        setForm((atual) => ({ ...atual, responsavelId: atual.responsavelId || lista[0]?.id || '' }))
      } else {
        setUsuarios([])
      }
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao carregar o cronograma.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { queueMicrotask(() => void carregar()) }, [carregar])

  const eGestor = perfil === 'GESTOR_EMPRESA' || perfil === 'GESTOR'
  const podeAtualizarStatus = eGestor || perfil === 'OPERADOR'
  const podeCriarTarefa = eGestor && usuarios.length > 0
  const podeCriarLembrete = Boolean(perfil && perfil !== 'VISUALIZADOR')

  const tarefasFiltradas = useMemo(() => {
    const agora = new Date()
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)
    const seteDias = new Date(hoje)
    seteDias.setDate(seteDias.getDate() + 8)
    const termo = busca.trim().toLocaleLowerCase('pt-BR')

    return tarefas.filter((tarefa) => {
      if (termo && !`${tarefa.titulo} ${tarefa.descricao ?? ''} ${tarefa.responsavel.nome}`.toLocaleLowerCase('pt-BR').includes(termo)) return false
      if (filtroStatus !== 'TODAS' && tarefa.status !== filtroStatus) return false
      if (filtroPrioridade !== 'TODAS' && tarefa.prioridade !== filtroPrioridade) return false
      if (filtroResponsavel !== 'TODOS' && tarefa.responsavel.id !== filtroResponsavel) return false
      const data = dataPrincipal(tarefa)
      if (filtroPeriodo === 'SEM_DATA') return !data
      if (filtroPeriodo === 'HOJE') return Boolean(data && data >= hoje && data < amanha)
      if (filtroPeriodo === '7_DIAS') return Boolean(data && data >= hoje && data < seteDias)
      if (filtroPeriodo === 'ATRASADAS') return Boolean(
        tarefaAtrasada(tarefa, agora),
      )
      return true
    })
  }, [busca, filtroPeriodo, filtroPrioridade, filtroResponsavel, filtroStatus, tarefas])

  const tarefasPorStatus = useMemo(() => Object.fromEntries(
    STATUS.map((status) => [status, tarefasFiltradas
      .filter((tarefa) => tarefa.status === status)
      .sort((a, b) => a.ordem - b.ordem || a.criado_em.localeCompare(b.criado_em))]),
  ) as Record<StatusTarefa, Tarefa[]>, [tarefasFiltradas])

  const diasCalendario = useMemo(() => {
    const primeiro = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1)
    primeiro.setDate(primeiro.getDate() - primeiro.getDay())
    return Array.from({ length: 42 }, (_, indice) => {
      const data = new Date(primeiro)
      data.setDate(primeiro.getDate() + indice)
      return data
    })
  }, [mesAtual])

  const tarefasCalendario = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>()
    for (const tarefa of tarefasFiltradas) {
      if (!tarefa.exibirCalendario) continue
      const data = dataPrincipal(tarefa)
      if (!data) continue
      const chave = chaveDia(data)
      mapa.set(chave, [...(mapa.get(chave) ?? []), tarefa])
    }
    return mapa
  }, [tarefasFiltradas])

  const lembretesCalendario = useMemo(() => {
    const mapa = new Map<string, LembretePessoal[]>()
    for (const lembrete of lembretesPessoais) {
      if (lembrete.concluido) continue
      const chave = chaveDia(new Date(lembrete.dataHora))
      mapa.set(chave, [...(mapa.get(chave) ?? []), lembrete])
    }
    return mapa
  }, [lembretesPessoais])

  const abrirCriacao = () => {
    setTarefaEditando(null)
    setForm(formVazio(usuarios[0]?.id ?? ''))
    setEditorAberto(true)
  }

  const abrirEdicao = (tarefa: Tarefa) => {
    setTarefaEditando(tarefa)
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao ?? '',
      inicio: paraInputData(tarefa.inicio, tarefa.diaInteiro),
      prazo: paraInputData(tarefa.prazo, tarefa.diaInteiro),
      modoNotificacao: tarefa.modoNotificacao ?? 'AUTOMATICA',
      notificarEm: tarefa.modoNotificacao === 'PERSONALIZADA' ? paraInputData(tarefa.lembreteEm) : '',
      prioridade: tarefa.prioridade,
      responsavelId: tarefa.responsavel.id,
      exibirCalendario: tarefa.exibirCalendario,
      diaInteiro: tarefa.diaInteiro,
    })
    setEditorAberto(true)
  }

  const salvarTarefa = async (event: FormEvent) => {
    event.preventDefault()
    if (salvando) return
    setSalvando(true)
    setErro('')
    setSucesso('')
    try {
      const payload = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        inicio: paraIsoOuNull(form.inicio, form.diaInteiro),
        prazo: paraIsoOuNull(form.prazo, form.diaInteiro),
        modoNotificacao: form.modoNotificacao,
        notificarEm: form.modoNotificacao === 'PERSONALIZADA' ? paraIsoOuNull(form.notificarEm) : null,
        prioridade: form.prioridade,
        responsavelId: form.responsavelId,
        exibirCalendario: form.exibirCalendario,
        diaInteiro: form.diaInteiro,
      }
      if (!tarefaEditando && !form.diaInteiro && payload.inicio && anteriorAoMinutoDaReferencia(new Date(payload.inicio))) {
        throw new Error('O início da tarefa não pode ser anterior ao momento do cadastro.')
      }
      const response = await fetch(tarefaEditando ? `/api/tarefas/${tarefaEditando.id}` : '/api/tarefas', {
        method: tarefaEditando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarefaEditando ? payload : { ...payload, modulo: 'TAREFAS' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível salvar a tarefa.')
      setTarefas((atual) => tarefaEditando
        ? atual.map((item) => item.id === data.id ? data : item)
        : [...atual, data])
      setEditorAberto(false)
      setTarefaEditando(null)
      setSucesso(tarefaEditando ? 'Tarefa atualizada no cronograma.' : 'Tarefa delegada e responsável notificado.')
      sinalizarAtualizacaoDashboardEmpresa()
      window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao salvar a tarefa.')
    } finally {
      setSalvando(false)
    }
  }

  const atualizarTarefa = async (tarefa: Tarefa, alteracoes: Partial<Pick<Tarefa, 'status' | 'ordem'>>) => {
    if (processandoId) return false
    const estadoAnterior = tarefas
    setProcessandoId(tarefa.id)
    setErro('')
    setTarefas((atual) => atual.map((item) => item.id === tarefa.id ? { ...item, ...alteracoes } : item))
    try {
      const response = await fetch(`/api/tarefas/${tarefa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alteracoes),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível atualizar a tarefa.')
      setTarefas((atual) => atual.map((item) => item.id === tarefa.id ? data : item))
      setSucesso('Cronograma atualizado.')
      sinalizarAtualizacaoDashboardEmpresa()
      window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))
      return true
    } catch (cause) {
      setTarefas(estadoAnterior)
      setErro(cause instanceof Error ? cause.message : 'Falha ao atualizar a tarefa.')
      return false
    } finally {
      setProcessandoId(null)
    }
  }

  const moverParaStatus = (tarefa: Tarefa, status: StatusTarefa, antesDe?: Tarefa) => {
    if (!podeAtualizarStatus || processandoId || tarefa.id === antesDe?.id) return
    const destino = tarefas
      .filter((item) => item.status === status && item.id !== tarefa.id)
      .sort((a, b) => a.ordem - b.ordem)
    const indice = antesDe ? destino.findIndex((item) => item.id === antesDe.id) : destino.length
    const anterior = indice > 0 ? destino[indice - 1]?.ordem : undefined
    const proxima = indice >= 0 && indice < destino.length ? destino[indice]?.ordem : undefined
    void atualizarTarefa(tarefa, { status, ordem: ordemEntre(anterior, proxima) })
  }

  const moverVertical = (tarefa: Tarefa, direcao: -1 | 1) => {
    const coluna = tarefasPorStatus[tarefa.status]
    const indiceAtual = coluna.findIndex((item) => item.id === tarefa.id)
    const indiceDestino = indiceAtual + direcao
    if (indiceDestino < 0 || indiceDestino >= coluna.length) return
    const semAtual = coluna.filter((item) => item.id !== tarefa.id)
    const indiceInsercao = indiceDestino
    const anterior = indiceInsercao > 0 ? semAtual[indiceInsercao - 1]?.ordem : undefined
    const proxima = indiceInsercao < semAtual.length ? semAtual[indiceInsercao]?.ordem : undefined
    void atualizarTarefa(tarefa, { ordem: ordemEntre(anterior, proxima) })
  }

  const aoSoltar = (event: DragEvent, status: StatusTarefa, antesDe?: Tarefa) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/tarefa-id') || arrastandoId
    const tarefa = tarefas.find((item) => item.id === id)
    setArrastandoId(null)
    if (tarefa) moverParaStatus(tarefa, status, antesDe)
  }

  const confirmarExclusao = async () => {
    if (!exclusao || processandoId) return
    const tarefa = exclusao
    setProcessandoId(tarefa.id)
    setErro('')
    try {
      const response = await fetch(`/api/tarefas/${tarefa.id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível excluir a tarefa.')
      setTarefas((atual) => atual.filter((item) => item.id !== tarefa.id))
      setExclusao(null)
      setSucesso('Tarefa excluída do cronograma.')
      sinalizarAtualizacaoDashboardEmpresa()
      window.dispatchEvent(new Event(NOTIFICACOES_ATUALIZADAS_EVENT))
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Falha ao excluir a tarefa.')
    } finally {
      setProcessandoId(null)
    }
  }

  const alterarMes = (incremento: number) => {
    setMesAtual((atual) => new Date(atual.getFullYear(), atual.getMonth() + incremento, 1))
  }

  if (loading && !perfil) return <DominoLoader label="Carregando cronograma" />
  if (somenteLembretes) return <CronogramaPessoal permitirLembretes={perfil !== 'VISUALIZADOR'} />

  return (
    <div className="mx-auto max-w-[1750px] space-y-5 font-mono">
      <header className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: primary }}>Planejamento operacional</p>
          <h1 className="font-rajdhani text-3xl font-black uppercase">Cronograma</h1>
          <p className="mt-1 max-w-3xl text-sm text-foreground-muted">
            {eGestor ? 'Delegue tarefas à equipe e organize seus próprios lembretes em um único calendário.' : 'Acompanhe suas tarefas e organize lembretes pessoais sem misturar os dois fluxos.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex border p-1" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }} role="group" aria-label="Visualização do cronograma">
            <ViewButton active={visualizacao === 'QUADRO'} onClick={() => setVisualizacao('QUADRO')} icon={LayoutDashboard} label="Quadro de tarefas" primary={primary} />
            {perfil && perfil !== 'VISUALIZADOR' && <ViewButton active={visualizacao === 'LEMBRETES'} onClick={() => setVisualizacao('LEMBRETES')} icon={StickyNote} label="Quadro de lembretes" primary={primary} />}
            <ViewButton active={visualizacao === 'CALENDARIO'} onClick={() => setVisualizacao('CALENDARIO')} icon={CalendarDays} label="Calendário" primary={primary} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={visualizacao}
              className="flex flex-wrap gap-2"
              aria-live="polite"
              initial={reduzirMovimento ? false : { opacity: 0, x: 10, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.98 }}
              transition={{ duration: reduzirMovimento ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
            >
              {(visualizacao === 'LEMBRETES' || visualizacao === 'CALENDARIO') && podeCriarLembrete && (
                <button
                  type="button"
                  onClick={() => setPedidoNovoLembrete((pedido) => pedido + 1)}
                  className="interactive-control flex min-h-11 items-center gap-2 border px-5 text-xs font-black uppercase"
                  style={visualizacao === 'LEMBRETES'
                    ? { borderColor: primary, backgroundColor: primary, color: '#000' }
                    : { borderColor: primary, color: primary, backgroundColor: 'var(--background-secondary)' }}
                >
                  <Plus size={16} /> Novo lembrete
                </button>
              )}
              {(visualizacao === 'QUADRO' || visualizacao === 'CALENDARIO') && podeCriarTarefa && (
                <button type="button" onClick={abrirCriacao} className="interactive-control flex min-h-11 items-center gap-2 px-5 text-xs font-black uppercase text-black" style={{ backgroundColor: primary }}>
                  <Plus size={16} /> Nova tarefa
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </header>

      {(erro || sucesso) && <ActionFeedback message={erro || sucesso} tone={erro ? 'error' : 'success'} />}

      {visualizacao !== 'LEMBRETES' && <><section className="grid gap-3 border p-4 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(150px,0.7fr))_auto]" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }} aria-label="Filtros do cronograma">
        <label className="relative flex items-center">
          <Search size={15} className="absolute left-3 text-foreground-muted" aria-hidden="true" />
          <span className="sr-only">Buscar tarefas</span>
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar tarefa ou responsável..." className="min-h-11 w-full border bg-background pl-10 pr-3 text-xs outline-none focus:border-primary" style={{ borderColor: 'var(--border)' }} />
        </label>
        <FiltroSelect label="Status" value={filtroStatus} onChange={(valor) => setFiltroStatus(valor as typeof filtroStatus)} options={['TODAS', ...STATUS]} />
        <FiltroSelect label="Prioridade" value={filtroPrioridade} onChange={(valor) => setFiltroPrioridade(valor as typeof filtroPrioridade)} options={['TODAS', ...PRIORIDADES]} />
        {eGestor ? (
          <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">
            Responsável
            <select value={filtroResponsavel} onChange={(event) => setFiltroResponsavel(event.target.value)} className="min-h-9 border bg-background px-2 text-[10px] text-foreground outline-none" style={{ borderColor: 'var(--border)' }}>
              <option value="TODOS">Todos</option>
              {usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome}</option>)}
            </select>
          </label>
        ) : <div />}
        <FiltroSelect label="Período" value={filtroPeriodo} onChange={(valor) => setFiltroPeriodo(valor as FiltroPeriodo)} options={['TODAS', 'ATRASADAS', 'HOJE', '7_DIAS', 'SEM_DATA']} />
        <button type="button" onClick={() => void carregar()} disabled={loading} className="interactive-control self-end border p-2.5 disabled:opacity-50" style={{ borderColor: 'var(--border)' }} aria-label="Atualizar cronograma">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-foreground-muted">
        <span>{tarefasFiltradas.length} tarefa(s) visível(is)</span>
        {visualizacao === 'QUADRO' && podeAtualizarStatus && <span>Arraste os cards ou use as setas de movimentação</span>}
      </div></>}

      {perfil && perfil !== 'VISUALIZADOR' && (
        <LembretesPessoaisBoard
          active={visualizacao === 'LEMBRETES'}
          createRequest={pedidoNovoLembrete}
          showCreateAction={false}
          onChange={aoAtualizarLembretes}
        />
      )}

      {visualizacao === 'LEMBRETES' ? null : loading ? (
        <DominoLoader label="Montando o cronograma" className="min-h-[360px]" />
      ) : visualizacao === 'QUADRO' ? (
        <div className="grid items-start gap-3 xl:grid-cols-4">
          {STATUS.map((status, indiceStatus) => (
            <section
              key={status}
              className="min-h-[360px] border"
              style={{ borderColor: arrastandoId ? `${primary}88` : 'var(--border)', backgroundColor: 'var(--background-secondary)' }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => aoSoltar(event, status)}
              aria-label={`Coluna ${STATUS_INFO[status].titulo}`}
            >
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
                <div><h2 className="text-xs font-black uppercase">{STATUS_INFO[status].titulo}</h2><p className="mt-0.5 text-[9px] text-foreground-muted">{STATUS_INFO[status].descricao}</p></div>
                <span className="min-w-7 border px-2 py-1 text-center text-[10px] font-black" style={{ borderColor: `${primary}66`, color: primary }}>{tarefasPorStatus[status].length}</span>
              </div>
              <div className="space-y-3 p-3">
                <AnimatePresence initial={false}>
                  {tarefasPorStatus[status].map((tarefa, indice) => (
                    <TarefaCard
                      key={tarefa.id}
                      tarefa={tarefa}
                      eGestor={eGestor}
                      podeAtualizar={podeAtualizarStatus}
                      processando={processandoId === tarefa.id}
                      arrastando={arrastandoId === tarefa.id}
                      primary={primary}
                      danger={semanticColors.danger}
                      podeSubir={indice > 0}
                      podeDescer={indice < tarefasPorStatus[status].length - 1}
                      podeEsquerda={indiceStatus > 0}
                      podeDireita={indiceStatus < STATUS.length - 1}
                      onEditar={() => abrirEdicao(tarefa)}
                      onExcluir={() => setExclusao(tarefa)}
                      onStatus={(novoStatus) => moverParaStatus(tarefa, novoStatus)}
                      onMoverVertical={(direcao) => moverVertical(tarefa, direcao)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/tarefa-id', tarefa.id)
                        setArrastandoId(tarefa.id)
                      }}
                      onDragEnd={() => setArrastandoId(null)}
                      onDropBefore={(event) => aoSoltar(event, status, tarefa)}
                    />
                  ))}
                </AnimatePresence>
                {tarefasPorStatus[status].length === 0 && (
                  <div className="border border-dashed px-3 py-10 text-center text-[10px] text-foreground-muted" style={{ borderColor: 'var(--border)' }}>
                    Solte uma tarefa aqui
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Calendário mensal</p>
              <h2 className="mt-1 font-rajdhani text-xl font-black uppercase">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => alterarMes(-1)} className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }} aria-label="Mês anterior"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setMesAtual(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} className="interactive-control border px-3 py-2 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}>Hoje</button>
              <button type="button" onClick={() => alterarMes(1)} className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }} aria-label="Próximo mês"><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
                {DIAS_SEMANA.map((dia) => <div key={dia} className="border-r px-2 py-2 text-center text-[9px] font-black text-foreground-muted last:border-r-0" style={{ borderColor: 'var(--border)' }}>{dia}</div>)}
              </div>
              <div className="grid grid-cols-7">
            {diasCalendario.map((dia) => {
              const tarefasDia = tarefasCalendario.get(chaveDia(dia)) ?? []
              const lembretesDia = lembretesCalendario.get(chaveDia(dia)) ?? []
              const espacoLembretes = Math.max(0, 3 - tarefasDia.length)
              const totalItens = tarefasDia.length + lembretesDia.length
              const outroMes = dia.getMonth() !== mesAtual.getMonth()
              const hoje = chaveDia(dia) === chaveDia(new Date())
              return (
                <div key={dia.toISOString()} className="min-h-28 border-b border-r p-1.5 last:border-r-0 sm:min-h-36 sm:p-2" style={{ borderColor: 'var(--border)', opacity: outroMes ? 0.45 : 1 }}>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center text-[10px] font-bold" style={hoje ? { backgroundColor: primary, color: '#000' } : undefined}>{dia.getDate()}</span>
                  <div className="mt-1 space-y-1">
                    {tarefasDia.slice(0, 3).map((tarefa) => (
                      <button key={tarefa.id} type="button" disabled={!eGestor} onClick={() => abrirEdicao(tarefa)} className="block w-full truncate border-l-2 px-1.5 py-1 text-left text-[8px] font-bold disabled:cursor-default sm:text-[9px]" style={{ borderColor: corPrioridade(tarefa.prioridade, primary, semanticColors.danger), backgroundColor: 'var(--background)' }} title={tarefa.titulo}>
                        {tarefa.diaInteiro ? 'DIA' : tarefa.inicio ? new Date(tarefa.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'PRAZO'} · {tarefa.titulo}
                      </button>
                    ))}
                    {lembretesDia.slice(0, espacoLembretes).map((lembrete) => (
                      <button key={lembrete.id} type="button" onClick={() => setVisualizacao('LEMBRETES')} className="block w-full truncate border-l-2 px-1.5 py-1 text-left text-[8px] font-bold sm:text-[9px]" style={{ borderColor: semanticColors.warning, backgroundColor: `color-mix(in srgb, var(--background) 84%, ${semanticColors.warning} 16%)` }} title={`Lembrete pessoal: ${lembrete.titulo}`}>
                        <StickyNote size={9} className="mr-1 inline" /> {lembrete.diaInteiro ? 'DIA' : new Date(lembrete.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {lembrete.titulo}
                      </button>
                    ))}
                    {totalItens > 3 && <span className="block text-[8px] text-foreground-muted">+ {totalItens - 3} item(ns)</span>}
                  </div>
                </div>
              )
            })}
              </div>
            </div>
          </div>
        </section>
      )}

      <AnimatePresence>
        {editorAberto && (
          <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="presentation">
            <motion.form onSubmit={salvarTarefa} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.98 }} transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }} role="dialog" aria-modal="true" aria-labelledby="editor-cronograma-titulo" className="modal-cronograma max-h-[88dvh] w-full max-w-[800px] overflow-y-auto border p-4 sm:p-5" style={{ borderColor: primary, backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex items-start justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                <div><p className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: primary }}>Cronograma</p><h2 id="editor-cronograma-titulo" className="mt-1 font-rajdhani text-2xl font-black uppercase">{tarefaEditando ? 'Editar tarefa' : 'Nova tarefa'}</h2></div>
                <button type="button" onClick={() => !salvando && setEditorAberto(false)} className="interactive-control border p-2" style={{ borderColor: 'var(--border)' }} aria-label="Fechar editor"><X size={17} /></button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Campo label="Título"><input autoFocus required minLength={3} maxLength={160} value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} className="input-cronograma" /></Campo>
                <Campo label="Responsável"><select required value={form.responsavelId} onChange={(event) => setForm({ ...form, responsavelId: event.target.value })} className="input-cronograma">{usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nome} — {usuario.role.replaceAll('_', ' ')}</option>)}</select></Campo>
                <label className="flex min-h-14 items-center gap-3 border px-4 py-3 text-[10px] md:col-span-2" style={{ borderColor: form.diaInteiro ? primary : 'var(--border)', backgroundColor: form.diaInteiro ? `${primary}0d` : 'transparent' }}><input type="checkbox" checked={form.diaInteiro} onChange={(event) => setForm({ ...form, diaInteiro: event.target.checked, inicio: paraInputData(form.inicio ? paraIsoOuNull(form.inicio, form.diaInteiro) : null, event.target.checked), prazo: paraInputData(form.prazo ? paraIsoOuNull(form.prazo, form.diaInteiro) : null, event.target.checked) })} className="h-5 w-5 shrink-0 accent-current" style={{ color: primary }} /><span><strong className="block uppercase">Não preciso definir um horário; somente o dia</strong><small className="mt-1 block text-[9px] normal-case text-foreground-muted">Início e prazo serão registrados sem um horário específico.</small></span></label>
                <Campo label={form.diaInteiro ? 'Dia de início' : 'Início'}><BrazilianDateTimePicker somenteData={form.diaInteiro} value={form.inicio} onChange={(valor) => setForm({ ...form, inicio: valor })} /></Campo>
                <Campo label={form.diaInteiro ? 'Dia do prazo' : 'Prazo'}><BrazilianDateTimePicker somenteData={form.diaInteiro} value={form.prazo} onChange={(valor) => setForm({ ...form, prazo: valor })} /></Campo>
                <Campo label="Prioridade"><select value={form.prioridade} onChange={(event) => setForm({ ...form, prioridade: event.target.value as PrioridadeTarefa })} className="input-cronograma">{[...PRIORIDADES_NOVAS, ...(form.prioridade === 'URGENTE' ? ['URGENTE' as const] : [])].map((item) => <option key={item} value={item}>{nomePrioridade(item)} — aviso {DIAS_ANTECEDENCIA_TAREFA[item]} dias antes</option>)}</select></Campo>
                <Campo label="Regra da notificação"><select value={form.modoNotificacao} onChange={(event) => setForm({ ...form, modoNotificacao: event.target.value as ModoNotificacaoTarefa, notificarEm: event.target.value === 'AUTOMATICA' ? '' : form.notificarEm })} className="input-cronograma"><option value="AUTOMATICA">Automática pela prioridade</option><option value="PERSONALIZADA">Escolher data e hora</option></select></Campo>
                {form.modoNotificacao === 'PERSONALIZADA' && <div className="md:col-span-2"><Campo label="Data e horário da notificação"><BrazilianDateTimePicker required value={form.notificarEm} onChange={(valor) => setForm({ ...form, notificarEm: valor })} /></Campo></div>}
                <div className="flex min-h-16 items-center gap-3 border px-4 py-3 text-[10px] md:col-span-2" style={{ borderColor: `${primary}55`, backgroundColor: `${primary}0a` }}><BellRing size={16} className="shrink-0" style={{ color: primary }} aria-hidden="true" /><span><strong className="block uppercase">Previsão da notificação</strong><small className="mt-1 block text-[9px] normal-case text-foreground-muted">{resumoNotificacao(form)}</small></span></div>
                <label className="flex min-h-16 items-center justify-between gap-4 border px-4 py-3" style={{ borderColor: 'var(--border)' }}><span><strong className="block text-[10px] uppercase">Exibir no calendário</strong><small className="mt-1 block text-[9px] text-foreground-muted">O card continuará disponível no quadro.</small></span><input type="checkbox" checked={form.exibirCalendario} onChange={(event) => setForm({ ...form, exibirCalendario: event.target.checked })} className="h-5 w-5 accent-current" style={{ color: primary }} /></label>
                <div className="md:col-span-2"><Campo label="Descrição"><textarea rows={3} maxLength={2000} value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className="input-cronograma resize-y" /></Campo></div>
              </div>
              <div className="mt-4 flex flex-col-reverse justify-end gap-2 border-t pt-3 sm:flex-row" style={{ borderColor: 'var(--border)' }}><button type="button" disabled={salvando} onClick={() => setEditorAberto(false)} className="interactive-control min-h-10 border px-4 text-xs font-bold disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>Cancelar</button><button disabled={salvando} className="interactive-control min-h-10 px-4 text-xs font-black uppercase text-black disabled:opacity-50" style={{ backgroundColor: primary }}>{salvando ? 'Salvando...' : tarefaEditando ? 'Salvar alterações' : 'Criar e notificar'}</button></div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <ActionConfirmDialog open={Boolean(exclusao)} title="Excluir tarefa" description={`A tarefa “${exclusao?.titulo ?? ''}” e suas notificações vinculadas serão removidas permanentemente.`} confirmLabel="Excluir tarefa" cancelLabel="Manter tarefa" loading={Boolean(processandoId)} onClose={() => { if (!processandoId) setExclusao(null) }} onConfirm={() => void confirmarExclusao()} />

    </div>
  )
}

function TarefaCard({
  tarefa,
  eGestor,
  podeAtualizar,
  processando,
  arrastando,
  primary,
  danger,
  podeSubir,
  podeDescer,
  podeEsquerda,
  podeDireita,
  onEditar,
  onExcluir,
  onStatus,
  onMoverVertical,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  tarefa: Tarefa
  eGestor: boolean
  podeAtualizar: boolean
  processando: boolean
  arrastando: boolean
  primary: string
  danger: string
  podeSubir: boolean
  podeDescer: boolean
  podeEsquerda: boolean
  podeDireita: boolean
  onEditar: () => void
  onExcluir: () => void
  onStatus: (status: StatusTarefa) => void
  onMoverVertical: (direcao: -1 | 1) => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onDropBefore: (event: DragEvent<HTMLElement>) => void
}) {
  const cor = corPrioridade(tarefa.prioridade, primary, danger)
  const atrasada = tarefaAtrasada(tarefa)
  const indiceStatus = STATUS.indexOf(tarefa.status)

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: arrastando ? 0.45 : 1, y: 0, scale: arrastando ? 0.98 : 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      draggable={podeAtualizar && !processando}
      onDragStartCapture={onDragStart}
      onDragEndCapture={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.stopPropagation(); onDropBefore(event) }}
      aria-busy={processando}
      className="group border p-3.5 shadow-sm"
      style={{ borderColor: atrasada ? `${danger}99` : `${cor}55`, backgroundColor: 'var(--background)' }}
    >
      <div className="flex items-start gap-2">
        {podeAtualizar && <GripVertical size={15} className="mt-0.5 shrink-0 cursor-grab text-foreground-muted" aria-hidden="true" />}
        <div className="min-w-0 flex-1"><span className="text-[8px] font-black uppercase tracking-[0.18em]" style={{ color: cor }}>{nomePrioridade(tarefa.prioridade)}</span><h3 className="mt-1 break-words text-xs font-black leading-5">{tarefa.titulo}</h3></div>
        {eGestor && <div className="flex shrink-0 gap-1"><button type="button" onClick={onEditar} className="interactive-control p-1.5 text-foreground-muted hover:text-foreground" aria-label={`Editar ${tarefa.titulo}`}><Pencil size={13} /></button><button type="button" onClick={onExcluir} className="interactive-control p-1.5" style={{ color: danger }} aria-label={`Excluir ${tarefa.titulo}`}><Trash2 size={13} /></button></div>}
      </div>
      {tarefa.descricao && <p className="mt-2 line-clamp-3 text-[10px] leading-4 text-foreground-muted">{tarefa.descricao}</p>}
      <div className="mt-3 space-y-1.5 border-t pt-3 text-[9px] text-foreground-muted" style={{ borderColor: 'var(--border)' }}>
        {eGestor && <span className="flex items-center gap-1.5"><UserRound size={11} /> {tarefa.responsavel.nome}</span>}
        <span className="flex items-center gap-1.5" style={atrasada ? { color: danger } : undefined}><Clock3 size={11} /> {tarefa.prazo ? tarefa.diaInteiro ? new Date(tarefa.prazo).toLocaleDateString('pt-BR') + ' · dia inteiro' : new Date(tarefa.prazo).toLocaleString('pt-BR') : 'Sem prazo'}</span>
        {tarefa.lembreteEm && <span className="flex items-center gap-1.5"><BellRing size={11} /> {tarefa.diaInteiro && tarefa.modoNotificacao === 'AUTOMATICA' ? new Date(tarefa.lembreteEm).toLocaleDateString('pt-BR') : new Date(tarefa.lembreteEm).toLocaleString('pt-BR')}</span>}
      </div>
      {podeAtualizar && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-1" role="group" aria-label={`Ordenar ${tarefa.titulo}`}>
            <MoveButton icon={ArrowUp} label="Mover para cima" disabled={!podeSubir || processando} onClick={() => onMoverVertical(-1)} />
            <MoveButton icon={ArrowDown} label="Mover para baixo" disabled={!podeDescer || processando} onClick={() => onMoverVertical(1)} />
            <MoveButton icon={ArrowLeft} label="Mover para coluna anterior" disabled={!podeEsquerda || processando} onClick={() => onStatus(STATUS[indiceStatus - 1])} />
            <MoveButton icon={ArrowRight} label="Mover para próxima coluna" disabled={!podeDireita || processando} onClick={() => onStatus(STATUS[indiceStatus + 1])} />
          </div>
          {processando && <span className="text-[8px] uppercase" style={{ color: primary }}>Salvando</span>}
        </div>
      )}
    </motion.article>
  )
}

function MoveButton({ icon: Icon, label, disabled, onClick }: { icon: typeof ArrowUp; label: string; disabled: boolean; onClick: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="interactive-control border p-1.5 text-foreground-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-25" style={{ borderColor: 'var(--border)' }} aria-label={label} title={label}><Icon size={11} /></button>
}

function ViewButton({ active, onClick, icon: Icon, label, primary }: { active: boolean; onClick: () => void; icon: typeof CalendarDays; label: string; primary: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className="interactive-control flex min-h-9 items-center gap-2 px-3 text-[10px] font-bold uppercase" style={{ backgroundColor: active ? primary : 'transparent', color: active ? '#000' : 'var(--foreground-muted)' }}><Icon size={14} /> {label}</button>
}

function FiltroSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (valor: string) => void; options: readonly string[] }) {
  return <label className="grid gap-1 text-[9px] font-bold uppercase tracking-wider text-foreground-muted">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-9 border bg-background px-2 text-[10px] text-foreground outline-none" style={{ borderColor: 'var(--border)' }}>{options.map((option) => <option key={option} value={option}>{option === 'BAIXA' ? 'LEVE' : option.replaceAll('_', ' ')}</option>)}</select></label>
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}</span>{children}</label>
}


function corPrioridade(prioridade: PrioridadeTarefa, primary: string, danger: string) {
  if (prioridade === 'URGENTE') return danger
  if (prioridade === 'ALTA') return 'var(--status-warning)'
  if (prioridade === 'BAIXA') return 'var(--status-info)'
  return primary
}
