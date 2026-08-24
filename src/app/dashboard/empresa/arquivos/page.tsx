'use client'

import { useCallback, useEffect, useState } from 'react'
import { Archive, CheckCircle2, Download, FileSpreadsheet, ShieldCheck, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

type StatusArquivo = 'PRONTO_DOWNLOAD' | 'DOWNLOAD_REGISTRADO' | 'CONFIRMADO_GESTOR' | 'DADOS_PURGADOS' | 'ARQUIVO_REMOVIDO'

interface ArquivoOperacional {
  id: string
  nome_arquivo: string
  tamanho_bytes: number
  checksum_sha256: string
  periodo_inicio: string
  periodo_fim: string
  status: StatusArquivo
  gerado_automaticamente: boolean
  confirmado_em: string | null
  dados_purgados_em: string | null
  arquivo_removido_em: string | null
  elegivel_purga_em: string
  pode_purgar: boolean
}

interface Capacidade {
  uso_bytes: number
  uso_global_bytes: number
  limite_interno_bytes: number
  banco_uso_bytes: number
  banco_limite_bytes: number
  banco_percentual: number
}

const capacidadeInicial: Capacidade = {
  uso_bytes: 0,
  uso_global_bytes: 0,
  limite_interno_bytes: 0,
  banco_uso_bytes: 0,
  banco_limite_bytes: 0,
  banco_percentual: 0,
}

function formatarBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ArquivosOperacionaisPage() {
  const { primary } = useTheme()
  const hoje = new Date().toISOString().slice(0, 10)
  const [inicio, setInicio] = useState(`${hoje.slice(0, 7)}-01`)
  const [fim, setFim] = useState(hoje)
  const [arquivos, setArquivos] = useState<ArquivoOperacional[]>([])
  const [capacidade, setCapacidade] = useState<Capacidade>(capacidadeInicial)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [podeGerenciar, setPodeGerenciar] = useState(false)
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    const response = await fetch('/api/relatorios/arquivos', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os arquivos.')
    setArquivos(data.arquivos)
    setCapacidade(data.armazenamento)
    setPodeGerenciar(Boolean(data.permissoes?.pode_gerenciar))
  }, [])

  useEffect(() => {
    queueMicrotask(() => carregar()
      .catch(error => setMensagem(error instanceof Error ? error.message : 'Erro ao carregar os arquivos.'))
      .finally(() => setCarregando(false)))
  }, [carregar])

  const executar = async (acao: () => Promise<void>) => {
    setProcessando(true)
    setMensagem('')
    try {
      await acao()
      await carregar()
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setProcessando(false)
    }
  }

  const gerar = () => executar(async () => {
    const response = await fetch('/api/relatorios/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inicio, fim }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível gerar o Excel.')
    setMensagem('Excel gerado e armazenado no bucket privado.')
  })

  const baixar = (id: string) => executar(async () => {
    const response = await fetch(`/api/relatorios/arquivos/${id}/download`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível liberar o download.')
    window.open(data.url, '_blank', 'noopener,noreferrer')
    setMensagem('Download liberado. Depois de salvar e conferir o Excel, confirme a guarda.')
  })

  const confirmar = (id: string) => executar(async () => {
    const response = await fetch(`/api/relatorios/arquivos/${id}/confirmar`, { method: 'POST' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível confirmar a guarda.')
    setMensagem('Guarda confirmada. Os dados permanecem online até o fim da retenção do plano.')
  })

  const purgar = (arquivo: ArquivoOperacional) => {
    if (!window.confirm('Excluir os detalhes operacionais deste período e remover o Excel temporário? Código, origem, destino e data dos containers serão preservados.')) return
    executar(async () => {
      const response = await fetch(`/api/relatorios/arquivos/${arquivo.id}/purgar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao: 'EXCLUIR DADOS ARQUIVADOS' }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.erro || 'Não foi possível limpar os detalhes.')
      setMensagem(data.aviso || 'Limpeza concluída; histórico permanente preservado.')
    })
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 font-mono">
      <header className="border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-3xl font-black uppercase tracking-tight font-rajdhani">Arquivo <span style={{ color: primary }}>Operacional</span></h1>
        <p className="mt-1 text-sm text-foreground-muted">Gere o Excel no servidor, guarde uma cópia e libere espaço sem perder a trilha permanente dos containers.</p>
      </header>

      {mensagem && <div role="status" className="border px-4 py-3 text-xs font-bold" style={{ borderColor: `${primary}55`, color: primary }}>{mensagem}</div>}

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest"><FileSpreadsheet size={17} style={{ color: primary }} /> Gerar Excel</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold uppercase">Início<input type="date" value={inicio} max={fim} onChange={event => setInicio(event.target.value)} className="mt-1 w-full border bg-transparent px-3 py-2 text-xs" style={{ borderColor: 'var(--border)' }} /></label>
            <label className="text-[10px] font-bold uppercase">Fim<input type="date" value={fim} min={inicio} max={hoje} onChange={event => setFim(event.target.value)} className="mt-1 w-full border bg-transparent px-3 py-2 text-xs" style={{ borderColor: 'var(--border)' }} /></label>
          </div>
          <button type="button" onClick={gerar} disabled={!podeGerenciar || processando || !inicio || !fim || inicio > fim} className="flex w-full items-center justify-center gap-2 px-4 py-3 text-xs font-black uppercase text-black disabled:opacity-40" style={{ backgroundColor: primary }}><Archive size={15} /> {processando ? 'Processando...' : podeGerenciar ? 'Gerar e proteger Excel' : 'Somente o gestor pode gerar'}</button>
          <p className="flex items-start gap-2 text-[10px] text-foreground-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: primary }} /> O arquivo inclui containers, abastecimentos, manutenções, custos, resumo e aba de auditoria com checksum SHA-256.</p>
        </div>

        <div className="space-y-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
          <h2 className="text-xs font-black uppercase tracking-widest">Capacidade do Supabase Free</h2>
          <div>
            <div className="mb-2 flex justify-between text-[10px] font-bold uppercase"><span>Banco compartilhado</span><span>{capacidade.banco_percentual.toFixed(1)}%</span></div>
            <div className="h-2 overflow-hidden bg-black/20" role="progressbar" aria-label="Uso do banco" aria-valuemin={0} aria-valuemax={100} aria-valuenow={capacidade.banco_percentual}><div className="h-full" style={{ width: `${Math.min(capacidade.banco_percentual, 100)}%`, backgroundColor: capacidade.banco_percentual >= 80 ? '#ef4444' : primary }} /></div>
            <p className="mt-2 text-[10px] text-foreground-muted">{formatarBytes(capacidade.banco_uso_bytes)} de {formatarBytes(capacidade.banco_limite_bytes)}.</p>
          </div>
          <div className="border-t pt-3 text-[10px] text-foreground-muted" style={{ borderColor: 'var(--border)' }}>
            Relatórios desta empresa: {formatarBytes(capacidade.uso_bytes)} · total de relatórios no projeto: {formatarBytes(capacidade.uso_global_bytes)} de {formatarBytes(capacidade.limite_interno_bytes)} do teto preventivo.
          </div>
          <p className="text-[10px] font-bold" style={{ color: capacidade.banco_percentual >= 80 ? '#ef4444' : 'var(--foreground-muted)' }}>
            {capacidade.banco_percentual >= 80 ? 'Uso crítico: baixe e confirme arquivos elegíveis e planeje a migração para o Pro.' : 'O sistema reserva margem do Storage para fotos e outros arquivos.'}
          </p>
        </div>
      </section>

      <section className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}><h2 className="text-xs font-black uppercase tracking-widest">Ciclo dos arquivos</h2></div>
        {carregando ? <p className="p-6 text-xs text-foreground-muted">Carregando arquivos...</p> : arquivos.length === 0 ? <p className="p-6 text-xs text-foreground-muted">Nenhum Excel operacional foi gerado.</p> : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {arquivos.map(arquivo => (
              <article key={arquivo.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><strong className="truncate text-xs">{arquivo.nome_arquivo}</strong><span className="border px-2 py-0.5 text-[8px] font-black uppercase" style={{ borderColor: 'var(--border)' }}>{arquivo.status.replaceAll('_', ' ')}</span></div>
                  <p className="mt-1 text-[9px] text-foreground-muted">{new Date(arquivo.periodo_inicio).toLocaleDateString('pt-BR')} a {new Date(arquivo.periodo_fim).toLocaleDateString('pt-BR')} · {formatarBytes(arquivo.tamanho_bytes)} · SHA-256 {arquivo.checksum_sha256.slice(0, 12)}…</p>
                  {arquivo.confirmado_em && !arquivo.pode_purgar && !arquivo.dados_purgados_em && <p className="mt-1 text-[9px] text-foreground-muted">Protegido pelo plano até {new Date(arquivo.elegivel_purga_em).toLocaleDateString('pt-BR')}.</p>}
                  {arquivo.arquivo_removido_em && <p className="mt-1 text-[9px] text-green-500">Arquivo temporário removido; trilha permanente preservada.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!arquivo.arquivo_removido_em && <button type="button" disabled={processando} onClick={() => baixar(arquivo.id)} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-40" style={{ borderColor: 'var(--border)' }}><Download size={12} /> Baixar</button>}
                  {podeGerenciar && arquivo.status === 'DOWNLOAD_REGISTRADO' && <button type="button" disabled={processando} onClick={() => confirmar(arquivo.id)} className="flex items-center gap-1 border px-3 py-2 text-[10px] font-bold uppercase disabled:opacity-40" style={{ borderColor: primary, color: primary }}><CheckCircle2 size={12} /> Confirmar guarda</button>}
                  {podeGerenciar && arquivo.pode_purgar && <button type="button" disabled={processando} onClick={() => purgar(arquivo)} className="flex items-center gap-1 border border-red-500/50 px-3 py-2 text-[10px] font-bold uppercase text-red-500 disabled:opacity-40"><Trash2 size={12} /> Limpar detalhes</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
