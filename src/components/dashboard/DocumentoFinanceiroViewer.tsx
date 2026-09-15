'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, FileText, X } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

export interface DocumentoFinanceiro {
  contaId: string
  tipo: 'boleto' | 'comprovante'
  nome: string
  url: string
}

export default function DocumentoFinanceiroViewer({ documento, onClose }: { documento: DocumentoFinanceiro; onClose: () => void }) {
  const { primary } = useTheme()
  const [carregado, setCarregado] = useState(false)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const endpoint = `/api/contas-pagar/${documento.contaId}/arquivo?tipo=${documento.tipo}`

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    fecharRef.current?.focus()
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', fecharComEscape)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', fecharComEscape)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="documento-financeiro-titulo" className="flex h-[96dvh] w-full flex-col overflow-hidden border sm:h-[90dvh] sm:max-w-5xl" style={{ borderColor: `${primary}80`, backgroundColor: 'var(--background)' }}>
        <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: primary }}><FileText size={14} /> Documento privado</p>
            <h2 id="documento-financeiro-titulo" className="mt-1 truncate font-rajdhani text-lg font-black uppercase sm:text-xl">{documento.nome}</h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={`${endpoint}&modo=baixar`} className="flex min-h-10 items-center gap-2 border px-3 text-[10px] font-black uppercase" style={{ borderColor: primary, color: primary }}><Download size={14} /> Baixar</a>
            <a href={`${endpoint}&modo=visualizar`} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-2 border px-3 text-[10px] font-black uppercase" style={{ borderColor: 'var(--border)' }}><ExternalLink size={14} /> Nova aba</a>
            <button ref={fecharRef} type="button" onClick={onClose} aria-label="Fechar visualização do documento" className="min-h-10 min-w-10 border" style={{ borderColor: 'var(--border)' }}><X size={17} className="mx-auto" /></button>
          </div>
        </header>
        <div className="relative min-h-0 flex-1" style={{ backgroundColor: 'var(--background-secondary)' }}>
          {!carregado && <div role="status" className="absolute inset-0 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-foreground-muted">Carregando documento...</div>}
          <iframe src={documento.url} title={`Visualização de ${documento.nome}`} onLoad={() => setCarregado(true)} className="relative h-full w-full border-0" />
        </div>
        <p className="border-t px-4 py-2 text-[9px] text-foreground-muted" style={{ borderColor: 'var(--border)' }}>A visualização usa um acesso temporário. Se o documento não aparecer, feche e abra novamente para gerar um novo acesso.</p>
      </section>
    </div>
  )
}
