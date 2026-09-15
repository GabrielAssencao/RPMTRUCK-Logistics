'use client'

import { useCallback, useEffect, useState } from 'react'
import { Download, Upload, RefreshCw, Check, FileSpreadsheet } from 'lucide-react'

interface ImportMetadata { status: string; resumo: Record<string, number>; checksum: string; motivo?: string | null }
interface ImportIssue { aba: string; linha: number; campo: string; mensagem: string }
interface ImportResponse { importacao?: ImportMetadata | null; lote?: Record<string, Record<string, unknown>[]> | null; problemas?: string[]; erro?: string; erros?: ImportIssue[] }
const STATUS: Record<string, string> = { PENDENTE: 'Aguardando revisão do superadmin', REJEITADO: 'Correções solicitadas', APROVADO: 'Importação inicial concluída' }
const LABELS: Record<string, string> = { Localizacoes: 'Localizações', Veiculos: 'Veículos', Motoristas: 'Motoristas', Custos: 'Custos', Manutencoes: 'Manutenções', Containers: 'Containers' }
const button = 'inline-flex min-h-10 items-center justify-center gap-2 border border-border px-4 py-2 text-xs font-bold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-primary'
function valor(value: unknown) { return value === null || value === undefined ? '—' : typeof value === 'boolean' ? value ? 'Sim' : 'Não' : String(value) }
async function consultarImportacao(endpoint: string, signal?: AbortSignal) {
  const response = await fetch(endpoint, { cache: 'no-store', signal })
  const body: ImportResponse = await response.json()
  if (!response.ok) throw new Error(body.erro || 'Não foi possível consultar a importação.')
  return body
}

export default function InitialDataImport({ empresaId, admin = false, onApproved }: { empresaId?: string; admin?: boolean; onApproved?: () => void }) {
  const endpoint = admin ? `/api/admin/empresas/${empresaId}/importacao-inicial` : '/api/empresa/importacao-inicial'
  const [data, setData] = useState<ImportResponse>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [feedback, setFeedback] = useState('')
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [motivo, setMotivo] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [aba, setAba] = useState('Veiculos')
  const [page, setPage] = useState(0)
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const body = await consultarImportacao(endpoint, signal)
      setData(body); setConfirm(false)
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setFeedback(error instanceof Error ? error.message : 'Falha ao carregar a importação.') }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [endpoint])
  useEffect(() => {
    const controller = new AbortController()
    void consultarImportacao(endpoint, controller.signal)
      .then(body => { if (!controller.signal.aborted) { setData(body); setConfirm(false) } })
      .catch(error => { if (!controller.signal.aborted) setFeedback(error instanceof Error ? error.message : 'Falha ao carregar a importação.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [endpoint])
  const upload = async () => {
    if (!file || busy) return
    setBusy(true); setFeedback(''); setIssues([])
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      const body: ImportResponse = await response.json()
      if (!response.ok) { setIssues(body.erros ?? []); throw new Error(body.erro || 'Não foi possível enviar a planilha.') }
      await load(); setFeedback('Planilha validada e enviada. Seus cadastros serão incluídos somente após a aprovação do superadmin.'); setFile(null)
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Falha ao enviar a planilha.') }
    finally { setBusy(false) }
  }
  const decide = async (approve: boolean) => {
    if (busy || !data.importacao || approve && !confirm) return
    setBusy(true); setFeedback('')
    try {
      const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: approve ? 'APROVAR' : 'REJEITAR', checksum: data.importacao.checksum, ...(!approve ? { motivo } : {}) }) })
      const body: ImportResponse = await response.json()
      if (!response.ok) throw new Error(body.erro || 'Não foi possível concluir a revisão.')
      await load(); setFeedback(approve ? 'Dados incluídos com sucesso. O benefício de importação inicial foi utilizado.' : 'Correções solicitadas. A empresa pode ajustar e reenviar a planilha.'); if (approve) onApproved?.()
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Falha ao revisar a planilha.') }
    finally { setBusy(false) }
  }
  const registro = data.importacao
  const canUpload = !loading && !busy && (!registro || registro.status === 'REJEITADO')
  const rows = data.lote?.[aba] ?? []
  const columns = rows.length ? Object.keys(rows[0]) : []
  return (
    <section className="space-y-5 border border-border bg-background p-4 sm:p-6" aria-label="Importação inicial de dados">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="flex items-center gap-2 font-display text-xl font-bold"><FileSpreadsheet size={20} className="text-primary" />{admin ? 'Revisar importação inicial' : 'Importar dados que já tenho'}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted">{admin ? 'Confira os registros enviados pela empresa antes de autorizar a inclusão. A aprovação usa as regras atuais do plano e não substitui cadastros existentes.' : 'Comece com seus dados organizados. Baixe o modelo, preencha e envie para revisão. Uma importação inicial aprovada está inclusa por empresa.'}</p></div>
        <button type="button" className={button} disabled={busy || loading} onClick={() => { setLoading(true); setFeedback(''); void load() }}><RefreshCw size={14} />Atualizar</button>
      </div>
      {loading ? <p role="status" className="text-sm text-foreground-muted">Consultando importação…</p> : registro ? <div className="border-l-2 border-primary pl-4"><p className="font-semibold">{STATUS[registro.status] ?? registro.status}</p><p className="mt-2 text-xs text-foreground-muted">{Object.entries(registro.resumo).map(([key, value]) => `${LABELS[key] ?? key}: ${value}`).join(' · ')}</p>{registro.motivo && <p className="mt-3 text-sm">O que corrigir: {registro.motivo}</p>}</div> : <p className="text-sm text-foreground-muted">{admin ? 'Esta empresa ainda não enviou uma planilha.' : 'Sua importação inicial está disponível.'}</p>}
      {!admin && registro?.status !== 'APROVADO' && <div className="space-y-4">
        <a href={`${endpoint}?modelo=true`} download className={button}><Download size={14} />Baixar modelo Excel</a>
        <p className="text-xs leading-relaxed text-foreground-muted">Localizações, veículos, motoristas, custos, manutenções e containers. Até 1.000 registros no total, arquivo .xlsx de até 2 MB. Consulte as instruções e exemplos no modelo. Se houver correções, você poderá reenviar sem consumir o benefício.</p>
        {registro?.status !== 'PENDENTE' && <><label className="block text-sm font-semibold">Planilha preenchida<input key={registro?.checksum ?? 'initial'} type="file" accept=".xlsx" disabled={!canUpload} onChange={event => { const selected = event.target.files?.[0] ?? null; setIssues([]); if (selected && (!/\.xlsx$/i.test(selected.name) || selected.size > 2 * 1024 * 1024)) { setFile(null); setFeedback('Escolha um arquivo .xlsx de até 2 MB.'); return }; setFeedback(''); setFile(selected) }} className="mt-2 block w-full border border-border p-3 text-xs file:mr-4 file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-contrast" /></label><button type="button" className={`${button} border-primary bg-primary text-primary-contrast`} disabled={!file || !canUpload} onClick={() => void upload()}><Upload size={14} />{busy ? 'Validando e enviando…' : 'Validar e enviar para revisão'}</button></>}
      </div>}
      {admin && data.lote && registro?.status === 'PENDENTE' && <>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Abas da planilha">{Object.keys(data.lote).map(key => <button key={key} type="button" aria-pressed={aba === key} className={`${button} ${aba === key ? 'border-primary text-primary' : ''}`} onClick={() => { setAba(key); setPage(0) }}>{LABELS[key] ?? key} ({data.lote![key].length})</button>)}</div>
        {rows.length ? <><div className="max-h-96 overflow-auto border border-border"><table className="w-full text-left text-xs"><caption className="sr-only">Registros enviados: {LABELS[aba] ?? aba}</caption><thead className="sticky top-0 bg-background-secondary"><tr>{columns.map(key => <th key={key} className="whitespace-nowrap p-3">{key}</th>)}</tr></thead><tbody>{rows.slice(page * 25, (page + 1) * 25).map((row, index) => <tr key={index} className="border-t border-border">{columns.map(key => <td key={key} className="max-w-xs break-words p-3 align-top">{valor(row[key])}</td>)}</tr>)}</tbody></table></div><div className="flex items-center gap-3 text-xs"><button type="button" className={button} disabled={!page} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(rows.length / 25)}</span><button type="button" className={button} disabled={(page + 1) * 25 >= rows.length} onClick={() => setPage(v => v + 1)}>Próxima</button></div></> : <p className="text-sm text-foreground-muted">Nenhum registro nesta aba.</p>}
        {data.problemas?.map(problem => <p key={problem} role="alert" className="border border-danger p-3 text-sm">{problem}</p>)}
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirm} disabled={busy || Boolean(data.problemas?.length)} onChange={event => setConfirm(event.target.checked)} className="mt-1" /><span>Conferi os registros e autorizo a inclusão na empresa. Esta aprovação utiliza sua única importação inicial.</span></label>
        <button type="button" className={`${button} border-primary bg-primary text-primary-contrast`} disabled={busy || !confirm || Boolean(data.problemas?.length)} onClick={() => void decide(true)}><Check size={14} />{busy ? 'Processando…' : 'Aprovar e incluir os dados'}</button>
        <div className="space-y-3 border-t border-border pt-4"><label className="block text-sm font-semibold">Orientações para correção<textarea value={motivo} onChange={event => setMotivo(event.target.value)} maxLength={500} disabled={busy} className="mt-2 block min-h-20 w-full border border-border bg-background-secondary p-3 text-sm" /></label><button type="button" className={button} disabled={busy || motivo.trim().length < 5} onClick={() => void decide(false)}>Solicitar correções à empresa</button></div>
      </>}
      {feedback && <p role="status" className="border border-border p-3 text-sm">{feedback}</p>}
      {issues.length > 0 && <div className="max-h-80 overflow-auto"><table className="w-full text-left text-xs"><caption className="mb-2 text-left font-semibold">Campos a corrigir (até 100 avisos)</caption><thead><tr>{['Aba', 'Linha', 'Campo', 'Orientação'].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{issues.map((issue, index) => <tr key={index} className="border-t border-border"><td className="p-2">{LABELS[issue.aba] ?? issue.aba}</td><td className="p-2">{issue.linha}</td><td className="p-2">{issue.campo}</td><td className="p-2">{issue.mensagem}</td></tr>)}</tbody></table></div>}
    </section>
  )
}
