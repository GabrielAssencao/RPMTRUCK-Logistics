'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type SecurityData = {
  resumo: { sessoesAtivas: number; falhasLogin24h: number; bloqueiosRateLimit24h: number }
  sessoes: Array<{
    id: string
    criadoEm: string
    ultimaAtividade: string
    userAgent: string | null
    usuario: { nome: string; email: string; role: string }
    empresa: { nome: string } | null
  }>
  eventos: Array<{
    id: string
    tipo: string
    criadoEm: string
    ipCorrelacao: string | null
    usuario: { nome: string; email: string } | null
    empresa: { nome: string } | null
  }>
  auditoria: Array<{
    id: string
    tabela: string
    acao: string
    registroId: string | null
    origem: string
    criadoEm: string
    usuario: { nome: string; email: string } | null
    empresa: { nome: string } | null
  }>
}

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
}).format(new Date(value))

async function fetchSecurityData(signal?: AbortSignal): Promise<SecurityData> {
  const response = await fetch('/api/admin/seguranca', { cache: 'no-store', signal })
  const body = await response.json()
  if (!response.ok) throw new Error(body.erro || 'Falha ao carregar os registros de segurança.')
  return body
}

export default function SecurityModule() {
  const { primary } = useTheme()
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchSecurityData())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros de segurança.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchSecurityData(controller.signal)
      .then(setData)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Falha ao carregar os registros de segurança.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: primary }}>Segurança e auditoria</p>
          <h1 className="mt-2 text-3xl font-black font-rajdhani">CENTRAL DE LOGS</h1>
          <p className="mt-1 text-sm text-foreground-muted">Sessões com atividade nos últimos 15 minutos e trilhas sem dados pessoais sensíveis.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase disabled:opacity-50" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {error && <div className="border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-500">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={UserCheck} label="Sessões ativas" value={data?.resumo.sessoesAtivas ?? '—'} color={primary} />
        <Metric icon={ShieldAlert} label="Falhas de login / 24h" value={data?.resumo.falhasLogin24h ?? '—'} color="#ef4444" />
        <Metric icon={Activity} label="Bloqueios / 24h" value={data?.resumo.bloqueiosRateLimit24h ?? '—'} color="#f59e0b" />
      </div>

      <LogTable title="Acessando agora" empty="Nenhuma sessão ativa no intervalo." columns={['Usuário', 'Empresa', 'Papel', 'Última atividade']} rows={(data?.sessoes || []).map((item) => [
        `${item.usuario.nome} · ${item.usuario.email}`,
        item.empresa?.nome || 'RPMTruck',
        item.usuario.role,
        formatDate(item.ultimaAtividade),
      ])} />

      <LogTable title="Eventos de segurança" empty="Nenhum evento registrado." columns={['Evento', 'Usuário', 'Empresa', 'Data']} rows={(data?.eventos || []).map((item) => [
        `${item.tipo}${item.ipCorrelacao ? ` · IP#${item.ipCorrelacao}` : ''}`,
        item.usuario ? `${item.usuario.nome} · ${item.usuario.email}` : 'Não identificado',
        item.empresa?.nome || '—',
        formatDate(item.criadoEm),
      ])} />

      <LogTable title="Trilha imutável de auditoria" empty="Nenhuma ação auditada." columns={['Ação', 'Recurso', 'Responsável', 'Data']} rows={(data?.auditoria || []).map((item) => [
        `${item.acao} · ${item.origem}`,
        `${item.tabela}${item.registroId ? ` · ${item.registroId.slice(0, 8)}` : ''}`,
        item.usuario?.nome || item.empresa?.nome || 'Processo do sistema',
        formatDate(item.criadoEm),
      ])} />
    </div>
  )
}

function Metric({ icon: Icon, label, value, color }: { icon: typeof Activity; label: string; value: number | string; color: string }) {
  return <div className="flex items-center gap-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}><Icon size={20} style={{ color }} /><div><div className="text-2xl font-black font-rajdhani">{value}</div><div className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{label}</div></div></div>
}

function LogTable({ title, empty, columns, rows }: { title: string; empty: string; columns: string[]; rows: string[][] }) {
  return <section className="space-y-3"><h2 className="text-sm font-black uppercase tracking-widest font-rajdhani">{title}</h2><div className="overflow-x-auto border" style={{ borderColor: 'var(--border)' }}><table className="min-w-full text-left text-xs"><thead style={{ backgroundColor: 'var(--background-secondary)' }}><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-bold uppercase tracking-wider text-foreground-muted">{column}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-foreground-muted">{empty}</td></tr> : rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t" style={{ borderColor: 'var(--border)' }}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">{cell}</td>)}</tr>)}</tbody></table></div></section>
}
