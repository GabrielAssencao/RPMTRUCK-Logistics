'use client'

import { useEffect, useState } from 'react'
import { FileText, ReceiptText } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface ContaArquivo {
  id: string
  descricao: string
  fornecedor: string | null
  vencimento: string
  valor: number
  status: 'PENDENTE' | 'PAGO' | 'CANCELADO'
  possuiBoleto: boolean
  boletoNome: string | null
  possuiComprovante: boolean
  comprovanteNome: string | null
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ArquivosContasPagar({ limite = 50 }: { limite?: number }) {
  const { primary } = useTheme()
  const [contas, setContas] = useState<ContaArquivo[]>([])
  const [indisponivel, setIndisponivel] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/contas-pagar', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (response.status === 403) {
          setIndisponivel(true)
          return null
        }
        const data = await response.json()
        if (!response.ok) throw new Error(data.erro || 'Não foi possível carregar os documentos financeiros.')
        return data
      })
      .then((data) => { if (data) setContas(data.contas ?? []) })
      .catch((error) => { if (!controller.signal.aborted) setFeedback(error instanceof Error ? error.message : 'Falha ao carregar documentos.') })
      .finally(() => { if (!controller.signal.aborted) setCarregando(false) })
    return () => controller.abort()
  }, [])

  const abrirArquivo = async (contaId: string, tipo: 'boleto' | 'comprovante') => {
    setFeedback('')
    const response = await fetch(`/api/contas-pagar/${contaId}/arquivo?tipo=${tipo}`, { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) return setFeedback(data.erro || 'Não foi possível abrir o arquivo.')
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  if (indisponivel) return null
  const comArquivos = contas.filter((conta) => conta.possuiBoleto || conta.possuiComprovante).slice(0, limite)

  return (
    <section className="border" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--background-secondary)' }}>
      <div className="border-b p-4" style={{ borderColor: 'var(--border)' }}><h2 className="text-xs font-black uppercase tracking-widest">Boletos e comprovantes privados</h2><p className="mt-1 text-[10px] text-foreground-muted">Histórico financeiro referenciado no banco e liberado por URL assinada temporária.</p></div>
      {feedback && <p role="status" className="border-b p-3 text-xs text-red-500" style={{ borderColor: 'var(--border)' }}>{feedback}</p>}
      {carregando ? <p className="p-6 text-xs text-foreground-muted">Carregando documentos financeiros...</p> : comArquivos.length === 0 ? <p className="p-6 text-xs text-foreground-muted">Nenhum boleto ou comprovante armazenado.</p> : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>{comArquivos.map((conta) => <article key={conta.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-xs font-bold uppercase">{conta.descricao}</p><p className="mt-1 text-[9px] text-foreground-muted">{conta.fornecedor || 'Fornecedor não informado'} · {new Date(`${conta.vencimento}T12:00:00`).toLocaleDateString('pt-BR')} · {moeda.format(conta.valor)} · {conta.status}</p></div><div className="flex flex-wrap gap-2">{conta.possuiBoleto && <button type="button" onClick={() => void abrirArquivo(conta.id, 'boleto')} className="flex min-h-10 items-center gap-2 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: primary, color: primary }}><FileText size={13} /> Boleto</button>}{conta.possuiComprovante && <button type="button" onClick={() => void abrirArquivo(conta.id, 'comprovante')} className="flex min-h-10 items-center gap-2 border px-3 text-[10px] font-bold uppercase" style={{ borderColor: 'var(--border)' }}><ReceiptText size={13} /> Comprovante</button>}</div></article>)}</div>
      )}
    </section>
  )
}
